"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Image as ImageIcon, Video, Upload, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createPostAction } from "@/actions/creator";

/**
 * Pantalla para subir nuevo contenido (/panel/nuevo)
 * Subida directa a Cloudflare R2 mediante URL prefirmada
 */
export default function NuevoPostPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProgress("Iniciando...");

    const formEl = e.currentTarget;
    const formData = new FormData(formEl);

    try {
      const uploadedMedia: any[] = [];

      // 1. Subir cada archivo directamente a R2 con URLs prefirmadas
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Subiendo archivo ${i + 1} de ${files.length} a R2...`);

        // Pedir URL prefirmada al backend
        const presignedRes = await fetch("/api/uploads/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            category: "post",
          }),
        });

        const presignedData = await presignedRes.json();
        if (!presignedData.success) {
          throw new Error(presignedData.error || "Error al obtener URL prefirmada de R2.");
        }

        // Subir binario directo a Cloudflare R2
        await fetch(presignedData.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        uploadedMedia.push({
          originalKey: presignedData.key,
          previewKey: presignedData.key, // Por defecto misma clave o preview blur
          mimeType: file.type,
          sizeBytes: file.size,
          type: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
        });
      }

      setProgress("Guardando publicación...");
      formData.set("mediaKeys", JSON.stringify(uploadedMedia));

      // 2. Crear post en base de datos
      const res = await createPostAction(formData);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      router.push("/panel");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al subir la publicación.");
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/panel"
          className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Subir Nueva Publicación</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Las fotos y videos se suben directamente a Cloudflare R2 cifrado.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        {error && (
          <div className="mb-5 p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Título de la publicación
            </label>
            <input
              name="title"
              type="text"
              required
              placeholder="ej: Sesión exclusiva en la playa 🌴"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Descripción (opcional)
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Detalles sobre este set o video..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Precio individual en KOIN (0 si está incluido con la suscripción)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-amber-400 text-xs font-bold">🪙 KOIN</span>
              <input
                name="priceKoin"
                type="number"
                step="0.5"
                min="0"
                defaultValue="0"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-20 pr-4 text-white text-sm focus:border-rose-500 focus:outline-hidden"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Si fijas 0 KOIN, solo tus suscriptores mensuales podrán verlo. Si fijas un precio (ej: 5 KOIN), cualquier usuario podrá comprarlo individualmente.
            </p>
          </div>

          {/* Selector de archivos */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Archivos multimedia (Imágenes hasta 15MB, Videos hasta 500MB)
            </label>

            <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/60 rounded-2xl p-6 text-center cursor-pointer transition relative">
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex justify-center gap-3 mb-2 text-rose-500">
                <ImageIcon className="w-8 h-8" />
                <Video className="w-8 h-8" />
              </div>
              <p className="text-white text-xs font-bold">
                {files.length > 0
                  ? `${files.length} archivo(s) seleccionado(s)`
                  : "Haz clic o arrastra fotos y videos aquí"}
              </p>
              <p className="text-slate-500 text-[11px] mt-1">
                Soporta JPG, PNG, WEBP, MP4, MOV
              </p>
            </div>
          </div>

          {progress && (
            <div className="p-3 bg-slate-950 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium text-center animate-pulse">
              {progress}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl transition text-sm shadow-md shadow-rose-600/30 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {loading ? "Subiendo contenido..." : "Publicar Contenido"}
          </button>
        </form>
      </div>
    </div>
  );
}
