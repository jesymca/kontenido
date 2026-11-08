"use client";

import { useState } from "react";
import { Coins, Check, AlertCircle, Sparkles, Calendar, ChevronDown } from "lucide-react";
import { subscribeToCreatorAction } from "@/actions/commerce";
import Link from "next/link";

export interface SubscriptionPlanOption {
  id: string;
  name: string;
  durationDays: number;
  priceKoin: number;
  description?: string | null;
}

interface Props {
  creatorId: string;
  priceKoin: number;
  isSubscriber: boolean;
  plans?: SubscriptionPlanOption[];
}

export default function SubscribeButton({
  creatorId,
  priceKoin,
  isSubscriber,
  plans = [],
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(
    plans.length > 0 ? plans[0].id : undefined
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRecharge, setNeedsRecharge] = useState(false);

  const handleSubscribe = async (planId?: string) => {
    setLoading(true);
    setError(null);
    setNeedsRecharge(false);

    try {
      const res = await subscribeToCreatorAction(creatorId, planId);
      if (res.error) {
        setError(res.error);
        if (res.needsRecharge) {
          setNeedsRecharge(true);
        }
        setLoading(false);
        return;
      }
      window.location.reload();
    } catch (e) {
      setError("Error al procesar la suscripción.");
      setLoading(false);
    }
  };

  if (isSubscriber) {
    return (
      <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs font-bold">
        <Check className="w-4 h-4" />
        Suscripción Activa
      </div>
    );
  }

  // Si la creadora tiene planes configurados, abrir modal con las opciones
  const hasMultiplePlans = plans.length > 0;

  return (
    <div className="flex flex-col items-end gap-1.5 relative">
      <button
        type="button"
        onClick={() => {
          if (hasMultiplePlans) {
            setShowModal(true);
          } else {
            handleSubscribe();
          }
        }}
        disabled={loading}
        className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition shadow-lg shadow-rose-600/30 hover:scale-105 disabled:opacity-50"
      >
        <Sparkles className="w-4 h-4" />
        {loading
          ? "Procesando..."
          : hasMultiplePlans
          ? `Ver Planes de Suscripción (${plans.length} opciones)`
          : `Suscribirme por ${priceKoin} KOIN/mes`}
      </button>

      {error && !showModal && (
        <div className="text-[11px] text-red-400 flex items-center gap-1 mt-1 text-right">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {needsRecharge && !showModal && (
        <Link
          href="/cuenta"
          className="text-xs text-amber-400 hover:underline font-bold mt-1 flex items-center gap-1"
        >
          <Coins className="w-3.5 h-3.5" />
          Recargar saldo KOIN en tu billetera
        </Link>
      )}

      {/* Modal de selección de plan de suscripción */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white tracking-tight">
                Elige tu Plan de Suscripción
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Selecciona la duración de acceso a fotos, videos y publicaciones privadas.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {needsRecharge && (
              <div className="mb-4 p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 shrink-0 text-amber-400" />
                  Saldo insuficiente para este plan.
                </span>
                <Link
                  href="/cuenta"
                  className="font-bold underline text-amber-400 hover:text-amber-300 shrink-0"
                >
                  Recargar KOIN ➔
                </Link>
              </div>
            )}

            <div className="space-y-3 mb-6">
              {plans.map((p) => {
                const isSelected = selectedPlanId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-slate-800 border-rose-500 ring-2 ring-rose-500/30"
                        : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{p.name}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-semibold">
                          {p.durationDays} días
                        </span>
                      </div>
                      {p.description && (
                        <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                          {p.description}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-amber-400">
                        {p.priceKoin} KOIN
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleSubscribe(selectedPlanId)}
                className="w-2/3 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-600/30 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                {loading ? "Procesando pago..." : "Confirmar y Desbloquear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
