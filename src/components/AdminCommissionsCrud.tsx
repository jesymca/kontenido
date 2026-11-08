"use client";

import { useState } from "react";
import {
  saveCreatorCommissionRuleAction,
  deleteCreatorCommissionRuleAction,
  updateCreatorLevelDirectAction,
} from "@/actions/admin";
import { CreatorCommissionRule } from "@/lib/commissions";
import {
  Percent,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Sparkles,
  Award,
  Users,
  Save,
} from "lucide-react";
import UserLevelBadge from "./UserLevelBadge";

interface CreatorSummary {
  id: string;
  username: string;
  email: string;
  level: number;
  kycStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  totalEarnedKoin: number;
  currentFeePct: number;
  currentRuleName: string;
}

interface Props {
  initialRules: CreatorCommissionRule[];
  creators: CreatorSummary[];
}

export default function AdminCommissionsCrud({ initialRules, creators }: Props) {
  const [editingRule, setEditingRule] = useState<Partial<CreatorCommissionRule> | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingCreatorId, setSavingCreatorId] = useState<string | null>(null);

  const handleSaveRule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await saveCreatorCommissionRuleAction(formData);
      if ((res as any).error) {
        alert((res as any).error);
        setLoading(false);
        return;
      }
      setEditingRule(null);
      window.location.reload();
    } catch {
      alert("Error guardando el tramo de comisión.");
      setLoading(false);
    }
  };

  const handleDeleteRule = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar el tramo "${name}"?`)) return;
    try {
      const res = await deleteCreatorCommissionRuleAction(id);
      if (res.error) {
        alert(res.error);
        return;
      }
      window.location.reload();
    } catch {
      alert("Error eliminando el tramo.");
    }
  };

  const handleUpdateCreatorLevel = async (e: React.FormEvent<HTMLFormElement>, creatorId: string) => {
    e.preventDefault();
    setSavingCreatorId(creatorId);
    const formData = new FormData(e.currentTarget);
    try {
      await updateCreatorLevelDirectAction(formData);
      window.location.reload();
    } catch {
      alert("Error actualizando el nivel de la creadora.");
      setSavingCreatorId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. CABECERA Y BOTÓN DE NUEVO TRAMO */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Percent className="w-5 h-5 text-rose-500" />
              Tramos de Comisión por Nivel de Creadora (CRUD)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configura qué nivel (0 al 100) debe tener la creadora para disfrutar de cada porcentaje de comisión (ej: Nivel 0 a 30 → 20%, Nivel 31 a 60 → 15%, Nivel 61 a 100 → 10%).
            </p>
          </div>

          {!editingRule && (
            <button
              type="button"
              onClick={() =>
                setEditingRule({
                  id: `rule-${Date.now()}`,
                  minLevel: 0,
                  maxLevel: 30,
                  feePct: 20,
                  name: "Nuevo Tramo de Comisión",
                  description: "",
                })
              }
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Agregar Tramo de Comisión
            </button>
          )}
        </div>

        {/* Formulario CRUD para Crear / Editar un tramo */}
        {editingRule && (
          <form
            onSubmit={handleSaveRule}
            className="mb-8 p-6 bg-slate-950 border border-rose-500/40 rounded-2xl space-y-4 shadow-xl"
          >
            <input type="hidden" name="id" value={editingRule.id || ""} />
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-500" />
                {initialRules.some((r) => r.id === editingRule.id)
                  ? "Editar Tramo de Comisión"
                  : "Crear Nuevo Tramo de Comisión"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre del Tramo
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={editingRule.name || ""}
                  placeholder="ej: Tramo Inicial (Nivel 0 al 30)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nivel Desde (0-100)
                </label>
                <input
                  name="minLevel"
                  type="number"
                  min={0}
                  max={100}
                  required
                  defaultValue={editingRule.minLevel ?? 0}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white font-bold focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nivel Hasta (0-100)
                </label>
                <input
                  name="maxLevel"
                  type="number"
                  min={0}
                  max={100}
                  required
                  defaultValue={editingRule.maxLevel ?? 30}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white font-bold focus:border-rose-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-rose-400 mb-1">
                  Comisión Plataforma (%)
                </label>
                <div className="relative">
                  <input
                    name="feePct"
                    type="number"
                    step="0.5"
                    min={0}
                    max={90}
                    required
                    defaultValue={editingRule.feePct ?? 20}
                    className="w-full bg-slate-900 border border-rose-500/40 rounded-xl py-2.5 pl-3.5 pr-8 text-sm text-rose-400 font-black focus:border-rose-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                    %
                  </span>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descripción / Beneficio visible para la Creadora
                </label>
                <input
                  name="description"
                  type="text"
                  defaultValue={editingRule.description || ""}
                  placeholder="ej: Al alcanzar el Nivel 31 tu comisión baja automáticamente al 15%."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {loading ? "Guardando..." : "Guardar Tramo"}
              </button>
            </div>
          </form>
        )}

        {/* Tarjetas de los Tramos Configurados */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {initialRules.map((rule, idx) => (
            <div
              key={rule.id}
              className="p-5 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between gap-4 hover:border-slate-700 transition"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-black text-amber-400 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5" />
                    Nivel {rule.minLevel} al Nivel {rule.maxLevel}
                  </span>

                  <span className="text-2xl font-black text-rose-400">
                    {rule.feePct}%
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white">{rule.name}</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {rule.description ||
                    `Las creadoras en Nivel ${rule.minLevel} a ${rule.maxLevel} pagan ${rule.feePct}% de comisión y reciben ${100 - rule.feePct}% neto.`}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-emerald-400 font-bold">
                  Ganancia Creadora: {100 - rule.feePct}%
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingRule(rule)}
                    className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-800 transition cursor-pointer"
                    title="Editar este tramo"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {initialRules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id, rule.name)}
                      className="p-2 bg-slate-900 hover:bg-red-950/60 text-slate-400 hover:text-red-400 rounded-lg border border-slate-800 transition cursor-pointer"
                      title="Eliminar tramo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. TABLA DE CREADORAS Y AJUSTE DIRECTO DE NIVEL / COMISIÓN */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="mb-5">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            Nivel y Comisión Aplicada por Creadora ({creators.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Puedes asignar o modificar manualmente el Nivel (0 al 100) de cualquier creadora para otorgarle un porcentaje de comisión específico.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Creadora</th>
                <th className="py-3 px-4">Volumen Generado</th>
                <th className="py-3 px-4">Tramo Aplicado</th>
                <th className="py-3 px-4">Comisión Actual</th>
                <th className="py-3 px-4">Ajustar Nivel (0-100)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {creators.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4">
                    <UserLevelBadge
                      level={c.level}
                      username={c.username}
                      role="CREATOR"
                      kycStatus={c.kycStatus}
                      showRoleBadge
                    />
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      {c.email}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-bold text-amber-400">
                    {c.totalEarnedKoin.toFixed(2)} KOIN
                  </td>

                  <td className="py-3 px-4 text-slate-300 font-semibold">
                    {c.currentRuleName}
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 font-black">
                      {c.currentFeePct}%
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <form
                      onSubmit={(e) => handleUpdateCreatorLevel(e, c.id)}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="creatorId" value={c.id} />
                      <input
                        name="level"
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={c.level}
                        className="w-20 bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2.5 text-xs text-white font-bold focus:border-rose-500 focus:outline-hidden"
                      />
                      <button
                        type="submit"
                        disabled={savingCreatorId === c.id}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[11px] flex items-center gap-1 transition cursor-pointer"
                      >
                        <Save className="w-3 h-3" />
                        {savingCreatorId === c.id ? "..." : "Guardar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
