"use client";

import { useState } from "react";
import { confirmTopupAction, rejectTopupAction } from "@/actions/admin";
import { Check, X, Coins, ExternalLink, AlertCircle } from "lucide-react";

interface TopupItem {
  id: string;
  userId: string;
  username: string;
  amountKoin: number;
  amountUsdt: number | null;
  reference: string | null;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  notes?: string | null;
  createdAt: string;
}

interface Props {
  transactions: TopupItem[];
}

export default function AdminTopupsList({ transactions }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleConfirm = async (id: string, username: string, amount: number) => {
    if (!confirm(`¿Confirmar recepción de $${amount} USDT para @${username}? Se acreditarán ${amount} KOIN y se recalculará su nivel de usuario.`)) {
      return;
    }

    setLoadingId(id);
    try {
      const res = await confirmTopupAction(id);
      if (res.error) {
        alert(res.error);
        setLoadingId(null);
        return;
      }
      window.location.reload();
    } catch (e) {
      alert("Error confirmando recarga.");
      setLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Ingresa el motivo del rechazo:", "TX Hash no encontrado en blockchain");
    if (!reason) return;

    setLoadingId(id);
    try {
      await rejectTopupAction(id, reason);
      window.location.reload();
    } catch (e) {
      alert("Error rechazando recarga.");
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
      {transactions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Fecha</th>
                <th className="py-3.5 px-4">Usuario</th>
                <th className="py-3.5 px-4">Monto USDT / KOIN</th>
                <th className="py-3.5 px-4">TX Hash / Referencia</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3.5 px-4 text-slate-400">
                    {new Date(tx.createdAt).toLocaleString("es-VE")}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-white">@{tx.username}</td>
                  <td className="py-3.5 px-4">
                    <span className="text-sm font-black text-amber-400">
                      ${tx.amountUsdt || tx.amountKoin} USDT
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      = {tx.amountKoin} KOIN
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300 max-w-xs truncate select-all">
                    {tx.reference || "—"}
                  </td>
                  <td className="py-3.5 px-4">
                    {tx.status === "PENDING" && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                        Por Validar
                      </span>
                    )}
                    {tx.status === "CONFIRMED" && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Confirmada
                      </span>
                    )}
                    {tx.status === "REJECTED" && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                        Rechazada
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {tx.status === "PENDING" && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={loadingId === tx.id}
                          onClick={() => handleConfirm(tx.id, tx.username, tx.amountUsdt || tx.amountKoin)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Confirmar
                        </button>
                        <button
                          type="button"
                          disabled={loadingId === tx.id}
                          onClick={() => handleReject(tx.id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-xl text-xs font-semibold transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-500 text-xs">
          No hay recargas USDT pendientes.
        </div>
      )}
    </div>
  );
}
