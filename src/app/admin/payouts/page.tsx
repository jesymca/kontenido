import { db } from "@/lib/db";
import { payouts, users, paymentMethods, banks } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import AdminPayoutsList from "@/components/AdminPayoutsList";
import { DollarSign } from "lucide-react";

/**
 * Vista de Cortes Semanales y Liquidaciones a Creadoras (/admin/payouts)
 */
export default async function AdminPayoutsPage() {
  const allPayouts = await db.query.payouts.findMany({
    orderBy: [desc(payouts.createdAt)],
    with: {
      creator: true,
      paymentMethod: {
        with: {
          bank: true,
        },
      },
    },
  });

  const allMethods = await db.query.paymentMethods.findMany({
    where: eq(paymentMethods.isActive, 1),
    with: {
      bank: true,
    },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-emerald-400" />
          Cortes Semanales y Liquidaciones
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Gestiona los pagos netos a creadoras mediante Banco de Venezuela, PagoMóvil o Binance USDT y adjunta comprobantes.
        </p>
      </div>

      <AdminPayoutsList payouts={allPayouts} paymentMethods={allMethods} />
    </div>
  );
}
