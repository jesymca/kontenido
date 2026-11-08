import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  wallets,
  walletTransactions,
  settings,
  userLevels,
  vipMemberships,
  subscriptions,
  users,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import UserLevelBadge from "@/components/UserLevelBadge";
import WalletTopupForm from "@/components/WalletTopupForm";
import BuyVipButton from "@/components/BuyVipButton";
import { cn, getVipBadgeClass } from "@/lib/utils";
import Link from "next/link";
import { Coins, Flame, ArrowUpRight, ShieldCheck, Star, Award, History, Download, Sparkles } from "lucide-react";

/**
 * Vista de Billetera y Cuenta de Usuario (/cuenta)
 * Gestiona recargas USDT, saldo KOIN, nivel del usuario (0 al 100) y membresías VIP.
 */
export default async function CuentaPage() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;

  // 1. Obtener usuario actualizado
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  // 2. Obtener billetera
  const wallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, userId),
  });

  // 3. Obtener direcciones USDT configuradas por SUPER_ADMIN
  const allSettings = await db.query.settings.findMany();
  const trc20 =
    allSettings.find((s) => s.key === "usdt_trc20_address")?.value ||
    "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
  const bep20 =
    allSettings.find((s) => s.key === "usdt_bep20_address")?.value ||
    "0x71C83638209121a91e57c61775e54d5885dc8bA8";

  // 4. Obtener transacciones del usuario
  const transactions = await db.query.walletTransactions.findMany({
    where: eq(walletTransactions.userId, userId),
    orderBy: [desc(walletTransactions.createdAt)],
    limit: 20,
  });

  // 5. Obtener membresías VIP activas
  const memberships = await db.query.vipMemberships.findMany({
    where: eq(vipMemberships.isActive, 1),
  });

  // 6. Obtener nivel actual y siguiente
  const currentLevelNum = user?.level || 0;
  const currentLevel = await db.query.userLevels.findFirst({
    where: eq(userLevels.levelNumber, currentLevelNum),
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Aviso especial si el usuario tiene rol de Creadora */}
      {user?.role === "CREATOR" && (
        <div className="mb-8 p-5 bg-gradient-to-r from-rose-950/60 via-slate-900 to-rose-950/40 border border-rose-500/40 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider rounded-md border border-rose-500/30">
                Rol Creadora de Contenido
              </span>
              <h3 className="text-white font-black text-sm mt-1">
                ¿Deseas gestionar tus ganancias, publicaciones y retiros en Bolívares?
              </h3>
              <p className="text-rose-200/80 text-xs mt-0.5 max-w-xl leading-relaxed">
                Esta sección es la Billetera de Consumo para recargar y suscribirte como fan. Tus herramientas de producción, estadísticas de ventas y cobros semanales están en tu Estudio de Creadora.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/panel"
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-rose-600/30"
            >
              Ir a Mi Estudio
            </Link>
            <Link
              href="/panel/pagos"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl transition border border-amber-500/30"
            >
              Retiros de Dinero
            </Link>
          </div>
        </div>
      )}

      {/* 1. CABECERA CON SALDO Y NIVEL */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="mb-2">
              <UserLevelBadge
                level={currentLevelNum}
                username={session.user.username}
                role={session.user.role}
                showRoleBadge
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">Mi Billetera KOIN</h1>
            <p className="text-xs text-slate-400 mt-1">
              Moneda interna respaldada 1:1 en USDT para suscripciones y compras.
            </p>
          </div>

          <div className="p-4 bg-slate-950/80 border border-amber-500/30 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Coins className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Saldo Disponible
              </span>
              <div className="text-2xl sm:text-3xl font-black text-amber-400">
                {wallet?.balanceKoin?.toFixed(2) || "0.00"}{" "}
                <span className="text-sm text-amber-500/80">KOIN</span>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de progreso de nivel según inversión en USD */}
        <div className="mt-8 pt-6 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              Nivel de Inversor: {currentLevel?.title || `Nivel ${currentLevelNum}`}
            </span>
            <span className="text-slate-400">
              Inversión acumulada: <strong>${(wallet?.totalSpentUsd || 0).toFixed(2)} USD</strong>
            </span>
          </div>

          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(5, (currentLevelNum / 100) * 100))}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
            <span>Nivel 0 ($0)</span>
            <span>Nivel 4 ($101+ Descargas VIP)</span>
            <span>Nivel 100 ($4,900+)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* 2. RECARGAR SALDO CON USDT */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Recargar KOIN vía USDT</h2>
              <p className="text-slate-400 text-xs">
                Transfiere USDT (Binance) y sube tu comprobante.
              </p>
            </div>
          </div>

          <WalletTopupForm trc20Address={trc20} bep20Address={bep20} />
        </div>

        {/* 3. TIENDA DE MEMBRESÍAS VIP */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Membresías VIP y Badges</h2>
              <p className="text-slate-400 text-xs">
                Destaca con frases especiales y habilita descargas autorizadas.
              </p>
            </div>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px] pr-1">
            {memberships.map((vip) => (
              <div
                key={vip.id}
                className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{vip.name}</span>
                    <span
                      className={cn(
                        "vip-badge-base text-[10px] px-2.5 py-0.5",
                        getVipBadgeClass(vip.badgeText, vip.badgeColor)
                      )}
                    >
                      {vip.badgeText}
                    </span>
                    {vip.allowDownload === 1 && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                        <Download className="w-3 h-3" /> Descarga
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {vip.description || "Beneficios exclusivos en KONTENIDO."}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-xs font-bold text-amber-400 block mb-1">
                    {vip.priceKoin} KOIN
                  </span>
                  <BuyVipButton
                    membershipId={vip.id}
                    priceKoin={vip.priceKoin}
                    isCurrent={user?.vipMembershipId === vip.id}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. HISTORIAL DE MOVIMIENTOS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-slate-400" />
          Historial de Transacciones
        </h3>

        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Monto</th>
                  <th className="py-3 px-4">Referencia / TX</th>
                  <th className="py-3 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(tx.createdAt).toLocaleString("es-VE")}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {tx.type === "TOPUP_USDT" && "Recarga USDT"}
                      {tx.type === "SUBSCRIPTION" && "Suscripción Creadora"}
                      {tx.type === "PURCHASE" && "Compra de Contenido"}
                      {tx.type === "VIP_MEMBERSHIP" && "Membresía VIP"}
                      {tx.type === "CONVERSION" && "Acreditación KOIN"}
                    </td>
                    <td className="py-3 px-4 font-bold text-amber-400">
                      {tx.amountKoin} KOIN
                      {tx.amountUsdt && (
                        <span className="text-[10px] text-slate-500 block font-normal">
                          (${tx.amountUsdt} USDT)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 max-w-xs truncate">
                      {tx.reference || "—"}
                    </td>
                    <td className="py-3 px-4">
                      {tx.status === "CONFIRMED" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                          Confirmada
                        </span>
                      )}
                      {tx.status === "PENDING" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 animate-pulse">
                          En Revisión
                        </span>
                      )}
                      {tx.status === "REJECTED" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">
                          Rechazada
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-500">
            Aún no tienes movimientos registrados en tu billetera.
          </div>
        )}
      </div>
    </div>
  );
}
