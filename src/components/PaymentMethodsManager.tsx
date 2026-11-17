"use client";

import { useState } from "react";
import { Landmark, Smartphone, Coins, Plus, Trash2, AlertCircle, Wallet } from "lucide-react";
import { savePaymentMethodAction, deletePaymentMethodAction } from "@/actions/creator";
import { USDT_NETWORKS } from "@/lib/countries";

interface Bank {
  id: number;
  nombreBanco: string;
  codigo?: string | null;
}

interface PaymentMethod {
  id: string;
  type: "BANK_TRANSFER" | "PAGOMOVIL" | "BINANCE" | "USDT_WALLET";
  bankId: number | null;
  accountNumber: string | null;
  accountHolder: string | null;
  idDocument: string | null;
  phone: string | null;
  binanceEmail: string | null;
  usdtNetwork?: string | null;
  isActive: number;
}

interface Props {
  banks: Bank[];
  existingMethods: PaymentMethod[];
  isVenezuela?: boolean;
}

/**
 * Gestor interactivo de métodos de pago para creadoras
 * - Venezuela: PagoMóvil, Transferencia Bancaria Nacional, Binance USDT y Wallet USDT
 * - Internacional: exclusivamente Binance Pay / USDT y Wallet USDT (sin Bolívares)
 */
export default function PaymentMethodsManager({
  banks,
  existingMethods,
  isVenezuela = true,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "BANK_TRANSFER" | "PAGOMOVIL" | "BINANCE" | "USDT_WALLET"
  >(isVenezuela ? "PAGOMOVIL" : "BINANCE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleMethods = isVenezuela
    ? existingMethods
    : existingMethods.filter((m) => m.type === "BINANCE" || m.type === "USDT_WALLET");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("type", activeTab);

    try {
      const res = await savePaymentMethodAction(formData);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Error al guardar método de pago.");
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Deseas eliminar este método de cobro?")) return;
    await deletePaymentMethodAction(id);
    window.location.reload();
  };

  return (
    <div className="space-y-8">
      {/* 1. MÉTODOS YA CONFIGURADOS */}
      {visibleMethods.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Tus métodos de cobro activos ({visibleMethods.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleMethods.map((m) => {
              const bankName = banks.find((b) => b.id === m.bankId)?.nombreBanco || "Banco Nacional";
              return (
                <div
                  key={m.id}
                  className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-start justify-between gap-3 shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 text-rose-400 flex items-center justify-center shrink-0">
                      {m.type === "BANK_TRANSFER" && <Landmark className="w-5 h-5" />}
                      {m.type === "PAGOMOVIL" && <Smartphone className="w-5 h-5" />}
                      {m.type === "BINANCE" && <Coins className="w-5 h-5" />}
                      {m.type === "USDT_WALLET" && <Wallet className="w-5 h-5 text-emerald-400" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                        {m.type === "BANK_TRANSFER" && "Transferencia Bancaria"}
                        {m.type === "PAGOMOVIL" && "PagoMóvil"}
                        {m.type === "BINANCE" && "Binance Pay / USDT"}
                        {m.type === "USDT_WALLET" && `Wallet USDT (${m.usdtNetwork || "TRC20"})`}
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-semibold">
                          Activo
                        </span>
                      </div>

                      {m.type === "BANK_TRANSFER" && (
                        <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                          <p className="text-slate-200 font-medium">{bankName}</p>
                          <p>Cuenta: {m.accountNumber}</p>
                          <p>
                            Titular: {m.accountHolder} ({m.idDocument})
                          </p>
                        </div>
                      )}

                      {m.type === "PAGOMOVIL" && (
                        <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                          <p className="text-slate-200 font-medium">{bankName}</p>
                          <p>Tlf: {m.phone}</p>
                          <p>C.I.: {m.idDocument}</p>
                        </div>
                      )}

                      {(m.type === "BINANCE" || m.type === "USDT_WALLET") && (
                        <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                          <p className="text-slate-200 font-medium font-mono break-all">
                            {m.binanceEmail}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg transition"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. FORMULARIO PARA AGREGAR NUEVO MÉTODO */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <h3 className="text-base font-bold text-white mb-4">
          {isVenezuela
            ? "Agregar método de cobro (Bolívares o USDT)"
            : "Agregar método de cobro internacional (100% USDT)"}
        </h3>

        {/* Pestañas de métodos */}
        <div
          className={`grid gap-2 mb-6 ${
            isVenezuela ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"
          }`}
        >
          {isVenezuela && (
            <>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("PAGOMOVIL");
                  setError(null);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === "PAGOMOVIL"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                PagoMóvil
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("BANK_TRANSFER");
                  setError(null);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === "BANK_TRANSFER"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                Banco Nacional
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setActiveTab("BINANCE");
              setError(null);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === "BINANCE"
                ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            Binance Pay / USDT
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("USDT_WALLET");
              setError(null);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === "USDT_WALLET"
                ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Wallet USDT Directa
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Formulario PagoMóvil */}
          {isVenezuela && activeTab === "PAGOMOVIL" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Banco Receptor (30 Bancos de Venezuela)
                </label>
                <select
                  name="bankId"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
                >
                  <option value="">Selecciona tu banco...</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id}. {b.nombreBanco} {b.codigo ? `(${b.codigo})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Teléfono PagoMóvil
                  </label>
                  <input
                    name="phone"
                    type="text"
                    required
                    placeholder="0414-1234567"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Cédula del Titular
                  </label>
                  <input
                    name="idDocument"
                    type="text"
                    required
                    placeholder="V-12345678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </>
          )}

          {/* Formulario Transferencia Bancaria */}
          {isVenezuela && activeTab === "BANK_TRANSFER" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Banco de la Cuenta
                </label>
                <select
                  name="bankId"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
                >
                  <option value="">Selecciona tu banco...</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id}. {b.nombreBanco} {b.codigo ? `(${b.codigo})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Número de Cuenta Bancaria (20 dígitos)
                </label>
                <input
                  name="accountNumber"
                  type="text"
                  required
                  maxLength={20}
                  placeholder="01020000000000000000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nombre del Titular
                  </label>
                  <input
                    name="accountHolder"
                    type="text"
                    required
                    placeholder="Nombre completo"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Cédula o RIF
                  </label>
                  <input
                    name="idDocument"
                    type="text"
                    required
                    placeholder="V-12345678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </>
          )}

          {/* Formulario Binance */}
          {activeTab === "BINANCE" && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Correo o Binance Pay ID
              </label>
              <input
                name="binanceEmail"
                type="text"
                required
                placeholder="ej: tu_correo@binance.com o Pay ID (ej: 123456789)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Se enviarán USDT directamente a tu cuenta Binance sin conversión a moneda local.
              </p>
            </div>
          )}

          {/* Formulario Wallet USDT Directa */}
          {activeTab === "USDT_WALLET" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Red Cripto (Blockchain)
                </label>
                <select
                  name="usdtNetwork"
                  required
                  defaultValue="TRC20"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
                >
                  {USDT_NETWORKS.map((net) => (
                    <option key={net.value} value={net.value}>
                      {net.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Dirección de Billetera (Wallet Address USDT)
                </label>
                <input
                  name="binanceEmail"
                  type="text"
                  required
                  placeholder="ej: T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb o 0x..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white font-mono text-sm focus:border-rose-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Verifica que la dirección corresponda exactamente a la red seleccionada.
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl transition text-sm shadow-md shadow-rose-600/30 disabled:opacity-50 mt-2"
          >
            <Plus className="w-4 h-4" />
            {loading ? "Guardando..." : "Guardar Método de Cobro"}
          </button>
        </form>
      </div>
    </div>
  );
}
