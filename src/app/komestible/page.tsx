import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  users,
  komestiblePhotos,
  komestibleMatches,
  komestibleSwipes,
} from "@/lib/db/schema";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { getCurrentDbUser } from "@/lib/session";
import { normalizeGenderValue, parseInterestedIn } from "@/lib/countries";
import {
  getKomestibleConfig,
  computeUserLikeQuota,
  getDiscoveryDeckAction,
} from "@/actions/komestible";
import { eq, and, or, desc, sql } from "drizzle-orm";
import Link from "next/link";
import KomestibleHub from "@/components/KomestibleHub";
import { Flame, Heart, Sparkles, MessageCircleHeart, ArrowRight, Camera } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "KOMESTIBLE — Encuentros y Valoración Gratis | KONTENIDO",
  description:
    "Sube tus fotos gratis, recibe valoraciones de la comunidad, haz swipe y encuentra coincidencias mutuas en KOINCIDEN.",
};

export default async function KomestiblePage() {
  await ensureKomestibleSchema();
  const session = await auth();

  if (!session?.user) {
    let totalPhotosCount = 0;
    try {
      totalPhotosCount = await db.$count(
        komestiblePhotos,
        and(eq(komestiblePhotos.status, "APPROVED"), eq(komestiblePhotos.isActive, 1))
      );
    } catch {
      totalPhotosCount = 0;
    }

    return (
      <div className="container mx-auto px-4 py-14 max-w-4xl">
        <div className="bg-gradient-to-br from-rose-950/60 via-slate-900 to-amber-950/40 border border-rose-500/30 rounded-3xl p-8 sm:p-12 text-center shadow-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black uppercase tracking-wider">
            <Flame className="w-4 h-4 text-rose-500 fill-rose-500" />
            100% Gratuito en KONTENIDO
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            Bienvenido a{" "}
            <span className="bg-gradient-to-r from-rose-500 via-pink-400 to-amber-400 bg-clip-text text-transparent">
              KOMESTIBLE
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            La sección estilo encuentros donde puedes <strong>subir fotos gratis</strong>, recibir valoraciones de la comunidad, deslizar perfiles y hacer match mutuo para encontrarte en{" "}
            <strong className="text-rose-400">KOINCIDEN</strong>. Si tus fotos destacan, también puedes perfilarte como Creador/a de Contenido y generar ingresos.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left pt-2">
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
              <Camera className="w-5 h-5 text-rose-400 mb-2" />
              <h3 className="text-xs font-bold text-white">Sube Fotos Gratis</h3>
              <p className="text-[11px] text-slate-400 mt-1">
                {totalPhotosCount > 0
                  ? `${totalPhotosCount} fotos activas recibiendo valoraciones.`
                  : "Publica tus mejores fotos para ser valoradas."}
              </p>
            </div>
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
              <Heart className="w-5 h-5 text-pink-400 mb-2" />
              <h3 className="text-xs font-bold text-white">Swipe & KOINCIDEN</h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Emparejamiento de doble confirmación: si ambos se dan Like, chatean en KOINCIDEN.
              </p>
            </div>
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
              <Sparkles className="w-5 h-5 text-amber-400 mb-2" />
              <h3 className="text-xs font-bold text-white">Perfilate como Creador</h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Convierte tu popularidad en ingresos reales con KOIN (USDT o Bs.).
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              href="/registro"
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-rose-600/30 transition"
            >
              Crear Cuenta Gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login?callbackUrl=/komestible"
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 transition"
            >
              Ya tengo cuenta • Entrar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const userId = session.user.id;
  const [config, currentUser, myPhotos, deckRes, matchesCount, admirersRes] =
    await Promise.all([
      getKomestibleConfig(),
      getCurrentDbUser(),
      db.query.komestiblePhotos.findMany({
        where: eq(komestiblePhotos.userId, userId),
        orderBy: [desc(komestiblePhotos.createdAt)],
      }),
      getDiscoveryDeckAction({ genderFilter: "PREFERENCES" }),
      db.$count(
        komestibleMatches,
        and(
          eq(komestibleMatches.status, "ACTIVE"),
          or(
            eq(komestibleMatches.userAId, userId),
            eq(komestibleMatches.userBId, userId)
          )
        )
      ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(komestibleSwipes)
        .where(
          and(
            eq(komestibleSwipes.targetUserId, userId),
            eq(komestibleSwipes.action, "LIKE")
          )
        ),
    ]);

  const normalizedGender = normalizeGenderValue(currentUser?.gender);
  const interestedInList = parseInterestedIn(currentUser?.interestedIn);

  const quota = await computeUserLikeQuota(
    userId,
    normalizedGender,
    currentUser?.vipMembershipId,
    currentUser?.komestibleBonusLikes || 0,
    config
  );

  // Admiradores pendientes (likes recibidos que aún no son match)
  const totalLikesReceived = Number(admirersRes[0]?.count || 0);
  const pendingAdmirersCount = Math.max(0, totalLikesReceived - matchesCount);

  return (
    <KomestibleHub
      config={config}
      currentUser={{
        id: userId,
        username: currentUser?.username || session.user.username,
        role: currentUser?.role || session.user.role,
        gender: normalizedGender,
        interestedIn: interestedInList,
        country: currentUser?.country || "VE",
      }}
      initialQuota={quota}
      initialDeck={deckRes.cards || []}
      initialMyPhotos={myPhotos}
      initialMatchesCount={matchesCount}
      pendingAdmirersCount={pendingAdmirersCount}
    />
  );
}
