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
  Camera,
  Smartphone,
  Globe,
  Check,
} from "lucide-react";
import { createPostAction } from "@/actions/creator";
import { validateNoExternalContact } from "@/lib/contentFilter";
import MediaCaptureModal from "@/components/MediaCaptureModal";
import { watermarkImageFile } from "@/lib/watermarkClient";
import { uploadFileToR2, resolveClientMimeType, cloneFileIntoMemory } from "@/lib/uploadClient";
import MediaWatermark from "@/components/MediaWatermark";

const QUICK_EMOJIS = ["🔥", "💋", "✨", "👑", "📸", "🌴", "💖", "😍", "😈", "🥂", "💎", "⭐", "🎉", "👀"];

interface Props {
  onSuccess?: () => void;
  isKycApproved?: boolean;
  username?: string;
  managedCreatorId?: string;
}

export default function SocialPostComposer({
  onSuccess,
  isKycApproved = false,
  username,
  managedCreatorId,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceKoin, setPriceKoin] = useState("0");
  const [postAccess, setPostAccess] = useState<"subscribers" | "free_teaser" | "ppv">("subscribers");
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<Array<{ url: string; type: "IMAGE" | "VIDEO"; name: string }>>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    if (inputEl.files && inputEl.files.length > 0) {
      const rawSelected = Array.from(inputEl.files);
      const selected = await Promise.all(rawSelected.map((f) => cloneFileIntoMemory(f)));
      inputEl.value = "";

      setFiles((prev) => [...prev, ...selected]);

      const newPreviews = selected.map((f) => {
        const mime = resolveClientMimeType(f);
        return {
          url: URL.createObjectURL(f),
          type: (mime.startsWith("video/") ? "VIDEO" : "IMAGE") as "IMAGE" | "VIDEO",
          name: f.name,
        };
      });
      setFilePreviews((prev) => [...prev, ...newPreviews]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setFilePreviews((prev) => {
      const target = prev[idx];
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleCameraCapture = (file: File) => {
    setFiles((prev) => [...prev, file]);
    const isVid = resolveClientMimeType(file).startsWith("video/");
    setFilePreviews((prev) => [
      ...prev,
      {
        url: URL.createObjectURL(file),
        type: isVid ? "VIDEO" : "IMAGE",
        name: file.name,
      },
    ]);
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
      const uploadedMedia: Array<{
        originalKey: string;
        previewKey: string;
        mimeType: string;
        sizeBytes: number;
        type: "IMAGE" | "VIDEO";
      }> = [];

      for (let i = 0; i < files.length; i++) {
        let file = files[i];
        const isImage = resolveClientMimeType(file).startsWith("image/");

        // Firmar fotos automáticamente con https://www.kontenido.online/{usuario}
        // manteniendo al 100% la perspectiva nativa (vertical u horizontal)
        if (isImage && username) {
          setProgress(`Firmando foto ${i + 1} de ${files.length} con https://www.kontenido.online/${username}...`);
          try {
            file = await watermarkImageFile(file, username);
          } catch (wErr) {
            console.warn("Aviso al firmar foto con marca de agua:", wErr);
          }
        }

        setProgress(`Subiendo archivo ${i + 1} de ${files.length} a Cloudflare R2...`);
        const uploaded = await uploadFileToR2(file, "post");

        uploadedMedia.push({
          originalKey: uploaded.key,
          previewKey: uploaded.key,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          type: uploaded.mimeType.startsWith("video/") ? "VIDEO" : "IMAGE",
        });
      }

      setProgress("Guardando publicación...");
      const formData = new FormData();
      formData.set("title", title.trim());
      formData.set("description", description.trim());
      formData.set("isPublicTeaser", postAccess === "free_teaser" ? "1" : "0");
      formData.set("priceKoin", postAccess === "ppv" ? priceKoin : "0");
      formData.set("mediaKeys", JSON.stringify(uploadedMedia));
      if (managedCreatorId) {
        formData.set("managedCreatorId", managedCreatorId);
      }

      let saveResult: { success?: boolean; error?: string; postId?: string };
      try {
        saveResult = await createPostAction(formData);
      } catch {
        // Respaldo REST si la Server Action falla por red o caché de despliegue
        let apiRes: Response;
        try {
          apiRes = await fetch("/api/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: title.trim(),
              description: description.trim(),
              isPublicTeaser: postAccess === "free_teaser" ? "1" : "0",
              priceKoin: postAccess === "ppv" ? priceKoin : "0",
              mediaItems: uploadedMedia,
              managedCreatorId,
            }),
          });
        } catch {
          throw new Error(
            "No se pudo conectar con el servidor para guardar la publicación. Verifica tu conexión e inténtalo de nuevo."
          );
        }

        const apiData = await apiRes.json().catch(() => null);
        if (!apiRes.ok || apiData?.error) {
          throw new Error(
            apiData?.error || `Error del servidor al guardar publicación (HTTP ${apiRes.status}).`
          );
        }
        saveResult = apiData;
      }

      if (saveResult.error) {
        throw new Error(saveResult.error);
      }

      // Limpiar formulario
      filePreviews.forEach((p) => {
        if (p.url) URL.revokeObjectURL(p.url);
      });
      setTitle("");
      setDescription("");
      setFiles([]);
      setFilePreviews([]);
      setPostAccess("subscribers");
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
      const msg =
        err?.message && err.message !== "Failed to fetch"
          ? err.message
          : "No se pudo conectar con el servidor o el almacenamiento para publicar. Verifica tu conexión e inténtalo de nuevo.";
      setError(msg);
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

        {/* Previsualización de archivos seleccionados preservando perspectiva vertical/horizontal */}
        {filePreviews.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {filePreviews.map((preview, idx) => (
              <div
                key={idx}
                className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 min-h-[160px] max-h-[240px] flex items-center justify-center p-1.5 group"
              >
                {preview.type === "VIDEO" ? (
                  <video
                    src={preview.url}
                    controls
                    className="max-h-[220px] w-auto max-w-full object-contain rounded-xl"
                  />
                ) : (
                  <img
                    src={preview.url}
                    alt={preview.name}
                    className="max-h-[220px] w-auto max-w-full object-contain rounded-xl"
                  />
                )}

                <div className="absolute top-2 left-2 z-30 bg-slate-950/85 px-2 py-0.5 rounded-md text-[10px] text-white font-semibold backdrop-blur-xs border border-slate-800/80">
                  {preview.type === "VIDEO" ? "Video" : "Foto"}
                </div>

                {/* MARCA DE AGUA SOBRE LA PREVISUALIZACIÓN */}
                {username && <MediaWatermark username={username} showDiagonal={false} />}

                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="absolute top-2 right-2 z-30 p-1 bg-red-600/90 hover:bg-red-600 text-white rounded-full transition opacity-90 group-hover:opacity-100 shadow-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Notificación de Marca de Agua activa */}
        {username && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-rose-200">
            <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Marca de Agua de Protección:</strong> Las fotos y videos se publicarán automáticamente con la marca de agua oficial:{" "}
              <strong className="text-white font-mono">https://www.kontenido.online/{username}</strong>.
            </span>
          </div>
        )}

        {/* Selector de Fotos y Videos con opción de Cámara Móvil */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setShowCameraModal(true)}
            className="w-full sm:w-auto px-5 py-3 bg-slate-950/80 hover:bg-slate-800 text-amber-300 hover:text-white rounded-2xl border border-amber-500/40 transition flex items-center justify-center gap-2 text-xs font-bold shadow-md shrink-0"
            title="Abrir cámara del teléfono para foto o video"
          >
            <Smartphone className="w-4 h-4 text-amber-400" />
            <span>Usar Cámara (Foto o Video)</span>
          </button>

          <label className="flex-1 w-full py-3 px-4 border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/60 rounded-2xl text-center cursor-pointer transition flex items-center justify-center gap-2 text-xs text-slate-300 font-semibold">
            <Upload className="w-4 h-4 text-rose-500" />
            <span>{files.length > 0 ? `Galería (${files.length} archivos)` : "Seleccionar desde Galería / Archivos"}</span>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {/* Configuración de Acceso y Visibilidad del Post */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white block">
              ¿Quién puede ver este contenido?
            </span>
            <span className="text-[11px] text-slate-500">
              {postAccess === "free_teaser"
                ? "Visible para todo público gratis"
                : postAccess === "subscribers"
                ? "Exclusivo para suscriptores"
                : "Pago individual por ver"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Opción 1: Muestra Gratuita (Pública / Teaser) */}
            <button
              type="button"
              onClick={() => setPostAccess("free_teaser")}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                postAccess === "free_teaser"
                  ? "bg-rose-600/15 border-rose-500 text-white shadow-sm"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <Globe className={`w-4 h-4 ${postAccess === "free_teaser" ? "text-rose-400" : "text-slate-500"}`} />
                <span className="text-xs font-bold">Muestra Gratuita</span>
              </div>
              <span className="text-[10px] leading-tight text-slate-400">
                Público y gratis. Para que los usuarios conozcan tu contenido sin pagar.
              </span>
            </button>

            {/* Opción 2: Solo Suscriptores */}
            <button
              type="button"
              onClick={() => setPostAccess("subscribers")}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                postAccess === "subscribers"
                  ? "bg-emerald-500/15 border-emerald-500 text-white shadow-sm"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <Unlock className={`w-4 h-4 ${postAccess === "subscribers" ? "text-emerald-400" : "text-slate-500"}`} />
                <span className="text-xs font-bold">Solo Suscriptores</span>
              </div>
              <span className="text-[10px] leading-tight text-slate-400">
                Incluido en la suscripción mensual de tu perfil.
              </span>
            </button>

            {/* Opción 3: Pago por Ver (PPV) */}
            <button
              type="button"
              onClick={() => setPostAccess("ppv")}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                postAccess === "ppv"
                  ? "bg-amber-500/15 border-amber-500 text-white shadow-sm"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <Lock className={`w-4 h-4 ${postAccess === "ppv" ? "text-amber-400" : "text-slate-500"}`} />
                <span className="text-xs font-bold">Pago por Ver (PPV)</span>
              </div>
              <span className="text-[10px] leading-tight text-slate-400">
                Cualquiera puede desbloquearlo pagando un monto en KOIN.
              </span>
            </button>
          </div>

          {postAccess === "ppv" && (
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-amber-400">
                Precio de desbloqueo en KOIN:
              </span>
              <div className="relative w-36">
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={priceKoin}
                  onChange={(e) => setPriceKoin(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-1.5 pl-3 pr-14 text-white text-xs font-bold focus:border-rose-500 focus:outline-hidden"
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

      {/* Modal de Cámara Móvil para Fotos o Videos */}
      {showCameraModal && (
        <MediaCaptureModal
          mode="both"
          defaultFacingMode="environment"
          title="Capturar Foto o Video con Cámara"
          onCapture={handleCameraCapture}
          onClose={() => setShowCameraModal(false)}
        />
      )}
    </div>
  );
}
