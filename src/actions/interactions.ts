"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, profiles, posts, mediaAssets, profileLikes, profileFavorites } from "@/lib/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ensureInteractionsSchema } from "@/lib/db/initInteractions";

/**
 * Alternar "Me Gusta" (Like / Corazón ❤️) a un perfil de creadora
 * Aumenta o disminuye el likesCount en profiles para alimentar el algoritmo de posicionamiento
 */
export async function toggleProfileLikeAction(creatorId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Inicia sesión para dar Me Gusta a este perfil.", requiresAuth: true };
  }

  const userId = session.user.id;
  if (userId === creatorId) {
    return { error: "No puedes darte Me Gusta a ti misma." };
  }

  await ensureInteractionsSchema();

  // Verificar si ya le dio like
  const existingLike = await db.query.profileLikes.findFirst({
    where: and(
      eq(profileLikes.userId, userId),
      eq(profileLikes.creatorId, creatorId)
    ),
  });

  let liked = false;
  if (existingLike) {
    // Quitar like
    await db.delete(profileLikes).where(eq(profileLikes.id, existingLike.id));
    liked = false;
  } else {
    // Agregar like
    await db.insert(profileLikes).values({
      id: crypto.randomUUID(),
      userId,
      creatorId,
      createdAt: new Date().toISOString(),
    });
    liked = true;
  }

  // Recalcular conteo total de likes reales para la creadora
  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(profileLikes)
    .where(eq(profileLikes.creatorId, creatorId));
  const newLikesCount = Number(countRes[0]?.count || 0);

  // Actualizar el cache likesCount en profiles para el algoritmo
  await db
    .update(profiles)
    .set({ likesCount: newLikesCount })
    .where(eq(profiles.userId, creatorId));

  // Obtener username de la creadora para revalidar su perfil público
  const creatorUser = await db.query.users.findFirst({
    where: eq(users.id, creatorId),
    columns: { username: true },
  });

  if (creatorUser) {
    revalidatePath(`/${creatorUser.username}`);
  }
  revalidatePath("/");
  revalidatePath("/cuenta/favoritos");

  return { success: true, liked, likesCount: newLikesCount };
}

/**
 * Alternar "Favorito" (Guardar en favoritos) para un perfil de creadora
 */
export async function toggleProfileFavoriteAction(creatorId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Inicia sesión para guardar este perfil en tus favoritos.", requiresAuth: true };
  }

  const userId = session.user.id;
  if (userId === creatorId) {
    return { error: "No puedes agregarte a ti misma como favorita." };
  }

  await ensureInteractionsSchema();

  // Verificar si ya está en favoritos
  const existingFav = await db.query.profileFavorites.findFirst({
    where: and(
      eq(profileFavorites.userId, userId),
      eq(profileFavorites.creatorId, creatorId)
    ),
  });

  let favorited = false;
  if (existingFav) {
    // Quitar de favoritos
    await db.delete(profileFavorites).where(eq(profileFavorites.id, existingFav.id));
    favorited = false;
  } else {
    // Agregar a favoritos
    await db.insert(profileFavorites).values({
      id: crypto.randomUUID(),
      userId,
      creatorId,
      createdAt: new Date().toISOString(),
    });
    favorited = true;
  }

  const creatorUser = await db.query.users.findFirst({
    where: eq(users.id, creatorId),
    columns: { username: true },
  });

  if (creatorUser) {
    revalidatePath(`/${creatorUser.username}`);
  }
  revalidatePath("/cuenta/favoritos");

  return { success: true, favorited };
}

/**
 * Obtener estado de interacciones del usuario actual hacia una creadora
 */
export async function getProfileInteractionsStatusAction(creatorId: string) {
  await ensureInteractionsSchema();

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(profileLikes)
    .where(eq(profileLikes.creatorId, creatorId));
  const totalLikes = Number(countRes[0]?.count || 0);

  const session = await auth();
  if (!session?.user) {
    return { isLiked: false, isFavorited: false, totalLikes };
  }

  const userId = session.user.id;

  const [like, fav] = await Promise.all([
    db.query.profileLikes.findFirst({
      where: and(
        eq(profileLikes.userId, userId),
        eq(profileLikes.creatorId, creatorId)
      ),
    }),
    db.query.profileFavorites.findFirst({
      where: and(
        eq(profileFavorites.userId, userId),
        eq(profileFavorites.creatorId, creatorId)
      ),
    }),
  ]);

  return {
    isLiked: !!like,
    isFavorited: !!fav,
    totalLikes,
  };
}

/**
 * Obtener la lista completa de perfiles favoritos del consumidor actual
 * con métricas intuitivas de fotos, videos y precio en KOIN
 */
export async function getConsumerFavoritesAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "No autorizado", favorites: [] };
  }

  await ensureInteractionsSchema();

  const favRows = await db.query.profileFavorites.findMany({
    where: eq(profileFavorites.userId, session.user.id),
    orderBy: [desc(profileFavorites.createdAt)],
  });

  if (favRows.length === 0) {
    return { success: true, favorites: [] };
  }

  const creatorIds = favRows.map((f) => f.creatorId);

  // Obtener datos de cada creadora
  const creators = await db.query.users.findMany({
    where: inArray(users.id, creatorIds),
    with: {
      profile: true,
    },
  });

  // Para cada creadora, calcular fotos, videos y likes
  const enrichedFavorites = await Promise.all(
    creators.map(async (creator) => {
      // Conteo de fotos y videos
      const mediaList = await db
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

      let photosCount = 0;
      let videosCount = 0;

      for (const m of mediaList) {
        if (m.type === "IMAGE") photosCount = Number(m.count);
        if (m.type === "VIDEO") videosCount = Number(m.count);
      }

      return {
        id: creator.id,
        username: creator.username,
        level: creator.level || 0,
        kycStatus: creator.kycStatus,
        displayName: creator.profile?.displayName || creator.username,
        bio: creator.profile?.bio || "",
        avatarKey: creator.profile?.avatarKey,
        bannerKey: creator.profile?.bannerKey,
        priceKoin: creator.profile?.subscriptionPriceKoin || 10.0,
        likesCount: creator.profile?.likesCount || 0,
        photosCount,
        videosCount,
      };
    })
  );

  return { success: true, favorites: enrichedFavorites };
}
