/**
 * Utilidad de firmado y marca de agua en el cliente (Browser HTML5 Canvas)
 * Permite firmar digitalmente fotos con la URL oficial de la creadora:
 * https://www.kontenido.online/{usuario}
 * 
 * Reglas críticas:
 * 1. Preservar estrictamente la perspectiva y orientación original (Vertical u Horizontal).
 * 2. Compatible con EXIF orientation de smartphones.
 * 3. Diseño elegante con fondo semitransparente, ícono y tipografía nítida.
 */

export interface WatermarkOptions {
  domain?: string; // Por defecto https://www.kontenido.online
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  quality?: number; // 0.92 por defecto
}

/**
 * Aplica la firma digital con la URL de la creadora sobre un archivo de imagen (File)
 * y devuelve un nuevo objeto File firmado.
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

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          // Crear canvas con las dimensiones EXACTAS de la imagen original
          // (Si es vertical, height > width, y se mantiene estrictamente vertical)
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }

          // 1. Dibujar imagen base preservando aspecto
          ctx.drawImage(img, 0, 0, width, height);

          // 2. Calcular escala dinámica del texto según resolución
          // Para imágenes 1080p -> fontSize ~24px; para 4K -> fontSize ~40px; mínimo 14px
          const minDim = Math.min(width, height);
          const fontSize = Math.max(14, Math.min(38, Math.round(minDim * 0.026)));
          const paddingX = Math.round(fontSize * 0.9);
          const paddingY = Math.round(fontSize * 0.55);
          const borderRadius = Math.round(fontSize * 0.45);
          const margin = Math.round(minDim * 0.035);

          ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.textBaseline = "middle";

          // Texto a mostrar
          const textMetrics = ctx.measureText(watermarkText);
          const textWidth = textMetrics.width;

          // Ancho y alto de la pastilla/badge
          const badgeWidth = textWidth + paddingX * 2 + fontSize * 1.1; // incluye espacio para el logo/punto
          const badgeHeight = fontSize + paddingY * 2;

          // Posicionamiento de la marca de agua
          let badgeX = width - badgeWidth - margin;
          if (position === "bottom-left") {
            badgeX = margin;
          } else if (position === "bottom-center") {
            badgeX = (width - badgeWidth) / 2;
          }
          const badgeY = height - badgeHeight - margin;

          // Sombra suave para la pastilla
          ctx.save();
          ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
          ctx.shadowBlur = Math.round(fontSize * 0.5);
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 2;

          // Fondo de la pastilla: degradado oscuro con borde sutil
          ctx.fillStyle = "rgba(10, 15, 30, 0.78)";
          drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, borderRadius);
          ctx.fill();

          // Borde sutil acentuado rosa
          ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.06));
          ctx.strokeStyle = "rgba(244, 63, 94, 0.45)"; // rose-500 traslúcido
          drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, borderRadius);
          ctx.stroke();
          ctx.restore();

          // Ícono/Punto de verificación rosa estilo Kontenido
          const iconRadius = Math.round(fontSize * 0.28);
          const iconCenterX = badgeX + paddingX + iconRadius;
          const iconCenterY = badgeY + badgeHeight / 2;

          ctx.save();
          ctx.fillStyle = "#f43f5e"; // rose-500
          ctx.beginPath();
          ctx.arc(iconCenterX, iconCenterY, iconRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Texto de la firma en blanco nítido
          const textX = iconCenterX + iconRadius + Math.round(fontSize * 0.5);
          const textY = badgeY + badgeHeight / 2 + 1;

          ctx.save();
          ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(watermarkText, textX, textY);
          ctx.restore();

          // 3. Exportar el nuevo archivo firmado preservando tipo MIME
          const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const signedFile = new File([blob], file.name, {
                type: outputType,
                lastModified: Date.now(),
              });
              resolve(signedFile);
            },
            outputType,
            quality
          );
        } catch (err) {
          console.error("Error al firmar imagen con marca de agua:", err);
          resolve(file); // Fallback al archivo original si ocurre algún error
        }
      };

      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Función auxiliar para dibujar rectángulos con esquinas redondeadas
 */
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
