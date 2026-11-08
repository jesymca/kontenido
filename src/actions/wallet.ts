"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  wallets,
  walletTransactions,
  vipMemberships,
  users,
  auditLog,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Solicitar recarga de saldo KOIN mediante transferencia de USDT
 * Crea una transacción PENDING para validación manual del SUPER_ADMIN
 */
export async function submitTopupAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    return { error: "No autorizado" };
  }

  const userId = session.user.id;
  const amountUsdtRaw = formData.get("amountUsdt") as string;
  const amountUsdt = parseFloat(amountUsdtRaw);
  const reference = (formData.get("reference") as string)?.trim();
  const proofKey = (formData.get("proofKey") as string) || null;

  if (!amountUsdt || amountUsdt <= 0) {
    return { error: "Ingresa un monto válido en USDT mayor a 0." };
  }

  if (!reference) {
    return { error: "El TX Hash de la transacción o comprobante es requerido." };
  }

  const now = new Date().toISOString();
  const txId = crypto.randomUUID();

  // 1 USDT = 1 KOIN
  const amountKoin = amountUsdt;

  await db.insert(walletTransactions).values({
    id: txId,
    userId,
    type: "TOPUP_USDT",
    amountKoin,
    amountUsdt,
    reference,
    proofKey,
    status: "PENDING",
    notes: "Recarga USDT en espera de validación manual por SUPER_ADMIN",
    createdAt: now,
  });

  revalidatePath("/cuenta");
  return {
    success: true,
    message: "Solicitud de recarga enviada. El SUPER_ADMIN validará la transacción y acreditará tus KOIN.",
  };
}

/**
 * Adquirir membresía VIP (Ultra, Pro, Platinum, etc.) con saldo KOIN
 * Otorga badge especial, marco distintivo y permiso legal de descarga
 */
export async function buyVipMembershipAction(membershipId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "No autorizado" };
  }

  const userId = session.user.id;

  const membership = await db.query.vipMemberships.findFirst({
    where: eq(vipMemberships.id, membershipId),
  });

  if (!membership || membership.isActive === 0) {
    return { error: "Membresía VIP no disponible." };
  }

  const buyerWallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, userId),
  });

  if (!buyerWallet || buyerWallet.balanceKoin < membership.priceKoin) {
    return {
      error: `Saldo insuficiente. Necesitas ${membership.priceKoin} KOIN. Tu saldo actual es ${buyerWallet?.balanceKoin?.toFixed(2) || "0.00"} KOIN.`,
      needsRecharge: true,
    };
  }

  const now = new Date().toISOString();

  // 1. Debitar saldo
  await db
    .update(wallets)
    .set({
      balanceKoin: sql`${wallets.balanceKoin} - ${membership.priceKoin}`,
      updatedAt: now,
    })
    .where(eq(wallets.userId, userId));

  // 2. Asignar membresía VIP y permiso de descarga al usuario
  await db
    .update(users)
    .set({
      vipMembershipId: membership.id,
      allowDownload: membership.allowDownload,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  // 3. Registrar transacción
  await db.insert(walletTransactions).values({
    id: crypto.randomUUID(),
    userId,
    type: "VIP_MEMBERSHIP",
    amountKoin: membership.priceKoin,
    reference: `VIP_${membership.slug.toUpperCase()}`,
    status: "CONFIRMED",
    notes: `Adquisición de Membresía VIP "${membership.name}"`,
    createdAt: now,
    confirmedAt: now,
  });

  revalidatePath("/cuenta");
  revalidatePath("/");

  return {
    success: true,
    message: `¡Felicidades! Has activado la membresía VIP ${membership.name}. Ahora tienes tu distintivo y permisos especiales activados.`,
  };
}
