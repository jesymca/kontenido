"use client";

import { useState } from "react";
import { Coins, Check, AlertCircle, Sparkles } from "lucide-react";
import { subscribeToCreatorAction } from "@/actions/commerce";
import Link from "next/link";

interface Props {
  creatorId: string;
  priceKoin: number;
  isSubscriber: boolean;
}

export default function SubscribeButton({ creatorId, priceKoin, isSubscriber }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRecharge, setNeedsRecharge] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    setNeedsRecharge(false);

    try {
      const res = await subscribeToCreatorAction(creatorId);
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

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition shadow-lg shadow-rose-600/30 hover:scale-105 disabled:opacity-50"
      >
        <Sparkles className="w-4 h-4" />
        {loading ? "Procesando..." : `Suscribirme por ${priceKoin} KOIN/mes`}
      </button>

      {error && (
        <div className="text-[11px] text-red-400 flex items-center gap-1 mt-1 text-right">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {needsRecharge && (
        <Link
          href="/cuenta"
          className="text-xs text-amber-400 hover:underline font-bold mt-1 flex items-center gap-1"
        >
          <Coins className="w-3.5 h-3.5" />
          Recargar saldo KOIN en tu billetera
        </Link>
      )}
    </div>
  );
}
