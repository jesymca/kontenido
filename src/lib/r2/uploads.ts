import { BUCKETS } from "@/lib/r2";

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

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

export interface UploadTarget {
  bucket: string;
  key: string;
  contentType: string;
  safeFilename: string;
  isImage: boolean;
  isVideo: boolean;
}

/**
 * Normaliza el tipo MIME (remueve parámetros como `;codecs=...` o infiere por extensión).
 */
export function normalizeUploadMimeType(rawType?: string | null, filename?: string): string {
  const base = (rawType || "").split(";")[0].trim().toLowerCase();
  if (base && base !== "application/octet-stream") {
    return base;
  }

  const ext = (filename || "").split(".").pop()?.toLowerCase() || "";
  return EXT_TO_MIME[ext] || base;
}

/**
 * Sanitiza el nombre del archivo para evitar caracteres problemáticos en claves S3/URLs (/api/media/...).
 */
export function sanitizeUploadFilename(rawFilename: string, fallbackExt: string): string {
  const basename = (rawFilename || "").split(/[/\\]/).pop() || "";
  const cleaned = basename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!cleaned) {
    return `archivo.${fallbackExt}`;
  }
  if (!cleaned.includes(".")) {
    return `${cleaned}.${fallbackExt}`;
  }
  return cleaned.slice(0, 120);
}

/**
 * Valida archivo y resuelve bucket y clave destino en Cloudflare R2.
 */
export function resolveUploadTarget(params: {
  userId: string;
  filename: string;
  contentType?: string | null;
  sizeBytes: number;
  category?: string | null;
}): { ok: true; target: UploadTarget } | { ok: false; error: string; status: number } {
  const rawFilename = (params.filename || "").trim();
  if (!rawFilename) {
    return { ok: false, error: "Nombre de archivo requerido", status: 400 };
  }

  const contentType = normalizeUploadMimeType(params.contentType, rawFilename);
  if (!contentType) {
    return { ok: false, error: "Tipo de archivo requerido", status: 400 };
  }

  const isImage = contentType.startsWith("image/");
  const isVideo = contentType.startsWith("video/");

  if (!isImage && !isVideo && contentType !== "application/pdf") {
    return {
      ok: false,
      error: "Formato no permitido. Solo imágenes, videos o PDF.",
      status: 400,
    };
  }

  const sizeBytes = Number(params.sizeBytes) || 0;
  if (isImage && sizeBytes > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Las imágenes no pueden superar los 15MB", status: 400 };
  }
  if (isVideo && sizeBytes > MAX_VIDEO_BYTES) {
    return { ok: false, error: "Los videos no pueden superar los 500MB", status: 400 };
  }

  const rawExt = rawFilename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const fallbackExt =
    rawExt ||
    (contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
      ? "webp"
      : isImage
      ? "jpg"
      : contentType === "video/webm"
      ? "webm"
      : isVideo
      ? "mp4"
      : "pdf");

  const safeFilename = sanitizeUploadFilename(rawFilename, fallbackExt);
  const fileExt = safeFilename.split(".").pop()?.toLowerCase() || fallbackExt;
  const uniqueId = crypto.randomUUID();
  const category = params.category || "post";

  let key = "";
  let bucket = BUCKETS.MEDIA;

  if (category === "avatar") {
    key = `creators/${params.userId}/avatar/${uniqueId}.${fileExt}`;
  } else if (category === "banner") {
    key = `creators/${params.userId}/banner/${uniqueId}.${fileExt}`;
  } else if (category === "kyc") {
    bucket = BUCKETS.PRIVATE;
    key = `creators/${params.userId}/kyc/${uniqueId}/${safeFilename}`;
  } else if (category === "chat") {
    key = `creators/${params.userId}/chat/${uniqueId}/${safeFilename}`;
  } else if (category === "komestible") {
    if (!isImage) {
      return {
        ok: false,
        error: "Solo se permiten imágenes en KOMESTIBLE.",
        status: 400,
      };
    }
    key = `komestible/${params.userId}/${uniqueId}.${fileExt}`;
  } else {
    key = `creators/${params.userId}/posts/${uniqueId}/original/${safeFilename}`;
  }

  return {
    ok: true,
    target: {
      bucket,
      key,
      contentType,
      safeFilename,
      isImage,
      isVideo,
    },
  };
}
