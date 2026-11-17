import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  BUCKETS,
  isR2Configured,
  uploadBufferToR2,
  getBufferFromR2,
  deleteObjectFromR2,
  createMultipartUploadInR2,
  uploadPartToR2,
  completeMultipartUploadInR2,
  abortMultipartUploadInR2,
} from "@/lib/r2";
import { resolveUploadTarget } from "@/lib/r2/uploads";

export const dynamic = "force-dynamic";

const MAX_SINGLE_SLICE_BYTES = 4.2 * 1024 * 1024;

function isAuthorizedUserKey(userId: string, key: string): boolean {
  return (
    key.startsWith(`creators/${userId}/`) ||
    key.startsWith(`komestible/${userId}/`)
  );
}

function resolveAllowedBucket(rawBucket?: string | null): string {
  if (rawBucket === BUCKETS.PRIVATE) return BUCKETS.PRIVATE;
  return BUCKETS.MEDIA;
}

/**
 * Endpoint same-origin para subir archivos a Cloudflare R2 desde el servidor:
 * - action="single" (o FormData): sube archivos <= 2.5 MiB en una sola petición binaria.
 * - action="init" / "chunk" / "complete": sube archivos pesados (> 2.5 MiB hasta 500 MB)
 *   en fragmentos binarios de 2.5 MiB ensamblando partes Multipart de 5 MiB en R2,
 *   evitando el límite de 4.5 MB por petición de Vercel y cualquier bloqueo CORS.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "Almacenamiento Cloudflare R2 no configurado en el servidor." },
        { status: 500 }
      );
    }

    const userId = session.user.id;
    const action = (req.headers.get("x-upload-action") || "single").toLowerCase();

    if (action === "init") {
      const body = await req.json();
      const resolved = resolveUploadTarget({
        userId,
        filename: body?.filename,
        contentType: body?.contentType,
        sizeBytes: Number(body?.sizeBytes) || 0,
        category: body?.category,
      });

      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
      }

      const { bucket, key, contentType } = resolved.target;
      const uploadId = await createMultipartUploadInR2(bucket, key, contentType);

      return NextResponse.json({
        success: true,
        uploadId,
        key,
        bucket,
        contentType,
      });
    }

    if (action === "chunk") {
      const uploadId = (req.headers.get("x-upload-id") || "").trim();
      const key = decodeURIComponent(req.headers.get("x-upload-key") || "");
      const bucket = resolveAllowedBucket(req.headers.get("x-upload-bucket"));
      const partNumber = parseInt(req.headers.get("x-upload-part-number") || "1", 10);
      const subIndex = parseInt(req.headers.get("x-upload-sub-index") || "0", 10);
      const isLastSlice = req.headers.get("x-upload-is-last-slice") === "1";

      if (!uploadId || !key || !isAuthorizedUserKey(userId, key) || partNumber < 1) {
        return NextResponse.json(
          { error: "Parámetros de fragmento inválidos o no autorizados." },
          { status: 400 }
        );
      }

      const arrayBuffer = await req.arrayBuffer();
      const sliceBuffer = Buffer.from(arrayBuffer);

      if (sliceBuffer.length === 0 || sliceBuffer.length > MAX_SINGLE_SLICE_BYTES) {
        return NextResponse.json(
          { error: "Tamaño de fragmento fuera de rango." },
          { status: 400 }
        );
      }

      const tempKey = `temp_chunks/${userId}/${uploadId.replace(/[^a-zA-Z0-9_-]/g, "")}_${partNumber}`;

      if (subIndex === 0) {
        if (isLastSlice) {
          const part = await uploadPartToR2(bucket, key, uploadId, partNumber, sliceBuffer);
          return NextResponse.json({ success: true, part });
        }

        await uploadBufferToR2(bucket, tempKey, sliceBuffer, "application/octet-stream");
        return NextResponse.json({ success: true, staged: true });
      }

      const firstHalf = await getBufferFromR2(bucket, tempKey);
      const combined = Buffer.concat([firstHalf, sliceBuffer]);
      const part = await uploadPartToR2(bucket, key, uploadId, partNumber, combined);
      await deleteObjectFromR2(bucket, tempKey).catch(() => {});

      return NextResponse.json({ success: true, part });
    }

    if (action === "complete") {
      const body = await req.json();
      const uploadId = (body?.uploadId || "").trim();
      const key = (body?.key || "").trim();
      const bucket = resolveAllowedBucket(body?.bucket);
      const parts = Array.isArray(body?.parts) ? body.parts : [];

      if (!uploadId || !key || !isAuthorizedUserKey(userId, key) || parts.length === 0) {
        return NextResponse.json(
          { error: "Datos incompletos para finalizar la subida." },
          { status: 400 }
        );
      }

      await completeMultipartUploadInR2(bucket, key, uploadId, parts);

      return NextResponse.json({
        success: true,
        key,
        bucket,
        contentType: body?.contentType || "application/octet-stream",
        sizeBytes: Number(body?.sizeBytes) || 0,
      });
    }

    if (action === "abort") {
      const body = await req.json().catch(() => ({}));
      const uploadId = (body?.uploadId || "").trim();
      const key = (body?.key || "").trim();
      const bucket = resolveAllowedBucket(body?.bucket);
      if (uploadId && key && isAuthorizedUserKey(userId, key)) {
        await abortMultipartUploadInR2(bucket, key, uploadId);
      }
      return NextResponse.json({ success: true });
    }

    // Modo "single": soporta tanto binario crudo con cabeceras como multipart/form-data
    const reqContentType = (req.headers.get("content-type") || "").toLowerCase();
    let filename = "";
    let fileMime = "";
    let category = "post";
    let buffer: Buffer;

    if (reqContentType.startsWith("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      category = (formData.get("category") as string) || "post";
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
      }
      filename = file.name;
      fileMime = file.type;
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      filename = decodeURIComponent(req.headers.get("x-upload-filename") || `archivo_${Date.now()}`);
      fileMime = req.headers.get("x-upload-content-type") || reqContentType;
      category = req.headers.get("x-upload-category") || "post";
      buffer = Buffer.from(await req.arrayBuffer());
    }

    if (buffer.length === 0) {
      return NextResponse.json({ error: "El archivo está vacío." }, { status: 400 });
    }

    if (buffer.length > MAX_SINGLE_SLICE_BYTES) {
      return NextResponse.json(
        { error: "El archivo requiere subida fragmentada." },
        { status: 413 }
      );
    }

    const resolved = resolveUploadTarget({
      userId,
      filename,
      contentType: fileMime,
      sizeBytes: buffer.length,
      category,
    });

    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const { bucket, key, contentType } = resolved.target;
    await uploadBufferToR2(bucket, key, buffer, contentType);

    return NextResponse.json({
      success: true,
      key,
      bucket,
      contentType,
      sizeBytes: buffer.length,
    });
  } catch (err: any) {
    console.error("Error en subida a R2 desde servidor:", err);
    return NextResponse.json(
      { error: err?.message || "Error subiendo archivo al almacenamiento." },
      { status: 500 }
    );
  }
}
