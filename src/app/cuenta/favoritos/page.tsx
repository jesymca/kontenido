import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, profiles, profileFavorites, mediaAssets, subscriptions } from "@/lib/db/schema";
import { eq, desc, inArray, and, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bookmark,
  Sparkles,
  ExternalLink,
  Heart,
  Coins,
  Image as ImageIcon,
  Video,
  ArrowRight,
} from "lucide-react";
import UserLevelBadge from "@/components/UserLevelBadge";
import ProfileInteractions from "@/components/ProfileInteractions";
import { ensureInteractionsSchema } from "@/lib/db/initInteractions";

export const dynamic = "force-dynamic";

/**
 * Sección de Perfiles Favoritos del Consumidor (/cuenta/favoritos)
 * Permite a los consumidores revisar las creadoras que les interesan,
 * ver cuántas fotos y videos tienen, su precio de suscripción y suscribirse cuando lo deseen.
 */
export default async function MisFavoritosPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await ensureInteractionsSchema();

  const userId = session.user.id;

  // 1. Obtener favoritos del usuario
  const favRows = await db.query.profileFavorites.findMany({
    where: eq(profileFavorites.userId, userId),
    orderBy: [desc(profileFavorites.createdAt)],
  });

  const creatorIds = favRows.map((f) => f.creatorId);

  let enrichedFavorites: Array<{
    id: string;
    username: string;
    displayName: string;
    bio: string;
    level: number;
    avatarUrl: string | null;
    bannerUrl: string | null;
    priceKoin: number;
    likesCount: number;
    isAiGenerated: boolean;
    photosCount: number;
    videosCount: number;
    isSubscriber: boolean;
  }> = [];

  if (creatorIds.length > 0) {
    const creators = await db.query.users.findMany({
      where: inArray(users.id, creatorIds),
      with: {
        profile: true,
      },
    });

    const activeSubs = await db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.subscriberId, userId),
        inArray(subscriptions.creatorId, creatorIds),
        eq(subscriptions.status, "ACTIVE")
      ),
    });
    const subSet = new Set(activeSubs.map((s) => s.creatorId));

    enrichedFavorites = await Promise.all(
      creators.map(async (creator) => {
        let photos = 0;
        let videos = 0;

        try {
          const mediaCounts = await db
            .select({
              type: mediaAssets.type,
              count: sql<number>`count(*)`,
            })
            .from(mediaAssets)
            .where(
              and(
                eq(mediaAssets.creatorId, creator.id),
                eq(mediaAssets.isDeleted, 0)
              )
            )
            .groupBy(mediaAssets.type);

          for (const m of mediaCounts) {
            if (m.type === "IMAGE") photos = Number(m.count);
            if (m.type === "VIDEO") videos = Number(m.count);
          }
        } catch {
          // Fallback seguro
        }

        const prof = creator.profile;

        return {
          id: creator.id,
          username: creator.username,
          displayName: prof?.displayName || creator.username,
          bio: prof?.bio || "Creadora de contenido en KONTENIDO.",
          level: creator.level || 0,
          avatarUrl: prof?.avatarKey ? `/api/media/${prof.avatarKey}` : null,
          bannerUrl: prof?.bannerKey ? `/api/media/${prof.bannerKey}` : null,
          priceKoin: prof?.subscriptionPriceKoin || 10.0,
          likesCount: prof?.likesCount || 0,
          isAiGenerated: prof?.isAiGenerated === 1,
          photosCount: photos,
          videosCount: videos,
          isSubscriber: subSet.has(creator.id),
        };
      })
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <Bookmark className="w-7 h-7 text-amber-400 fill-amber-400/20" />
            Mis Creadoras Favoritas
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Perfiles guardados para seguir de cerca, consultar su nuevo contenido y suscribirte cuando desees.
          </p>
        </div>
        <Link
          href="/"
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-700 transition self-start sm:self-auto flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-rose-500" />
          Descubrir más Creadoras
        </Link>
      </div>

      {enrichedFavorites.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {enrichedFavorites.map((fav) => (
            <div
              key={fav.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between hover:border-amber-500/40 transition group"
            >
              <div>
                {/* Banner de Portada */}
                <div className="h-32 bg-gradient-to-r from-rose-900/50 via-slate-900 to-amber-900/40 relative overflow-hidden">
                  {fav.bannerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fav.bannerUrl}
                      alt={fav.displayName}
                      className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-rose-950 via-purple-950 to-slate-900 opacity-80" />
                  )}

                  <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-amber-400 border border-amber-500/30 flex items-center gap-1 shadow-md">
                    <Coins className="w-3.5 h-3.5" />
                    {fav.priceKoin} KOIN/mes
                  </div>
                </div>

                {/* Info Principal */}
                <div className="p-5 -mt-10 relative">
                  <div className="flex items-end justify-between gap-3 mb-3">
                    <div className="w-20 h-20 rounded-2xl bg-slate-800 border-4 border-slate-900 overflow-hidden flex items-center justify-center text-white font-bold text-2xl shadow-xl shrink-0">
                      {fav.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={fav.avatarUrl}
                          alt={fav.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        fav.displayName[0]?.toUpperCase() || "K"
                      )}
                    </div>

                    <ProfileInteractions
                      creatorId={fav.id}
                      initialLikesCount={fav.likesCount}
                      initialIsLiked={false}
                      initialIsFavorited={true}
                      isAuthenticated={true}
                    />
                  </div>

                  <UserLevelBadge
                    level={fav.level}
                    username={fav.username}
                    isAiGenerated={fav.isAiGenerated}
                    className="mb-1"
                  />

                  <h3 className="text-white font-bold text-lg mt-1 group-hover:text-amber-400 transition">
                    {fav.displayName}
                  </h3>

                  <p className="text-slate-400 text-xs mt-1 line-clamp-2 leading-relaxed">
                    {fav.bio}
                  </p>

                  {/* Estadísticas intuitivas de fotos, videos y likes */}
                  <div className="grid grid-cols-3 gap-2 py-2.5 px-3 my-4 bg-slate-950 border border-slate-800 rounded-2xl text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-rose-400" />
                        {fav.photosCount}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Fotos</span>
                    </div>

                    <div className="flex flex-col items-center border-x border-slate-800">
                      <span className="text-xs font-bold text-purple-400 flex items-center gap-1">
                        <Video className="w-3.5 h-3.5 text-purple-400" />
                        {fav.videosCount}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Videos</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-xs font-bold text-rose-500 flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 fill-rose-500" />
                        {fav.likesCount}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Me Gusta</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="p-5 pt-0 flex items-center gap-2">
                <Link
                  href={`/${fav.username}`}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20"
                >
                  {fav.isSubscriber ? "Ver Contenido Exclusivo" : "Ver Perfil y Suscribirme"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Bookmark className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white">No tienes creadoras en tus favoritos todavía</h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
            Cuando visites el perfil de una creadora que te guste, presiona el botón <strong>&quot;Favorito&quot;</strong> o dale <strong>Me Gusta ❤️</strong>. Así podrás guardarla aquí para ver cuánto contenido tiene y suscribirte en el momento que desees.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-rose-600/30"
            >
              <Sparkles className="w-4 h-4" />
              Explorar Creadoras Ahora
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
