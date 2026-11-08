import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  users,
  profiles,
  posts,
  mediaAssets,
  subscriptions,
  purchases,
  vipMemberships,
} from "@/lib/db/schema";
import { eq, and, desc, gt } from "drizzle-orm";
import UserLevelBadge from "@/components/UserLevelBadge";
import SubscribeButton from "@/components/SubscribeButton";
import BuyPostButton from "@/components/BuyPostButton";
import {
  Sparkles,
  Lock,
  Unlock,
  Coins,
  ShieldCheck,
  Download,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { getPresignedDownloadUrl, BUCKETS } from "@/lib/r2";

interface PageProps {
  params: Promise<{ username: string }>;
}

/**
 * Perfil público del Creador (/[username])
 * Multi-tenant por path nativo. Resuelve el username contra la base de datos.
 */
export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  const decodedUsername = decodeURIComponent(username).toLowerCase().trim();

  // 1. Buscar usuario
  const creator = await db.query.users.findFirst({
    where: eq(users.username, decodedUsername),
    with: {
      profile: true,
    },
  });

  if (!creator) {
    notFound();
  }

  // Si el usuario está suspendido
  if (creator.status === "SUSPENDED") {
    return (
      <div className="container mx-auto px-4 py-20 text-center max-w-md">
        <div className="p-8 bg-slate-900 border border-red-500/30 rounded-3xl shadow-xl">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Cuenta Suspendida</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            El perfil de @{creator.username} se encuentra actualmente suspendido por incumplimiento de las normas de la comunidad.
          </p>
        </div>
      </div>
    );
  }

  const session = await auth();
  const currentUserId = session?.user?.id;
  const isOwner = currentUserId === creator.id;
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const userCanDownload = session?.user?.allowDownload === 1 || isSuperAdmin;

  // 2. Obtener membresía VIP del creador si tiene
  let creatorVipBadge: string | null = null;
  let creatorVipColor: string | null = null;
  if (creator.vipMembershipId) {
    const vip = await db.query.vipMemberships.findFirst({
      where: eq(vipMemberships.id, creator.vipMembershipId),
    });
    if (vip) {
      creatorVipBadge = vip.badgeText;
      creatorVipColor = vip.badgeColor;
    }
  }

  // 3. Verificar si el usuario actual tiene suscripción activa a esta creadora
  let isSubscriber = false;
  if (currentUserId && !isOwner) {
    const activeSub = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.subscriberId, currentUserId),
        eq(subscriptions.creatorId, creator.id),
        eq(subscriptions.status, "ACTIVE"),
        gt(subscriptions.endsAt, new Date().toISOString())
      ),
    });
    isSubscriber = !!activeSub;
  }

  // 4. Obtener compras individuales del usuario actual
  let purchasedPostIds = new Set<string>();
  if (currentUserId && !isOwner) {
    const userPurchases = await db.query.purchases.findMany({
      where: and(
        eq(purchases.buyerId, currentUserId),
        eq(purchases.itemType, "POST"),
        eq(purchases.status, "COMPLETED")
      ),
    });
    purchasedPostIds = new Set(userPurchases.map((p) => p.itemId));
  }

  // 5. Cargar publicaciones activas
  const creatorPosts = await db.query.posts.findMany({
    where: and(eq(posts.creatorId, creator.id), eq(posts.isDeleted, 0)),
    orderBy: [desc(posts.createdAt)],
    with: {
      media: true,
    },
  });

  const profile = creator.profile;
  const subscriptionPrice = profile?.subscriptionPriceKoin || 10.0;

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {/* 1. PORTADA / BANNER */}
      <div className="h-48 sm:h-64 bg-gradient-to-r from-rose-950 via-purple-950 to-slate-900 relative">
        <div className="absolute inset-0 bg-black/30" />
      </div>

      <div className="container mx-auto px-4 max-w-4xl relative -mt-16 sm:-mt-20">
        {/* 2. CABECERA DE PERFIL */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-5">
            <div className="flex items-end gap-4">
              {/* Avatar con marco */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-800 border-4 border-slate-900 flex items-center justify-center text-white font-black text-3xl shadow-xl overflow-hidden shrink-0">
                {profile?.displayName?.[0]?.toUpperCase() || creator.username[0].toUpperCase()}
              </div>

              <div>
                <UserLevelBadge
                  level={creator.level || 0}
                  username={creator.username}
                  vipBadgeText={creatorVipBadge}
                  vipBadgeColor={creatorVipColor}
                  role={creator.role}
                  showRoleBadge
                />
                <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
                  {profile?.displayName || creator.username}
                </h1>
              </div>
            </div>

            {/* Botón de suscripción o edición */}
            {isOwner ? (
              <a
                href="/panel"
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                Editar mi perfil
              </a>
            ) : (
              <SubscribeButton
                creatorId={creator.id}
                priceKoin={subscriptionPrice}
                isSubscriber={isSubscriber}
              />
            )}
          </div>

          <p className="text-slate-300 text-sm leading-relaxed max-w-2xl mb-6">
            {profile?.bio || "Creadora de contenido exclusiva en KONTENIDO. Suscríbete para acceder a mis fotos y videos privados."}
          </p>

          <div className="flex items-center gap-6 pt-4 border-t border-slate-800 text-xs text-slate-400">
            <div>
              <strong className="text-white font-bold">{creatorPosts.length}</strong> Publicaciones
            </div>
            <div>
              <strong className="text-amber-400 font-bold">{subscriptionPrice} KOIN</strong> / Mes
            </div>
            <div className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-4 h-4" /> Verificada
            </div>
          </div>
        </div>

        {/* 3. LISTADO DE PUBLICACIONES */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-rose-500" />
            Publicaciones
          </h2>

          {creatorPosts.length > 0 ? (
            <div className="space-y-6">
              {creatorPosts.map(async (post) => {
                // Verificar si este post está desbloqueado para el espectador
                const isFree = post.priceKoin === 0;
                const isPurchased = purchasedPostIds.has(post.id);
                const isUnlocked = isOwner || isSuperAdmin || (isFree && isSubscriber) || isPurchased;

                // Generar URL prefirmada si está desbloqueado
                let mediaUrl: string | null = null;
                const firstMedia = post.media?.[0];
                if (firstMedia) {
                  try {
                    mediaUrl = await getPresignedDownloadUrl(
                      BUCKETS.MEDIA,
                      firstMedia.originalKey,
                      isUnlocked ? 900 : 60 // 15min si comprado, 60s si preview
                    );
                  } catch (e) {
                    console.error("Error firmando URL:", e);
                  }
                }

                return (
                  <div
                    key={post.id}
                    className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl"
                  >
                    <div className="p-5 flex items-center justify-between border-b border-slate-800/80">
                      <div>
                        <h3 className="text-white font-bold text-base">{post.title}</h3>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(post.createdAt).toLocaleDateString("es-VE")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isUnlocked ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <Unlock className="w-3 h-3" /> Desbloqueado
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            {post.priceKoin > 0 ? `${post.priceKoin} KOIN` : "Solo Suscriptores"}
                          </span>
                        )}
                      </div>
                    </div>

                    {post.description && (
                      <div className="px-5 pt-3 text-xs text-slate-300 leading-relaxed">
                        {post.description}
                      </div>
                    )}

                    {/* Visor de medios protegido */}
                    <div className="p-4 sm:p-5">
                      <div className="relative rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center min-h-[300px]">
                        {isUnlocked && mediaUrl ? (
                          <div className="relative w-full flex flex-col items-center">
                            {firstMedia?.type === "VIDEO" ? (
                              <video
                                src={mediaUrl}
                                controls
                                controlsList={userCanDownload ? undefined : "nodownload"}
                                className="w-full max-h-[550px] object-contain rounded-xl protected-content"
                              />
                            ) : (
                              <img
                                src={mediaUrl}
                                alt={post.title}
                                className="w-full max-h-[550px] object-contain rounded-xl protected-content"
                              />
                            )}

                            {/* Botón de descarga: Exclusivo para usuarios VIP con permiso o Super Admin */}
                            {userCanDownload && (
                              <div className="w-full flex justify-end mt-3">
                                <a
                                  href={mediaUrl}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
                                >
                                  <Download className="w-3.5 h-3.5 text-amber-400" />
                                  Descargar (Beneficio VIP)
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Contenido bloqueado con blur y teaser */
                          <div className="relative w-full h-80 flex flex-col items-center justify-center text-center p-6 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent z-10" />

                            {/* Marca de agua de fondo */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-10 select-none pointer-events-none">
                              <span className="text-5xl sm:text-7xl font-black text-rose-500 rotate-[-15deg]">
                                KONTENIDO
                              </span>
                            </div>

                            <div className="relative z-20 max-w-sm flex flex-col items-center">
                              <div className="w-14 h-14 rounded-2xl bg-rose-600/20 text-rose-500 border border-rose-500/30 flex items-center justify-center mb-3">
                                <Lock className="w-7 h-7" />
                              </div>

                              <h4 className="text-white font-bold text-base mb-1">
                                Contenido Exclusivo Bloqueado
                              </h4>
                              <p className="text-slate-400 text-xs mb-5 leading-relaxed">
                                {post.priceKoin > 0
                                  ? `Adquiere este post individual por ${post.priceKoin} KOIN para desbloquearlo de inmediato.`
                                  : `Suscríbete al perfil de @${creator.username} por ${subscriptionPrice} KOIN/mes para ver este y todos sus posts.`}
                              </p>

                              {post.priceKoin > 0 ? (
                                <BuyPostButton postId={post.id} priceKoin={post.priceKoin} />
                              ) : (
                                <SubscribeButton
                                  creatorId={creator.id}
                                  priceKoin={subscriptionPrice}
                                  isSubscriber={false}
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-3xl p-8">
              <Sparkles className="w-10 h-10 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-400 text-xs">Esta creadora aún no ha publicado fotos o videos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
