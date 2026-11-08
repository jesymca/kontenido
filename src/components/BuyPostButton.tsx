"use client";

import { useState } from "react";
import { Coins, Unlock, AlertCircle } from "lucide-react";
import { buyPostAction } from "@/actions/commerce";
import Link from "next/link";

interface Props {
  postId: string;
  priceKoin: number;
}

export default function BuyPostButton({ postId, priceKoin }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRecharge, setNeedsRecharge] = useState(false);

  const handleBuy = async () => {
    setLoading(true);
    setError(null);
    setNeedsRecharge(false);

    try {
      const res = await buyPostAction(postId);
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
      setError("Error al comprar la publicación.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5 w-full">
      <button
        type="button"
        onClick={handleBuy}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
      >
        <Unlock className="w-4 h-4" />
        {loading ? "Desbloqueando..." : `Desbloquear este post por ${priceKoin} KOIN`}
      </button>

      {error && (
        <div className="text-[11px] text-red-400 flex items-center gap-1 mt-1 text-center">
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
          Recargar KOIN en tu billetera
        </Link>
      )}
    </div>
  );
}
