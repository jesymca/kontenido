import { auth, signOut } from "@/auth";
import { ShieldAlert, AlertOctagon, LogOut } from "lucide-react";
import Link from "next/link";

/**
 * Página de visualización para usuarios cuya cuenta ha sido suspendida
 * Cumple con la regla de suspensión inmediata y notificación de motivo
 */
export default async function SuspendidoPage() {
  const session = await auth();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <div className="max-w-md w-full bg-slate-900 border border-red-500/40 rounded-2xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
        {/* Glow de advertencia */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-red-700" />

        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4 text-red-500">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-white tracking-tight">Cuenta Suspendida</h1>
        <p className="text-red-400 text-sm mt-1 font-medium flex items-center justify-center gap-1">
          <AlertOctagon className="w-4 h-4" /> Alerta de Comportamiento Detectado
        </p>

        <div className="bg-red-950/40 border border-red-900/50 rounded-xl p-4 my-6 text-left">
          <span className="text-[11px] font-bold text-red-300 uppercase tracking-wider block mb-1">
            Motivo de la sanción:
          </span>
          <p className="text-sm text-red-100">
            {session?.user?.suspensionReason ||
              "Se detectaron intentos no autorizados de descarga, inspección o extracción de contenido protegido de creadoras."}
          </p>
        </div>

        <p className="text-slate-400 text-xs leading-relaxed mb-6">
          En <strong>KONTENIDO</strong> protegemos el trabajo de las creadoras. Las descargas están restringidas a usuarios VIP autorizados. Si consideras que se trata de un error, puedes solicitar revisión al soporte administrativo.
        </p>

        <div className="flex flex-col gap-2.5">
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 px-4 rounded-xl transition text-sm"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </form>

          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-white transition py-1"
          >
            Volver a la página principal
          </Link>
        </div>
      </div>
    </div>
  );
}
