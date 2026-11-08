import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscriptions, users, creatorSubscriptionPlans } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import CreatorPanelNav from "@/components/CreatorPanelNav";
import CreatorPlansManager from "@/components/CreatorPlansManager";
import UserLevelBadge from "@/components/UserLevelBadge";
import { Users, Calendar, ShieldCheck, Clock, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Pantalla de Gestión de Membresías y Suscriptores de la Creadora (/panel/suscripciones)
 * - Configura hasta 3 opciones de planes con precios y duraciones personalizadas
 * - Visualiza la lista de clientes activos con su vencimiento exacto
 */
export default async function CreatorSubscriptionsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;

  const [currentUser, plans, activeSubscriptions] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
    }),
    db.query.creatorSubscriptionPlans.findMany({
      where: eq(creatorSubscriptionPlans.creatorId, userId),
      orderBy: [creatorSubscriptionPlans.orderIndex],
    }),
    db.query.subscriptions.findMany({
      where: eq(subscriptions.creatorId, userId),
      orderBy: [desc(subscriptions.startsAt)],
      with: {
        subscriber: true,
        plan: true,
      },
    }),
  ]);

  const now = new Date();

  return (
    <div>
      <CreatorPanelNav
        username={session.user.username}
        kycStatus={currentUser?.kycStatus || "NONE"}
      />

      <div className="container mx-auto px-4 pb-16 max-w-5xl space-y-10">
        {/* 1. SECCIÓN DE PLANES DE SUSCRIPCIÓN */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <CreatorPlansManager plans={plans} />
        </div>

        {/* 2. SECCIÓN DE MEMBRESÍAS DE CLIENTES ACTIVOS */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-rose-500" />
                Membresías de tus Clientes ({activeSubscriptions.length})
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Historial y estado de los fanáticos suscritos a tu contenido.
              </p>
            </div>
          </div>

          {activeSubscriptions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Plan Adquirido</th>
                    <th className="py-3 px-4">Monto KOIN</th>
                    <th className="py-3 px-4">Inicio</th>
                    <th className="py-3 px-4">Vence el</th>
                    <th className="py-3 px-4">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {activeSubscriptions.map((sub) => {
                    const endsDate = new Date(sub.endsAt);
                    const isStillActive = sub.status === "ACTIVE" && endsDate > now;
                    const diffTime = endsDate.getTime() - now.getTime();
                    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    return (
                      <tr key={sub.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4">
                          <UserLevelBadge
                            level={sub.subscriber?.level || 0}
                            username={sub.subscriber?.username || "Usuario"}
                            role={sub.subscriber?.role}
                          />
                        </td>

                        <td className="py-3 px-4 text-white font-semibold">
                          {sub.plan?.name || `Plan ${sub.durationDays || 30} días`}
                        </td>

                        <td className="py-3 px-4 font-bold text-amber-400">
                          {sub.priceKoinSnapshot.toFixed(2)} KOIN
                        </td>

                        <td className="py-3 px-4 text-slate-400">
                          {new Date(sub.startsAt).toLocaleDateString("es-VE")}
                        </td>

                        <td className="py-3 px-4 text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>{endsDate.toLocaleDateString("es-VE")}</span>
                            {isStillActive && remainingDays > 0 && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                ({remainingDays}d restantes)
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {isStillActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> Activa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                              <Clock className="w-3 h-3" /> Vencida
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              Aún no tienes clientes suscritos a tus planes. Comparte tu enlace para conseguir tus primeros suscriptores.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
