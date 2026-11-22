import { auth } from "@/auth";
import { db } from "@/lib/db";
import { banks, paymentMethods, wallets, settings, payouts, subscriptions, users, vipMemberships } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import PaymentMethodsManager from "@/components/PaymentMethodsManager";
import CreatorWithdrawalHub from "@/components/CreatorWithdrawalHub";
import CreatorPanelNav from "@/components/CreatorPanelNav";
import { getDolarRates } from "@/lib/dolarapi";
import { getCreatorCommissionTier } from "@/lib/commissions";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { getCurrentDbUser } from "@/lib/session";
import { isVenezuelanUser, getCountryMeta } from "@/lib/countries";
import { Wallet, Landmark, DollarSign } from "lucide-react";

/**
 * Pantalla de Gestión de Retiros (Bolívares VES para VE / USDT directo para Internacional),
 * Suscriptores y Métodos de Cobro de la Creadora (/panel/pagos)
 */
export default async function PagosPage() {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;

  // Ejecutar TODAS las consultas independientes en paralelo
  const [
    currentUser,
    wallet,
    allSettings,
    allBanksRaw,
    userMethods,
    creatorPayouts,
    creatorSubs,
    allVips,
  ] = await Promise.all([
    getCurrentDbUser(),
    db.query.wallets.findFirst({ where: eq(wallets.userId, userId) }),
    db.query.settings.findMany(),
    db.query.banks.findMany({ orderBy: (b, { asc }) => [asc(b.id)] }),
    db.query.paymentMethods.findMany({
      where: eq(paymentMethods.creatorId, userId),
      with: { bank: true },
    }),
    db.query.payouts.findMany({
      where: eq(payouts.creatorId, userId),
      orderBy: [desc(payouts.createdAt)],
      with: { paymentMethod: { with: { bank: true } } },
    }),
    db.query.subscriptions.findMany({
      where: eq(subscriptions.creatorId, userId),
      orderBy: [desc(subscriptions.startsAt)],
      with: { subscriber: true },
    }),
    db.query.vipMemberships.findMany(),
  ]);

  const isVenezuela = isVenezuelanUser(currentUser?.country);
  const countryMeta = getCountryMeta(currentUser?.country);
  const allBanks = isVenezuela ? allBanksRaw : [];

  const balanceKoin = wallet?.balanceKoin || 0;
  const totalEarnedKoin = wallet?.totalEarnedKoin || 0;

  const settingsMap = new Map(allSettings.map((s) => [s.key, s.value]));
  const fallbackRate = parseFloat(settingsMap.get("fallback_usd_ves_rate") || "1030.88");

  const tierInfo = getCreatorCommissionTier(totalEarnedKoin, settingsMap, currentUser?.level);

  const dolarInfo = isVenezuela
    ? await getDolarRates(fallbackRate)
    : {
        paralelo: 1,
        fechaActualizacion: new Date().toISOString(),
        fuente: "USDT 1:1 Internacional",
      };

  const vipMap = new Map(allVips.map((v) => [v.id, v]));

  const enrichedSubscribers = creatorSubs.map((sub) => {
    const subscriberUser = sub.subscriber;
    const userVip = subscriberUser?.vipMembershipId ? vipMap.get(subscriberUser.vipMembershipId) : null;
    const priceKoin = sub.priceKoinSnapshot || 10.0;
    const creatorNetKoin = Number((priceKoin * (1 - tierInfo.feePct / 100)).toFixed(2));

    return {
      id: sub.id,
      subscriberUsername: subscriberUser?.username || "Usuario",
      subscriberLevel: subscriberUser?.level || 0,
      vipBadgeText: userVip?.badgeText || null,
      vipBadgeColor: userVip?.badgeColor || null,
      priceKoin,
      creatorNetKoin,
      status: sub.status,
      startDate: sub.startsAt,
      endDate: sub.endsAt,
    };
  });

  return (
    <div>
      <CreatorPanelNav
        username={session.user.username}
        kycStatus={currentUser?.kycStatus || "NONE"}
      />

      <div className="container mx-auto px-4 pb-12 max-w-5xl space-y-10">
        {/* Cabecera Principal */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5 flex-wrap">
          <Wallet className="w-7 h-7 text-rose-500" />
          {isVenezuela
            ? "Centro de Pagos y Retiros en Bolívares"
            : "Centro de Pagos y Retiros en USDT"}
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
            {countryMeta.flag} {countryMeta.name}
          </span>
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          {isVenezuela
            ? "Solicita retiros calculados según el Valor Paralelo en tiempo real, monitorea tus liquidaciones bancarias y revisa los pagos de tus suscriptores."
            : "Solicita tus retiros internacionales directamente en USDT (1 KOIN = 1 USDT) sin conversión a moneda local y revisa los pagos de tus suscriptores."}
        </p>
      </div>

      {/* Módulo Principal: Calculadora de Retiro, Historial y Suscriptores */}
      <CreatorWithdrawalHub
        balanceKoin={balanceKoin}
        totalEarnedKoin={totalEarnedKoin}
        tasaParalelo={dolarInfo.paralelo}
        fechaActualizacionTasa={dolarInfo.fechaActualizacion}
        fuenteTasa={dolarInfo.fuente}
        tierInfo={tierInfo}
        paymentMethods={userMethods}
        payouts={creatorPayouts}
        subscribers={enrichedSubscribers}
        isVenezuela={isVenezuela}
        countryLabel={`${countryMeta.flag} ${countryMeta.name}`}
      />

      {/* Sección Inferior: Administración de Cuentas y Métodos de Cobro */}
      <div id="metodos-de-cobro" className="pt-6 border-t border-slate-800 scroll-mt-28">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 text-emerald-400" />
            {isVenezuela
              ? "Configuración de Métodos de Cobro (Venezuela y Cripto)"
              : "Configuración de Métodos de Cobro Internacionales (USDT)"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isVenezuela
              ? "Agrega o actualiza tus cuentas bancarias de los 30 bancos oficiales venezolanos, PagoMóvil, Binance Pay o Wallet USDT."
              : "Configura tu Binance Pay ID / correo o tu dirección Wallet USDT (TRC20, BEP20, ERC20) para recibir pagos globales."}
          </p>
        </div>

        <PaymentMethodsManager
          banks={allBanks}
          existingMethods={userMethods}
          isVenezuela={isVenezuela}
        />
      </div>
    </div>
  </div>
);
}
