/**
 * Utilidad de MARCA DE AGUA (Watermark) en el cliente (Browser HTML5 Canvas)
 * Estampa permanentemente la MARCA DE AGUA oficial de la creadora en el borde
 * inferior derecho de la fotografía sin cruzar ni interrumpir la imagen:
 * https://www.kontenido.online/{usuario}
 *
 * Reglas de protección y calidad:
 * 1. Sello compacto y discreto ubicado en el borde inferior derecho.
 * 2. Ajuste dinámico de escala para que nunca cruce ni ocupe excesivo ancho en fotos verticales.
 * 3. Preservación estricta de la relación de aspecto original (Vertical u Horizontal).
 */

export interface WatermarkOptions {
  domain?: string; // Por defecto https://www.kontenido.online
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  quality?: number; // 0.88 por defecto
  includeDiagonal?: boolean; // False por defecto: no cruzar la foto
}

const MAX_CANVAS_DIMENSION = 1920;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo decodificar la imagen."));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function replaceFileExtension(filename: string, ext: string): string {
  if (!filename) return `foto.${ext}`;
  const dotIdx = filename.lastIndexOf(".");
  const base = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
  return `${base}.${ext}`;
}

/**
 * Aplica la MARCA DE AGUA discreta en el borde inferior derecho sobre un archivo
 * de imagen (File) y devuelve un nuevo objeto File con la marca de agua incrustada.
 */
export async function watermarkImageFile(
  file: File,
  username: string,
  options: WatermarkOptions = {}
): Promise<File> {
  // Solo procesar imágenes
  if (!file.type.startsWith("image/")) {
    return file;
  }

  const domain = options.domain || "https://www.kontenido.online";
  const watermarkText = `${domain}/${username.replace(/^@/, "")}`;
  const quality = options.quality ?? 0.88;
  const position = options.position || "bottom-right";
  const includeDiagonal = options.includeDiagonal === true;

  try {
    const img = await loadImageFromFile(file);
    const rawWidth = img.naturalWidth || img.width;
    const rawHeight = img.naturalHeight || img.height;
    if (!rawWidth || !rawHeight) {
      return file;
    }

    // Escalar solo si excede MAX_CANVAS_DIMENSION preservando 100% la orientación y proporción nativa
    const maxSide = Math.max(rawWidth, rawHeight);
    const scale = maxSide > MAX_CANVAS_DIMENSION ? MAX_CANVAS_DIMENSION / maxSide : 1;
    const width = Math.max(1, Math.round(rawWidth * scale));
    const height = Math.max(1, Math.round(rawHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }

    // 1. Dibujar la fotografía base preservando perspectiva y orientación
    ctx.drawImage(img, 0, 0, width, height);

    const minDim = Math.min(width, height);

    // 2. Opcional: diagonal solo si se solicita explícitamente (desactivado por defecto)
    if (includeDiagonal) {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate((-22 * Math.PI) / 180);

      const diagonalFontSize = Math.max(16, Math.min(44, Math.round(minDim * 0.04)));
      ctx.font = `900 ${diagonalFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.fillText(watermarkText.toUpperCase(), 0, 0);
      ctx.restore();
    }

    // 3. MARCA DE AGUA COMPACTA EN EL BORDE INFERIOR DERECHO (sin interrumpir la foto)
    const margin = Math.max(8, Math.round(minDim * 0.018));
    let fontSize = Math.max(11, Math.min(24, Math.round(minDim * 0.019)));

    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // Garantizar que la pastilla jamás supere el 56% del ancho de la imagen (se mantiene en la esquina)
    const maxBadgeWidth = Math.max(120, Math.round(width * 0.56));
    let measuredWidth = ctx.measureText(watermarkText).width;
    let paddingX = Math.round(fontSize * 0.7);
    let badgeWidth = measuredWidth + paddingX * 2 + fontSize * 0.9;

    while (badgeWidth > maxBadgeWidth && fontSize > 9) {
      fontSize -= 1;
      ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      measuredWidth = ctx.measureText(watermarkText).width;
      paddingX = Math.round(fontSize * 0.7);
      badgeWidth = measuredWidth + paddingX * 2 + fontSize * 0.9;
    }

    const paddingY = Math.round(fontSize * 0.42);
    const borderRadius = Math.round(fontSize * 0.42);
    const badgeHeight = fontSize + paddingY * 2;

    let badgeX = Math.max(margin, width - badgeWidth - margin);
    if (position === "bottom-left") {
      badgeX = margin;
    } else if (position === "bottom-center") {
      badgeX = Math.max(margin, (width - badgeWidth) / 2);
    }
    const badgeY = Math.max(margin, height - badgeHeight - margin);

    // Pastilla discreta semitransparente pegada al borde inferior derecho
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = Math.round(fontSize * 0.4);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = "rgba(8, 12, 24, 0.65)";
    drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, borderRadius);
    ctx.fill();

    ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.05));
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, borderRadius);
    ctx.stroke();
    ctx.restore();

    // Punto rosa discreto
    const iconRadius = Math.max(2.5, Math.round(fontSize * 0.22));
    const iconCenterX = badgeX + paddingX + iconRadius;
    const iconCenterY = badgeY + badgeHeight / 2;

    ctx.save();
    ctx.fillStyle = "#f43f5e";
    ctx.beginPath();
    ctx.arc(iconCenterX, iconCenterY, iconRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Texto de la marca de agua
    const textX = iconCenterX + iconRadius + Math.round(fontSize * 0.42);
    const textY = badgeY + badgeHeight / 2 + 0.5;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.fillText(watermarkText, textX, textY);
    ctx.restore();

    // 4. Exportar el archivo con la marca de agua integrada
    let outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    let blob = await canvasToBlob(canvas, outputType, quality);

    // Si un PNG resulta pesado (> 1.5 MB, común en capturas de pantalla), convertir a JPEG de alta calidad
    if (blob && outputType === "image/png" && blob.size > 1.5 * 1024 * 1024) {
      const jpegBlob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (jpegBlob && jpegBlob.size < blob.size) {
        blob = jpegBlob;
        outputType = "image/jpeg";
      }
    }

    if (!blob) {
      return file;
    }

    const finalExt = outputType === "image/png" ? "png" : "jpg";
    const finalName = replaceFileExtension(file.name, finalExt);
    return new File([blob], finalName, {
      type: outputType,
      lastModified: Date.now(),
    });
  } catch (err) {
    console.error("Error al aplicar marca de agua a imagen:", err);
    return file;
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
