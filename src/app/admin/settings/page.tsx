import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { updatePlatformSettingsAction } from "@/actions/admin";
import { Settings, Save, Percent, DollarSign, ShieldCheck, Wallet } from "lucide-react";

/**
 * Vista de Configuración Global del Sistema (/admin/settings)
 * CRUD Completo de SUPER_ADMIN para comisiones escalonadas (10%, 15%, 20%),
 * paridad KOIN, direcciones de recarga y parámetros de liquidación.
 */
export default async function AdminSettingsPage() {
  const allSettings = await db.query.settings.findMany();
  const getVal = (key: string, def = "") =>
    allSettings.find((s) => s.key === key)?.value || def;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-rose-500" />
          Configuraciones Generales de KONTENIDO
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Control total de comisiones escalonadas, tasa paralelo de contingencia, billeteras USDT y parámetros VIP.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <form
          action={async (formData: FormData) => {
            "use server";
            await updatePlatformSettingsAction(formData);
          }}
          className="space-y-6"
        >
          {/* SECCIÓN 1: COMISIONES ESCALONADAS POR STATUS / MONTO GENERAL */}
          <div className="p-5 bg-slate-950/80 border border-rose-500/30 rounded-2xl space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
              <Percent className="w-5 h-5 text-rose-400" />
              <div>
                <h3 className="text-white font-bold text-sm">Comisiones Escalonadas de Creadoras</h3>
                <p className="text-slate-400 text-xs">
                  Mientras mayor sea el monto general generado por la creadora, menor será el porcentaje de comisión descontado.
                </p>
              </div>
            </div>

            {/* Nivel 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div>
                <label className="block text-xs font-semibold text-amber-300 mb-1">
                  Nivel 1 — Volumen Máximo ($)
                </label>
                <input
                  name="fee_tier1_max"
                  type="number"
                  step="10"
                  min="50"
                  required
                  defaultValue={getVal("fee_tier1_max", "500.0")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:border-rose-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Creadoras iniciales (hasta $500).</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-amber-300 mb-1">
                  Nivel 1 — Comisión (%)
                </label>
                <input
                  name="fee_tier1_pct"
                  type="number"
                  step="0.5"
                  min="1"
                  max="50"
                  required
                  defaultValue={getVal("fee_tier1_pct", "20.0")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:border-rose-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Porcentaje de descuento (ej: 20%).</span>
              </div>
            </div>

            {/* Nivel 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div>
                <label className="block text-xs font-semibold text-blue-300 mb-1">
                  Nivel 2 — Volumen Máximo ($)
                </label>
                <input
                  name="fee_tier2_max"
                  type="number"
                  step="50"
                  min="100"
                  required
                  defaultValue={getVal("fee_tier2_max", "2000.0")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:border-rose-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Creadoras intermedias (de $501 a $2,000).</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-300 mb-1">
                  Nivel 2 — Comisión (%)
                </label>
                <input
                  name="fee_tier2_pct"
                  type="number"
                  step="0.5"
                  min="1"
                  max="50"
                  required
                  defaultValue={getVal("fee_tier2_pct", "15.0")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:border-rose-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Porcentaje de descuento (ej: 15%).</span>
              </div>
            </div>

            {/* Nivel 3 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div>
                <label className="block text-xs font-semibold text-emerald-300 mb-1">
                  Nivel 3 — Estatus Top Creadora
                </label>
                <div className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-slate-400 text-xs">
                  Aplica para volumen superior al Nivel 2
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Mayor monto general acumulado.</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-300 mb-1">
                  Nivel 3 — Comisión Top (%)
                </label>
                <input
                  name="fee_tier3_pct"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="50"
                  required
                  defaultValue={getVal("fee_tier3_pct", "10.0")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:border-rose-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Comisión preferencial reducida (ej: 10%).</span>
              </div>
            </div>

            {/* Tasa de respaldo y fallback */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tasa Dólar Paralelo de Respaldo (Bs. / USD)
              </label>
              <input
                name="fallback_usd_ves_rate"
                type="number"
                step="0.01"
                min="1"
                required
                defaultValue={getVal("fallback_usd_ves_rate", "1030.88")}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:border-rose-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Valor utilizado únicamente en caso de contingencia si la API https://ve.dolarapi.com/v1/dolares/ no responde.
              </span>
            </div>
          </div>

          {/* SECCIÓN 2: PARÁMETROS GENERALES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Comisión Estándar por Defecto (%)
              </label>
              <input
                name="platform_fee_pct"
                type="number"
                step="0.5"
                min="0"
                max="50"
                required
                defaultValue={getVal("platform_fee_pct", "15.0")}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Comisión base de referencia para el sistema.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Paridad KOIN / USD
              </label>
              <input
                name="koin_usd_parity"
                type="number"
                step="0.01"
                min="0.1"
                required
                defaultValue={getVal("koin_usd_parity", "1.0")}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                1 KOIN ≈ 1 USDT por defecto.
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Dirección USDT TRC20 (Tron) para Recargas
            </label>
            <input
              name="usdt_trc20_address"
              type="text"
              required
              defaultValue={getVal("usdt_trc20_address", "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb")}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm font-mono focus:border-rose-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Dirección USDT BEP20 (BNB Chain) para Recargas
            </label>
            <input
              name="usdt_bep20_address"
              type="text"
              required
              defaultValue={getVal("usdt_bep20_address", "0x71C83638209121a91e57c61775e54d5885dc8bA8")}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm font-mono focus:border-rose-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-amber-400 mb-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              ID de Binance / Binance Pay ID para Recargas
            </label>
            <input
              name="binance_pay_id"
              type="text"
              defaultValue={getVal("binance_pay_id", "")}
              placeholder="ej: 123456789 (Binance Pay ID o Correo Binance)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm font-mono focus:border-rose-500 focus:outline-hidden"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Permite a los usuarios enviar USDT directamente por ID de Binance sin comisiones de red adicionales.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Inversión Mínima ($) para Habilitar Descargas VIP
            </label>
            <input
              name="vip_download_min_spent"
              type="number"
              step="1"
              min="1"
              required
              defaultValue={getVal("vip_download_min_spent", "100.0")}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Consumidores con esta inversión acumulada podrán descargar contenido de forma autorizada.
            </span>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl transition text-sm shadow-md shadow-rose-600/30"
          >
            <Save className="w-4 h-4" />
            Guardar Parámetros y Comisiones Escalonadas
          </button>
        </form>
      </div>
    </div>
  );
}
