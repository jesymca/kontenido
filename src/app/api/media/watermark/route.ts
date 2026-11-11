import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { s3Client, BUCKETS, uploadBufferToR2 } from "@/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { signImageBufferWithSharp, signVideoWithFfmpeg } from "@/lib/watermarkServer";
import fs from "fs/promises";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

/**
 * Endpoint de firmado de contenido en el servidor
 * POST /api/media/watermark
 * Permite firmar o refirmar cualquier fotografía o video con la URL de la creadora:
 * https://www.kontenido.online/{usuario}
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { key, username, type } = await req.json();

    if (!key || !username) {
      return NextResponse.json(
        { error: "Parámetros key y username requeridos" },
        { status: 400 }
      );
    }

    // 1. Descargar objeto original de R2
    const getCommand = new GetObjectCommand({
      Bucket: BUCKETS.MEDIA,
      Key: key,
    });

    const response = await s3Client.send(getCommand);
    if (!response.Body) {
      return NextResponse.json({ error: "Archivo original no encontrado en R2" }, { status: 404 });
    }

    const byteArray = await response.Body.transformToByteArray();
    const originalBuffer = Buffer.from(byteArray);

    const isVideo = type === "VIDEO" || key.endsWith(".mp4") || key.endsWith(".webm");

    if (!isVideo) {
      // 2. Firmar imagen con Sharp (auto-orienta por EXIF para preservar fotos verticales)
      const signedBuffer = await signImageBufferWithSharp(originalBuffer, username);

      // Guardar de vuelta en R2
      await uploadBufferToR2(
        BUCKETS.MEDIA,
        key,
        signedBuffer,
        response.ContentType || "image/jpeg"
      );

      return NextResponse.json({
        success: true,
        message: `Foto firmada con éxito para https://www.kontenido.online/${username}`,
        key,
      });
    } else {
      // 3. Firmar video con FFmpeg conservando orientación vertical/horizontal nativa
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kontenido-video-"));
      const inputPath = path.join(tempDir, "input_video.mp4");
      const outputPath = path.join(tempDir, "output_signed.mp4");

      try {
        await fs.writeFile(inputPath, originalBuffer);
        await signVideoWithFfmpeg(inputPath, outputPath, username);

        const signedVideoBuffer = await fs.readFile(outputPath);
        await uploadBufferToR2(
          BUCKETS.MEDIA,
          key,
          signedVideoBuffer,
          response.ContentType || "video/mp4"
        );

        return NextResponse.json({
          success: true,
          message: `Video firmado con éxito para https://www.kontenido.online/${username}`,
          key,
        });
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  } catch (err: any) {
    console.error("Error en API de firmado de medios:", err);
    return NextResponse.json({ error: err.message || "Error procesando firmado" }, { status: 500 });
  }
}
