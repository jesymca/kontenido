"use client";

interface MediaWatermarkProps {
  username: string;
  domain?: string;
  showDiagonal?: boolean;
}

/**
 * Componente oficial de MARCA DE AGUA (Watermark) para fotos y videos.
 * Se posiciona discretamente en el borde inferior derecho sin cruzar ni
 * interrumpir el contenido visual que el consumidor está disfrutando:
 * https://www.kontenido.online/{usuario}
 *
 * Totalmente interactivo: 'pointer-events-none' para que los controles nativos
 * del reproductor (Play, Pausa, Volumen, Pantalla Completa) funcionen normalmente.
 */
export default function MediaWatermark({
  username,
  domain = "https://www.kontenido.online",
  showDiagonal = false,
}: MediaWatermarkProps) {
  const cleanUsername = username?.replace(/^@/, "") || "";
  if (!cleanUsername) return null;

  const fullUrl = `${domain}/${cleanUsername}`;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 overflow-hidden flex items-end justify-end p-2 sm:p-2.5">
      {/* Opcional solo si se solicita explícitamente */}
      {showDiagonal && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <div className="transform -rotate-12 whitespace-nowrap text-white/15 font-black text-xs sm:text-lg tracking-widest uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
            {fullUrl}
          </div>
        </div>
      )}

      {/* Sello discreto en el borde inferior derecho sin interrumpir la foto */}
      <div className="inline-flex items-center gap-1.5 max-w-[82%] px-2.5 py-1 rounded-lg bg-slate-950/65 border border-white/15 text-white shadow-md backdrop-blur-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
        <span className="font-bold text-[10px] sm:text-[11px] text-white/90 tracking-tight truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {fullUrl}
        </span>
      </div>
    </div>
  );
}
