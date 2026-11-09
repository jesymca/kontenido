import { NextRequest, NextResponse } from "next/server";
import { getPresignedDownloadUrl, BUCKETS, s3Client } from "@/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

/**
 * Endpoint para servir imágenes y medios almacenados en Cloudflare R2
 * GET /api/media/{key...}
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    // Tomar la ruta completa de la URL después de /api/media/
    const url = new URL(req.url);
    const key = url.pathname.replace(/^\/api\/media\//, "");

    if (!key) {
      return NextResponse.json({ error: "Clave de archivo no proporcionada" }, { status: 400 });
    }

    const command = new GetObjectCommand({
      Bucket: BUCKETS.MEDIA,
      Key: decodeURIComponent(key),
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    const headers = new Headers();
    if (response.ContentType) {
      headers.set("Content-Type", response.ContentType);
    }
    if (response.ContentLength) {
      headers.set("Content-Length", response.ContentLength.toString());
    }
    headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");

    // Convertir el stream de AWS S3 en un stream web estándar de Node
    const webStream = response.Body.transformToWebStream();
    return new NextResponse(webStream, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }
    console.error("Error al servir medio desde R2:", err);
    return NextResponse.json({ error: "Error al recuperar archivo" }, { status: 500 });
  }
}
