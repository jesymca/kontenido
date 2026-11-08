import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPresignedUploadUrl, BUCKETS } from "@/lib/r2";

/**
 * Endpoint para obtener una URL prefirmada de subida directa a Cloudflare R2
 * Permite que el frontend suba fotos/videos pesados sin sobrecargar las Serverless Functions de Vercel.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { filename, contentType, sizeBytes, category } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Nombre y tipo de archivo requeridos" }, { status: 400 });
    }

    // Validar tipo MIME permitido
    const isImage = contentType.startsWith("image/");
    const isVideo = contentType.startsWith("video/");

    if (!isImage && !isVideo && contentType !== "application/pdf") {
      return NextResponse.json({ error: "Formato no permitido. Solo imágenes, videos o PDF." }, { status: 400 });
    }

    // Validar límites de peso (15MB para fotos, 500MB para videos)
    if (isImage && sizeBytes > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Las imágenes no pueden superar los 15MB" }, { status: 400 });
    }

    if (isVideo && sizeBytes > 500 * 1024 * 1024) {
      return NextResponse.json({ error: "Los videos no pueden superar los 500MB" }, { status: 400 });
    }

    const userId = session.user.id;
    const fileExt = filename.split(".").pop()?.toLowerCase() || (isImage ? "jpg" : "mp4");
    const uniqueId = crypto.randomUUID();

    // Estructura de carpetas obligatoria según docs/01_STACK_Y_ARQUITECTURA.md
    let key = "";
    let bucket = BUCKETS.MEDIA;

    if (category === "avatar") {
      key = `creators/${userId}/avatar/${uniqueId}.${fileExt}`;
    } else if (category === "banner") {
      key = `creators/${userId}/banner/${uniqueId}.${fileExt}`;
    } else if (category === "kyc") {
      bucket = BUCKETS.PRIVATE;
      key = `creators/${userId}/kyc/${uniqueId}/${filename}`;
    } else {
      key = `creators/${userId}/posts/${uniqueId}/original/${filename}`;
    }

    const uploadUrl = await getPresignedUploadUrl(bucket, key, contentType, 900);

    return NextResponse.json({
      success: true,
      uploadUrl,
      key,
      bucket,
    });
  } catch (err: any) {
    console.error("Error generando URL prefirmada:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
