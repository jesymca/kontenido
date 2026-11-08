import { auth } from "@/auth";
import { db } from "@/lib/db";
import { agencies, agencyCreators, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { LayoutDashboard, Users, TrendingUp, Sparkles, Plus } from "lucide-react";
import Link from "next/link";

/**
 * Panel de Atención y Gestión para Agencias (/agencia)
 * Cumple con 09_AGENCIAS.md
 */
export default async function AgenciaPage() {
  const session = await auth();
  if (!session?.user) return null;

  const agency = await db.query.agencies.findFirst({
    where: eq(agencies.ownerUserId, session.user.id),
  });

  const affiliated = agency
    ? await db.query.agencyCreators.findMany({
        where: eq(agencyCreators.agencyId, agency.id),
      })
    : [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-7 h-7 text-indigo-500" />
            Panel de Agencia
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Gestiona creadoras afiliadas, métricas consolidadas y liquidaciones de comisión.
          </p>
        </div>
      </div>

      {agency ? (
        <div className="space-y-8">
          {/* Métricas de la agencia */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl">
              <span className="text-slate-400 text-xs font-semibold block mb-1">
                Agencia
              </span>
              <div className="text-xl font-bold text-white">{agency.name}</div>
              <span className="text-[11px] text-indigo-400 mt-2 block">
                Comisión: {agency.commissionPct}%
              </span>
            </div>

            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl">
              <span className="text-slate-400 text-xs font-semibold block mb-1">
                Creadoras Afiliadas
              </span>
              <div className="text-2xl font-black text-white">{affiliated.length}</div>
              <span className="text-[11px] text-slate-500 mt-2 block">
                Modelos bajo gestión
              </span>
            </div>

            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl">
              <span className="text-slate-400 text-xs font-semibold block mb-1">
                Estado
              </span>
              <div className="text-xl font-bold text-emerald-400">
                {agency.status === "ACTIVE" ? "Activa ✓" : "En Revisión"}
              </div>
              <span className="text-[11px] text-slate-500 mt-2 block">
                Aprobada por SUPER_ADMIN
              </span>
            </div>
          </div>

          {/* Listado de creadoras */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4">Creadoras en tu Agencia</h3>
            {affiliated.length > 0 ? (
              <div className="space-y-3">
                {affiliated.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between"
                  >
                    <span className="text-xs font-bold text-white">ID: {item.creatorId}</span>
                    <span className="text-xs text-slate-400">Estado: {item.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500 text-xs">
                Aún no tienes creadoras afiliadas a tu agencia.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center max-w-md mx-auto">
          <Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">Registro de Agencia</h3>
          <p className="text-xs text-slate-400 mt-1 mb-6 leading-relaxed">
            Representa a múltiples modelos en KONTENIDO y gestiona sus cobros con comisiones automáticas.
          </p>
          <button
            type="button"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30"
          >
            Solicitar Afiliación de Agencia
          </button>
        </div>
      )}
    </div>
  );
}
