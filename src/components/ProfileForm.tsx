"use client";

import { useState } from "react";
import { updateProfileAction } from "@/actions/creator";
import { Check, AlertCircle, Save } from "lucide-react";

interface Profile {
  displayName: string;
  bio: string | null;
  subscriptionPriceKoin: number;
  isPublished: number;
  avatarKey?: string | null;
  bannerKey?: string | null;
}

interface Props {
  profile?: Profile | null;
  username: string;
}

export default function ProfileForm({ profile, username }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await updateProfileAction(formData);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setLoading(false);
    } catch (err) {
      setError("Error al actualizar perfil.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>¡Perfil actualizado con éxito!</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          Nombre para Mostrar
        </label>
        <input
          name="displayName"
          type="text"
          required
          defaultValue={profile?.displayName || username}
          placeholder="ej: Vanessa Gómez"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          Biografía / Descripción
        </label>
        <textarea
          name="bio"
          rows={3}
          defaultValue={profile?.bio || ""}
          placeholder="Cuéntale a tus fans sobre tu contenido exclusivo..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          Precio de Suscripción Mensual (en KOIN)
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-2.5 text-amber-400 text-xs font-bold">🪙 KOIN</span>
          <input
            name="subscriptionPriceKoin"
            type="number"
            step="0.5"
            min="1"
            required
            defaultValue={profile?.subscriptionPriceKoin || 10.0}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-20 pr-4 text-white text-sm focus:border-rose-500 focus:outline-hidden"
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          1 KOIN ≈ 1 USDT. Este es el monto que se debitará cada mes a los consumidores que se suscriban a tu perfil.
        </p>
      </div>

      <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-white block">Perfil público visible</span>
          <span className="text-[11px] text-slate-500">
            Si está desactivado, solo tú podrás ver tu perfil.
          </span>
        </div>
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={profile?.isPublished === 1}
          className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-rose-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl transition text-sm shadow-md shadow-rose-600/30 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {loading ? "Guardando..." : "Guardar Cambios"}
      </button>
    </form>
  );
}
