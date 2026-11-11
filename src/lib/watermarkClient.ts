/**
 * Utilidad de MARCA DE AGUA (Watermark) en el cliente (Browser HTML5 Canvas)
 * Estampa permanentemente la MARCA DE AGUA oficial de la creadora sobre las fotos:
 * https://www.kontenido.online/{usuario}
 * 
 * Reglas de protección y calidad:
 * 1. Marca de agua diagonal central semitransparente (estilo OnlyFans / stock / anti-piratería).
 * 2. Marca de agua tipo sello oficial en la esquina inferior con logotipo KONTENIDO.
 * 3. Preservación estricta de la relación de aspecto original (Vertical u Horizontal).
 * 4. Ajuste dinámico de escala según la resolución de la foto.
 */

export interface WatermarkOptions {
  domain?: string; // Por defecto https://www.kontenido.online
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  quality?: number; // 0.92 por defecto
  includeDiagonal?: boolean; // True por defecto
}

/**
 * Aplica la MARCA DE AGUA sobre un archivo de imagen (File)
 * y devuelve un nuevo objeto File con la marca de agua incrustada.
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
  const quality = options.quality ?? 0.92;
  const position = options.position || "bottom-right";
  const includeDiagonal = options.includeDiagonal !== false;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          // Crear canvas con las dimensiones EXACTAS de la foto original
          // (Si la foto es vertical, height > width, y se mantiene 100% vertical)
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }

          // 1. Dibujar la fotografía base preservando perspectiva y orientación
          ctx.drawImage(img, 0, 0, width, height);

          const minDim = Math.min(width, height);

          // 2. MARCA DE AGUA DIAGONAL EN EL CENTRO DE LA FOTO (Anti-recorte y Anti-piratería)
          if (includeDiagonal) {
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate((-22 * Math.PI) / 180);

            const diagonalFontSize = Math.max(18, Math.min(54, Math.round(minDim * 0.046)));
            ctx.font = `900 ${diagonalFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // Sombra oscura suave para garantizar legibilidad sobre fondos claros
            ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 2;

            // Borde tenue
            ctx.lineWidth = Math.max(1, Math.round(diagonalFontSize * 0.05));
            ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
            ctx.strokeText(watermarkText.toUpperCase(), 0, 0);

            // Relleno semitransparente
            ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
            ctx.fillText(watermarkText.toUpperCase(), 0, 0);

            ctx.restore();
          }

          // 3. MARCA DE AGUA TIPO SELLO OFICIAL EN LA ESQUINA INFERIOR
          const fontSize = Math.max(14, Math.min(36, Math.round(minDim * 0.026)));
          const paddingX = Math.round(fontSize * 0.95);
          const paddingY = Math.round(fontSize * 0.55);
          const borderRadius = Math.round(fontSize * 0.45);
          const margin = Math.round(minDim * 0.035);

          ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";

          const textMetrics = ctx.measureText(watermarkText);
          const textWidth = textMetrics.width;

          const badgeWidth = textWidth + paddingX * 2 + fontSize * 1.1;
          const badgeHeight = fontSize + paddingY * 2;

          let badgeX = width - badgeWidth - margin;
          if (position === "bottom-left") {
            badgeX = margin;
          } else if (position === "bottom-center") {
            badgeX = (width - badgeWidth) / 2;
          }
          const badgeY = height - badgeHeight - margin;

          // Sombra de la pastilla
          ctx.save();
          ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
          ctx.shadowBlur = Math.round(fontSize * 0.6);
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 2;

          // Fondo semitransparente oscuro
          ctx.fillStyle = "rgba(8, 12, 24, 0.82)";
          drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, borderRadius);
          ctx.fill();

          // Borde rosa de acento Kontenido
          ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.06));
          ctx.strokeStyle = "rgba(244, 63, 94, 0.6)";
          drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, borderRadius);
          ctx.stroke();
          ctx.restore();

          // Punto de verificación rosa
          const iconRadius = Math.round(fontSize * 0.28);
          const iconCenterX = badgeX + paddingX + iconRadius;
          const iconCenterY = badgeY + badgeHeight / 2;

          ctx.save();
          ctx.fillStyle = "#f43f5e";
          ctx.beginPath();
          ctx.arc(iconCenterX, iconCenterY, iconRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Texto de la marca de agua
          const textX = iconCenterX + iconRadius + Math.round(fontSize * 0.5);
          const textY = badgeY + badgeHeight / 2 + 1;

          ctx.save();
          ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(watermarkText, textX, textY);
          ctx.restore();

          // 4. Exportar el archivo con la marca de agua integrada
          const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const watermarkedFile = new File([blob], file.name, {
                type: outputType,
                lastModified: Date.now(),
              });
              resolve(watermarkedFile);
            },
            outputType,
            quality
          );
        } catch (err) {
          console.error("Error al aplicar marca de agua a imagen:", err);
          resolve(file);
        }
      };

      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
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
