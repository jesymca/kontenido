"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, ShieldCheck, X } from "lucide-react";
import { deletePostWithBackupAction } from "@/actions/creator";

interface DeletePostButtonProps {
  postId: string;
  postTitle: string;
}

/**
 * Botón con modal de confirmación obligatorio para eliminar publicaciones.
 * Cumple la regla inquebrantable:
 * "siempre que va a eliminar un contenido se le debe notificar que no quedara
 * registro en la plataforma pero siempre debe quedar respaldo de dichos archivos"
 */
export default function DeletePostButton({ postId, postTitle }: DeletePostButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await deletePostWithBackupAction(postId);
      if (res.error) {
        alert(res.error);
        setLoading(false);
        return;
      }
      setMessage(res.message || "Publicación eliminada y respaldada exitosamente.");
      setTimeout(() => {
        setOpen(false);
        window.location.reload();
      }, 1500);
    } catch (e) {
      alert("Error al eliminar la publicación.");
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition flex items-center gap-1"
        title="Eliminar publicación"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Eliminar</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">
              ¿Eliminar &quot;{postTitle}&quot;?
            </h3>

            {/* Notificación obligatoria según el master prompt */}
            <div className="my-4 p-4 bg-slate-950 border border-amber-500/30 rounded-2xl text-left">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Aviso de seguridad y respaldo obligatorio
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Al confirmar, este contenido <strong>dejará de estar disponible y no quedará registro público visible</strong> en la plataforma KONTENIDO. Sin embargo, para cumplir con la política legal y prevenir fraude o disputas, la plataforma conservará un <strong>respaldo seguro permanente</strong> de los archivos.
              </p>
            </div>

            {message ? (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs mb-4">
                {message}
              </div>
            ) : (
              <div className="flex items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-red-600/30 disabled:opacity-50"
                >
                  {loading ? "Procesando..." : "Confirmar y Respaldar"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
