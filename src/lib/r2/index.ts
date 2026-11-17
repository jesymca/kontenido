import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cliente de Cloudflare R2 utilizando la API compatible con Amazon S3.
 * Configuración estricta para KONTENIDO:
 * - Bucket de medios: 'kontenido-media'
 * - Bucket privado: 'kontenido-private'
 */
const rawEndpoint = process.env.R2_ENDPOINT?.trim().replace(/\/+$/, "");
const rawAccountId = process.env.R2_ACCOUNT_ID?.trim();
const endpoint =
  rawEndpoint ||
  (rawAccountId ? `https://${rawAccountId}.r2.cloudflarestorage.com` : undefined);

const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || "";

export function isR2Configured(): boolean {
  return Boolean(endpoint && accessKeyId && secretAccessKey);
}

export const s3Client = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  // Evita que @aws-sdk/client-s3 >= 3.729 inyecte parámetros CRC32 en URLs prefirmadas PUT de R2
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const BUCKETS = {
  MEDIA: process.env.R2_BUCKET?.trim() || "kontenido",
  PRIVATE:
    process.env.R2_BUCKET_PRIVATE?.trim() ||
    process.env.R2_BUCKET?.trim() ||
    "kontenido",
};

/**
 * Genera una URL prefirmada para SUBIR archivos directamente a Cloudflare R2
 * evitando que los binarios pesados pasen por Vercel.
 * @param bucket Nombre del bucket ('kontenido-media' o 'kontenido-private')
 * @param key Ruta destino del archivo
 * @param contentType Tipo MIME validado (ej: 'image/jpeg', 'video/mp4')
 * @param expiresIn Tiempo de validez en segundos (por defecto 900s = 15 minutos)
 */
export async function getPresignedUploadUrl(
  bucket: string,
  key: string,
  contentType: string,
  expiresIn = 900
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Genera una URL prefirmada para DESCARGAR o VISUALIZAR archivos de Cloudflare R2
 * de forma temporal y segura.
 * Regla: TTL 60s para previews (prevenir enlaces compartidos no autorizados),
 * 15min para archivos comprados.
 * @param bucket Nombre del bucket
 * @param key Ruta del archivo en R2
 * @param expiresIn Duración de la URL en segundos
 */
export async function getPresignedDownloadUrl(
  bucket: string,
  key: string,
  expiresIn = 60
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Copia un objeto dentro de R2.
 * Usado OBLIGATORIAMENTE cuando un creador elimina contenido:
 * se traslada a la carpeta de respaldo permanente antes de desasociarlo de la vista pública.
 */
export async function copyObjectInR2(
  sourceBucket: string,
  sourceKey: string,
  targetBucket: string,
  targetKey: string
): Promise<void> {
  const command = new CopyObjectCommand({
    CopySource: `${sourceBucket}/${encodeURIComponent(sourceKey)}`,
    Bucket: targetBucket,
    Key: targetKey,
  });

  await s3Client.send(command);
}

/**
 * Elimina un objeto de R2 (solo para archivos temporales o limpieza de KYC tras 90 días)
 */
export async function deleteObjectFromR2(bucket: string, key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Sube directamente un Buffer a R2 desde el servidor
 * Utilizado para:
 * 1. Miniaturas con blur/marca de agua generadas con Sharp.
 * 2. Contratos PDF generados al registrarse una creadora.
 */
export async function uploadBufferToR2(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
}

/**
 * Descarga un objeto de R2 como Buffer en memoria
 */
export async function getBufferFromR2(bucket: string, key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const res = await s3Client.send(command);
  if (!res.Body) {
    throw new Error("Objeto no encontrado en R2");
  }
  const bytes = await res.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/**
 * Inicia una subida Multipart en R2 para archivos pesados enviados por fragmentos
 */
export async function createMultipartUploadInR2(
  bucket: string,
  key: string,
  contentType: string
): Promise<string> {
  const res = await s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })
  );
  if (!res.UploadId) {
    throw new Error("No se pudo iniciar la subida multiparte en R2");
  }
  return res.UploadId;
}

/**
 * Sube una parte individual (>= 5 MiB excepto la última) de una subida Multipart en R2
 */
export async function uploadPartToR2(
  bucket: string,
  key: string,
  uploadId: string,
  partNumber: number,
  buffer: Buffer
): Promise<{ ETag: string; PartNumber: number }> {
  const res = await s3Client.send(
    new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: buffer,
    })
  );
  if (!res.ETag) {
    throw new Error(`No se recibió ETag para la parte ${partNumber}`);
  }
  return { ETag: res.ETag, PartNumber: partNumber };
}

/**
 * Finaliza una subida Multipart en R2 ensamblando todas las partes
 */
export async function completeMultipartUploadInR2(
  bucket: string,
  key: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>
): Promise<void> {
  const sorted = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
  await s3Client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: sorted },
    })
  );
}

/**
 * Aborta una subida Multipart en R2 en caso de fallo
 */
export async function abortMultipartUploadInR2(
  bucket: string,
  key: string,
  uploadId: string
): Promise<void> {
  await s3Client
    .send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      })
    )
    .catch(() => {});
}
