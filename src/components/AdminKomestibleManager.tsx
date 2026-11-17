"use client";

import { useState } from "react";
import {
  Flame,
  Save,
  Check,
  X,
  Trash2,
  Users,
  MessageCircleHeart,
  ImageIcon,
  RotateCcw,
  Plus,
  CheckCircle2,
  Heart,
  ShieldAlert,
} from "lucide-react";
import {
  saveKomestibleSettingsAction,
  moderateKomestiblePhotoAction,
  setKomestibleBonusLikesAction,
  resetUserKomestibleLikesAction,
  adminToggleKoincidenMatchAction,
} from "@/actions/adminKomestible";
import type { KomestibleConfig } from "@/actions/komestible";
import { getCountryMeta } from "@/lib/countries";

export interface AdminKomestiblePhotoItem {
  id: string;
  userId: string;
  username: string;
  gender: string | null;
  country: string;
  mediaKey: string;
  caption: string | null;
  likesReceived: number;
  avgRating: number;
  ratingCount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface AdminMaleQuotaItem {
  id: string;
  username: string;
  country: string;
  role: string;
  likesUsedInPeriod: number;
  totalLikesGiven: number;
  bonusLikes: number;
  effectiveLimit: number;
  remaining: number;
}

export interface AdminMatchItem {
  id: string;
  userAUsername: string;
  userBUsername: string;
  status: "ACTIVE" | "UNMATCHED" | "BLOCKED";
  messagesCount: number;
  createdAt: string;
}

interface Props {
  config: KomestibleConfig;
  photos: AdminKomestiblePhotoItem[];
  maleUsers: AdminMaleQuotaItem[];
  matches: AdminMatchItem[];
  stats: {
    totalPhotos: number;
    totalLikes: number;
    totalPasses: number;
    activeMatches: number;
  };
}

export default function AdminKomestibleManager({
  config,
  photos,
  maleUsers,
  matches,
  stats,
}: Props) {
  const [activeTab, setActiveTab] = useState<"config" | "photos" | "quotas" | "matches">("config");
  const [savingCfg, setSavingCfg] = useState(false);
  const [cfgSuccess, setCfgSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [photoFilter, setPhotoFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [bonusDrafts, setBonusDrafts] = useState<Record<string, string>>(
    Object.fromEntries(maleUsers.map((u) => [u.id, String(u.bonusLikes)]))
  );

  const handleSaveConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingCfg(true);
    setCfgSuccess(null);
    const fd = new FormData(e.currentTarget);
    try {
      await saveKomestibleSettingsAction(fd);
      setCfgSuccess("Configuración de KOMESTIBLE y límite para HOMBRES guardada con éxito.");
    } finally {
      setSavingCfg(false);
    }
  };

  const handleModeratePhoto = async (
    photoId: string,
    action: "APPROVED" | "REJECTED" | "DELETE"
  ) => {
    if (action === "DELETE" && !confirm("¿Eliminar permanentemente esta foto de KOMESTIBLE?")) {
      return;
    }
    setBusyId(photoId);
    try {
      await moderateKomestiblePhotoAction(photoId, action);
      window.location.reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveBonus = async (userId: string) => {
    setBusyId(userId);
    try {
      const val = parseInt(bonusDrafts[userId] || "0", 10) || 0;
      await setKomestibleBonusLikesAction(userId, val);
      window.location.reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleResetLikes = async (userId: string, username: string) => {
    if (!confirm(`¿Reiniciar todos los Likes usados en KOMESTIBLE para @${username}?`)) return;
    setBusyId(userId);
    try {
      await resetUserKomestibleLikesAction(userId);
      window.location.reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleMatch = async (matchId: string, newStatus: "ACTIVE" | "BLOCKED") => {
    setBusyId(matchId);
    try {
      await adminToggleKoincidenMatchAction(matchId, newStatus);
      window.location.reload();
    } finally {
      setBusyId(null);
    }
  };

  const filteredPhotos = photos.filter((p) =>
    photoFilter === "ALL" ? true : p.status === photoFilter
  );

  return (
    <div className="space-y-6">
      {/* Métricas globales de KOMESTIBLE y KOINCIDEN */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 block">Fotos Subidas</span>
          <span className="text-2xl font-black text-white mt-1 block">{stats.totalPhotos}</span>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 block">Likes Dados ❤️</span>
          <span className="text-2xl font-black text-rose-400 mt-1 block">{stats.totalLikes}</span>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 block">Swipes Pasar ✕</span>
          <span className="text-2xl font-black text-slate-300 mt-1 block">{stats.totalPasses}</span>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 block">Matches KOINCIDEN</span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">
            {stats.activeMatches}
          </span>
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("config")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === "config"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Flame className="w-4 h-4" />
          Reglas y Límite Hombres
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("photos")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === "photos"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Moderación de Fotos ({photos.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("quotas")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === "quotas"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          Cuotas de Likes Hombres ({maleUsers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("matches")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === "matches"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <MessageCircleHeart className="w-4 h-4" />
          Matches KOINCIDEN ({matches.length})
        </button>
      </div>

      {/* TAB 1: CONFIGURACIÓN */}
      {activeTab === "config" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl max-w-3xl">
          <h2 className="text-lg font-black text-white mb-1">
            Control de Límites y Reglas de KOMESTIBLE
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Configura cuántos Likes pueden dar los usuarios registrados como <strong>HOMBRES</strong>, el período de renovación y las reglas de moderación.
          </p>

          {cfgSuccess && (
            <div className="mb-5 p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{cfgSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveConfig} className="space-y-5">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-white block">
                  Habilitar sección gratuita KOMESTIBLE y KOINCIDEN
                </span>
                <span className="text-[11px] text-slate-400">
                  Si se desactiva, los usuarios no podrán deslizar ni subir nuevas fotos.
                </span>
              </div>
              <input
                type="checkbox"
                name="komestible_enabled"
                value="1"
                defaultChecked={config.enabled}
                className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-rose-600 cursor-pointer"
              />
            </div>

            <div className="p-5 bg-slate-950/90 border border-rose-500/30 rounded-2xl space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <Heart className="w-4 h-4 fill-rose-500" />
                Límite de Likes para Usuarios Registrados como HOMBRES
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Cantidad de Likes Permitidos (HOMBRES)
                  </label>
                  <input
                    name="komestible_male_likes_limit"
                    type="number"
                    min="0"
                    max="1000"
                    required
                    defaultValue={config.maleLikesLimit}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm font-bold focus:border-rose-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Ej: 10 likes gratuitos. (0 = no pueden dar likes gratuitos sin bono).
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Período del Límite para HOMBRES
                  </label>
                  <select
                    name="komestible_male_limit_period"
                    defaultValue={config.maleLimitPeriod}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
                  >
                    <option value="DAILY">Diario (Se renueva cada día)</option>
                    <option value="WEEKLY">Semanal (Últimos 7 días)</option>
                    <option value="TOTAL">Total Único (Límite total gratuito)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Límite de Likes para otros géneros (0 = Ilimitado)
                </label>
                <input
                  name="komestible_other_likes_limit"
                  type="number"
                  min="0"
                  max="1000"
                  required
                  defaultValue={config.otherLikesLimit}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Máximo de Fotos por Usuario en KOMESTIBLE
                </label>
                <input
                  name="komestible_max_photos_per_user"
                  type="number"
                  min="1"
                  max="20"
                  required
                  defaultValue={config.maxPhotosPerUser}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-white block">
                    Requerir aprobación previa de fotos por SUPER_ADMIN
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Si está activo, las fotos nuevas quedan en estado PENDING hasta que las apruebes aquí.
                  </span>
                </div>
                <input
                  type="checkbox"
                  name="komestible_require_moderation"
                  value="1"
                  defaultChecked={config.requireModeration}
                  className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-rose-600"
                />
              </label>

              <label className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-white block">
                    ¿Membresía VIP otorga Likes ilimitados a HOMBRES?
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Incentiva a usuarios hombres a adquirir una membresía VIP en su billetera.
                  </span>
                </div>
                <input
                  type="checkbox"
                  name="komestible_vip_unlimited"
                  value="1"
                  defaultChecked={config.vipUnlimited}
                  className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-rose-600"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={savingCfg}
              className="w-full py-3.5 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 disabled:opacity-50 transition"
            >
              <Save className="w-4 h-4" />
              {savingCfg ? "Guardando..." : "Guardar Configuración de KOMESTIBLE"}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: MODERACIÓN DE FOTOS */}
      {activeTab === "photos" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setPhotoFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  photoFilter === st
                    ? "bg-rose-600 text-white border-rose-500"
                    : "bg-slate-900 text-slate-400 border-slate-800"
                }`}
              >
                {st === "ALL"
                  ? "Todas"
                  : st === "PENDING"
                  ? "Pendientes"
                  : st === "APPROVED"
                  ? "Aprobadas"
                  : "Rechazadas"}
              </button>
            ))}
          </div>

          {filteredPhotos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPhotos.map((p) => (
                <div
                  key={p.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg flex flex-col"
                >
                  <div className="h-64 bg-slate-950 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/media/${p.mediaKey}`}
                      alt={p.username}
                      className="w-full h-full object-cover"
                    />
                    <span
                      className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        p.status === "APPROVED"
                          ? "bg-emerald-500 text-white"
                          : p.status === "PENDING"
                          ? "bg-amber-500 text-slate-950"
                          : "bg-red-600 text-white"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <strong className="text-white">@{p.username}</strong>
                        <span className="text-slate-400">
                          {getCountryMeta(p.country).flag} {p.gender || "N/A"}
                        </span>
                      </div>
                      {p.caption && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{p.caption}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-300">
                        <span>❤️ {p.likesReceived} Likes</span>
                        <span>🔥 {p.avgRating > 0 ? p.avgRating.toFixed(1) : "0"}/5 ({p.ratingCount})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                      {p.status !== "APPROVED" && (
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => handleModeratePhoto(p.id, "APPROVED")}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Aprobar
                        </button>
                      )}
                      {p.status !== "REJECTED" && (
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => handleModeratePhoto(p.id, "REJECTED")}
                          className="flex-1 py-2 bg-slate-800 hover:bg-amber-950 text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> Rechazar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => handleModeratePhoto(p.id, "DELETE")}
                        className="p-2 bg-slate-800 hover:bg-red-950 text-red-400 rounded-xl"
                        title="Eliminar foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-3xl text-xs text-slate-500">
              No hay fotos en esta categoría.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CUOTAS DE USUARIOS HOMBRES */}
      {activeTab === "quotas" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Usuario (HOMBRE)</th>
                  <th className="py-3.5 px-4">Likes Usados ({config.maleLimitPeriod})</th>
                  <th className="py-3.5 px-4">Restantes</th>
                  <th className="py-3.5 px-4">Likes Extra (Bono)</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {maleUsers.length > 0 ? (
                  maleUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/30">
                      <td className="py-3.5 px-4">
                        <strong className="text-white block">@{u.username}</strong>
                        <span className="text-[10px] text-slate-400">
                          {getCountryMeta(u.country).flag} {getCountryMeta(u.country).name} • {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-200 font-bold">
                        {u.likesUsedInPeriod} / {u.effectiveLimit}{" "}
                        <span className="text-[10px] text-slate-500 font-normal">
                          (Histórico: {u.totalLikesGiven})
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            u.remaining > 0
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {u.remaining} disponibles
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            value={bonusDrafts[u.id] ?? "0"}
                            onChange={(e) =>
                              setBonusDrafts((prev) => ({ ...prev, [u.id]: e.target.value }))
                            }
                            className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                          />
                          <button
                            type="button"
                            disabled={busyId === u.id}
                            onClick={() => handleSaveBonus(u.id)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-[11px]"
                          >
                            Aplicar
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => handleResetLikes(u.id, u.username)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reiniciar Likes
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      Aún no hay usuarios registrados como HOMBRE.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: MATCHES EN KOINCIDEN */}
      {activeTab === "matches" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Match Mutuo</th>
                  <th className="py-3.5 px-4">Mensajes</th>
                  <th className="py-3.5 px-4">Fecha</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {matches.length > 0 ? (
                  matches.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/30">
                      <td className="py-3.5 px-4 font-bold text-white">
                        @{m.userAUsername} ❤️ @{m.userBUsername}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{m.messagesCount}</td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(m.createdAt).toLocaleString("es-VE")}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.status === "ACTIVE"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {m.status === "ACTIVE" ? (
                          <button
                            type="button"
                            disabled={busyId === m.id}
                            onClick={() => handleToggleMatch(m.id, "BLOCKED")}
                            className="px-3 py-1 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-500/30 rounded-lg text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <ShieldAlert className="w-3 h-3" /> Bloquear Match
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === m.id}
                            onClick={() => handleToggleMatch(m.id, "ACTIVE")}
                            className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-bold"
                          >
                            Reactivar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      Aún no existen matches registrados en KOINCIDEN.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
