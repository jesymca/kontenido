import { compressImageFileForFallback } from "@/lib/watermarkClient";

export type UploadCategory = "post" | "avatar" | "banner" | "chat" | "komestible" | "kyc";

export interface UploadedR2File {
  key: string;
  mimeType: string;
  sizeBytes: number;
}

const DIRECT_FALLBACK_MAX_BYTES = 4 * 1024 * 1024;

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

async function uploadViaDirectFallback(
  file: File,
  category: UploadCategory
): Promise<UploadedR2File> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("category", category);

  let res: Response;
  try {
    res = await fetch("/api/uploads/direct", {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      "No se pudo conectar con el servidor para subir el archivo. Verifica tu conexión a internet e inténtalo de nuevo."
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
    mimeType: data.contentType || resolveClientMimeType(file),
    sizeBytes: data.sizeBytes || file.size,
  };
}

/**
 * Sube un archivo a Cloudflare R2 intentando primero subida directa por URL prefirmada
 * y cayendo automáticamente al endpoint same-origin (/api/uploads/direct) si el navegador,
 * red, adblocker o configuración CORS bloquean la petición PUT directa a R2.
 */
export async function uploadFileToR2(
  file: File,
  category: UploadCategory
): Promise<UploadedR2File> {
  const contentType = resolveClientMimeType(file);

  let presignedRes: Response;
  try {
    presignedRes = await fetch("/api/uploads/presigned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name || `archivo_${Date.now()}`,
        contentType,
        sizeBytes: file.size,
        category,
      }),
    });
  } catch {
    throw new Error(
      "No se pudo conectar con el servidor para iniciar la subida. Verifica tu conexión a internet e inténtalo de nuevo."
    );
  }

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
  let directErrorMessage = "";

  try {
    const putRes = await fetch(presignedData.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": effectiveMime },
    });

    if (putRes.ok) {
      return {
        key: presignedData.key,
        mimeType: effectiveMime,
        sizeBytes: file.size,
      };
    }

    directErrorMessage = `Cloudflare R2 rechazó la subida (HTTP ${putRes.status}).`;
  } catch (err: any) {
    directErrorMessage = err?.message || "Error de red o CORS al subir a Cloudflare R2.";
  }

  // Respaldo automático same-origin para archivos <= 4MB o imágenes comprimibles
  if (file.size <= DIRECT_FALLBACK_MAX_BYTES) {
    return uploadViaDirectFallback(file, category);
  }

  if (effectiveMime.startsWith("image/")) {
    const compressed = await compressImageFileForFallback(file, 3.8 * 1024 * 1024);
    if (compressed) {
      return uploadViaDirectFallback(compressed, category);
    }
  }

  throw new Error(
    `No se pudo completar la subida directa a Cloudflare R2 (${directErrorMessage}). Verifica tu conexión o la configuración CORS del bucket.`
  );
}
