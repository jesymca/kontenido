"use client";

import { useState } from "react";
import { Copy, Check, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { submitTopupAction } from "@/actions/wallet";

interface Props {
  trc20Address: string;
  bep20Address: string;
}

export default function WalletTopupForm({ trc20Address, bep20Address }: Props) {
  const [copiedNetwork, setCopiedNetwork] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const copyToClipboard = (text: string, network: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNetwork(network);
    setTimeout(() => setCopiedNetwork(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const formEl = e.currentTarget;
    const formData = new FormData(formEl);

    try {
      const res = await submitTopupAction(formData);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      setSuccess(res.message || "Recarga registrada con éxito.");
      formEl.reset();
      setLoading(false);
    } catch (err) {
      setError("Error enviando solicitud de recarga.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Direcciones USDT de depósito */}
      <div className="space-y-3">
        {/* TRC20 */}
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              USDT (Red TRC20 / Tron)
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(trc20Address, "TRC20")}
              className="text-xs text-rose-400 hover:text-white flex items-center gap-1 transition"
            >
              {copiedNetwork === "TRC20" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
          <p className="font-mono text-[11px] text-slate-400 break-all select-all">
            {trc20Address}
          </p>
        </div>

        {/* BEP20 */}
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              USDT (Red BEP20 / BNB Chain)
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(bep20Address, "BEP20")}
              className="text-xs text-rose-400 hover:text-white flex items-center gap-1 transition"
            >
              {copiedNetwork === "BEP20" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
          <p className="font-mono text-[11px] text-slate-400 break-all select-all">
            {bep20Address}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      {/* Formulario de reporte de recarga */}
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Monto transferido en USDT (1 USDT = 1 KOIN)
          </label>
          <input
            name="amountUsdt"
            type="number"
            step="0.1"
            min="1"
            required
            placeholder="ej: 25.00"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            TX Hash (Identificador de la transacción de Binance / Wallet)
          </label>
          <input
            name="reference"
            type="text"
            required
            placeholder="ej: 0x7a8b... o TXID de Binance"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm font-mono focus:border-rose-500 focus:outline-hidden"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl transition text-sm shadow-md shadow-rose-600/30 disabled:opacity-50"
        >
          {loading ? "Enviando reporte..." : "Notificar Recarga al SUPER_ADMIN"}
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
