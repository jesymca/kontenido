import { db } from "@/lib/db";
import { walletTransactions, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import AdminTopupsList from "@/components/AdminTopupsList";
import { Coins } from "lucide-react";

/**
 * Vista de Validación de Recargas USDT (/admin/recargas)
 */
export default async function AdminRecargasPage() {
  const pendingTxs = await db.query.walletTransactions.findMany({
    where: eq(walletTransactions.type, "TOPUP_USDT"),
    orderBy: [desc(walletTransactions.createdAt)],
  });

  // Mapear con nombres de usuarios
  const allUsers = await db.query.users.findMany();
  const userMap = new Map(allUsers.map((u) => [u.id, u.username]));

  const enrichedTxs = pendingTxs.map((t) => ({
    ...t,
    username: userMap.get(t.userId) || "Desconocido",
  }));

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Coins className="w-6 h-6 text-amber-400" />
          Validación de Recargas USDT
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Revisa el TX Hash en el explorador de Binance/Blockchain y confirma la acreditación de saldo KOIN y nivel de usuario.
        </p>
      </div>

      <AdminTopupsList transactions={enrichedTxs} />
    </div>
  );
}
