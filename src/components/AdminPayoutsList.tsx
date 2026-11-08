"use client";

import { useState } from "react";
import { processPayoutAction } from "@/actions/admin";
import { Check, DollarSign, Wallet, Landmark, Smartphone, Coins, ArrowRight, ShieldCheck, Clock, CheckCircle2, Hash } from "lucide-react";
import { formatBs } from "@/lib/dolarapi";
import { formatKoin } from "@/lib/utils";

interface PaymentMethodItem {
  id: string;
  creatorId: string;
  type: "BANK_TRANSFER" | "PAGOMOVIL" | "BINANCE";
  accountHolder?: string | null;
  idDocument?: string | null;
  accountNumber?: string | null;
  accountType?: string | null;
  phone?: string | null;
  binanceEmail?: string | null;
  bank?: {
    nombreBanco: string;
    codigo?: string | null;
  } | null;
}

interface PayoutItem {
  id: string;
  creatorId: string;
  periodStart: string;
  periodEnd: string;
  grossKoin: number;
  feeKoin: number;
  netKoin: number;
  feePct?: number | null;
  usdRateVes?: number | null;
  amountVes?: number | null;
  paymentMethodId: string | null;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED";
  transactionRef?: string | null;
  paidAt?: string | null;
  createdAt: string;
  creator: {
    username: string;
  };
  paymentMethod?: PaymentMethodItem | null;
}

interface Props {
  payouts: PayoutItem[];
  paymentMethods: PaymentMethodItem[];
}

/**
 * Componente administrativo para liquidar cortes semanales y retiros de creadoras
 * Registra el Número de Transferencia y calcula el monto en Bolívares según la tasa paralelo.
 */
export default function AdminPayoutsList({ payouts, paymentMethods }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeModalPayout, setActiveModalPayout] = useState<PayoutItem | null>(null);

  const handlePay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeModalPayout) return;

    setLoadingId(activeModalPayout.id);
    const formData = new FormData(e.currentTarget);
    formData.set("payoutId", activeModalPayout.id);

    try {
      const res = await processPayoutAction(formData);
      if (res.error) {
        alert(res.error);
        setLoadingId(null);
        return;
      }
      setActiveModalPayout(null);
      window.location.reload();
    } catch (err) {
      alert("Error procesando pago.");
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {payouts.length > 0 ? (
        payouts.map((p) => {
          const creatorMethods = paymentMethods.filter((m) => m.creatorId === p.creatorId);
          const chosenMethod = p.paymentMethod || creatorMethods.find((m) => m.id === p.paymentMethodId) || creatorMethods[0];

          return (
            <div
              key={p.id}
              className="p-5 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl hover:border-slate-700 transition"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-black text-white">@{p.creator.username}</span>
                    {p.status === "PAID" ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        PAGADO CON ÉXITO
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                        <Clock className="w-3 h-3" />
                        EN ESPERA DE PAGO
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Solicitud creada el {new Date(p.createdAt).toLocaleString("es-VE")}
                  </span>
                </div>

                {/* Montos destacados */}
                <div className="flex items-center gap-4 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                      Neto a Transferir
                    </span>
                    <span className="text-lg font-black text-emerald-400">
                      {p.amountVes ? formatBs(p.amountVes) : `$${p.netKoin.toFixed(2)} USD`}
                    </span>
                  </div>
                  <div className="pl-3 border-l border-slate-800 text-left">
                    <span className="text-[10px] text-slate-500 block">
                      Neto: <strong>{p.netKoin.toFixed(2)} KOIN</strong>
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Tasa: <strong>Bs. {p.usdRateVes?.toFixed(2) || "—"}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Detalles Financieros y Datos Bancarios */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-1">
                {/* Desglose de Comisión */}
                <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-xs space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">
                    Desglose de Liquidación
                  </span>
                  <div className="flex justify-between text-slate-400 text-xs">
                    <span>Monto Bruto Retirado:</span>
                    <strong className="text-white">{p.grossKoin.toFixed(2)} KOIN</strong>
                  </div>
                  <div className="flex justify-between text-slate-400 text-xs">
                    <span>Comisión Plataforma ({p.feePct || 15}%):</span>
                    <strong className="text-rose-400">-{p.feeKoin.toFixed(2)} KOIN</strong>
                  </div>
                  <div className="flex justify-between text-slate-300 text-xs pt-1 border-t border-slate-800">
                    <span>Neto Aprobado:</span>
                    <strong className="text-amber-400">{p.netKoin.toFixed(2)} KOIN</strong>
                  </div>
                </div>

                {/* Datos de Pago / Cuenta Bancaria de la Creadora */}
                <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-xs space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">
                    Destino del Pago en Venezuela
                  </span>
                  {chosenMethod ? (
                    <div>
                      {chosenMethod.type === "BANK_TRANSFER" && (
                        <div className="space-y-0.5 text-slate-300">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                            Transferencia — {chosenMethod.bank?.nombreBanco || "Banco"}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Cuenta: <strong className="text-slate-200 font-mono">{chosenMethod.accountNumber}</strong>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Titular: {chosenMethod.accountHolder || "Creadora"} ({chosenMethod.idDocument || "V-..."})
                          </div>
                        </div>
                      )}

                      {chosenMethod.type === "PAGOMOVIL" && (
                        <div className="space-y-0.5 text-slate-300">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                            PagoMóvil — {chosenMethod.bank?.nombreBanco || "Banco"}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Teléfono: <strong className="text-slate-200 font-mono">{chosenMethod.phone}</strong>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Cédula: <strong className="text-slate-200">{chosenMethod.idDocument || "—"}</strong>
                          </div>
                        </div>
                      )}

                      {chosenMethod.type === "BINANCE" && (
                        <div className="space-y-0.5 text-slate-300">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5 text-yellow-400" />
                            Binance Pay USDT
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Email: <strong className="text-slate-200">{chosenMethod.binanceEmail}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500 italic">No ha configurado método de pago.</span>
                  )}
                </div>
              </div>

              {/* Estado final y acción */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {p.status === "PAID" ? (
                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/40 px-3 py-1 rounded-xl border border-emerald-500/30">
                      <Hash className="w-3.5 h-3.5" />
                      Nro. de Transferencia: {p.transactionRef || "Registrado"}
                    </span>
                    {p.paidAt && (
                      <span className="text-slate-500 text-[11px]">
                        Liquidado el {new Date(p.paidAt).toLocaleString("es-VE")}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-400/90 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    En espera de que el Super Administrador transfiera los Bolívares y asigne el número de referencia.
                  </div>
                )}

                {p.status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => setActiveModalPayout(p)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
                  >
                    <Check className="w-4 h-4" />
                    Procesar y Asignar Nro. Transferencia
                  </button>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-center py-12 text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-3xl">
          No hay solicitudes de retiro ni cortes pendientes por procesar.
        </div>
      )}

      {/* Modal para ingresar Nro. de Transferencia */}
      {activeModalPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Confirmar Liquidación de Pago
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Realiza la transferencia en Bolívares a la creadora e ingresa el número de referencia bancario.
            </p>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl mb-4 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Creadora:</span>
                <strong className="text-white">@{activeModalPayout.creator.username}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Monto en Bolívares:</span>
                <strong className="text-emerald-400 text-sm">
                  {activeModalPayout.amountVes ? formatBs(activeModalPayout.amountVes) : `$${activeModalPayout.netKoin} USD`}
                </strong>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Tasa Paralelo fijada:</span>
                <span>Bs. {activeModalPayout.usdRateVes?.toFixed(2) || "—"} / USD</span>
              </div>
            </div>

            <form onSubmit={handlePay} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Número de Transferencia / Referencia Bancaria <span className="text-rose-500">*</span>
                </label>
                <input
                  name="transactionRef"
                  type="text"
                  required
                  placeholder="ej: 0102-1234567890 o 987654321"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm font-mono focus:border-emerald-500 focus:outline-hidden"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Este número será visible de inmediato en el panel de la creadora para confirmar su pago.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Comprobante o Nota Adicional (Opcional)
                </label>
                <input
                  name="proofKey"
                  type="text"
                  placeholder="ej: comprobante_bancario_exitoso"
                  defaultValue="transferencia_bancaria_confirmada"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-xs focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModalPayout(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingId === activeModalPayout.id}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/30 disabled:opacity-50"
                >
                  {loadingId === activeModalPayout.id ? "Guardando..." : "Confirmar Pago"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
