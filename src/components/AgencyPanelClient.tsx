"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Sparkles,
  Users,
  ExternalLink,
  Settings,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageCircle,
  Coins,
  Award,
  Sliders,
  X,
} from "lucide-react";
import {
  updateAgencySettingsAction,
  createAgencyCreatorAction,
} from "@/actions/agency";
import UsernameAvailabilityInput from "@/components/UsernameAvailabilityInput";
import {
  CREATOR_CATEGORIES,
  AGENCY_BADGE_GRADIENTS,
  getCreatorCategoryMeta,
} from "@/lib/creatorCategories";

export interface AgencyCreatorItem {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  creatorCategory: string;
  subscriptionPriceKoin: number;
  chatPriceKoin: number;
  chatDurationHours: number;
  totalEarnedKoin: number;
  postsCount: number;
  isPublished: number;
}

interface AgencyData {
  id: string;
  name: string;
  description: string | null;
  badgeText: string | null;
  badgeColor: string;
  showBadge: number;
  commissionPct: number;
  status: string;
}

interface Props {
  agency: AgencyData;
  creators: AgencyCreatorItem[];
}

export default function AgencyPanelClient({ agency, creators }: Props) {
  const router = useRouter();

  // Estados de configuración de Agencia & Badge
  const [showBadgeConfig, setShowBadgeConfig] = useState(false);
  const [agencyName, setAgencyName] = useState(agency.name);
  const [agencyDesc, setAgencyDesc] = useState(agency.description || "");
  const [badgeText, setBadgeText] = useState(agency.badgeText || agency.name);
  const [badgeColor, setBadgeColor] = useState(
    agency.badgeColor || AGENCY_BADGE_GRADIENTS[0].gradient
  );
  const [showBadge, setShowBadge] = useState(agency.showBadge === 1);
  const [savingAgency, setSavingAgency] = useState(false);
  const [agencyMsg, setAgencyMsg] = useState<string | null>(null);
  const [agencyErr, setAgencyErr] = useState<string | null>(null);

  // Estados de creación de nuevo perfil de creadora
  const [showNewCreator, setShowNewCreator] = useState(false);
  const [newCategory, setNewCategory] = useState("MUJER");
  const [creatingCreator, setCreatingCreator] = useState(false);
  const [creatorErr, setCreatorErr] = useState<string | null>(null);
  const [creatorSuccess, setCreatorSuccess] = useState<string | null>(null);

  const totalEarned = creators.reduce((acc, c) => acc + (c.totalEarnedKoin || 0), 0);

  const handleSaveAgency = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingAgency(true);
    setAgencyErr(null);
    setAgencyMsg(null);

    const formData = new FormData();
    formData.set("name", agencyName);
    formData.set("description", agencyDesc);
    formData.set("badgeText", badgeText);
    formData.set("badgeColor", badgeColor);
    if (showBadge) formData.set("showBadge", "1");

    try {
      const res = await updateAgencySettingsAction(formData);
      if (res?.error) {
        setAgencyErr(res.error);
      } else {
        setAgencyMsg("Configuración de agencia y badge guardada.");
        router.refresh();
      }
    } catch {
      setAgencyErr("Error al guardar configuración.");
    } finally {
      setSavingAgency(false);
    }
  };

  const handleCreateCreator = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreatingCreator(true);
    setCreatorErr(null);
    setCreatorSuccess(null);

    const formData = new FormData(e.currentTarget);
    formData.set("creatorCategory", newCategory);

    try {
      const res = await createAgencyCreatorAction(formData);
      if (res?.error) {
        setCreatorErr(res.error);
      } else if (res?.success) {
        setCreatorSuccess(`Perfil @${res.username} creado con éxito.`);
        setShowNewCreator(false);
        router.refresh();
      }
    } catch {
      setCreatorErr("Error al crear el perfil de creadora.");
    } finally {
      setCreatingCreator(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. MÉTRICAS PRINCIPALES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl">
          <span className="text-slate-400 text-xs font-semibold block mb-1">
            Agencia
          </span>
          <div className="text-xl font-black text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400 shrink-0" />
            <span className="truncate">{agency.name}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {showBadge ? (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r ${badgeColor} shadow-md`}
              >
                <Award className="w-3 h-3" />
                {badgeText || agency.name}
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">Badge oculto</span>
            )}
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl">
          <span className="text-slate-400 text-xs font-semibold block mb-1">
            Perfiles Administrados
          </span>
          <div className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-rose-400" />
            {creators.length}
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            Comisión de agencia: {agency.commissionPct}%
          </span>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl">
          <span className="text-slate-400 text-xs font-semibold block mb-1">
            Ingresos Generados (KOIN)
          </span>
          <div className="text-2xl font-black text-amber-400 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            {totalEarned.toFixed(2)} KOIN
          </div>
          <span className="text-[11px] text-emerald-400 mt-2 block font-semibold">
            {agency.status === "ACTIVE" ? "● Agencia Activa" : "● En Revisión"}
          </span>
        </div>
      </div>

      {/* 2. BARRA DE ACCIONES RÁPIDAS */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setShowNewCreator(!showNewCreator);
            setCreatorErr(null);
            setCreatorSuccess(null);
          }}
          className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black transition shadow-lg shadow-rose-600/25 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {showNewCreator ? "Cerrar Formulario" : "Crear Nuevo Perfil de Creadora"}
        </button>

        <button
          type="button"
          onClick={() => setShowBadgeConfig(!showBadgeConfig)}
          className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-2xl text-xs font-bold transition flex items-center gap-2"
        >
          <Settings className="w-4 h-4 text-indigo-400" />
          Configurar Agencia y Badge Llamativo
        </button>
      </div>

      {creatorSuccess && (
        <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{creatorSuccess}</span>
        </div>
      )}

      {/* 3. CONFIGURACIÓN DE AGENCIA Y BADGE */}
      {showBadgeConfig && (
        <form
          onSubmit={handleSaveAgency}
          className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 space-y-5 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-400" />
              Configuración de Agencia y Badge en Perfiles
            </h3>
            <button
              type="button"
              onClick={() => setShowBadgeConfig(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {agencyErr && (
            <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{agencyErr}</span>
            </div>
          )}
          {agencyMsg && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{agencyMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Nombre Oficial de la Agencia
              </label>
              <input
                type="text"
                required
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Texto del Badge Llamativo (en cada perfil)
              </label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder={agencyName}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Descripción de la Agencia
            </label>
            <textarea
              rows={2}
              value={agencyDesc}
              onChange={(e) => setAgencyDesc(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              Estilo y Color del Badge
            </label>
            <div className="flex flex-wrap gap-2.5">
              {AGENCY_BADGE_GRADIENTS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setBadgeColor(g.gradient)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${g.gradient} transition ${
                    badgeColor === g.gradient
                      ? "ring-2 ring-white scale-105 shadow-lg"
                      : "opacity-75 hover:opacity-100"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-200 font-semibold">
              <input
                type="checkbox"
                checked={showBadge}
                onChange={(e) => setShowBadge(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500"
              />
              Mostrar badge llamativo de la agencia en todos los perfiles administrados
            </label>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400">Vista previa:</span>
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider text-white bg-gradient-to-r ${badgeColor} shadow-lg`}
              >
                <Building2 className="w-3 h-3" />
                {badgeText || agencyName}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingAgency}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 disabled:opacity-50"
          >
            {savingAgency ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Guardar Configuración de Agencia
          </button>
        </form>
      )}

      {/* 4. FORMULARIO CREAR NUEVO PERFIL DE CREADORA */}
      {showNewCreator && (
        <form
          onSubmit={handleCreateCreator}
          className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 space-y-5 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-rose-500" />
                Nuevo Perfil de Creadora en tu Agencia
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Aplican las mismas reglas y condiciones que las creadoras individuales. Podrás subir su contenido, tarifas y mensajería desde este panel.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewCreator(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {creatorErr && (
            <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{creatorErr}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Nombre Artístico (Público)
              </label>
              <input
                name="displayName"
                type="text"
                required
                placeholder="ej: Sofía VIP"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            <UsernameAvailabilityInput label="Enlace de Usuario (@username)" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              Categoría del Perfil
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CREATOR_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setNewCategory(cat.value)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    newCategory === cat.value
                      ? "bg-rose-600 text-white border-rose-500 shadow-md"
                      : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Suscripción Base (KOIN)
              </label>
              <input
                name="subscriptionPriceKoin"
                type="number"
                min="1"
                step="0.5"
                defaultValue="10"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Tarifa de Chat (KOIN)
              </label>
              <input
                name="chatPriceKoin"
                type="number"
                min="0.5"
                step="any"
                defaultValue="5"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Duración Pase Chat (Horas)
              </label>
              <input
                name="chatDurationHours"
                type="number"
                min="1"
                defaultValue="168"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Biografía del Perfil
            </label>
            <textarea
              name="bio"
              rows={2}
              placeholder="Descripción atractiva del perfil..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-rose-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={creatingCreator}
            className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 disabled:opacity-50"
          >
            {creatingCreator ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Crear Perfil y Publicar en la Agencia
          </button>
        </form>
      )}

      {/* 5. LISTADO DE PERFILES DE LA AGENCIA */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-black text-white">
              Perfiles en tu Agencia ({creators.length})
            </h3>
            <p className="text-xs text-slate-400">
              Administra contenido, precios de acceso, planes de suscripción y mensajería privada de cada perfil.
            </p>
          </div>
        </div>

        {creators.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creators.map((c) => {
              const catMeta = getCreatorCategoryMeta(c.creatorCategory);
              return (
                <div
                  key={c.id}
                  className="p-5 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between gap-4 hover:border-indigo-500/40 transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg shrink-0">
                          {c.displayName[0]?.toUpperCase() || "C"}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                            <span>{c.displayName}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${catMeta.badgeClass}`}
                            >
                              {catMeta.label}
                            </span>
                          </h4>
                          <p className="text-xs text-rose-400 font-mono">@{c.username}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-amber-400">
                        {c.totalEarnedKoin.toFixed(2)} KOIN
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] bg-slate-900/80 border border-slate-800/80 rounded-xl p-2.5">
                      <div>
                        <span className="text-slate-500 block">Suscripción</span>
                        <strong className="text-white">{c.subscriptionPriceKoin} KOIN</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Chat</span>
                        <strong className="text-amber-400">{c.chatPriceKoin} KOIN</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Posts</span>
                        <strong className="text-white">{c.postsCount}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                    <Link
                      href={`/agencia/creadoras/${c.id}`}
                      className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      Gestionar Perfil, Contenido y Chat
                    </Link>

                    <Link
                      href={`/${c.username}`}
                      target="_blank"
                      className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                      title="Ver perfil público"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 text-xs">
            Aún no has creado perfiles de creadoras en tu agencia. Haz clic en{" "}
            <strong className="text-rose-400">&quot;Crear Nuevo Perfil de Creadora&quot;</strong>{" "}
            para comenzar.
          </div>
        )}
      </div>
    </div>
  );
}
