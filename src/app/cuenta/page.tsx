import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  wallets,
  walletTransactions,
  settings,
  userLevels,
  vipMemberships,
  profiles,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import UserLevelBadge from "@/components/UserLevelBadge";
import WalletTopupForm from "@/components/WalletTopupForm";
import BuyVipButton from "@/components/BuyVipButton";
import AccountModeCard from "@/components/AccountModeCard";
import BasicProfileCard from "@/components/BasicProfileCard";
import { cn, getVipBadgeClass } from "@/lib/utils";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { getCurrentDbUser } from "@/lib/session";
import { isVenezuelanUser, getCountryMeta } from "@/lib/countries";
import Link from "next/link";
import {
  Coins,
  Flame,
  ArrowUpRight,
  ShieldCheck,
  Star,
  Award,
  History,
  Download,
  Sparkles,
  Heart,
  Bookmark,
  ArrowRight,
} from "lucide-react";

interface CuentaPageProps {
  searchParams?: Promise<{ completar?: string }>;
}

/**
 * Vista de Billetera y Cuenta de Usuario (/cuenta)
 * Gestiona perfil básico + preferencias KOMESTIBLE, recargas USDT, saldo KOIN, nivel del usuario (0 al 100) y membresías VIP.
 */
export default async function CuentaPage({ searchParams }: CuentaPageProps) {
  await ensureKomestibleSchema();
  const [session, resolvedSearch] = await Promise.all([
    auth(),
    searchParams ? searchParams : Promise.resolve({} as { completar?: string }),
  ]);
  if (!session?.user) return null;

  const userId = session.user.id;

  // Ejecutar TODAS las consultas de BD en paralelo para navegación instantánea
  const [user, userProfile, wallet, allSettings, transactions, memberships, allLevels] =
    await Promise.all([
      getCurrentDbUser(),
      db.query.profiles.findFirst({ where: eq(profiles.userId, userId) }),
      db.query.wallets.findFirst({ where: eq(wallets.userId, userId) }),
      db.query.settings.findMany(),
      db.query.walletTransactions.findMany({
        where: eq(walletTransactions.userId, userId),
        orderBy: [desc(walletTransactions.createdAt)],
        limit: 20,
      }),
      db.query.vipMemberships.findMany({
        where: eq(vipMemberships.isActive, 1),
      }),
      db.query.userLevels.findMany({
        orderBy: (ul, { asc }) => [asc(ul.levelNumber)],
      }),
    ]);

  const isVenezuela = isVenezuelanUser(user?.country);
  const countryMeta = getCountryMeta(user?.country);

  const trc20 =
    allSettings.find((s) => s.key === "usdt_trc20_address")?.value ||
    "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
  const bep20 =
    allSettings.find((s) => s.key === "usdt_bep20_address")?.value ||
    "0x71C83638209121a91e57c61775e54d5885dc8bA8";
  const binancePayId =
    allSettings.find((s) => s.key === "binance_pay_id")?.value || null;

  const currentLevelNum = user?.level || 0;
  const currentLevel =
    allLevels.find((l) => l.levelNumber === currentLevelNum) ||
    allLevels[0] ||
    null;
  const minLvl = allLevels[0];
  const vipDownloadLvl = allLevels.find((l) => l.canDownload === 1);
  const maxLvl = allLevels[allLevels.length - 1];
  const nextLvl = allLevels.find((l) => l.levelNumber > currentLevelNum);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Información Básica del Perfil + Preferencias de KOMESTIBLE (Hombre/Mujer/Pareja/Transgénero) */}
      {(user?.role || session.user.role) !== "AGENCY" && (
        <BasicProfileCard
          username={user?.username || session.user.username}
          initialDisplayName={userProfile?.displayName || user?.username || session.user.username}
          initialBio={userProfile?.bio || ""}
          initialCountry={user?.country || "VE"}
          initialGender={user?.gender || null}
          initialInterestedIn={user?.interestedIn || null}
          forceOpen={resolvedSearch?.completar === "1"}
        />
      )}

      {/* Tarjeta explicativa y selector bidireccional Vender vs Consumir */}
      <AccountModeCard
        currentRole={user?.role || session.user.role}
        username={user?.username || session.user.username}
        isVenezuela={isVenezuela}
        variant="cuenta"
      />

      {/* 1. CABECERA CON SALDO Y NIVEL */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="mb-2 flex items-center gap-2 flex-wrap">
              <UserLevelBadge
                level={currentLevelNum}
                username={user?.username || session.user.username}
                role={user?.role || session.user.role}
                kycStatus={user?.kycStatus}
                showRoleBadge
              />
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-700 text-slate-300">
                {countryMeta.flag} {countryMeta.name} {!isVenezuela && "• 100% USDT"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Mi Billetera KOIN y Compras
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {user?.role === "CREATOR"
                ? "Desde aquí también puedes recargar USDT, activar VIP y suscribirte a otros creadores. Tus ventas y retiros están en /panel/pagos."
                : "Moneda interna respaldada 1:1 en USDT para suscripciones, compras y membresías VIP."}
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

        {/* Barra de progreso de nivel según inversión en USD (disponible también si un creador consume contenido) */}
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

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 mt-2.5">
              <span>
                Nivel {minLvl?.levelNumber ?? 0} (${(minLvl?.minSpentUsd ?? 0).toLocaleString("en-US")})
              </span>
              {vipDownloadLvl ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  Nivel {vipDownloadLvl.levelNumber} (${vipDownloadLvl.minSpentUsd.toLocaleString("en-US")}+ Descargas VIP)
                </span>
              ) : (
                <span>Descargas VIP según Membresía</span>
              )}
              <span>
                Nivel {maxLvl?.levelNumber ?? 100} (${(maxLvl?.minSpentUsd ?? 4900).toLocaleString("en-US")}+)
              </span>
            </div>
            {nextLvl && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                Siguiente rango: <strong className="text-slate-300">Nivel {nextLvl.levelNumber} ({nextLvl.title})</strong> a partir de <strong>${nextLvl.minSpentUsd.toLocaleString("en-US")} USD</strong> acumulados.
              </p>
            )}
          </div>
      </div>

      {/* Accesos directos de Consumo: Suscripciones, Favoritas, KOMESTIBLE y KOINCIDEN (para Consumidores y Creadoras que también consumen) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Link
            href="/cuenta/suscripciones"
            className="p-4 bg-slate-900 border border-slate-800 hover:border-rose-500/40 rounded-2xl flex items-center justify-between transition group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-white group-hover:text-rose-400 transition block">
                  Mis Suscripciones Activas
                </span>
                <span className="text-xs text-slate-400">
                  Accede al contenido exclusivo de tus creadoras
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/cuenta/favoritos"
            className="p-4 bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl flex items-center justify-between transition group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Bookmark className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-white group-hover:text-amber-400 transition block">
                  Mis Creadoras Favoritas
                </span>
                <span className="text-xs text-slate-400">
                  Perfiles guardados para suscribirte a futuro
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/komestible"
            className="p-4 bg-gradient-to-r from-rose-950/50 to-slate-900 border border-rose-500/30 hover:border-rose-500/60 rounded-2xl flex items-center justify-between transition group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-white group-hover:text-rose-400 transition block">
                  KOMESTIBLE (Gratis)
                </span>
                <span className="text-xs text-slate-400">
                  Sube fotos para valorar, desliza y perfilate como creadora
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/koinciden"
            className="p-4 bg-gradient-to-r from-pink-950/40 to-slate-900 border border-pink-500/30 hover:border-pink-500/60 rounded-2xl flex items-center justify-between transition group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/15 text-pink-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-white group-hover:text-pink-400 transition block">
                  Espacio KOINCIDEN
                </span>
                <span className="text-xs text-slate-400">
                  Encuentra tus matches mutuos y conversa gratis
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-pink-400 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

      {/* SECCIÓN DE CONSUMO (Para cualquier usuario que desee recargar o comprar VIP): RECARGAS USDT Y MEMBRESÍAS VIP */}
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

            <WalletTopupForm
              trc20Address={trc20}
              bep20Address={bep20}
              binancePayId={binancePayId}
            />
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

            <div className="space-y-3 flex-1 overflow-y-auto max-h-[580px] pr-2 custom-scrollbar">
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
                      membershipName={vip.name}
                      badgeText={vip.badgeText}
                      badgeColor={vip.badgeColor}
                      allowDownload={vip.allowDownload}
                      priceKoin={vip.priceKoin}
                      isCurrent={user?.vipMembershipId === vip.id}
                      userBalanceKoin={wallet?.balanceKoin || 0}
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
