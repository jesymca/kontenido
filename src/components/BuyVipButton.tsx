"use client";

import { useState } from "react";
import { buyVipMembershipAction } from "@/actions/wallet";
import { Check } from "lucide-react";

interface Props {
  membershipId: string;
  priceKoin: number;
  isCurrent: boolean;
}

export default function BuyVipButton({ membershipId, priceKoin, isCurrent }: Props) {
  const [loading, setLoading] = useState(false);

  const handleBuy = async () => {
    if (!confirm(`¿Deseas adquirir esta membresía VIP por ${priceKoin} KOIN?`)) return;
    setLoading(true);

    try {
      const res = await buyVipMembershipAction(membershipId);
      if (res.error) {
        alert(res.error);
        setLoading(false);
        return;
      }
      alert(res.message);
      window.location.reload();
    } catch (e) {
      alert("Error al procesar la membresía.");
      setLoading(false);
    }
  };

  if (isCurrent) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl">
        <Check className="w-3 h-3" /> Activa
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleBuy}
      disabled={loading}
      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
    >
      {loading ? "..." : "Adquirir"}
    </button>
  );
}
