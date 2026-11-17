import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPresignedUploadUrl, isR2Configured } from "@/lib/r2";
import { resolveUploadTarget } from "@/lib/r2/uploads";

/**
 * Endpoint para obtener una URL prefirmada de subida directa a Cloudflare R2.
 * Permite que el frontend suba fotos/videos pesados sin sobrecargar las Serverless Functions.
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

    const body = await req.json();
    const resolved = resolveUploadTarget({
      userId: session.user.id,
      filename: body?.filename,
      contentType: body?.contentType,
      sizeBytes: Number(body?.sizeBytes) || 0,
      category: body?.category,
    });

    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const { bucket, key, contentType } = resolved.target;
    const uploadUrl = await getPresignedUploadUrl(bucket, key, contentType, 900);

    return NextResponse.json({
      success: true,
      uploadUrl,
      key,
      bucket,
      contentType,
    });
  } catch (err: any) {
    console.error("Error generando URL prefirmada:", err);
    return NextResponse.json(
      { error: err?.message || "Error generando URL prefirmada" },
      { status: 500 }
    );
  }
}
