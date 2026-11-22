"use client";

import { useState } from "react";
import { Sparkles, Building2, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { createAgencyForUserAction } from "@/actions/agency";

interface Props {
  defaultName?: string;
  isSuperAdmin?: boolean;
}

export default function AgencyOnboardingForm({ defaultName = "", isSuperAdmin = false }: Props) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      setError("El nombre de la agencia debe tener al menos 2 caracteres.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("name", name.trim());
    if (description.trim()) {
      formData.set("description", description.trim());
    }

    try {
      const res = await createAgencyForUserAction(formData);
      if (res?.error) {
        setError(res.error);
        setLoading(false);
      } else if (res?.success) {
        setSuccess("¡Agencia activada con éxito! Cargando tu panel...");
        setTimeout(() => {
          window.location.href = "/agencia";
        }, 800);
      }
    } catch {
      setError("Error al procesar la activación de la agencia.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6 relative">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-600/20">
            <Building2 className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Activa tu Panel de Agencia
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed max-w-md mx-auto">
            {isSuperAdmin
              ? "Como Administrador general, puedes activar un perfil de Agencia para representar y publicar modelos o probar las funciones de agencia."
              : "Crea y administra múltiples perfiles de creadoras, publica su contenido multimedia, configura tarifas en KOIN y destaca con tu badge oficial."}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Nombre Oficial de la Agencia <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: Velvet Models VIP"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Este nombre se mostrará en el badge llamativo de todos los perfiles de tu agencia.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Descripción o Enfoque (Opcional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Agencia de talentos y producción de contenido exclusivo..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Activando Agencia...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Activar Agencia y Abrir Panel</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
