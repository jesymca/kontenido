import { auth } from "@/auth";
import { db } from "@/lib/db";
import { banks, paymentMethods, wallets, settings, payouts, subscriptions, users, vipMemberships } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import PaymentMethodsManager from "@/components/PaymentMethodsManager";
import CreatorWithdrawalHub from "@/components/CreatorWithdrawalHub";
import { getDolarRates } from "@/lib/dolarapi";
import { getCreatorCommissionTier } from "@/lib/commissions";
import { Wallet, Landmark, DollarSign } from "lucide-react";

/**
 * Pantalla de Gestión de Retiros, Liquidaciones en Bolívares (VES),
 * Suscriptores y Métodos de Cobro de la Creadora (/panel/pagos)
 */
export default async function PagosPage() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;

  // 1. Obtener billetera de la creadora
  const wallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, userId),
  });

  const balanceKoin = wallet?.balanceKoin || 0;
  const totalEarnedKoin = wallet?.totalEarnedKoin || 0;

  // 2. Obtener configuraciones de comisiones escalonadas de la plataforma
  const allSettings = await db.query.settings.findMany();
  const settingsMap = new Map(allSettings.map((s) => [s.key, s.value]));
  const fallbackRate = parseFloat(settingsMap.get("fallback_usd_ves_rate") || "1030.88");

  // 3. Evaluar tier de comisión (10%, 15%, 20%) según el volumen general acumulado
  const tierInfo = getCreatorCommissionTier(totalEarnedKoin, settingsMap);

  // 4. Consultar tasa de Dólar Paralelo en tiempo real desde ve.dolarapi.com
  const dolarInfo = await getDolarRates(fallbackRate);

  // 5. Obtener los 30 bancos venezolanos y métodos de cobro de la creadora
  const allBanks = await db.query.banks.findMany({
    orderBy: (banks, { asc }) => [asc(banks.id)],
  });

  const userMethods = await db.query.paymentMethods.findMany({
    where: eq(paymentMethods.creatorId, userId),
    with: {
      bank: true,
    },
  });

  // 6. Obtener historial de retiros y liquidaciones de la creadora
  const creatorPayouts = await db.query.payouts.findMany({
    where: eq(payouts.creatorId, userId),
    orderBy: [desc(payouts.createdAt)],
    with: {
      paymentMethod: {
        with: {
          bank: true,
        },
      },
    },
  });

  // 7. Obtener lista de suscriptores y pagos de suscripción recibidos
  const creatorSubs = await db.query.subscriptions.findMany({
    where: eq(subscriptions.creatorId, userId),
    orderBy: [desc(subscriptions.startsAt)],
    with: {
      subscriber: true,
    },
  });

  const allVips = await db.query.vipMemberships.findMany();
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
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-10">
      {/* Cabecera Principal */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
          <Wallet className="w-7 h-7 text-rose-500" />
          Centro de Pagos y Retiros en Bolívares
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Solicita retiros calculados según el Valor Paralelo en tiempo real, monitorea tus liquidaciones bancarias y revisa los pagos de tus suscriptores.
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
      />

      {/* Sección Inferior: Administración de Cuentas y Métodos de Cobro */}
      <div className="pt-6 border-t border-slate-800">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 text-emerald-400" />
            Configuración de Métodos de Cobro (Venezuela y Cripto)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Agrega o actualiza tus cuentas bancarias de los 30 bancos oficiales venezolanos, PagoMóvil o billetera Binance USDT.
          </p>
        </div>

        <PaymentMethodsManager banks={allBanks} existingMethods={userMethods} />
      </div>
    </div>
  );
}
