import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isR2Configured, uploadBufferToR2 } from "@/lib/r2";
import { resolveUploadTarget } from "@/lib/r2/uploads";

export const dynamic = "force-dynamic";

const MAX_DIRECT_FALLBACK_BYTES = 4.3 * 1024 * 1024;

/**
 * Endpoint same-origin de respaldo para subir archivos a Cloudflare R2 desde el servidor.
 * Se utiliza automáticamente cuando la subida directa del navegador a R2 falla por CORS,
 * bloqueadores, restricciones de red móvil o dominios preview.
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

    const formData = await req.formData();
    const file = formData.get("file");
    const category = (formData.get("category") as string) || "post";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    if (file.size > MAX_DIRECT_FALLBACK_BYTES) {
      return NextResponse.json(
        {
          error:
            "El archivo supera el límite de respaldo directo (4.3MB). Verifica CORS en Cloudflare R2 o reduce el tamaño del archivo.",
        },
        { status: 413 }
      );
    }

    const resolved = resolveUploadTarget({
      userId: session.user.id,
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      category,
    });

    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const { bucket, key, contentType } = resolved.target;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await uploadBufferToR2(bucket, key, buffer, contentType);

    return NextResponse.json({
      success: true,
      key,
      bucket,
      contentType,
      sizeBytes: file.size,
    });
  } catch (err: any) {
    console.error("Error en subida directa a R2 desde servidor:", err);
    return NextResponse.json(
      { error: err?.message || "Error subiendo archivo al almacenamiento." },
      { status: 500 }
    );
  }
}
