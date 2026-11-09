"use client";

import { useState } from "react";
import { buyVipMembershipAction } from "@/actions/wallet";
import { Check, Star, AlertCircle, X, Sparkles, Download, Coins } from "lucide-react";
import { cn, getVipBadgeClass } from "@/lib/utils";

interface Props {
  membershipId: string;
  membershipName?: string;
  badgeText?: string;
  badgeColor?: string | null;
  allowDownload?: number;
  priceKoin: number;
  isCurrent: boolean;
  userBalanceKoin?: number;
}

export default function BuyVipButton({
  membershipId,
  membershipName = "Membresía VIP",
  badgeText = "VIP",
  badgeColor = null,
  allowDownload = 0,
  priceKoin,
  isCurrent,
  userBalanceKoin = 0,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasEnoughBalance = userBalanceKoin >= priceKoin;

  const handleConfirmPurchase = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await buyVipMembershipAction(membershipId);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      setSuccess(res.message || "¡Membresía VIP activada con éxito!");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch {
      setError("Error de conexión al procesar la compra de membresía.");
      setLoading(false);
    }
  };

  if (isCurrent) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
        <Check className="w-3 h-3" /> Activa
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setSuccess(null);
          setModalOpen(true);
        }}
        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/30 active:scale-95"
      >
        Adquirir
      </button>

      {/* Modal interactivo elegante de confirmación de Membresía VIP */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative flex flex-col">
            {/* Botón cerrar */}
            <button
              type="button"
              onClick={() => !loading && setModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabecera del modal */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                <Star className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                  Confirmación de Membresía
                </span>
                <h3 className="text-lg font-black text-white">
                  {membershipName}
                </h3>
              </div>
            </div>

            {/* Distintivo 3D preview */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl mb-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block mb-1">Insignia exclusiva que se mostrará:</span>
                <span
                  className={cn(
                    "vip-badge-base text-xs px-3 py-1",
                    getVipBadgeClass(badgeText, badgeColor)
                  )}
                >
                  {badgeText}
                </span>
              </div>
              {allowDownload === 1 && (
                <span className="text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> Descarga VIP
                </span>
              )}
            </div>

            {/* Costo y Saldo */}
            <div className="space-y-2 text-xs mb-5 p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
              <div className="flex justify-between items-center text-slate-300">
                <span>Costo de la Membresía:</span>
                <strong className="text-amber-400 text-sm font-bold flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" />
                  {priceKoin.toFixed(2)} KOIN
                </strong>
              </div>
              <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800/60">
                <span>Tu saldo actual disponible:</span>
                <strong className="text-white">
                  {userBalanceKoin.toFixed(2)} KOIN
                </strong>
              </div>
            </div>

            {/* Alertas de error o éxito */}
            {error && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading || !hasEnoughBalance}
                onClick={handleConfirmPurchase}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loading ? "Procesando..." : "Confirmar Compra"}
              </button>
            </div>

            {!hasEnoughBalance && (
              <p className="text-[11px] text-amber-400 text-center mt-3">
                Saldo insuficiente. Recarga KOIN en la sección de la izquierda para adquirir esta membresía.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
