import sharp from "sharp";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Utilidades de servidor para MARCA DE AGUA (Watermark) con la URL oficial de la creadora:
 * https://www.kontenido.online/{usuario}
 * Posicionada discretamente en el borde inferior derecho para no interrumpir la foto.
 */

export interface ServerWatermarkOptions {
  domain?: string;
  includeDiagonal?: boolean;
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Aplica la MARCA DE AGUA discreta en el borde inferior derecho sobre una imagen (Buffer) usando Sharp.
 * REGLA CRÍTICA: Llama siempre a .rotate() para auto-orientar según EXIF
 * garantizando que fotos verticales permanezcan verticales y no se volteen horizontalmente.
 */
export async function signImageBufferWithSharp(
  imageBuffer: Buffer,
  username: string,
  options: ServerWatermarkOptions = {}
): Promise<Buffer> {
  const domain = options.domain || "https://www.kontenido.online";
  const watermarkText = `${domain}/${username.replace(/^@/, "")}`;
  const safeWatermarkText = escapeXml(watermarkText);
  const includeDiagonal = options.includeDiagonal === true;

  // 1. Cargar imagen y auto-orientar según EXIF
  const image = sharp(imageBuffer).rotate();
  const metadata = await image.metadata();

  const width = metadata.width || 1200;
  const height = metadata.height || 800;

  // 2. Calcular tamaño compacto relativo a la menor dimensión y acotado al borde inferior derecho
  const minDim = Math.min(width, height);
  const margin = Math.max(8, Math.round(minDim * 0.018));
  const maxBadgeWidth = Math.max(140, Math.round(width * 0.56));

  let fontSize = Math.max(11, Math.min(26, Math.round(minDim * 0.02)));
  let paddingX = Math.round(fontSize * 0.72);
  let badgeWidth = Math.round(watermarkText.length * fontSize * 0.56 + paddingX * 2 + fontSize * 0.9);

  while (badgeWidth > maxBadgeWidth && fontSize > 9) {
    fontSize -= 1;
    paddingX = Math.round(fontSize * 0.72);
    badgeWidth = Math.round(watermarkText.length * fontSize * 0.56 + paddingX * 2 + fontSize * 0.9);
  }

  const paddingY = Math.round(fontSize * 0.42);
  const badgeHeight = Math.round(fontSize + paddingY * 2);

  const badgeX = Math.max(margin, width - badgeWidth - margin);
  const badgeY = Math.max(margin, height - badgeHeight - margin);

  const diagonalFontSize = Math.max(18, Math.min(46, Math.round(minDim * 0.04)));

  // 3. Crear SVG superpuesto con la MARCA DE AGUA solo en el borde inferior derecho
  const svgOverlay = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.5"/>
        </filter>
      </defs>

      ${
        includeDiagonal
          ? `
      <g transform="translate(${width / 2}, ${height / 2}) rotate(-22)">
        <text
          x="0"
          y="0"
          text-anchor="middle"
          dominant-baseline="middle"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="${diagonalFontSize}px"
          font-weight="900"
          fill="#ffffff"
          fill-opacity="0.16"
          letter-spacing="2px"
        >
          ${safeWatermarkText.toUpperCase()}
        </text>
      </g>
      `
          : ""
      }

      <!-- MARCA DE AGUA DISCRETA EN EL BORDE INFERIOR DERECHO -->
      <g filter="url(#shadow)">
        <rect
          x="${badgeX}"
          y="${badgeY}"
          width="${badgeWidth}"
          height="${badgeHeight}"
          rx="${Math.round(fontSize * 0.42)}"
          fill="#0a0f1e"
          fill-opacity="0.65"
          stroke="#ffffff"
          stroke-width="1"
          stroke-opacity="0.22"
        />
        <circle
          cx="${badgeX + paddingX + Math.round(fontSize * 0.25)}"
          cy="${badgeY + badgeHeight / 2}"
          r="${Math.max(2.5, Math.round(fontSize * 0.22))}"
          fill="#f43f5e"
        />
        <text
          x="${badgeX + paddingX + Math.round(fontSize * 0.78)}"
          y="${badgeY + badgeHeight / 2 + Math.round(fontSize * 0.34)}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="${fontSize}px"
          font-weight="600"
          fill="#ffffff"
          fill-opacity="0.92"
        >
          ${safeWatermarkText}
        </text>
      </g>
    </svg>
  `;

  return await image
    .composite([
      {
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      },
    ])
    .toBuffer();
}

/**
 * Aplica MARCA DE AGUA discreta en el borde inferior derecho a un video usando ffmpeg drawtext.
 * Preserva automáticamente la relación de aspecto y orientación vertical (9:16) u horizontal (16:9).
 */
export async function signVideoWithFfmpeg(
  inputFilePath: string,
  outputFilePath: string,
  username: string,
  domain = "https://www.kontenido.online"
): Promise<void> {
  const watermarkText = `${domain}/${username.replace(/^@/, "")}`.replace(/:/g, "\\:");

  // Filtro drawtext compacto en la esquina inferior derecha
  const filter = `drawtext=text='${watermarkText}':x=w-tw-16:y=h-th-16:fontsize=h/36:fontcolor=white@0.88:box=1:boxcolor=black@0.55:boxborderw=8:shadowcolor=black@0.6:shadowx=1:shadowy=1`;

  const cmd = `ffmpeg -y -i "${inputFilePath}" -vf "${filter}" -c:v libx264 -preset fast -crf 23 -c:a copy "${outputFilePath}"`;
  await execAsync(cmd);
}
