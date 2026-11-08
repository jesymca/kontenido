"use client";

import { useState } from "react";
import { requestPayoutAction } from "@/actions/creator";
import {
  Wallet,
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  Landmark,
  Smartphone,
  Coins,
  TrendingUp,
  Users,
  Percent,
  Hash,
  Sparkles,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { formatBs } from "@/lib/dolarapi";
import { formatKoin } from "@/lib/utils";
import UserLevelBadge from "@/components/UserLevelBadge";

interface BankItem {
  id: number;
  nombreBanco: string;
  codigo: string;
}

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
  grossKoin: number;
  feeKoin: number;
  netKoin: number;
  feePct?: number | null;
  usdRateVes?: number | null;
  amountVes?: number | null;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED";
  transactionRef?: string | null;
  paidAt?: string | null;
  createdAt: string;
  paymentMethod?: PaymentMethodItem | null;
}

interface SubscriberItem {
  id: string;
  subscriberUsername: string;
  subscriberLevel: number;
  vipBadgeText?: string | null;
  vipBadgeColor?: string | null;
  priceKoin: number;
  creatorNetKoin: number;
  status: string;
  startDate: string;
  endDate: string;
}

interface TierInfo {
  tierNumber: number;
  name: string;
  description: string;
  feePct: number;
  minVolume: number;
  maxVolume: number;
  minLevel?: number;
  maxLevel?: number;
  currentLevel?: number;
  nextLevelTarget?: number | null;
  nextFeePct?: number | null;
  allRules?: Array<{
    id: string;
    minLevel: number;
    maxLevel: number;
    feePct: number;
    name: string;
    description: string;
  }>;
  koinToNextTier?: number;
  progressToNextPct?: number;
}

interface Props {
  balanceKoin: number;
  totalEarnedKoin: number;
  tasaParalelo: number;
  fechaActualizacionTasa: string;
  fuenteTasa: string;
  tierInfo: TierInfo;
  paymentMethods: PaymentMethodItem[];
  payouts: PayoutItem[];
  subscribers: SubscriberItem[];
}

/**
 * Hub Integral de Retiros en Bolívares (VES), Suscriptores y Liquidaciones para Creadoras
 * - Muestra tasa paralelo de DolarAPI en tiempo real
 * - Descuenta comisión según el status / volumen general (10%, 15%, 20%)
 * - Registra la solicitud en estado "EN ESPERA" hasta que SUPER_ADMIN confirme con Nro. de Transferencia
 * - Muestra la lista completa de suscriptores y pagos en KOIN
 */
export default function CreatorWithdrawalHub({
  balanceKoin,
  totalEarnedKoin,
  tasaParalelo,
  fechaActualizacionTasa,
  fuenteTasa,
  tierInfo,
  paymentMethods,
  payouts,
  subscribers,
}: Props) {
  const [activeTab, setActiveTab] = useState<"withdraw" | "history" | "subscribers">("withdraw");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("20");
  const [selectedMethodId, setSelectedMethodId] = useState<string>(
    paymentMethods.length > 0 ? paymentMethods[0].id : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const numericAmount = parseFloat(withdrawAmount) || 0;
  const calculatedFee = Number(((numericAmount * tierInfo.feePct) / 100).toFixed(2));
  const calculatedNetKoin = Number(Math.max(0, numericAmount - calculatedFee).toFixed(2));
  const calculatedBs = Number((calculatedNetKoin * tasaParalelo).toFixed(2));

  const handleRequestPayout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (numericAmount <= 0) {
      setError("Por favor ingresa un monto mayor a cero.");
      return;
    }

    if (numericAmount > balanceKoin) {
      setError(`No tienes suficiente saldo disponible (${balanceKoin.toFixed(2)} KOIN).`);
      return;
    }

    if (!selectedMethodId) {
      setError("Debes agregar y seleccionar una cuenta bancaria o PagoMóvil para recibir los Bolívares.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.set("amountKoin", withdrawAmount);
    formData.set("paymentMethodId", selectedMethodId);

    try {
      const res = await requestPayoutAction(formData);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      setSuccessMessage(res.message || "Solicitud de retiro enviada exitosamente.");
      setTimeout(() => {
        window.location.reload();
      }, 2500);
    } catch {
      setError("Error de conexión al procesar la solicitud de retiro.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TARJETAS DE CABECERA: SALDO, TASA PARALELO Y STATUS DE COMISIÓN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Saldo Disponible */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">Saldo para Retirar</span>
            <Wallet className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-3xl font-black text-amber-400">
              {balanceKoin.toFixed(2)} <span className="text-sm font-bold text-amber-500/80">KOIN</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Equivalente: <strong>{formatBs(balanceKoin * tasaParalelo)}</strong>
            </span>
          </div>
        </div>

        {/* Tasa Dólar Paralelo en Tiempo Real */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl p-5 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              Tasa Valor Paralelo
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              Bs. {tasaParalelo.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block truncate">
              {fuenteTasa} • Actualizado hoy
            </span>
          </div>
        </div>

        {/* Estatus / Nivel de Comisión de la Creadora */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-rose-500/30 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">Tu Comisión Actual</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Nivel {tierInfo.currentLevel ?? 0}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl sm:text-3xl font-black text-rose-400">
                {tierInfo.feePct}%
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {tierInfo.name.split("—")[0]?.trim() || tierInfo.name}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1.5">
              Tramo actual: <strong>Nivel {tierInfo.minLevel ?? 0} al {tierInfo.maxLevel ?? 30}</strong>
            </p>
            {tierInfo.nextLevelTarget != null && tierInfo.nextFeePct != null ? (
              <p className="text-[11px] text-emerald-400 mt-0.5 font-medium">
                Al alcanzar el <strong>Nivel {tierInfo.nextLevelTarget}</strong> tu comisión baja al <strong>{tierInfo.nextFeePct}%</strong>
              </p>
            ) : (
              <p className="text-[11px] text-emerald-400 mt-0.5 font-medium">
                ¡Disfrutas del tramo preferencial más bajo de comisión!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* DESPLIEGUE DETALLADO DE TRAMOS DE COMISIÓN POR NIVEL */}
      {tierInfo.allRules && tierInfo.allRules.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Escala de Comisiones por Nivel de Creadora
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Conoce exactamente en qué nivel disminuye tu porcentaje de comisión de plataforma. Tu nivel actual es <strong className="text-amber-400">Nivel {tierInfo.currentLevel ?? 0}</strong> (Volumen acumulado: ${totalEarnedKoin.toFixed(2)} KOIN).
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {tierInfo.allRules.map((rule) => {
              const currentLvl = tierInfo.currentLevel ?? 0;
              const isCurrent = currentLvl >= rule.minLevel && currentLvl <= rule.maxLevel;
              return (
                <div
                  key={rule.id}
                  className={`p-3.5 rounded-2xl border transition flex flex-col justify-between ${
                    isCurrent
                      ? "bg-rose-950/30 border-rose-500/50 shadow-md shadow-rose-950/30"
                      : "bg-slate-950/70 border-slate-800/80 opacity-80"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                        Nivel {rule.minLevel} al {rule.maxLevel}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white uppercase">
                          Tu Nivel Actual
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-white">{rule.feePct}%</span>
                      <span className="text-[11px] text-emerald-400 font-bold">
                        (Recibes {100 - rule.feePct}% neto)
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-300 mt-1">{rule.name}</p>
                  </div>
                  {rule.description && (
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">{rule.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. PESTAÑAS DE NAVEGACIÓN */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("withdraw")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition ${
            activeTab === "withdraw"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <ArrowDownToLine className="w-4 h-4" />
          Solicitar Retiro en Bolívares
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition ${
            activeTab === "history"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Clock className="w-4 h-4" />
          Historial y Estado ({payouts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("subscribers")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition ${
            activeTab === "subscribers"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Users className="w-4 h-4" />
          Mis Suscriptores ({subscribers.length})
        </button>
      </div>

      {/* 3. CONTENIDO DE LAS PESTAÑAS */}

      {/* PESTAÑA A: CALCULADORA Y SOLICITUD DE RETIRO */}
      {activeTab === "withdraw" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Formulario / Calculadora */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
            <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-rose-500" />
              Calculadora de Retiro en Bolívares (VES)
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Ingresa el monto en KOIN que deseas retirar. El sistema aplicará tu descuento de comisión del {tierInfo.feePct}% y calculará automáticamente los Bolívares que llegarán a tu cuenta bancaria según el valor paralelo.
            </p>

            {error && (
              <div className="p-4 bg-red-950/60 border border-red-500/40 rounded-2xl text-red-300 text-xs flex items-center gap-2 mb-5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs flex items-center gap-2 mb-5 animate-pulse">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleRequestPayout} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Monto a Retirar (KOIN)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="5"
                    max={balanceKoin}
                    required
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="ej: 20"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-4 pr-16 text-white text-base font-bold focus:border-rose-500 focus:outline-hidden"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">
                    KOIN
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                  <span>Mínimo: 5.00 KOIN</span>
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(balanceKoin.toString())}
                    className="text-rose-400 hover:underline font-semibold"
                  >
                    Retirar Todo ({balanceKoin.toFixed(2)} KOIN)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cuenta de Destino en Venezuela
                </label>
                {paymentMethods.length > 0 ? (
                  <div className="space-y-1.5">
                    <select
                      value={selectedMethodId}
                      onChange={(e) => setSelectedMethodId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                    >
                      {paymentMethods.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.type === "BANK_TRANSFER" && `Transferencia: ${m.bank?.nombreBanco || "Banco"} — ${m.accountNumber}`}
                          {m.type === "PAGOMOVIL" && `PagoMóvil: ${m.bank?.nombreBanco || "Banco"} — Tel: ${m.phone} (${m.idDocument || ""})`}
                          {m.type === "BINANCE" && `Binance USDT: ${m.binanceEmail}`}
                        </option>
                      ))}
                    </select>
                    <a
                      href="#metodos-de-cobro"
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold hover:underline"
                    >
                      + Agregar o editar cuenta en Configuración de Métodos de Cobro (abajo) ↓
                    </a>
                  </div>
                ) : (
                  <div className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-2xl text-xs text-amber-300 space-y-2">
                    <p>
                      Aún no tienes cuentas configuradas. Ve a la sección inferior de{" "}
                      <a
                        href="#metodos-de-cobro"
                        className="font-bold text-amber-200 underline hover:text-white transition"
                      >
                        Métodos de Cobro
                      </a>{" "}
                      para agregar tu cuenta bancaria o PagoMóvil.
                    </p>
                    <a
                      href="#metodos-de-cobro"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-[11px] border border-amber-500/40 transition"
                    >
                      <Landmark className="w-3.5 h-3.5" />
                      Ir a Configuración de Métodos de Cobro (Venezuela y Cripto) ↓
                    </a>
                  </div>
                )}
              </div>

              {/* Botón de solicitud */}
              <button
                type="submit"
                disabled={loading || paymentMethods.length === 0 || numericAmount <= 0}
                className="w-full py-3.5 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Procesando solicitud..." : "Solicitar Retiro en Bolívares"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Desglose Transparente */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-4">
                Desglose Transparente en Vivo
              </span>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center text-slate-300 pb-2 border-b border-slate-800">
                  <span>Monto Solicitado:</span>
                  <strong className="text-white text-sm">{numericAmount.toFixed(2)} KOIN</strong>
                </div>

                <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                  <span className="flex items-center gap-1">
                    Comisión Plataforma ({tierInfo.feePct}%):
                  </span>
                  <strong className="text-rose-400">-{calculatedFee.toFixed(2)} KOIN</strong>
                </div>

                <div className="flex justify-between items-center text-slate-300 pb-2 border-b border-slate-800">
                  <span>Neto en KOIN:</span>
                  <strong className="text-amber-400 text-sm">{calculatedNetKoin.toFixed(2)} KOIN</strong>
                </div>

                <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                  <span>Tasa Paralelo DolarAPI:</span>
                  <strong className="text-emerald-400">Bs. {tasaParalelo.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</strong>
                </div>

                {/* Resultado en Bolívares */}
                <div className="p-4 bg-slate-950 border border-emerald-500/30 rounded-2xl mt-4 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Monto que recibirás en tu banco
                  </span>
                  <div className="text-2xl font-black text-emerald-400">
                    {formatBs(calculatedBs)}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Calculado 100% en base al Valor Paralelo oficial de la API.
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-500 leading-relaxed flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Tu solicitud quedará en estado <strong>EN ESPERA</strong>. Tan pronto como el Super Administrador realice la transferencia, verás el <strong>Número de Transferencia</strong> en tu historial de pagos.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA B: HISTORIAL DE RETIROS CON ESTADO "EN ESPERA" Y NRO DE TRANSFERENCIA */}
      {activeTab === "history" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Historial de Solicitudes de Retiro y Pagos
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Monitorea el estado de tus retiros en tiempo real y consulta los números de transferencia bancaria registrados por el Administrador.
          </p>

          {payouts.length > 0 ? (
            <div className="space-y-4">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="p-5 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-700 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {p.status === "PAID" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          PAGADO CON ÉXITO
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                          <Clock className="w-3 h-3" />
                          EN ESPERA
                        </span>
                      )}

                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(p.createdAt).toLocaleString("es-VE")}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300">
                      Retiro de <strong>{p.grossKoin.toFixed(2)} KOIN</strong> (Comisión {p.feePct || 15}%: -{p.feeKoin.toFixed(2)} KOIN)
                    </div>

                    {/* Número de Transferencia asignado por Super Admin */}
                    {p.status === "PAID" ? (
                      <div className="pt-1 flex items-center gap-2 text-xs">
                        <span className="font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                          <Hash className="w-3.5 h-3.5" />
                          Nro. de Transferencia: {p.transactionRef || "Verificado"}
                        </span>
                        {p.paidAt && (
                          <span className="text-[11px] text-slate-500">
                            Transferido el {new Date(p.paidAt).toLocaleString("es-VE")}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="pt-1 text-[11px] text-amber-400/90 italic">
                        El Administrador está procesando la transferencia bancaria. Tan pronto se liquide, aparecerá tu número de referencia aquí.
                      </div>
                    )}
                  </div>

                  {/* Monto en Bolívares */}
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                      Monto en Bolívares
                    </span>
                    <div className="text-xl font-black text-emerald-400 font-mono">
                      {p.amountVes ? formatBs(p.amountVes) : `$${p.netKoin.toFixed(2)} USD`}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Tasa: Bs. {p.usdRateVes?.toFixed(2) || tasaParalelo.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-xs text-slate-500 bg-slate-950 rounded-2xl border border-slate-800">
              Aún no has realizado solicitudes de retiro. Usa la pestaña "Solicitar Retiro en Bolívares" para cobrar tus ganancias.
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA C: LISTA DE SUSCRIPTORES Y PAGOS EN KOIN */}
      {activeTab === "subscribers" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                <Users className="w-5 h-5 text-rose-500" />
                Mis Suscriptores y Pagos Recibidos
              </h2>
              <p className="text-xs text-slate-400">
                Consulta en vivo quiénes son tus suscriptores, el valor pagado y el monto neto que te corresponde en KOIN.
              </p>
            </div>
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Total Suscriptores Activos
              </span>
              <span className="text-xl font-black text-white">{subscribers.length}</span>
            </div>
          </div>

          {subscribers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Suscriptor</th>
                    <th className="py-3.5 px-4">Pago Suscripción</th>
                    <th className="py-3.5 px-4">Tu Ganancia Neta ({100 - tierInfo.feePct}%)</th>
                    <th className="py-3.5 px-4">Fecha Inicio</th>
                    <th className="py-3.5 px-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {subscribers.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4">
                        <UserLevelBadge
                          level={sub.subscriberLevel}
                          username={sub.subscriberUsername}
                          vipBadgeText={sub.vipBadgeText}
                          vipBadgeColor={sub.vipBadgeColor}
                        />
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        {sub.priceKoin.toFixed(2)} KOIN
                      </td>
                      <td className="py-3.5 px-4 font-black text-emerald-400">
                        +{sub.creatorNetKoin.toFixed(2)} KOIN
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(sub.startDate).toLocaleDateString("es-VE")}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {sub.status === "ACTIVE" ? "Activa" : sub.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-xs text-slate-500 bg-slate-950 rounded-2xl border border-slate-800">
              Aún no tienes suscriptores registrados. Comparte tu enlace de perfil para conseguir tus primeros suscriptores.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
