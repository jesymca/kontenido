"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  users,
  profiles,
  wallets,
  payouts,
  komestiblePhotos,
  auditLog,
} from "@/lib/db/schema";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { eq, and, desc, asc, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Activa el Modo Creador de Contenido (para crear y vender) desde una cuenta de Consumidor,
 * preservando su billetera KOIN, nivel, membresía VIP, suscripciones, favoritos y fotos de KOMESTIBLE.
 */
export async function activateCreatorModeAction() {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) {
    return { error: "Debes iniciar sesión para activar el Estudio de Creador." };
  }

  const targetEmail = session.user.email?.toLowerCase().trim();
  const dbUser = targetEmail
    ? await db.query.users.findFirst({
        where: or(eq(users.id, session.user.id), eq(users.email, targetEmail)),
        with: { profile: true },
      })
    : await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        with: { profile: true },
      });

  if (!dbUser) {
    return { error: "Usuario no encontrado." };
  }

  if (dbUser.role === "CREATOR") {
    return { success: true, alreadyCreator: true, redirectTo: "/panel" };
  }

  if (dbUser.role === "SUPER_ADMIN" || dbUser.role === "AGENCY") {
    return {
      error: "Tu cuenta administrativa o de agencia no necesita convertirse a perfil individual.",
    };
  }

  const now = new Date().toISOString();

  // Usar mejor foto de KOMESTIBLE como avatar inicial si no tiene avatar todavía
  const bestPhoto = await db.query.komestiblePhotos.findFirst({
    where: and(
      eq(komestiblePhotos.userId, dbUser.id),
      eq(komestiblePhotos.isActive, 1)
    ),
    orderBy: [desc(komestiblePhotos.likesReceived), asc(komestiblePhotos.sortOrder)],
  });

  const creatorCat =
    dbUser.gender &&
    ["MUJER", "HOMBRE", "PAREJA", "TRANSEXUAL"].includes(dbUser.gender)
      ? (dbUser.gender as "MUJER" | "HOMBRE" | "PAREJA" | "TRANSEXUAL")
      : "MUJER";

  await db
    .update(users)
    .set({
      role: "CREATOR",
      status: dbUser.kycStatus === "APPROVED" ? "ACTIVE" : "PENDING",
      updatedAt: now,
    })
    .where(eq(users.id, dbUser.id));

  if (dbUser.profile) {
    const isGenericBio =
      !dbUser.profile.bio ||
      dbUser.profile.bio.includes("Usuario en KONTENIDO") ||
      dbUser.profile.bio.includes("Estoy usando KONTENIDO");

    await db
      .update(profiles)
      .set({
        creatorCategory: dbUser.profile.creatorCategory || creatorCat,
        subscriptionPriceKoin:
          dbUser.profile.subscriptionPriceKoin > 0
            ? dbUser.profile.subscriptionPriceKoin
            : 10.0,
        bio: isGenericBio
          ? "Creadora de contenido en KONTENIDO."
          : dbUser.profile.bio,
        avatarKey: dbUser.profile.avatarKey || bestPhoto?.mediaKey || null,
        updatedAt: now,
      })
      .where(eq(profiles.userId, dbUser.id));
  } else {
    await db.insert(profiles).values({
      userId: dbUser.id,
      displayName: dbUser.username,
      bio: "Creadora de contenido en KONTENIDO.",
      subscriptionPriceKoin: 10.0,
      creatorCategory: creatorCat,
      avatarKey: bestPhoto?.mediaKey || null,
      isPublished: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Garantizar billetera existente
  const wallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, dbUser.id),
  });
  if (!wallet) {
    await db.insert(wallets).values({
      userId: dbUser.id,
      balanceKoin: 0.0,
      totalSpentUsd: 0.0,
      totalEarnedKoin: 0.0,
      updatedAt: now,
    });
  }

  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorId: dbUser.id,
    action: "SWITCH_TO_CREATOR_MODE",
    entity: "USER",
    entityId: dbUser.id,
    meta: JSON.stringify({ previousRole: dbUser.role }),
    createdAt: now,
  });

  revalidatePath("/", "layout");
  revalidatePath("/panel");
  revalidatePath("/panel/perfil");
  revalidatePath("/cuenta");
  revalidatePath("/komestible");

  return {
    success: true,
    redirectTo: "/panel",
  };
}

/**
 * Cambia una cuenta de Creador a solo Consumidor (por ejemplo si se registró como Creador por error
 * o decide dejar de vender temporalmente), ocultando su perfil público del catálogo sin perder su saldo ni suscripciones.
 */
export async function switchToConsumerModeAction() {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) {
    return { error: "Debes iniciar sesión." };
  }

  const targetEmail = session.user.email?.toLowerCase().trim();
  const dbUser = targetEmail
    ? await db.query.users.findFirst({
        where: or(eq(users.id, session.user.id), eq(users.email, targetEmail)),
      })
    : await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });

  if (!dbUser) {
    return { error: "Usuario no encontrado." };
  }

  if (dbUser.role === "CONSUMER") {
    return { success: true, alreadyConsumer: true, redirectTo: "/cuenta" };
  }

  if (dbUser.role === "SUPER_ADMIN" || dbUser.role === "AGENCY") {
    return {
      error: "Las cuentas de Super Admin o Agencia no pueden convertirse en consumidor individual.",
    };
  }

  // Verificar si tiene retiros pendientes en curso
  const pendingPayout = await db.query.payouts.findFirst({
    where: and(
      eq(payouts.creatorId, dbUser.id),
      eq(payouts.status, "PENDING")
    ),
  });

  if (pendingPayout) {
    return {
      error:
        "Tienes una solicitud de retiro pendiente por liquidar. Espera a que se complete antes de desactivar tu perfil de Creador.",
    };
  }

  const now = new Date().toISOString();

  await db
    .update(users)
    .set({
      role: "CONSUMER",
      status: "ACTIVE",
      updatedAt: now,
    })
    .where(eq(users.id, dbUser.id));

  // Ocultar perfil público del catálogo de venta sin borrar sus publicaciones/datos por si reactiva luego
  await db
    .update(profiles)
    .set({
      isPublished: 0,
      updatedAt: now,
    })
    .where(eq(profiles.userId, dbUser.id));

  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorId: dbUser.id,
    action: "SWITCH_TO_CONSUMER_MODE",
    entity: "USER",
    entityId: dbUser.id,
    meta: JSON.stringify({ previousRole: dbUser.role }),
    createdAt: now,
  });

  revalidatePath("/", "layout");
  revalidatePath("/panel");
  revalidatePath("/panel/perfil");
  revalidatePath("/cuenta");
  revalidatePath("/komestible");

  return {
    success: true,
    redirectTo: "/cuenta",
  };
}
