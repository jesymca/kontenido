"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  wallets,
  subscriptions,
  purchases,
  walletTransactions,
  profiles,
  posts,
  users,
  auditLog,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Suscribirse mensualmente al perfil de una creadora
 * Debita el saldo en KOIN de la billetera del consumidor y activa la suscripción por 30 días.
 */
export async function subscribeToCreatorAction(creatorId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Debes iniciar sesión para suscribirte." };
  }

  const subscriberId = session.user.id;
  if (subscriberId === creatorId) {
    return { error: "No puedes suscribirte a tu propio perfil." };
  }

  // Obtener precio de suscripción del perfil
  const creatorProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, creatorId),
  });

  if (!creatorProfile) {
    return { error: "Perfil de creadora no encontrado." };
  }

  const priceKoin = creatorProfile.subscriptionPriceKoin || 10.0;

  // Obtener billetera del consumidor
  const buyerWallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, subscriberId),
  });

  if (!buyerWallet || buyerWallet.balanceKoin < priceKoin) {
    return {
      error: `Saldo insuficiente. Necesitas ${priceKoin.toFixed(2)} KOIN. Tu saldo es ${buyerWallet?.balanceKoin?.toFixed(2) || "0.00"} KOIN.`,
      needsRecharge: true,
    };
  }

  const now = new Date();
  const startsAt = now.toISOString();
  const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const subId = crypto.randomUUID();

  // 1. Debitar saldo del consumidor
  await db
    .update(wallets)
    .set({
      balanceKoin: sql`${wallets.balanceKoin} - ${priceKoin}`,
      updatedAt: startsAt,
    })
    .where(eq(wallets.userId, subscriberId));

  // 2. Acreditar ganancias a la creadora
  await db
    .update(wallets)
    .set({
      totalEarnedKoin: sql`${wallets.totalEarnedKoin} + ${priceKoin}`,
      updatedAt: startsAt,
    })
    .where(eq(wallets.userId, creatorId));

  // 3. Registrar o renovar suscripción
  await db.insert(subscriptions).values({
    id: subId,
    subscriberId,
    creatorId,
    priceKoinSnapshot: priceKoin,
    startsAt,
    endsAt,
    autoRenew: 1,
    status: "ACTIVE",
    createdAt: startsAt,
  });

  // 4. Registrar transacción
  await db.insert(walletTransactions).values({
    id: crypto.randomUUID(),
    userId: subscriberId,
    type: "SUBSCRIPTION",
    amountKoin: priceKoin,
    reference: `SUB_${creatorId.slice(0, 8)}`,
    status: "CONFIRMED",
    notes: `Suscripción mensual a creador ${creatorId}`,
    createdAt: startsAt,
    confirmedAt: startsAt,
  });

  revalidatePath(`/${session.user.username}`);
  return { success: true };
}

/**
 * Comprar un post individual (PPV)
 */
export async function buyPostAction(postId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Debes iniciar sesión para comprar contenido." };
  }

  const buyerId = session.user.id;

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!post) {
    return { error: "Publicación no encontrada." };
  }

  if (post.creatorId === buyerId) {
    return { error: "Eres el autor de esta publicación." };
  }

  const priceKoin = post.priceKoin;

  // Verificar si ya lo compró
  const existingPurchase = await db.query.purchases.findFirst({
    where: and(
      eq(purchases.buyerId, buyerId),
      eq(purchases.itemType, "POST"),
      eq(purchases.itemId, postId)
    ),
  });

  if (existingPurchase) {
    return { success: true, message: "Ya habías adquirido este contenido." };
  }

  // Verificar saldo
  const buyerWallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, buyerId),
  });

  if (!buyerWallet || buyerWallet.balanceKoin < priceKoin) {
    return {
      error: `Saldo insuficiente. Requiere ${priceKoin.toFixed(2)} KOIN. Tu saldo es ${buyerWallet?.balanceKoin?.toFixed(2) || "0.00"} KOIN.`,
      needsRecharge: true,
    };
  }

  const now = new Date().toISOString();

  // Debitar
  await db
    .update(wallets)
    .set({
      balanceKoin: sql`${wallets.balanceKoin} - ${priceKoin}`,
      updatedAt: now,
    })
    .where(eq(wallets.userId, buyerId));

  // Registrar compra
  await db.insert(purchases).values({
    id: crypto.randomUUID(),
    buyerId,
    creatorId: post.creatorId,
    itemType: "POST",
    itemId: postId,
    priceKoin,
    status: "COMPLETED",
    createdAt: now,
  });

  // Registrar transacción
  await db.insert(walletTransactions).values({
    id: crypto.randomUUID(),
    userId: buyerId,
    type: "PURCHASE",
    amountKoin: priceKoin,
    reference: `POST_${postId.slice(0, 8)}`,
    status: "CONFIRMED",
    notes: `Compra de post "${post.title}"`,
    createdAt: now,
    confirmedAt: now,
  });

  revalidatePath(`/${session.user.username}`);
  return { success: true };
}
