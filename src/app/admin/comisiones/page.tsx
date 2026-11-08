import { db } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import { parseCreatorCommissionRules, getCreatorCommissionTier } from "@/lib/commissions";
import AdminCommissionsCrud from "@/components/AdminCommissionsCrud";
import { Percent } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminCommissionsPage() {
  const allSettings = await db.query.settings.findMany();
  const settingsMap = Object.fromEntries(allSettings.map((s) => [s.key, s.value]));

  const rules = parseCreatorCommissionRules(settingsMap);

  const creatorUsers = await db.query.users.findMany({
    where: eq(users.role, "CREATOR"),
    orderBy: [desc(users.createdAt)],
    with: {
      profile: true,
      wallet: true,
    },
  });

  const enrichedCreators = creatorUsers.map((c) => {
    const level = c.level ?? 0;
    const totalEarnedKoin = c.wallet?.totalEarnedKoin ?? 0;
    const tier = getCreatorCommissionTier(totalEarnedKoin, settingsMap, level);
    return {
      id: c.id,
      username: c.username,
      displayName: c.profile?.displayName || null,
      email: c.email,
      level,
      kycStatus: c.kycStatus,
      totalEarnedKoin,
      currentFeePct: tier.feePct,
      currentRuleName: tier.name,
    };
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Percent className="w-8 h-8 text-amber-500" />
            Comisiones de Creadoras por Nivel
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Configura los tramos de nivel de creadora (ej. Nivel 0 al 30 = 20%, Nivel 31 al 60 = 15%) y gestiona el nivel individual de cada creadora.
          </p>
        </div>
      </div>

      <AdminCommissionsCrud initialRules={rules} creators={enrichedCreators} />
    </div>
  );
}
