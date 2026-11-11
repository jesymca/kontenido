import sharp from "sharp";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Utilidades de servidor para firmado de medios con la URL oficial de la creadora:
 * https://www.kontenido.online/{usuario}
 */

export interface ServerWatermarkOptions {
  domain?: string;
}

/**
 * Firma una imagen (Buffer) usando Sharp.
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

  // 1. Cargar imagen y auto-orientar según EXIF
  const image = sharp(imageBuffer).rotate();
  const metadata = await image.metadata();

  const width = metadata.width || 1200;
  const height = metadata.height || 800;

  // 2. Calcular tamaño del texto relativo a la menor dimensión
  const minDim = Math.min(width, height);
  const fontSize = Math.max(16, Math.min(42, Math.round(minDim * 0.028)));
  const paddingX = Math.round(fontSize * 0.9);
  const paddingY = Math.round(fontSize * 0.55);
  const margin = Math.round(minDim * 0.035);

  const approxCharWidth = fontSize * 0.6;
  const textWidth = watermarkText.length * approxCharWidth;
  const badgeWidth = Math.round(textWidth + paddingX * 2 + fontSize * 1.2);
  const badgeHeight = Math.round(fontSize + paddingY * 2);

  const badgeX = Math.max(margin, width - badgeWidth - margin);
  const badgeY = Math.max(margin, height - badgeHeight - margin);

  // 3. Crear SVG superpuesto con la firma
  const svgOverlay = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.5"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <rect 
          x="${badgeX}" 
          y="${badgeY}" 
          width="${badgeWidth}" 
          height="${badgeHeight}" 
          rx="${Math.round(fontSize * 0.4)}" 
          fill="#0a0f1e" 
          fill-opacity="0.82" 
          stroke="#f43f5e" 
          stroke-width="1.5" 
          stroke-opacity="0.5"
        />
        <circle 
          cx="${badgeX + paddingX + Math.round(fontSize * 0.3)}" 
          cy="${badgeY + badgeHeight / 2}" 
          r="${Math.round(fontSize * 0.28)}" 
          fill="#f43f5e" 
        />
        <text 
          x="${badgeX + paddingX + Math.round(fontSize * 0.9)}" 
          y="${badgeY + badgeHeight / 2 + Math.round(fontSize * 0.35)}" 
          font-family="system-ui, -apple-system, sans-serif" 
          font-size="${fontSize}px" 
          font-weight="bold" 
          fill="#ffffff"
        >
          ${watermarkText}
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
 * Firma un video usando ffmpeg drawtext overlay en el servidor.
 * Preserva automáticamente la relación de aspecto y orientación vertical (9:16) u horizontal (16:9).
 */
export async function signVideoWithFfmpeg(
  inputFilePath: string,
  outputFilePath: string,
  username: string,
  domain = "https://www.kontenido.online"
): Promise<void> {
  const watermarkText = `${domain}/${username.replace(/^@/, "")}`.replace(/:/g, "\\:");

  // Filtro drawtext que se posiciona en la esquina inferior derecha adaptándose a la altura (h)
  const filter = `drawtext=text='${watermarkText}':x=w-tw-30:y=h-th-30:fontsize=h/32:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=10`;

  const cmd = `ffmpeg -y -i "${inputFilePath}" -vf "${filter}" -c:v libx264 -preset fast -crf 23 -c:a copy "${outputFilePath}"`;
  await execAsync(cmd);
}
