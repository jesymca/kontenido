"use client";

import { useState } from "react";
import { saveVipMembershipAction, deleteVipMembershipAction } from "@/actions/admin";
import { Plus, Edit2, Trash2, X, Star, Download, Check, Sparkles } from "lucide-react";
import { cn, getVipBadgeClass } from "@/lib/utils";

interface VipMembershipItem {
  id: string;
  name: string;
  slug: string;
  badgeText: string;
  badgeColor: string;
  priceKoin: number;
  durationDays: number;
  allowDownload: number;
  description?: string | null;
  isActive: number;
}

interface Props {
  initialMemberships: VipMembershipItem[];
}

/**
 * Plantillas predeterminadas de alta gama para membresías VIP
 */
const VIP_PRESETS = [
  {
    name: "Ultra",
    slug: "ultra",
    badgeText: "ULTRA",
    badgeColor: "vip-badge-ultra",
    priceKoin: 50,
    durationDays: 30,
    allowDownload: 1,
    description: "Acceso ilimitado, descarga de contenido habilitada y halo cósmico Ultra.",
  },
  {
    name: "Pro",
    slug: "pro",
    badgeText: "PRO",
    badgeColor: "vip-badge-pro",
    priceKoin: 35,
    durationDays: 30,
    allowDownload: 1,
    description: "Badge Pro distintivo, atención prioritaria y descarga autorizada.",
  },
  {
    name: "Platinum",
    slug: "platinum",
    badgeText: "PLATINUM",
    badgeColor: "vip-badge-platinum",
    priceKoin: 25,
    durationDays: 30,
    allowDownload: 1,
    description: "Cromo glacial diamantino y soporte preferente.",
  },
  {
    name: "Golden",
    slug: "golden",
    badgeText: "GOLDEN",
    badgeColor: "vip-badge-golden",
    priceKoin: 20,
    durationDays: 30,
    allowDownload: 0,
    description: "Oro Imperial 24K en perfil, chat y publicaciones.",
  },
  {
    name: "Silver",
    slug: "silver",
    badgeText: "SILVER",
    badgeColor: "vip-badge-silver",
    priceKoin: 15,
    durationDays: 30,
    allowDownload: 0,
    description: "Plata esterlina líquida con destello de prestigio.",
  },
  {
    name: "Bronce",
    slug: "bronce",
    badgeText: "BRONCE",
    badgeColor: "vip-badge-bronce",
    priceKoin: 10,
    durationDays: 30,
    allowDownload: 0,
    description: "Cobre radiante incandescente de distinción inicial.",
  },
];

/**
 * Administrador interactivo de Membresías VIP y Badges de Distinción (CRUD)
 * Permite al Super Admin crear, modificar, previsualizar en vivo y eliminar membresías.
 */
export default function AdminVipManager({ initialMemberships }: Props) {
  const [memberships, setMemberships] = useState(initialMemberships);
  const [editingItem, setEditingItem] = useState<VipMembershipItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados del formulario para la vista previa interactiva en vivo
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formBadgeText, setFormBadgeText] = useState("");
  const [formBadgeColor, setFormBadgeColor] = useState("");
  const [formPriceKoin, setFormPriceKoin] = useState(20);
  const [formDurationDays, setFormDurationDays] = useState(30);
  const [formAllowDownload, setFormAllowDownload] = useState(1);
  const [formDescription, setFormDescription] = useState("");

  const startCreate = () => {
    setEditingItem(null);
    setFormName("");
    setFormSlug("");
    setFormBadgeText("VIP");
    setFormBadgeColor("vip-badge-golden");
    setFormPriceKoin(20);
    setFormDurationDays(30);
    setFormAllowDownload(1);
    setFormDescription("");
    setIsCreating(true);
  };

  const startEdit = (m: VipMembershipItem) => {
    setEditingItem(m);
    setFormName(m.name);
    setFormSlug(m.slug);
    setFormBadgeText(m.badgeText);
    setFormBadgeColor(m.badgeColor);
    setFormPriceKoin(m.priceKoin);
    setFormDurationDays(m.durationDays);
    setFormAllowDownload(m.allowDownload);
    setFormDescription(m.description || "");
    setIsCreating(false);
  };

  const applyPreset = (preset: typeof VIP_PRESETS[0]) => {
    setFormName(preset.name);
    setFormSlug(preset.slug);
    setFormBadgeText(preset.badgeText);
    setFormBadgeColor(preset.badgeColor);
    setFormPriceKoin(preset.priceKoin);
    setFormDurationDays(preset.durationDays);
    setFormAllowDownload(preset.allowDownload);
    setFormDescription(preset.description);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await saveVipMembershipAction(formData);
      if (res.error) {
        alert(res.error);
        setLoading(false);
        return;
      }
      setEditingItem(null);
      setIsCreating(false);
      window.location.reload();
    } catch (e) {
      alert("Error guardando membresía VIP.");
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la membresía "${name}"?`)) return;
    await deleteVipMembershipAction(id);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={startCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/30"
        >
          <Plus className="w-4 h-4" />
          Nueva Membresía VIP
        </button>
      </div>

      {/* Grid de Membresías */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {memberships.map((m) => (
          <div
            key={m.id}
            className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col justify-between shadow-xl hover:border-slate-700 transition"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                {/* Badge VIP con estilo de alta gama, 3D, halo de luz y barrido continuo */}
                <span
                  className={cn(
                    "vip-badge-base text-xs px-3.5 py-1 shadow-md",
                    getVipBadgeClass(m.badgeText, m.badgeColor)
                  )}
                >
                  {m.badgeText}
                </span>

                <span className="text-sm font-black text-amber-400">
                  {m.priceKoin} KOIN
                </span>
              </div>

              <h3 className="text-white font-bold text-base mb-1">{m.name}</h3>
              <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                {m.description || "Sin descripción."}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Duración: {m.durationDays} días</span>
                {m.allowDownload === 1 ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Download className="w-3 h-3" /> Descarga VIP
                  </span>
                ) : (
                  <span className="text-slate-500">Solo vista</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => startEdit(m)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title="Editar membresía"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(m.id, m.name)}
                className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                title="Eliminar membresía"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Crear / Editar */}
      {(isCreating || editingItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative my-8">
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingItem(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2">
              {isCreating ? "Crear Membresía VIP" : `Editar "${editingItem?.name}"`}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Configura el badge distintivo y beneficios exclusivos para usuarios y creadoras.
            </p>

            {/* Vista Previa en Vivo del Badge */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 mb-4">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Vista Previa del Badge en Tiempo Real
              </span>
              <div className="py-2">
                <span
                  className={cn(
                    "vip-badge-base text-sm px-5 py-1.5 shadow-xl",
                    getVipBadgeClass(formBadgeText, formBadgeColor)
                  )}
                >
                  {formBadgeText || "VIP"}
                </span>
              </div>
              <span className="text-[10px] text-slate-500">
                Se verá exactamente así en perfiles, comentarios y navbar.
              </span>
            </div>

            {/* Selector Rápido de Plantillas */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Plantillas Rápidas con Efectos 3D:
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {VIP_PRESETS.map((p) => (
                  <button
                    key={p.slug}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={cn(
                      "p-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition text-center hover:scale-105",
                      formBadgeText.toLowerCase() === p.badgeText.toLowerCase()
                        ? "border-rose-500 bg-rose-500/10"
                        : "border-slate-800 bg-slate-950 hover:border-slate-700"
                    )}
                  >
                    <span
                      className={cn(
                        "vip-badge-base text-[9px] px-2 py-0.5",
                        p.badgeColor
                      )}
                    >
                      {p.badgeText}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {editingItem && <input type="hidden" name="id" value={editingItem.id} />}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="ej: Ultra"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Slug</label>
                  <input
                    name="slug"
                    type="text"
                    required
                    placeholder="ej: ultra"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Frase Corta del Badge
                  </label>
                  <input
                    name="badgeText"
                    type="text"
                    required
                    placeholder="ej: ULTRA, PRO"
                    value={formBadgeText}
                    onChange={(e) => setFormBadgeText(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Clase o Gradiente
                  </label>
                  <input
                    name="badgeColor"
                    type="text"
                    required
                    placeholder="vip-badge-ultra o from-..."
                    value={formBadgeColor}
                    onChange={(e) => setFormBadgeColor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Precio en KOIN
                  </label>
                  <input
                    name="priceKoin"
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={formPriceKoin}
                    onChange={(e) => setFormPriceKoin(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Duración (Días)
                  </label>
                  <input
                    name="durationDays"
                    type="number"
                    required
                    value={formDurationDays}
                    onChange={(e) => setFormDurationDays(parseInt(e.target.value) || 30)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descripción de Beneficios
                </label>
                <textarea
                  name="description"
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Beneficios exclusivos de esta membresía..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white resize-none focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Permite Descargas</span>
                  <span className="text-[11px] text-slate-500">¿Otorga permiso de descarga VIP?</span>
                </div>
                <select
                  name="allowDownload"
                  value={formAllowDownload.toString()}
                  onChange={(e) => setFormAllowDownload(parseInt(e.target.value) || 0)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                >
                  <option value="1">Sí (Habilitada)</option>
                  <option value="0">No (Solo Vista)</option>
                </select>
              </div>

              <input type="hidden" name="isActive" value="1" />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/30 transition disabled:opacity-50"
                >
                  {loading ? "Guardando..." : "Guardar Membresía"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
