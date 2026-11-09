"use client";

import { useState, useRef, useEffect } from "react";
import { Check, X, Move, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImageCropModalProps {
  imageSrc: string;
  aspectRatio: number; // e.g. 3 / 1 for banner, 1 / 1 for avatar
  title: string;
  description?: string;
  onConfirm: (croppedBlob: Blob, croppedPreviewUrl: string) => void;
  onCancel: () => void;
}

/**
 * Modal interactivo para recortar, encuadrar y posicionar imágenes (banner y avatar).
 * Permite desplazar (pan) y hacer zoom para encuadrar exactamente la parte deseada de la foto
 * (por ejemplo la parte superior de fotos verticales en banners horizontales) y renderiza el resultado en canvas.
 */
export default function ImageCropModal({
  imageSrc,
  aspectRatio,
  title,
  description = "Arrastra la imagen para elegir la sección visible y ajusta el zoom.",
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgNatural, setImgNatural] = useState<{ width: number; height: number } | null>(null);

  // Cargar dimensiones naturales de la imagen
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      setImgNatural({ width: img.naturalWidth, height: img.naturalHeight });
      // Reset position to top/center by default
      setPosition({ x: 0, y: 0 });
      setScale(1);
    };
  }, [imageSrc]);

  // Manejadores de arrastre con mouse o touch
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Generar recorte final usando HTML5 Canvas
  const handleCropDone = () => {
    if (!containerRef.current || !imgNatural) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      // Dimensiones de salida deseadas
      const outputWidth = aspectRatio >= 2 ? 1200 : 600;
      const outputHeight = Math.round(outputWidth / aspectRatio);

      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Calcular proporción de imagen mostrada dentro del contenedor
      // La imagen usa object-fit: contain o cover. En nuestro contenedor se muestra centrada con escala y traslación.
      // Calculamos el tamaño renderizado base:
      const renderedRatio = imgNatural.width / imgNatural.height;
      let baseWidth = containerWidth;
      let baseHeight = containerWidth / renderedRatio;
      if (baseHeight < containerHeight) {
        baseHeight = containerHeight;
        baseWidth = containerHeight * renderedRatio;
      }

      const currentWidth = baseWidth * scale;
      const currentHeight = baseHeight * scale;

      // Centro del contenedor
      const centerX = containerWidth / 2 + position.x;
      const centerY = containerHeight / 2 + position.y;

      const imgLeftInContainer = centerX - currentWidth / 2;
      const imgTopInContainer = centerY - currentHeight / 2;

      // Mapear de coordenadas del contenedor a coordenadas de la imagen original
      const factorX = imgNatural.width / currentWidth;
      const factorY = imgNatural.height / currentHeight;

      const srcX = Math.max(0, -imgLeftInContainer * factorX);
      const srcY = Math.max(0, -imgTopInContainer * factorY);
      const srcW = Math.min(imgNatural.width - srcX, containerWidth * factorX);
      const srcH = Math.min(imgNatural.height - srcY, containerHeight * factorY);

      const destX = imgLeftInContainer < 0 ? 0 : imgLeftInContainer * (outputWidth / containerWidth);
      const destY = imgTopInContainer < 0 ? 0 : imgTopInContainer * (outputHeight / containerHeight);
      const destW = (srcW / factorX) * (outputWidth / containerWidth);
      const destH = (srcH / factorY) * (outputHeight / containerHeight);

      // Dibujar fondo oscuro
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, outputWidth, outputHeight);

      ctx.drawImage(img, srcX, srcY, srcW, srcH, destX, destY, destW, destH);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const previewUrl = URL.createObjectURL(blob);
            onConfirm(blob, previewUrl);
          }
        },
        "image/jpeg",
        0.92
      );
    };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Move className="w-4 h-4 text-rose-500" />
              {title}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Área de Encuadre / Recorte */}
        <div className="py-5 flex-1 flex flex-col items-center justify-center min-h-[260px] overflow-hidden select-none">
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              aspectRatio: `${aspectRatio}`,
              maxHeight: "360px",
            }}
            className={`w-full relative overflow-hidden bg-slate-950 border-2 border-dashed border-rose-500/60 rounded-2xl cursor-grab active:cursor-grabbing shadow-inner flex items-center justify-center ${
              aspectRatio === 1 ? "max-w-[280px]" : ""
            }`}
          >
            {imageSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSrc}
                alt="Para encuadrar"
                draggable={false}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: "center center",
                  transition: isDragging ? "none" : "transform 0.1s ease-out",
                  pointerEvents: "none",
                }}
                className="max-w-none w-full h-full object-cover"
              />
            )}

            {/* Guías de regla de tercios */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-30">
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-white" />
              <div className="border-r border-white" />
              <div />
            </div>

            <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-slate-950/80 rounded-lg text-[10px] text-white font-semibold pointer-events-none flex items-center gap-1">
              <Move className="w-3 h-3 text-rose-400" />
              Arrastra para posicionar
            </div>
          </div>
        </div>

        {/* Controles de Zoom y Posición */}
        <div className="pt-2 pb-4 flex items-center justify-between gap-4 border-t border-slate-800">
          <div className="flex items-center gap-3 flex-1 max-w-sm">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(1, s - 0.15))}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Alejar"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="flex-1 accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(3, s + 0.15))}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Acercar"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setScale(1);
              setPosition({ x: 0, y: 0 });
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Centrar</span>
          </button>
        </div>

        {/* Botones de Confirmar o Cancelar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCropDone}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Aplicar y Encuadrar
          </button>
        </div>
      </div>
    </div>
  );
}
