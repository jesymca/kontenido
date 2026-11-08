"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  Video,
  Upload,
  AlertCircle,
  Sparkles,
  Smile,
  AtSign,
  Lock,
  Unlock,
  X,
} from "lucide-react";
import { createPostAction } from "@/actions/creator";
import { validateNoExternalContact } from "@/lib/contentFilter";

const QUICK_EMOJIS = ["🔥", "💋", "✨", "👑", "📸", "🌴", "💖", "😍", "😈", "🥂", "💎", "⭐", "🎉", "👀"];

interface Props {
  onSuccess?: () => void;
  isKycApproved?: boolean;
}

export default function SocialPostComposer({ onSuccess, isKycApproved = false }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceKoin, setPriceKoin] = useState("0");
  const [isPpv, setIsPpv] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<Array<{ url: string; type: "IMAGE" | "VIDEO"; name: string }>>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertEmoji = (emoji: string) => {
    setDescription((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleInsertMention = () => {
    setDescription((prev) => prev + " @");
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selected]);

      const newPreviews = selected.map((f) => ({
        url: URL.createObjectURL(f),
        type: (f.type.startsWith("video/") ? "VIDEO" : "IMAGE") as "IMAGE" | "VIDEO",
        name: f.name,
      }));
      setFilePreviews((prev) => [...prev, ...newPreviews]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setFilePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Por favor escribe un título para tu publicación.");
      return;
    }

    const titleCheck = validateNoExternalContact(title, "El título de la publicación");
    if (!titleCheck.valid) {
      setError(titleCheck.error || "No se permiten datos de contacto externo.");
      return;
    }

    const descCheck = validateNoExternalContact(description, "La descripción de la publicación");
    if (!descCheck.valid) {
      setError(descCheck.error || "No se permiten datos de contacto externo.");
      return;
    }

    if (files.length === 0) {
      setError("Debes adjuntar al menos una fotografía o video a la publicación.");
      return;
    }

    setLoading(true);
    setProgress("Iniciando subida segura a Cloudflare R2...");

    try {
      const uploadedMedia: any[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Subiendo archivo ${i + 1} de ${files.length} directamente a R2...`);

        // 1. Obtener URL prefirmada de R2
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

        // 2. Subir binario directo a Cloudflare R2
        await fetch(presignedData.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        uploadedMedia.push({
          originalKey: presignedData.key,
          previewKey: presignedData.key,
          mimeType: file.type,
          sizeBytes: file.size,
          type: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
        });
      }

      setProgress("Guardando publicación...");
      const formData = new FormData();
      formData.set("title", title.trim());
      formData.set("description", description.trim());
      formData.set("priceKoin", isPpv ? priceKoin : "0");
      formData.set("mediaKeys", JSON.stringify(uploadedMedia));

      const res = await createPostAction(formData);
      if (res.error) {
        throw new Error(res.error);
      }

      // Limpiar formulario
      setTitle("");
      setDescription("");
      setFiles([]);
      setFilePreviews([]);
      setIsPpv(false);
      setPriceKoin("0");
      setLoading(false);
      setProgress(null);

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/panel");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Error al publicar contenido.");
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-rose-500" />
          Nueva Publicación (Fotos y Videos)
        </h3>
        {!isKycApproved && (
          <span className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-semibold">
            Modo Borrador (Valida tu cédula para publicar público)
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Título */}
        <div>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título de la publicación (ej: Sesión exclusiva en Los Roques 🌴)"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white font-semibold text-sm focus:border-rose-500 focus:outline-hidden transition"
          />
        </div>

        {/* Descripción tipo red social */}
        <div className="space-y-1.5">
          <textarea
            ref={textareaRef}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Escribe lo que quieras compartir con tus suscriptores... usa emojis 🔥 y menciona @usuarios"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-xs sm:text-sm focus:border-rose-500 focus:outline-hidden transition resize-none leading-relaxed"
          />

          {/* Barra de herramientas: Emojis y menciones */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-slate-800 transition flex items-center gap-1 text-xs font-semibold"
                title="Insertar Emojis"
              >
                <Smile className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Emojis</span>
              </button>

              <button
                type="button"
                onClick={handleInsertMention}
                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition flex items-center gap-1 text-xs font-semibold"
                title="Mencionar usuario"
              >
                <AtSign className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">Mencionar</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500">
              {description.length} caracteres
            </div>
          </div>

          {/* Selector de Emojis Rápido */}
          {showEmojiPicker && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center gap-2 flex-wrap animate-in fade-in duration-150">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleInsertEmoji(emoji)}
                  className="text-lg p-1 hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Previsualización de archivos seleccionados */}
        {filePreviews.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {filePreviews.map((preview, idx) => (
              <div
                key={idx}
                className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center group"
              >
                {preview.type === "VIDEO" ? (
                  <video src={preview.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={preview.url} alt={preview.name} className="w-full h-full object-cover" />
                )}

                <div className="absolute top-1.5 left-1.5 bg-slate-950/80 px-2 py-0.5 rounded-md text-[10px] text-white font-semibold">
                  {preview.type === "VIDEO" ? "Video" : "Foto"}
                </div>

                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="absolute top-1.5 right-1.5 p-1 bg-red-600/90 hover:bg-red-600 text-white rounded-full transition opacity-90 group-hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Selector de Fotos y Videos */}
        <div className="flex items-center gap-3 pt-1">
          <label className="flex-1 py-3 px-4 border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/60 rounded-2xl text-center cursor-pointer transition flex items-center justify-center gap-2 text-xs text-slate-300 font-semibold">
            <Upload className="w-4 h-4 text-rose-500" />
            <span>{files.length > 0 ? `Agregar más fotos o videos (${files.length} seleccionados)` : "Seleccionar Fotos y Videos"}</span>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {/* Configuración de Pago (Incluido en Suscripción vs Pago por Ver / PPV) */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPpv(!isPpv)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition ${
                isPpv
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {isPpv ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </button>
            <div>
              <span className="text-xs font-bold text-white block">
                {isPpv ? "Contenido de Pago por Ver (PPV)" : "Incluido en la Suscripción"}
              </span>
              <span className="text-[11px] text-slate-400">
                {isPpv
                  ? "Cualquier usuario puede desbloquear este post pagando el monto en KOIN."
                  : "Acceso ilimitado para todos tus suscriptores activos."}
              </span>
            </div>
          </div>

          {isPpv && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-amber-400 shrink-0">Precio:</span>
              <div className="relative w-32">
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={priceKoin}
                  onChange={(e) => setPriceKoin(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-1.5 pl-3 pr-12 text-white text-xs font-bold focus:border-rose-500 focus:outline-hidden"
                />
                <span className="absolute right-2.5 top-1.5 text-[10px] text-amber-400 font-bold">KOIN</span>
              </div>
            </div>
          )}
        </div>

        {progress && (
          <div className="p-3 bg-slate-950 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium text-center animate-pulse">
            {progress}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs sm:text-sm transition shadow-lg shadow-rose-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {loading ? "Subiendo a Cloudflare R2..." : "Publicar Ahora"}
        </button>
      </form>
    </div>
  );
}
