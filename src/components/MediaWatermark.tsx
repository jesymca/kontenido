"use client";

import { Sparkles, ShieldCheck } from "lucide-react";

interface MediaWatermarkProps {
  username: string;
  domain?: string;
  showDiagonal?: boolean;
}

/**
 * Componente oficial de MARCA DE AGUA (Watermark) para fotos y videos
 * Se superpone de forma inmutable sobre los reproductores de video y fotografías
 * estampando la URL oficial de la creadora:
 * https://www.kontenido.online/{usuario}
 * 
 * Características:
 * 1. Marca de agua diagonal semitransparente en el centro (protección anti-recorte y anti-piratería).
 * 2. Marca de agua tipo sello en la esquina inferior (sello oficial de alta visibilidad).
 * 3. Totalmente interactivo: 'pointer-events-none' para que los controles nativos del reproductor
 *    (Play, Pausa, Volumen, Pantalla Completa, Seek) funcionen con total normalidad.
 */
export default function MediaWatermark({
  username,
  domain = "https://www.kontenido.online",
  showDiagonal = true,
}: MediaWatermarkProps) {
  const cleanUsername = username?.replace(/^@/, "") || "";
  if (!cleanUsername) return null;

  const fullUrl = `${domain}/${cleanUsername}`;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 overflow-hidden flex flex-col justify-between">
      {/* 1. MARCA DE AGUA DIAGONAL EN EL CENTRO (Semi-transparente, estilo OnlyFans / Marca de agua de protección) */}
      {showDiagonal && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <div className="transform -rotate-12 whitespace-nowrap text-white/20 font-black text-sm sm:text-xl md:text-2xl lg:text-3xl tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] border-y border-white/10 py-1 px-8 backdrop-blur-[0.5px]">
            {fullUrl}
          </div>
        </div>
      )}

      {/* Marca de agua sutil en esquina superior izquierda */}
      <div className="p-3 sm:p-4 flex items-center justify-start opacity-75">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[10px] font-bold text-white/80 backdrop-blur-xs shadow-sm">
          <ShieldCheck className="w-3 h-3 text-rose-400" />
          KONTENIDO
        </span>
      </div>

      {/* 2. MARCA DE AGUA PRINCIPAL EN LA ESQUINA INFERIOR */}
      <div className="p-3 sm:p-4 flex items-center justify-end">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-rose-500/40 text-white shadow-2xl backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500 animate-pulse" />
          <span className="font-extrabold text-[11px] sm:text-xs text-rose-200 tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {fullUrl}
          </span>
        </div>
      </div>
    </div>
  );
}
