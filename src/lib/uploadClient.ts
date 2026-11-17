export type UploadCategory = "post" | "avatar" | "banner" | "chat" | "komestible" | "kyc";

export interface UploadedR2File {
  key: string;
  mimeType: string;
  sizeBytes: number;
}

const SLICE_SIZE_BYTES = 2.5 * 1024 * 1024; // 2.5 MiB (2 fragmentos = 5.0 MiB exactos para S3 Multipart)

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  "3gp": "video/3gpp",
  pdf: "application/pdf",
};

export function resolveClientMimeType(file: File): string {
  const base = (file.type || "").split(";")[0].trim().toLowerCase();
  if (base && base !== "application/octet-stream") {
    return base;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return EXT_TO_MIME[ext] || "image/jpeg";
}

/**
 * Copia inmediatamente los bytes de un File seleccionado en memoria RAM (ArrayBuffer -> File)
 * para evitar que el navegador móvil o el reseteo del <input type="file"> invaliden la referencia.
 */
export async function cloneFileIntoMemory(file: File): Promise<File> {
  const mime = resolveClientMimeType(file);
  try {
    const buffer = await file.arrayBuffer();
    return new File([buffer], file.name || `archivo_${Date.now()}`, {
      type: mime,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

async function fetchWithRetry(
  input: string,
  init: RequestInit,
  retries = 2
): Promise<Response> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Sube un archivo <= 2.5 MiB en una sola petición binaria same-origin (/api/uploads/direct)
 */
async function uploadSingleViaServer(
  fileBytes: ArrayBuffer,
  filename: string,
  contentType: string,
  category: UploadCategory
): Promise<UploadedR2File> {
  const blob = new Blob([fileBytes], { type: contentType });

  let res: Response;
  try {
    res = await fetchWithRetry("/api/uploads/direct", {
      method: "POST",
      headers: {
        "x-upload-action": "single",
        "x-upload-filename": encodeURIComponent(filename),
        "x-upload-category": category,
        "x-upload-content-type": contentType,
        "Content-Type": "application/octet-stream",
      },
      body: blob,
    });
  } catch (err: any) {
    throw new Error(
      `Error de red al enviar el archivo (${err?.message || "conexión interrumpida"}).`
    );
  }

  if (res.status === 401 || res.redirected) {
    throw new Error("Tu sesión expiró. Recarga la página e inicia sesión nuevamente.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success || !data?.key) {
    throw new Error(
      data?.error || `El servidor rechazó la subida del archivo (HTTP ${res.status}).`
    );
  }

  return {
    key: data.key,
    mimeType: data.contentType || contentType,
    sizeBytes: data.sizeBytes || fileBytes.byteLength,
  };
}

/**
 * Sube archivos pesados (> 2.5 MiB hasta 500 MB) en fragmentos binarios de 2.5 MiB
 * a través de /api/uploads/direct ensamblando partes Multipart de 5 MiB en Cloudflare R2.
 */
async function uploadChunkedViaServer(
  fileBytes: ArrayBuffer,
  filename: string,
  contentType: string,
  category: UploadCategory
): Promise<UploadedR2File> {
  let initRes: Response;
  try {
    initRes = await fetchWithRetry("/api/uploads/direct", {
      method: "POST",
      headers: {
        "x-upload-action": "init",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename,
        contentType,
        sizeBytes: fileBytes.byteLength,
        category,
      }),
    });
  } catch (err: any) {
    throw new Error(
      `No se pudo inicializar la subida fragmentada (${err?.message || "error de red"}).`
    );
  }

  if (initRes.status === 401 || initRes.redirected) {
    throw new Error("Tu sesión expiró. Recarga la página e inicia sesión nuevamente.");
  }

  const initData = await initRes.json().catch(() => null);
  if (!initRes.ok || !initData?.success || !initData?.uploadId || !initData?.key) {
    throw new Error(
      initData?.error || `No se pudo iniciar la subida fragmentada (HTTP ${initRes.status}).`
    );
  }

  const { uploadId, key, bucket, contentType: effectiveMime } = initData;
  const totalSlices = Math.ceil(fileBytes.byteLength / SLICE_SIZE_BYTES);
  const parts: Array<{ ETag: string; PartNumber: number }> = [];

  try {
    for (let sliceIdx = 0; sliceIdx < totalSlices; sliceIdx++) {
      const start = sliceIdx * SLICE_SIZE_BYTES;
      const end = Math.min(start + SLICE_SIZE_BYTES, fileBytes.byteLength);
      const sliceBlob = new Blob([fileBytes.slice(start, end)], {
        type: "application/octet-stream",
      });

      const partNumber = Math.floor(sliceIdx / 2) + 1;
      const subIndex = sliceIdx % 2;
      const isLastSlice = sliceIdx === totalSlices - 1;

      const chunkRes = await fetchWithRetry("/api/uploads/direct", {
        method: "POST",
        headers: {
          "x-upload-action": "chunk",
          "x-upload-id": uploadId,
          "x-upload-key": encodeURIComponent(key),
          "x-upload-bucket": bucket,
          "x-upload-part-number": String(partNumber),
          "x-upload-sub-index": String(subIndex),
          "x-upload-is-last-slice": isLastSlice ? "1" : "0",
          "Content-Type": "application/octet-stream",
        },
        body: sliceBlob,
      });

      const chunkData = await chunkRes.json().catch(() => null);
      if (!chunkRes.ok || !chunkData?.success) {
        throw new Error(
          chunkData?.error ||
            `Error subiendo fragmento ${sliceIdx + 1}/${totalSlices} (HTTP ${chunkRes.status}).`
        );
      }

      if (chunkData.part?.ETag && chunkData.part?.PartNumber) {
        parts.push({
          ETag: chunkData.part.ETag,
          PartNumber: chunkData.part.PartNumber,
        });
      }
    }

    const completeRes = await fetchWithRetry("/api/uploads/direct", {
      method: "POST",
      headers: {
        "x-upload-action": "complete",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucket,
        key,
        uploadId,
        parts,
        contentType: effectiveMime || contentType,
        sizeBytes: fileBytes.byteLength,
      }),
    });

    const completeData = await completeRes.json().catch(() => null);
    if (!completeRes.ok || !completeData?.success) {
      throw new Error(
        completeData?.error ||
          `Error finalizando subida multiparte (HTTP ${completeRes.status}).`
      );
    }

    return {
      key,
      mimeType: effectiveMime || contentType,
      sizeBytes: fileBytes.byteLength,
    };
  } catch (err) {
    fetch("/api/uploads/direct", {
      method: "POST",
      headers: {
        "x-upload-action": "abort",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucket, key, uploadId }),
    }).catch(() => {});
    throw err;
  }
}

/**
 * Intenta subida directa con URL prefirmada a Cloudflare R2
 */
async function uploadDirectPresignedToR2(
  fileBytes: ArrayBuffer,
  filename: string,
  contentType: string,
  category: UploadCategory
): Promise<UploadedR2File> {
  const presignedRes = await fetchWithRetry("/api/uploads/presigned", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename,
      contentType,
      sizeBytes: fileBytes.byteLength,
      category,
    }),
  });

  if (presignedRes.status === 401 || presignedRes.redirected) {
    throw new Error("Tu sesión expiró. Recarga la página e inicia sesión nuevamente.");
  }

  const presignedData = await presignedRes.json().catch(() => null);
  if (!presignedRes.ok || !presignedData?.success || !presignedData?.uploadUrl) {
    throw new Error(
      presignedData?.error ||
        `No se pudo autorizar la subida del archivo (HTTP ${presignedRes.status}).`
    );
  }

  const effectiveMime = presignedData.contentType || contentType;
  const blob = new Blob([fileBytes], { type: effectiveMime });

  const putRes = await fetch(presignedData.uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": effectiveMime },
  });

  if (!putRes.ok) {
    throw new Error(`Cloudflare R2 rechazó la subida directa (HTTP ${putRes.status}).`);
  }

  return {
    key: presignedData.key,
    mimeType: effectiveMime,
    sizeBytes: fileBytes.byteLength,
  };
}

/**
 * Sube un archivo a Cloudflare R2 garantizando compatibilidad para cualquier tamaño:
 * - Archivos <= 2.5 MiB: subida directa same-origin (/api/uploads/direct) sin depender de CORS en R2.
 * - Archivos > 2.5 MiB (hasta 500 MB): intenta URL prefirmada directa a R2 y, si falla por red/CORS,
 *   sube automáticamente en fragmentos de 2.5 MiB vía /api/uploads/direct (Multipart en R2).
 */
export async function uploadFileToR2(
  file: File,
  category: UploadCategory
): Promise<UploadedR2File> {
  const contentType = resolveClientMimeType(file);
  const filename = file.name || `archivo_${Date.now()}`;

  let fileBytes: ArrayBuffer;
  try {
    fileBytes = await file.arrayBuffer();
  } catch {
    throw new Error(
      "No se pudo leer el archivo seleccionado en tu dispositivo. Por favor vuelve a seleccionarlo desde tu galería."
    );
  }

  if (fileBytes.byteLength === 0) {
    throw new Error("El archivo seleccionado está vacío.");
  }

  // 1. Para archivos <= 2.5 MiB (la mayoría de fotos firmadas y clips cortos),
  // subir directo por same-origin (/api/uploads/direct) evita bloqueos CORS/ISP hacia r2.cloudflarestorage.com
  if (fileBytes.byteLength <= SLICE_SIZE_BYTES) {
    try {
      return await uploadSingleViaServer(fileBytes, filename, contentType, category);
    } catch (serverErr: any) {
      if (serverErr?.message?.includes("sesión expiró")) {
        throw serverErr;
      }
      // Si falló por cualquier motivo transitorio, intentar por URL prefirmada a R2
      try {
        return await uploadDirectPresignedToR2(fileBytes, filename, contentType, category);
      } catch {
        throw serverErr;
      }
    }
  }

  // 2. Para archivos > 2.5 MiB (fotos muy pesadas o videos de hasta 500 MB):
  // subir en fragmentos de 2.5 MiB por same-origin (/api/uploads/direct -> Multipart en R2)
  // evitando el límite de 4.5 MB de Vercel y cualquier bloqueo CORS/ISP hacia r2.cloudflarestorage.com
  try {
    return await uploadChunkedViaServer(fileBytes, filename, contentType, category);
  } catch (chunkErr: any) {
    if (
      chunkErr?.message?.includes("sesión expiró") ||
      chunkErr?.message?.includes("superar los") ||
      chunkErr?.message?.includes("Formato no permitido")
    ) {
      throw chunkErr;
    }
    try {
      return await uploadDirectPresignedToR2(fileBytes, filename, contentType, category);
    } catch {
      throw chunkErr;
    }
  }
}
