import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, agencies, agencyCreators, posts } from "@/lib/db/schema";
import { ensureChatSchema } from "@/lib/db/initChat";
import { eq, and, sql, desc } from "drizzle-orm";
import { Building2, Shield, Users } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import AgencyPanelClient, { type AgencyCreatorItem } from "@/components/AgencyPanelClient";
import AgencyOnboardingForm from "@/components/AgencyOnboardingForm";

export const metadata = {
  title: "Panel de Agencia | KONTENIDO",
  description: "Crea y administra perfiles de creadoras, contenido, precios y mensajería.",
};

interface PageProps {
  searchParams?: Promise<{ agencyId?: string }>;
}

export default async function AgenciaPage({ searchParams }: PageProps) {
  await ensureChatSchema();

  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/agencia");
  }

  const resolvedSearch = searchParams ? await searchParams : {};
  const requestedAgencyId = resolvedSearch?.agencyId?.trim() || null;

  // Obtener rol actualizado directamente de Turso DB para evitar desfaces del token JWT
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    with: { profile: true },
  });

  const effectiveRole = dbUser?.role || session.user.role;
  const isSuperAdmin = effectiveRole === "SUPER_ADMIN";

  let agency: typeof agencies.$inferSelect | undefined = undefined;
  let allAgenciesForAdmin: Array<typeof agencies.$inferSelect> = [];

  if (isSuperAdmin) {
    allAgenciesForAdmin = await db.query.agencies.findMany({
      orderBy: [desc(agencies.createdAt)],
    });

    if (requestedAgencyId) {
      agency = allAgenciesForAdmin.find((a) => a.id === requestedAgencyId);
    }

    if (!agency) {
      agency =
        allAgenciesForAdmin.find((a) => a.ownerUserId === session.user.id) ||
        allAgenciesForAdmin[0];
    }
  } else {
    agency = await db.query.agencies.findFirst({
      where: eq(agencies.ownerUserId, session.user.id),
    });
  }

  let creators: AgencyCreatorItem[] = [];

  if (agency) {
    const affiliated = await db.query.agencyCreators.findMany({
      where: and(
        eq(agencyCreators.agencyId, agency.id),
        eq(agencyCreators.status, "ACCEPTED")
      ),
      with: {
        creator: {
          with: {
            profile: true,
            wallet: true,
          },
        },
      },
    });

    const rawCreators = await Promise.all(
      affiliated.map(async (item) => {
        const c = item.creator;
        if (!c) return null;

        let postsCount = 0;
        try {
          const countRes = await db
            .select({ count: sql<number>`count(*)` })
            .from(posts)
            .where(and(eq(posts.creatorId, c.id), eq(posts.isDeleted, 0)));
          postsCount = Number(countRes[0]?.count || 0);
        } catch {
          postsCount = 0;
        }

        return {
          id: c.id,
          username: c.username,
          displayName: c.profile?.displayName || c.username,
          bio: c.profile?.bio || null,
          creatorCategory: c.profile?.creatorCategory || "MUJER",
          subscriptionPriceKoin: c.profile?.subscriptionPriceKoin ?? 10.0,
          chatPriceKoin: c.profile?.chatPriceKoin ?? 5.0,
          chatDurationHours: c.profile?.chatDurationHours ?? 168,
          totalEarnedKoin: c.wallet?.totalEarnedKoin ?? 0,
          postsCount,
          isPublished: c.profile?.isPublished ?? 0,
        };
      })
    );

    creators = rawCreators.filter(Boolean) as AgencyCreatorItem[];
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Selector de Agencia para SUPER_ADMIN si existen varias agencias */}
      {isSuperAdmin && allAgenciesForAdmin.length > 0 && (
        <div className="mb-6 p-4 bg-slate-900/90 border border-indigo-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
              <Shield className="w-3 h-3" />
              SUPER_ADMIN
            </span>
            <span className="text-xs text-slate-300 font-semibold">
              Viendo agencia: <strong className="text-white">{agency?.name || "Ninguna seleccionada"}</strong>
            </span>
          </div>

          {allAgenciesForAdmin.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-400">Cambiar agencia:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {allAgenciesForAdmin.map((ag) => (
                  <Link
                    key={ag.id}
                    href={`/agencia?agencyId=${ag.id}`}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                      agency?.id === ag.id
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
                    }`}
                  >
                    <Building2 className="w-3 h-3" />
                    <span>{ag.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-indigo-400 shrink-0" />
            Panel Administrativo de Agencia
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Crea y administra perfiles de creadoras, gestiona su contenido, tarifas de acceso, mensajería y configura tu badge distintivo de agencia.
          </p>
        </div>
      </div>

      {agency ? (
        <AgencyPanelClient
          key={agency.id}
          agency={{
            id: agency.id,
            name: agency.name,
            description: agency.description,
            badgeText: agency.badgeText,
            badgeColor: agency.badgeColor,
            showBadge: agency.showBadge,
            commissionPct: agency.commissionPct,
            status: agency.status,
          }}
          creators={creators}
        />
      ) : (
        <AgencyOnboardingForm
          defaultName={
            dbUser?.profile?.displayName || dbUser?.username
              ? `Agencia ${dbUser.profile?.displayName || dbUser.username}`
              : "Mi Agencia VIP"
          }
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </div>
  );
}
