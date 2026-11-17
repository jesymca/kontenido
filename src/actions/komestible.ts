"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  users,
  profiles,
  settings,
  komestiblePhotos,
  komestibleSwipes,
  komestiblePhotoRatings,
  komestibleMatches,
  koincidenMessages,
} from "@/lib/db/schema";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { validateNoExternalContact } from "@/lib/contentFilter";
import { deleteObjectFromR2, BUCKETS } from "@/lib/r2";
import { eq, and, or, desc, asc, ne, inArray, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type LimitPeriod = "DAILY" | "WEEKLY" | "TOTAL";

export interface KomestibleConfig {
  enabled: boolean;
  maleLikesLimit: number;
  maleLimitPeriod: LimitPeriod;
  otherLikesLimit: number;
  maxPhotosPerUser: number;
  requireModeration: boolean;
  vipUnlimited: boolean;
}

export interface LikeQuotaInfo {
  isLimited: boolean;
  limit: number | null;
  baseLimit: number;
  bonus: number;
  used: number;
  remaining: number | null;
  period: LimitPeriod;
  gender: string | null;
}

export interface KomestibleCardPhoto {
  id: string;
  mediaKey: string;
  caption: string | null;
  likesReceived: number;
  avgRating: number;
  ratingCount: number;
  myRating: number | null;
}

export interface KomestibleDeckCard {
  userId: string;
  username: string;
  displayName: string;
  bio: string | null;
  role: string;
  level: number;
  country: string;
  gender: string | null;
  kycStatus: string;
  isAiGenerated: boolean;
  photos: KomestibleCardPhoto[];
  totalLikes: number;
  overallRating: number;
}

/**
 * Lee las reglas de KOMESTIBLE configuradas por SUPER_ADMIN desde settings
 */
export async function getKomestibleConfig(): Promise<KomestibleConfig> {
  await ensureKomestibleSchema();
  const rows = await db.query.settings.findMany();
  const map = new Map(rows.map((s) => [s.key, s.value]));

  const periodRaw = (map.get("komestible_male_limit_period") || "DAILY").toUpperCase();
  const maleLimitPeriod: LimitPeriod =
    periodRaw === "WEEKLY" || periodRaw === "TOTAL" ? periodRaw : "DAILY";

  return {
    enabled: map.get("komestible_enabled") !== "0",
    maleLikesLimit: Math.max(0, parseInt(map.get("komestible_male_likes_limit") || "10", 10) || 10),
    maleLimitPeriod,
    otherLikesLimit: Math.max(0, parseInt(map.get("komestible_other_likes_limit") || "0", 10) || 0),
    maxPhotosPerUser: Math.max(1, parseInt(map.get("komestible_max_photos_per_user") || "6", 10) || 6),
    requireModeration: map.get("komestible_require_moderation") === "1",
    vipUnlimited: map.get("komestible_vip_unlimited") === "1",
  };
}

function getPeriodStartIso(period: LimitPeriod): string | null {
  const now = new Date();
  if (period === "DAILY") {
    return `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
  }
  if (period === "WEEKLY") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  return null;
}

/**
 * Calcula la cuota de Likes restante para el usuario en KOMESTIBLE
 * Los usuarios registrados como HOMBRE están sujetos al límite configurado por SUPER_ADMIN.
 */
export async function computeUserLikeQuota(
  userId: string,
  gender: string | null | undefined,
  vipMembershipId: string | null | undefined,
  bonusLikes: number,
  cfg?: KomestibleConfig
): Promise<LikeQuotaInfo> {
  const config = cfg || (await getKomestibleConfig());
  const isMale = gender === "HOMBRE";
  const periodStart = getPeriodStartIso(config.maleLimitPeriod);

  const countCondition = periodStart
    ? and(
        eq(komestibleSwipes.swiperId, userId),
        eq(komestibleSwipes.action, "LIKE"),
        gte(komestibleSwipes.createdAt, periodStart)
      )
    : and(eq(komestibleSwipes.swiperId, userId), eq(komestibleSwipes.action, "LIKE"));

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(komestibleSwipes)
    .where(countCondition);
  const used = Number(countRes[0]?.count || 0);

  if (isMale) {
    if (config.vipUnlimited && vipMembershipId) {
      return {
        isLimited: false,
        limit: null,
        baseLimit: config.maleLikesLimit,
        bonus: bonusLikes,
        used,
        remaining: null,
        period: config.maleLimitPeriod,
        gender: gender || null,
      };
    }

    const totalLimit = Math.max(0, config.maleLikesLimit + (bonusLikes || 0));
    return {
      isLimited: true,
      limit: totalLimit,
      baseLimit: config.maleLikesLimit,
      bonus: bonusLikes || 0,
      used,
      remaining: Math.max(0, totalLimit - used),
      period: config.maleLimitPeriod,
      gender: gender || null,
    };
  }

  if (config.otherLikesLimit > 0) {
    const totalLimit = Math.max(0, config.otherLikesLimit + (bonusLikes || 0));
    return {
      isLimited: true,
      limit: totalLimit,
      baseLimit: config.otherLikesLimit,
      bonus: bonusLikes || 0,
      used,
      remaining: Math.max(0, totalLimit - used),
      period: config.maleLimitPeriod,
      gender: gender || null,
    };
  }

  return {
    isLimited: false,
    limit: null,
    baseLimit: 0,
    bonus: bonusLikes || 0,
    used,
    remaining: null,
    period: config.maleLimitPeriod,
    gender: gender || null,
  };
}

/**
 * Permite a usuarios existentes o de Google OAuth completar su género y país para KOMESTIBLE
 */
export async function updateMyKomestibleIdentityAction(formData: FormData) {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) {
    return { error: "Debes iniciar sesión." };
  }

  const genderRaw = (formData.get("gender") as string)?.toUpperCase().trim();
  const countryRaw = (formData.get("country") as string)?.toUpperCase().trim();

  const validGenders = ["MUJER", "HOMBRE", "PAREJA", "TRANSEXUAL", "OTRO"] as const;
  if (!validGenders.includes(genderRaw as any)) {
    return { error: "Selecciona una opción de género válida." };
  }

  const country = countryRaw && /^[A-Z]{2,5}$/.test(countryRaw) ? countryRaw : undefined;
  const now = new Date().toISOString();

  await db
    .update(users)
    .set({
      gender: genderRaw as any,
      ...(country ? { country } : {}),
      updatedAt: now,
    })
    .where(eq(users.id, session.user.id));

  revalidatePath("/komestible");
  revalidatePath("/koinciden");
  return { success: true };
}

/**
 * Sube una foto gratuita a KOMESTIBLE para que sea valorada y aparezca en el Discovery Deck
 */
export async function uploadKomestiblePhotoAction(input: {
  mediaKey: string;
  caption?: string;
}) {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) {
    return { error: "Debes iniciar sesión para subir fotos a KOMESTIBLE." };
  }

  const userId = session.user.id;
  const cfg = await getKomestibleConfig();
  if (!cfg.enabled) {
    return { error: "La sección KOMESTIBLE se encuentra deshabilitada temporalmente." };
  }

  const mediaKey = (input.mediaKey || "").trim();
  if (!mediaKey || !mediaKey.startsWith(`komestible/${userId}/`)) {
    return { error: "Clave de imagen inválida." };
  }

  const caption = (input.caption || "").trim().slice(0, 140);
  if (caption) {
    const filter = validateNoExternalContact(caption, "La descripción de la foto");
    if (!filter.valid) {
      return { error: filter.error };
    }
  }

  const existingPhotos = await db.query.komestiblePhotos.findMany({
    where: and(eq(komestiblePhotos.userId, userId), eq(komestiblePhotos.isActive, 1)),
  });

  if (existingPhotos.length >= cfg.maxPhotosPerUser) {
    return {
      error: `Has alcanzado el límite de ${cfg.maxPhotosPerUser} fotos activas en KOMESTIBLE. Elimina alguna para subir una nueva.`,
    };
  }

  const now = new Date().toISOString();
  const photoId = crypto.randomUUID();
  const status = cfg.requireModeration ? "PENDING" : "APPROVED";

  await db.insert(komestiblePhotos).values({
    id: photoId,
    userId,
    mediaKey,
    caption: caption || null,
    sortOrder: existingPhotos.length,
    likesReceived: 0,
    ratingSum: 0,
    ratingCount: 0,
    avgRating: 0,
    viewsCount: 0,
    status,
    isActive: 1,
    createdAt: now,
  });

  revalidatePath("/komestible");
  return {
    success: true,
    photoId,
    status,
    message:
      status === "PENDING"
        ? "Foto subida y enviada a revisión por el administrador."
        : "¡Foto publicada en KOMESTIBLE! Otros usuarios ya pueden valorarla.",
  };
}

/**
 * Elimina una foto propia de KOMESTIBLE
 */
export async function deleteKomestiblePhotoAction(photoId: string) {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) {
    return { error: "No autorizado." };
  }

  const photo = await db.query.komestiblePhotos.findFirst({
    where: eq(komestiblePhotos.id, photoId),
  });
  if (!photo || (photo.userId !== session.user.id && session.user.role !== "SUPER_ADMIN")) {
    return { error: "Foto no encontrada." };
  }

  await db.delete(komestiblePhotos).where(eq(komestiblePhotos.id, photoId));
  try {
    await deleteObjectFromR2(BUCKETS.MEDIA, photo.mediaKey);
  } catch {
    // No bloquear si el objeto ya no estaba en R2
  }

  revalidatePath("/komestible");
  return { success: true };
}

/**
 * Obtiene la pila de tarjetas deslizables (Discovery Deck) para KOMESTIBLE
 */
export async function getDiscoveryDeckAction(filters?: {
  genderFilter?: string;
  countryFilter?: string;
}): Promise<{ success?: boolean; error?: string; cards: KomestibleDeckCard[] }> {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) {
    return { error: "Inicia sesión para descubrir perfiles.", cards: [] };
  }

  const currentUserId = session.user.id;

  // 1. Obtener usuarios ya evaluados (swiped) por el usuario actual
  const mySwipes = await db.query.komestibleSwipes.findMany({
    where: eq(komestibleSwipes.swiperId, currentUserId),
  });
  const swipedSet = new Set(mySwipes.map((s) => s.targetUserId));

  // 2. Obtener todas las fotos aprobadas y activas de otros usuarios
  const allApprovedPhotos = await db.query.komestiblePhotos.findMany({
    where: and(
      ne(komestiblePhotos.userId, currentUserId),
      eq(komestiblePhotos.status, "APPROVED"),
      eq(komestiblePhotos.isActive, 1)
    ),
    orderBy: [asc(komestiblePhotos.sortOrder), desc(komestiblePhotos.createdAt)],
  });

  const candidateUserIds = Array.from(
    new Set(
      allApprovedPhotos
        .map((p) => p.userId)
        .filter((uid) => !swipedSet.has(uid))
    )
  );

  if (candidateUserIds.length === 0) {
    return { success: true, cards: [] };
  }

  const [candidateUsers, myRatings] = await Promise.all([
    db.query.users.findMany({
      where: and(
        inArray(users.id, candidateUserIds),
        ne(users.status, "SUSPENDED")
      ),
      with: {
        profile: true,
      },
    }),
    db.query.komestiblePhotoRatings.findMany({
      where: eq(komestiblePhotoRatings.raterId, currentUserId),
    }),
  ]);

  const myRatingMap = new Map(myRatings.map((r) => [r.photoId, r.score]));
  const photosByUser = new Map<string, typeof allApprovedPhotos>();
  for (const ph of allApprovedPhotos) {
    if (swipedSet.has(ph.userId)) continue;
    const arr = photosByUser.get(ph.userId) || [];
    arr.push(ph);
    photosByUser.set(ph.userId, arr);
  }

  const genderFilter = filters?.genderFilter?.toUpperCase().trim();
  const countryFilter = filters?.countryFilter?.toUpperCase().trim();

  const cards: KomestibleDeckCard[] = [];
  for (const u of candidateUsers) {
    const userPhotos = photosByUser.get(u.id);
    if (!userPhotos || userPhotos.length === 0) continue;

    const effectiveGender = u.gender || u.profile?.creatorCategory || null;
    if (genderFilter && genderFilter !== "ALL" && effectiveGender !== genderFilter) {
      continue;
    }
    if (countryFilter && countryFilter !== "ALL" && (u.country || "VE") !== countryFilter) {
      continue;
    }

    const totalLikes = userPhotos.reduce((acc, p) => acc + (p.likesReceived || 0), 0);
    const totalRatingSum = userPhotos.reduce((acc, p) => acc + (p.ratingSum || 0), 0);
    const totalRatingCount = userPhotos.reduce((acc, p) => acc + (p.ratingCount || 0), 0);
    const overallRating =
      totalRatingCount > 0 ? Number((totalRatingSum / totalRatingCount).toFixed(1)) : 0;

    cards.push({
      userId: u.id,
      username: u.username,
      displayName: u.profile?.displayName || u.username,
      bio: u.profile?.bio || null,
      role: u.role,
      level: u.level || 0,
      country: u.country || "VE",
      gender: effectiveGender,
      kycStatus: u.kycStatus,
      isAiGenerated: u.profile?.isAiGenerated === 1,
      totalLikes,
      overallRating,
      photos: userPhotos.map((p) => ({
        id: p.id,
        mediaKey: p.mediaKey,
        caption: p.caption,
        likesReceived: p.likesReceived || 0,
        avgRating: Number((p.avgRating || 0).toFixed(1)),
        ratingCount: p.ratingCount || 0,
        myRating: myRatingMap.get(p.id) ?? null,
      })),
    });
  }

  // Mezclar suavemente priorizando perfiles nuevos o con más actividad
  cards.sort((a, b) => b.photos.length - a.photos.length);

  return { success: true, cards };
}

/**
 * Permite volver a ver perfiles a los que el usuario dio PASS (nunca reinicia LIKEs para proteger la cuota)
 */
export async function resetMyKomestiblePassesAction() {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) return { error: "No autorizado." };

  await db
    .delete(komestibleSwipes)
    .where(
      and(
        eq(komestibleSwipes.swiperId, session.user.id),
        eq(komestibleSwipes.action, "PASS")
      )
    );

  revalidatePath("/komestible");
  return { success: true };
}

/**
 * Ejecuta una acción de Swipe (LIKE o PASS) en el Binary Rating Feed de KOMESTIBLE.
 * - Controla estrictamente el límite de Likes para usuarios HOMBRES.
 * - Implementa Double Opt-In Matchmaking: si hay LIKE mutuo, crea el match en KOINCIDEN.
 */
export async function swipeKomestibleAction(input: {
  targetUserId: string;
  photoId?: string | null;
  action: "LIKE" | "PASS";
}) {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) {
    return { error: "Inicia sesión para interactuar en KOMESTIBLE.", requiresAuth: true };
  }

  const swiperId = session.user.id;
  const targetUserId = input.targetUserId?.trim();
  const action = input.action;

  if (!targetUserId || targetUserId === swiperId) {
    return { error: "Usuario objetivo inválido." };
  }

  const cfg = await getKomestibleConfig();
  if (!cfg.enabled) {
    return { error: "La sección KOMESTIBLE se encuentra temporalmente deshabilitada." };
  }

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, swiperId),
  });
  if (!currentUser) {
    return { error: "Usuario no encontrado." };
  }

  // Verificar si ya existe un swipe previo hacia este usuario
  const existingSwipe = await db.query.komestibleSwipes.findFirst({
    where: and(
      eq(komestibleSwipes.swiperId, swiperId),
      eq(komestibleSwipes.targetUserId, targetUserId)
    ),
  });

  if (existingSwipe?.action === "LIKE") {
    const quota = await computeUserLikeQuota(
      swiperId,
      currentUser.gender,
      currentUser.vipMembershipId,
      currentUser.komestibleBonusLikes,
      cfg
    );
    return { success: true, alreadyLiked: true, isMatch: false, quota };
  }

  // Si es LIKE, validar límite configurado (especialmente para HOMBRES)
  if (action === "LIKE") {
    const quotaBefore = await computeUserLikeQuota(
      swiperId,
      currentUser.gender,
      currentUser.vipMembershipId,
      currentUser.komestibleBonusLikes,
      cfg
    );

    if (quotaBefore.isLimited && quotaBefore.remaining !== null && quotaBefore.remaining <= 0) {
      const periodText =
        quotaBefore.period === "DAILY"
          ? "hoy"
          : quotaBefore.period === "WEEKLY"
          ? "esta semana"
          : "en total";
      return {
        error: `Has alcanzado tu límite de ${quotaBefore.limit} Likes ${periodText} en KOMESTIBLE.`,
        limitReached: true,
        quota: quotaBefore,
      };
    }
  }

  const now = new Date().toISOString();

  if (existingSwipe) {
    await db
      .update(komestibleSwipes)
      .set({
        action,
        photoId: input.photoId || existingSwipe.photoId,
        createdAt: now,
      })
      .where(eq(komestibleSwipes.id, existingSwipe.id));
  } else {
    await db.insert(komestibleSwipes).values({
      id: crypto.randomUUID(),
      swiperId,
      targetUserId,
      photoId: input.photoId || null,
      action,
      createdAt: now,
    });
  }

  let isMatch = false;
  let matchId: string | null = null;
  let matchedUser: {
    id: string;
    username: string;
    displayName: string;
    photoKey: string | null;
    role: string;
  } | null = null;

  if (action === "LIKE") {
    // Sumar like a la foto mostrada (o a la foto principal del usuario)
    let targetPhotoId = input.photoId || null;
    if (!targetPhotoId) {
      const firstPhoto = await db.query.komestiblePhotos.findFirst({
        where: and(
          eq(komestiblePhotos.userId, targetUserId),
          eq(komestiblePhotos.isActive, 1)
        ),
        orderBy: [asc(komestiblePhotos.sortOrder)],
      });
      targetPhotoId = firstPhoto?.id || null;
    }

    if (targetPhotoId) {
      await db
        .update(komestiblePhotos)
        .set({
          likesReceived: sql`${komestiblePhotos.likesReceived} + 1`,
        })
        .where(eq(komestiblePhotos.id, targetPhotoId));
    }

    // Double Opt-In Matchmaking: verificar si el usuario objetivo ya dio LIKE al usuario actual
    const reciprocalLike = await db.query.komestibleSwipes.findFirst({
      where: and(
        eq(komestibleSwipes.swiperId, targetUserId),
        eq(komestibleSwipes.targetUserId, swiperId),
        eq(komestibleSwipes.action, "LIKE")
      ),
    });

    if (reciprocalLike) {
      const [userAId, userBId] = [swiperId, targetUserId].sort();
      const existingMatch = await db.query.komestibleMatches.findFirst({
        where: and(
          eq(komestibleMatches.userAId, userAId),
          eq(komestibleMatches.userBId, userBId)
        ),
      });

      if (existingMatch) {
        matchId = existingMatch.id;
        if (existingMatch.status !== "ACTIVE") {
          await db
            .update(komestibleMatches)
            .set({ status: "ACTIVE", matchedByUserId: swiperId, createdAt: now })
            .where(eq(komestibleMatches.id, existingMatch.id));
        }
      } else {
        matchId = crypto.randomUUID();
        await db.insert(komestibleMatches).values({
          id: matchId,
          userAId,
          userBId,
          matchedByUserId: swiperId,
          status: "ACTIVE",
          createdAt: now,
        });
      }

      isMatch = true;

      const [partner, partnerPhoto] = await Promise.all([
        db.query.users.findFirst({
          where: eq(users.id, targetUserId),
          with: { profile: true },
        }),
        db.query.komestiblePhotos.findFirst({
          where: and(
            eq(komestiblePhotos.userId, targetUserId),
            eq(komestiblePhotos.isActive, 1)
          ),
          orderBy: [asc(komestiblePhotos.sortOrder)],
        }),
      ]);

      if (partner) {
        matchedUser = {
          id: partner.id,
          username: partner.username,
          displayName: partner.profile?.displayName || partner.username,
          photoKey: partnerPhoto?.mediaKey || partner.profile?.avatarKey || null,
          role: partner.role,
        };
      }
    }
  }

  const updatedQuota = await computeUserLikeQuota(
    swiperId,
    currentUser.gender,
    currentUser.vipMembershipId,
    currentUser.komestibleBonusLikes,
    cfg
  );

  if (isMatch) {
    revalidatePath("/koinciden");
  }

  return {
    success: true,
    isMatch,
    matchId,
    matchedUser,
    quota: updatedQuota,
  };
}

/**
 * Valora una foto específica de KOMESTIBLE con puntuación 1 a 5 🔥
 */
export async function rateKomestiblePhotoAction(input: {
  photoId: string;
  score: number;
}) {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) {
    return { error: "Inicia sesión para valorar fotos." };
  }

  const raterId = session.user.id;
  const score = Math.min(5, Math.max(1, Math.round(Number(input.score))));
  if (!Number.isFinite(score)) {
    return { error: "Puntuación inválida." };
  }

  const photo = await db.query.komestiblePhotos.findFirst({
    where: eq(komestiblePhotos.id, input.photoId),
  });
  if (!photo) {
    return { error: "Foto no encontrada." };
  }
  if (photo.userId === raterId) {
    return { error: "No puedes valorar tus propias fotos." };
  }

  const now = new Date().toISOString();
  const existing = await db.query.komestiblePhotoRatings.findFirst({
    where: and(
      eq(komestiblePhotoRatings.raterId, raterId),
      eq(komestiblePhotoRatings.photoId, photo.id)
    ),
  });

  if (existing) {
    await db
      .update(komestiblePhotoRatings)
      .set({ score, createdAt: now })
      .where(eq(komestiblePhotoRatings.id, existing.id));
  } else {
    await db.insert(komestiblePhotoRatings).values({
      id: crypto.randomUUID(),
      raterId,
      photoId: photo.id,
      targetUserId: photo.userId,
      score,
      createdAt: now,
    });
  }

  // Recalcular agregados de la foto
  const agg = await db
    .select({
      sum: sql<number>`coalesce(sum(${komestiblePhotoRatings.score}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(komestiblePhotoRatings)
    .where(eq(komestiblePhotoRatings.photoId, photo.id));

  const ratingSum = Number(agg[0]?.sum || 0);
  const ratingCount = Number(agg[0]?.count || 0);
  const avgRating = ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(2)) : 0;

  await db
    .update(komestiblePhotos)
    .set({
      ratingSum,
      ratingCount,
      avgRating,
    })
    .where(eq(komestiblePhotos.id, photo.id));

  return {
    success: true,
    avgRating,
    ratingCount,
    myRating: score,
  };
}

/**
 * Permite a un usuario (CONSUMER) que ha subido/valorado fotos en KOMESTIBLE
 * perfilarse como Creador de Contenido en KONTENIDO para comenzar a monetizar.
 */
export async function promoteToCreatorFromKomestibleAction() {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) {
    return { error: "Debes iniciar sesión." };
  }

  const userId = session.user.id;
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: { profile: true },
  });
  if (!user) return { error: "Usuario no encontrado." };

  if (user.role === "CREATOR") {
    return { success: true, alreadyCreator: true, redirectTo: "/panel" };
  }

  if (user.role === "SUPER_ADMIN" || user.role === "AGENCY") {
    return { error: "Tu cuenta actual tiene privilegios especiales y no requiere conversión." };
  }

  const now = new Date().toISOString();

  // Tomar la mejor foto de KOMESTIBLE como avatar inicial si no tiene avatar todavía
  const bestPhoto = await db.query.komestiblePhotos.findFirst({
    where: and(eq(komestiblePhotos.userId, userId), eq(komestiblePhotos.isActive, 1)),
    orderBy: [desc(komestiblePhotos.likesReceived), asc(komestiblePhotos.sortOrder)],
  });

  const creatorCat =
    user.gender && ["MUJER", "HOMBRE", "PAREJA", "TRANSEXUAL"].includes(user.gender)
      ? (user.gender as "MUJER" | "HOMBRE" | "PAREJA" | "TRANSEXUAL")
      : "MUJER";

  await db
    .update(users)
    .set({
      role: "CREATOR",
      status: user.kycStatus === "APPROVED" ? "ACTIVE" : "PENDING",
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  if (user.profile) {
    await db
      .update(profiles)
      .set({
        creatorCategory: creatorCat,
        subscriptionPriceKoin:
          user.profile.subscriptionPriceKoin > 0 ? user.profile.subscriptionPriceKoin : 10.0,
        bio:
          !user.profile.bio || user.profile.bio.includes("consumidor") || user.profile.bio.includes("Estoy usando")
            ? "Creadora de contenido en KONTENIDO. ¡Descúbreme también en KOMESTIBLE!"
            : user.profile.bio,
        avatarKey: user.profile.avatarKey || bestPhoto?.mediaKey || null,
        isPublished: 1,
        updatedAt: now,
      })
      .where(eq(profiles.userId, userId));
  } else {
    await db.insert(profiles).values({
      userId,
      displayName: user.username,
      bio: "Creadora de contenido en KONTENIDO.",
      subscriptionPriceKoin: 10.0,
      creatorCategory: creatorCat,
      avatarKey: bestPhoto?.mediaKey || null,
      isPublished: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidatePath("/", "layout");
  revalidatePath("/panel");
  revalidatePath("/komestible");
  revalidatePath("/koinciden");

  return { success: true, redirectTo: "/panel" };
}

/**
 * Obtiene los mensajes de un Match en KOINCIDEN (solo para miembros del match)
 */
export async function getKoincidenMessagesAction(matchId: string) {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) return { error: "No autorizado." };

  const userId = session.user.id;
  const match = await db.query.komestibleMatches.findFirst({
    where: eq(komestibleMatches.id, matchId),
  });

  if (!match || match.status !== "ACTIVE" || (match.userAId !== userId && match.userBId !== userId)) {
    return { error: "No tienes acceso a este KOINCIDEN." };
  }

  // Marcar mensajes recibidos como leídos
  await db
    .update(koincidenMessages)
    .set({ isRead: 1 })
    .where(
      and(
        eq(koincidenMessages.matchId, matchId),
        eq(koincidenMessages.receiverId, userId),
        eq(koincidenMessages.isRead, 0)
      )
    );

  const rows = await db.query.koincidenMessages.findMany({
    where: eq(koincidenMessages.matchId, matchId),
    orderBy: [asc(koincidenMessages.createdAt)],
  });

  return { success: true, messages: rows };
}

/**
 * Envía un mensaje gratuito dentro del espacio de KOINCIDEN
 */
export async function sendKoincidenMessageAction(input: {
  matchId: string;
  content: string;
}) {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) return { error: "Debes iniciar sesión." };

  const senderId = session.user.id;
  const content = (input.content || "").trim();
  if (!content) {
    return { error: "Escribe un mensaje para enviar." };
  }
  if (content.length > 1000) {
    return { error: "El mensaje no puede superar los 1000 caracteres." };
  }

  const filter = validateNoExternalContact(content, "El mensaje");
  if (!filter.valid) {
    return { error: filter.error };
  }

  const match = await db.query.komestibleMatches.findFirst({
    where: eq(komestibleMatches.id, input.matchId),
  });
  if (!match || match.status !== "ACTIVE" || (match.userAId !== senderId && match.userBId !== senderId)) {
    return { error: "Este KOINCIDEN no está activo." };
  }

  const receiverId = match.userAId === senderId ? match.userBId : match.userAId;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.insert(koincidenMessages).values({
    id,
    matchId: match.id,
    senderId,
    receiverId,
    content,
    isRead: 0,
    createdAt: now,
  });

  revalidatePath("/koinciden");

  return {
    success: true,
    message: {
      id,
      matchId: match.id,
      senderId,
      receiverId,
      content,
      isRead: 0,
      createdAt: now,
    },
  };
}

/**
 * Deshace un Match en KOINCIDEN (Unmatch)
 */
export async function unmatchKoincidenAction(matchId: string) {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) return { error: "No autorizado." };

  const userId = session.user.id;
  const match = await db.query.komestibleMatches.findFirst({
    where: eq(komestibleMatches.id, matchId),
  });

  if (!match || (match.userAId !== userId && match.userBId !== userId)) {
    return { error: "Koinciden no encontrado." };
  }

  await db
    .update(komestibleMatches)
    .set({ status: "UNMATCHED" })
    .where(eq(komestibleMatches.id, matchId));

  revalidatePath("/koinciden");
  return { success: true };
}
