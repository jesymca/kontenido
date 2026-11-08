"use client";

import { useState } from "react";
import { saveSubscriptionPlanAction, deleteSubscriptionPlanAction } from "@/actions/creator";
import { Plus, Trash2, Edit3, Calendar, Coins, Check, AlertCircle, Sparkles } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  durationDays: number;
  priceKoin: number;
  description?: string | null;
  orderIndex: number;
  isActive: number;
}

interface Props {
  plans: Plan[];
}

export default function CreatorPlansManager({ plans }: Props) {
  const [editingPlan, setEditingPlan] = useState<Partial<Plan> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await saveSubscriptionPlanAction(formData);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setSuccess(true);
      setEditingPlan(null);
      setLoading(false);
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Error guardando el plan.");
      setLoading(false);
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm("¿Deseas eliminar este plan de suscripción?")) return;
    try {
      await deleteSubscriptionPlanAction(planId);
      window.location.reload();
    } catch (err) {
      alert("Error al eliminar plan.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-rose-500" />
            Tus Opciones de Suscripción (Hasta 3 Planes)
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Configura hasta 3 duraciones y precios en KOIN (ej: 30 días, 90 días, 180 días).
          </p>
        </div>

        {plans.length < 3 && !editingPlan && (
          <button
            type="button"
            onClick={() =>
              setEditingPlan({
                name: plans.length === 0 ? "Pase Mensual" : plans.length === 1 ? "Pase Trimestral" : "Pase Semestral",
                durationDays: plans.length === 0 ? 30 : plans.length === 1 ? 90 : 180,
                priceKoin: plans.length === 0 ? 10 : plans.length === 1 ? 25 : 45,
                orderIndex: plans.length + 1,
              })
            }
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-rose-600/20"
          >
            <Plus className="w-4 h-4" />
            Agregar Plan ({plans.length}/3)
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Formulario de creación/edición de plan */}
      {editingPlan && (
        <form
          onSubmit={handleSave}
          className="p-5 sm:p-6 bg-slate-950 border border-rose-500/40 rounded-3xl space-y-4 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">
              {editingPlan.id ? "Editar Plan de Suscripción" : "Nuevo Plan de Suscripción"}
            </h3>
            <button
              type="button"
              onClick={() => setEditingPlan(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>

          <input type="hidden" name="planId" value={editingPlan.id || ""} />
          <input type="hidden" name="orderIndex" value={editingPlan.orderIndex || plans.length + 1} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre del Plan
              </label>
              <input
                type="text"
                name="name"
                required
                defaultValue={editingPlan.name || ""}
                placeholder="ej: Pase Mensual"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Duración Exacta (Días de acceso)
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="durationDays"
                  required
                  min="1"
                  max="365"
                  defaultValue={editingPlan.durationDays || 30}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-3 pr-12 text-white text-xs focus:border-rose-500 focus:outline-hidden"
                />
                <span className="absolute right-3 top-2 text-[11px] text-slate-500 font-semibold">días</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Al cumplirse estos días, el acceso caduca automáticamente.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Precio en KOIN (USDT)
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="priceKoin"
                  required
                  step="0.5"
                  min="1"
                  defaultValue={editingPlan.priceKoin || 10}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-3 pr-14 text-white text-xs focus:border-rose-500 focus:outline-hidden"
                />
                <span className="absolute right-3 top-2 text-[11px] text-amber-400 font-bold">KOIN</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Descripción o Beneficios (opcional)
            </label>
            <input
              type="text"
              name="description"
              defaultValue={editingPlan.description || ""}
              placeholder="ej: Acceso total a todas mis fotos y videos privados por 30 días"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:border-rose-500 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingPlan(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/30"
            >
              {loading ? "Guardando..." : "Guardar Plan"}
            </button>
          </div>
        </form>
      )}

      {/* Lista de planes activos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.length > 0 ? (
          plans.map((p, idx) => (
            <div
              key={p.id}
              className="p-5 bg-slate-950 border border-slate-800 rounded-3xl flex flex-col justify-between hover:border-slate-700 transition relative group shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] uppercase font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                    Opción {idx + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingPlan(p)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                      title="Editar"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h4 className="text-base font-black text-white">{p.name}</h4>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Vence a los <strong>{p.durationDays} días</strong></span>
                </div>

                {p.description && (
                  <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Costo</span>
                <span className="text-base font-black text-amber-400">{p.priceKoin} KOIN</span>
              </div>
            </div>
          ))
        ) : (
          <div className="md:col-span-3 p-6 text-center bg-slate-950/60 border border-slate-800 rounded-3xl">
            <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-semibold">No has creado planes de suscripción personalizados.</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Tus fans usarán el precio base mensual por defecto. Agrega hasta 3 planes para ofrecer descuentos por 3 o 6 meses.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
