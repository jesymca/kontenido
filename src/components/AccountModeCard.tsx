"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Eye,
  ArrowRight,
  Wallet,
  AlertCircle,
  Loader2,
  X,
  RefreshCw,
  CheckCircle2,
  Coins,
} from "lucide-react";
import {
  activateCreatorModeAction,
  switchToConsumerModeAction,
} from "@/actions/roleMode";

interface AccountModeCardProps {
  currentRole: string;
  username: string;
  isVenezuela: boolean;
  variant: "cuenta" | "panel-perfil";
}

/**
 * Tarjeta educativa y de cambio rápido de modo:
 * Deja cristalino que una cuenta puede usarse para:
 * - CREAR CONTENIDO PARA VENDER (/panel)
 * - CONSUMIR / VER CONTENIDO (/cuenta)
 * Y permite alternar entre ambos sin perder saldo KOIN, nivel ni suscripciones.
 */
export default function AccountModeCard({
  currentRole,
  username,
  isVenezuela,
  variant,
}: AccountModeCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<"TO_CREATOR" | "TO_CONSUMER" | null>(null);

  if (currentRole === "SUPER_ADMIN" || currentRole === "AGENCY") {
    return null;
  }

  const isCreator = currentRole === "CREATOR";

  const handleConfirmSwitch = async () => {
    if (!confirmModal) return;
    setLoading(true);
    setError(null);

    try {
      const res =
        confirmModal === "TO_CREATOR"
          ? await activateCreatorModeAction()
          : await switchToConsumerModeAction();

      if (res?.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      window.location.href = res?.redirectTo || (confirmModal === "TO_CREATOR" ? "/panel" : "/cuenta");
    } catch {
      setError("Ocurrió un error al cambiar el modo de tu cuenta.");
      setLoading(false);
    }
  };

  // Vista en /cuenta cuando es CONSUMIDOR -> Invitación clara para también CREAR Y VENDER contenido
  if (variant === "cuenta" && !isCreator) {
    return (
      <>
        <div className="mb-8 p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/40 border border-slate-800 rounded-3xl shadow-xl space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-black uppercase tracking-wider">
                <Eye className="w-3 h-3" />
                Modo Actual: Consumidor (Ver y Comprar Contenido)
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                ¿También quieres subir contenido para vender y ganar dinero?
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                En KONTENIDO hay dos modos muy claros: <strong className="text-sky-300">Consumidor</strong> (recargas KOIN para ver perfiles y suscribirte) y{" "}
                <strong className="text-rose-400">Creador/a de Contenido</strong> (subes tus propias fotos/videos, fijas precios y retiras tus ganancias{" "}
                {isVenezuela ? "en Bolívares o USDT" : "directamente en USDT"}). Al activar tu Estudio de Creador/a{" "}
                <strong className="text-white">conservas intactos tu saldo KOIN, nivel y suscripciones actuales</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setConfirmModal("TO_CREATOR");
              }}
              className="px-5 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-sm transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Activar Modo Creador (Vender)
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {renderModal()}
      </>
    );
  }

  // Vista en /panel/perfil (o en /cuenta como CREADOR): explica uso dual + opción de volver a solo Consumidor
  return (
    <>
      <div
        className={`p-5 sm:p-6 rounded-3xl border shadow-xl ${
          variant === "cuenta"
            ? "mb-8 bg-gradient-to-r from-rose-950/60 via-slate-900 to-amber-950/30 border-rose-500/40"
            : "mt-6 bg-slate-900 border-slate-800"
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-black uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                Modo Activo: Creador/a (Crear para Vender)
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-bold">
                <CheckCircle2 className="w-3 h-3" />
                También puedes comprar y suscribirte a otros perfiles
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-black text-white">
              {variant === "cuenta"
                ? "Tu cuenta funciona en ambos modos: Vender (/panel) y Consumir (/cuenta)"
                : "¿Cómo funciona Vender vs Consumir en tu cuenta?"}
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              • <strong className="text-rose-400">Para Vender Contenido:</strong> usa tu{" "}
              <Link href="/panel" className="underline text-white hover:text-rose-300">
                Estudio de Creador/a (/panel)
              </Link>{" "}
              para publicar fotos/videos, configurar precios y solicitar{" "}
              <Link href="/panel/pagos" className="underline text-amber-300 hover:text-amber-200">
                retiros ({isVenezuela ? "Bs. / USDT" : "USDT"})
              </Link>
              .
              <br />• <strong className="text-sky-300">Para Ver / Comprar Contenido de otros:</strong>{" "}
              no necesitas otra cuenta; usa{" "}
              <Link href="/cuenta" className="underline text-white hover:text-sky-300">
                Mi Billetera Fan (/cuenta)
              </Link>{" "}
              para recargar USDT, activar VIP o ver{" "}
              <Link href="/cuenta/suscripciones" className="underline text-white hover:text-sky-300">
                tus suscripciones
              </Link>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {variant === "cuenta" ? (
              <>
                <Link
                  href="/panel"
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ir a Mi Estudio (Vender)
                </Link>
                <Link
                  href="/panel/pagos"
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl transition border border-amber-500/30 flex items-center gap-1.5"
                >
                  <Coins className="w-3.5 h-3.5" />
                  {isVenezuela ? "Retiros (Bs. / USDT)" : "Retiros (USDT)"}
                </Link>
              </>
            ) : (
              <Link
                href="/cuenta"
                className="px-4 py-2.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5" />
                Ir a Modo Consumidor (Comprar / Recargar)
              </Link>
            )}

            <button
              type="button"
              onClick={() => {
                setError(null);
                setConfirmModal("TO_CONSUMER");
              }}
              className="px-3.5 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="Si te registraste como Creador por error o solo quieres consumir contenido"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              Solo Consumidor
            </button>
          </div>
        </div>
      </div>

      {renderModal()}
    </>
  );

  function renderModal() {
    if (!confirmModal) return null;

    const toCreator = confirmModal === "TO_CREATOR";

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={() => {
          if (!loading) setConfirmModal(null);
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${
                  toCreator
                    ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                    : "bg-sky-500/15 border-sky-500/30 text-sky-400"
                }`}
              >
                {toCreator ? <Sparkles className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  {toCreator
                    ? "Activar Modo Creador/a de Contenido"
                    : "Cambiar a Solo Consumidor"}
                </h3>
                <p className="text-xs text-slate-400 font-mono">@{username}</p>
              </div>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => setConfirmModal(null)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2">
            {toCreator ? (
              <>
                <p>
                  Se habilitará tu <strong className="text-white">Estudio de Creador/a (/panel)</strong>{" "}
                  para que puedas publicar fotos/videos de pago, configurar planes de suscripción y cobrar ingresos.
                </p>
                <p className="text-slate-400 text-xs">
                  • Mantendrás tu saldo actual de KOIN, tu nivel, tus suscripciones activas y tus fotos en KOMESTIBLE.
                  <br />• Podrás seguir comprando o suscribiéndote a otros creadores desde{" "}
                  <strong className="text-slate-200">/cuenta</strong>.
                </p>
              </>
            ) : (
              <>
                <p>
                  ¿Confirmas cambiar tu cuenta a <strong className="text-sky-300">Solo Consumidor</strong>?
                </p>
                <p className="text-slate-400 text-xs">
                  • Tu perfil dejará de aparecer publicado en el catálogo de creadores en venta.
                  <br />• Tus KOIN, nivel, compras, suscripciones y matches de KOINCIDEN permanecerán intactos, y podrás reactivar el Estudio de Creador cuando quieras.
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              disabled={loading}
              onClick={() => setConfirmModal(null)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleConfirmSwitch}
              className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
                toCreator
                  ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30"
                  : "bg-sky-600 hover:bg-sky-700 shadow-sky-600/30"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Aplicando...</span>
                </>
              ) : toCreator ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sí, Activar Creador/a</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Sí, Cambiar a Consumidor</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
