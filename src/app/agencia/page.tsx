import { auth } from "@/auth";
import { db } from "@/lib/db";
import { agencies, agencyCreators, posts } from "@/lib/db/schema";
import { ensureChatSchema } from "@/lib/db/initChat";
import { eq, and, sql } from "drizzle-orm";
import { LayoutDashboard, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import AgencyPanelClient, { type AgencyCreatorItem } from "@/components/AgencyPanelClient";
import { createAgencyForUserAction } from "@/actions/agency";

export const metadata = {
  title: "Panel de Agencia | KONTENIDO",
  description: "Crea y administra perfiles de creadoras, contenido, precios y mensajería.",
};

export default async function AgenciaPage() {
  await ensureChatSchema();

  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/agencia");
  }

  const agency = await db.query.agencies.findFirst({
    where: eq(agencies.ownerUserId, session.user.id),
  });

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

    creators = await Promise.all(
      affiliated.map(async (item) => {
        const c = item.creator;
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
  }

  async function initAgencyAction(formData: FormData) {
    "use server";
    await createAgencyForUserAction(formData);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-7 h-7 text-indigo-500" />
            Panel Administrativo de Agencia
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Crea perfiles de creadoras, gestiona su contenido, tarifas de acceso, mensajerías y configura tu badge de agencia.
          </p>
        </div>
      </div>

      {agency ? (
        <AgencyPanelClient
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
        <form
          action={initAgencyAction}
          className="p-8 bg-slate-900 border border-slate-800 rounded-3xl max-w-md mx-auto space-y-4 shadow-xl"
        >
          <div className="text-center">
            <Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">Activa tu Agencia</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Configura el nombre de tu agencia para comenzar a crear y gestionar perfiles en KONTENIDO.
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Nombre de la Agencia
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="ej: Velvet Models Agency"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Descripción (opcional)
            </label>
            <textarea
              name="description"
              rows={2}
              placeholder="Agencia de talentos..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-lg shadow-indigo-600/30"
          >
            Crear Agencia y Continuar
          </button>
        </form>
      )}
    </div>
  );
}
