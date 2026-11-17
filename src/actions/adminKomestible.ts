"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  settings,
  users,
  komestiblePhotos,
  komestibleSwipes,
  komestibleMatches,
  auditLog,
} from "@/lib/db/schema";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { deleteObjectFromR2, BUCKETS } from "@/lib/r2";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Acceso denegado: Se requieren permisos de SUPER_ADMIN.");
  }
  return session.user;
}

/**
 * Guardar reglas globales de KOMESTIBLE y límite de Likes para HOMBRES desde SUPER_ADMIN
 */
export async function saveKomestibleSettingsAction(formData: FormData) {
  await ensureKomestibleSchema();
  const admin = await requireSuperAdmin();

  const enabled = formData.get("komestible_enabled") === "1" ? "1" : "0";
  const maleLikesLimit = String(
    Math.max(0, parseInt((formData.get("komestible_male_likes_limit") as string) || "10", 10) || 0)
  );
  const periodRaw = ((formData.get("komestible_male_limit_period") as string) || "DAILY").toUpperCase();
  const maleLimitPeriod = ["DAILY", "WEEKLY", "TOTAL"].includes(periodRaw) ? periodRaw : "DAILY";
  const otherLikesLimit = String(
    Math.max(0, parseInt((formData.get("komestible_other_likes_limit") as string) || "0", 10) || 0)
  );
  const maxPhotos = String(
    Math.max(1, Math.min(20, parseInt((formData.get("komestible_max_photos_per_user") as string) || "6", 10) || 6))
  );
  const requireModeration = formData.get("komestible_require_moderation") === "1" ? "1" : "0";
  const vipUnlimited = formData.get("komestible_vip_unlimited") === "1" ? "1" : "0";

  const now = new Date().toISOString();
  const updates = [
    { key: "komestible_enabled", value: enabled },
    { key: "komestible_male_likes_limit", value: maleLikesLimit },
    { key: "komestible_male_limit_period", value: maleLimitPeriod },
    { key: "komestible_other_likes_limit", value: otherLikesLimit },
    { key: "komestible_max_photos_per_user", value: maxPhotos },
    { key: "komestible_require_moderation", value: requireModeration },
    { key: "komestible_vip_unlimited", value: vipUnlimited },
  ];

  for (const u of updates) {
    await db
      .insert(settings)
      .values({ key: u.key, value: u.value, updatedAt: now })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: u.value, updatedAt: now },
      });
  }

  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorId: admin.id,
    action: "KOMESTIBLE_SETTINGS_UPDATED",
    entity: "settings",
    entityId: "komestible",
    meta: JSON.stringify(updates),
    ipAddress: "127.0.0.1",
    createdAt: now,
  });

  revalidatePath("/admin/komestible");
  revalidatePath("/komestible");
  revalidatePath("/koinciden");

  return { success: true };
}

/**
 * Moderar foto de KOMESTIBLE (Aprobar, Rechazar o Eliminar)
 */
export async function moderateKomestiblePhotoAction(
  photoId: string,
  action: "APPROVED" | "REJECTED" | "DELETE"
) {
  await ensureKomestibleSchema();
  await requireSuperAdmin();

  const photo = await db.query.komestiblePhotos.findFirst({
    where: eq(komestiblePhotos.id, photoId),
  });
  if (!photo) return { error: "Foto no encontrada." };

  if (action === "DELETE") {
    await db.delete(komestiblePhotos).where(eq(komestiblePhotos.id, photoId));
    try {
      await deleteObjectFromR2(BUCKETS.MEDIA, photo.mediaKey);
    } catch {
      // Ignorar si no existe
    }
  } else {
    await db
      .update(komestiblePhotos)
      .set({ status: action, isActive: action === "APPROVED" ? 1 : 0 })
      .where(eq(komestiblePhotos.id, photoId));
  }

  revalidatePath("/admin/komestible");
  revalidatePath("/komestible");
  return { success: true };
}

/**
 * Otorgar o actualizar Likes adicionales (bono) para un usuario específico en KOMESTIBLE
 */
export async function setKomestibleBonusLikesAction(userId: string, bonusLikes: number) {
  await ensureKomestibleSchema();
  await requireSuperAdmin();

  const safeBonus = Math.max(0, Math.min(10000, Math.floor(Number(bonusLikes) || 0)));
  await db
    .update(users)
    .set({ komestibleBonusLikes: safeBonus, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId));

  revalidatePath("/admin/komestible");
  revalidatePath("/komestible");
  return { success: true };
}

/**
 * Reiniciar el contador de Likes usados de un usuario en KOMESTIBLE
 */
export async function resetUserKomestibleLikesAction(userId: string) {
  await ensureKomestibleSchema();
  await requireSuperAdmin();

  await db
    .delete(komestibleSwipes)
    .where(
      and(
        eq(komestibleSwipes.swiperId, userId),
        eq(komestibleSwipes.action, "LIKE")
      )
    );

  revalidatePath("/admin/komestible");
  revalidatePath("/komestible");
  return { success: true };
}

/**
 * Cerrar o bloquear un match en KOINCIDEN desde SUPER_ADMIN
 */
export async function adminToggleKoincidenMatchAction(
  matchId: string,
  newStatus: "ACTIVE" | "BLOCKED"
) {
  await ensureKomestibleSchema();
  await requireSuperAdmin();

  await db
    .update(komestibleMatches)
    .set({ status: newStatus })
    .where(eq(komestibleMatches.id, matchId));

  revalidatePath("/admin/komestible");
  revalidatePath("/koinciden");
  return { success: true };
}
