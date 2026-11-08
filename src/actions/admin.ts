"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  users,
  wallets,
  walletTransactions,
  userLevels,
  vipMemberships,
  kycDocuments,
  posts,
  mediaAssets,
  settings,
  payouts,
  auditLog,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { calculateUserLevel } from "@/lib/utils";
import { revalidatePath } from "next/cache";

/**
 * Middleware interno para verificar privilegios de SUPER_ADMIN
 */
async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Acceso denegado: Se requieren permisos de SUPER_ADMIN.");
  }
  return session.user;
}

/**
 * Confirmar recarga USDT (Acredita saldo KOIN y recalcula el nivel 0 a 100 del usuario)
 */
export async function confirmTopupAction(txId: string) {
  const admin = await requireSuperAdmin();

  const tx = await db.query.walletTransactions.findFirst({
    where: eq(walletTransactions.id, txId),
  });

  if (!tx || tx.status !== "PENDING") {
    return { error: "Transacción no encontrada o ya procesada." };
  }

  const now = new Date().toISOString();
  const amountUsdt = tx.amountUsdt || tx.amountKoin;

  // 1. Acreditar saldo KOIN y sumar al total invertido en USD
  await db
    .update(wallets)
    .set({
      balanceKoin: sql`${wallets.balanceKoin} + ${tx.amountKoin}`,
      totalSpentUsd: sql`${wallets.totalSpentUsd} + ${amountUsdt}`,
      updatedAt: now,
    })
    .where(eq(wallets.userId, tx.userId));

  // 2. Obtener nuevo total invertido para recalcular el nivel (0 al 100)
  const updatedWallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, tx.userId),
  });

  const newTotalSpent = updatedWallet?.totalSpentUsd || 0;
  const newLevel = calculateUserLevel(newTotalSpent);

  // Actualizar nivel de usuario
  await db
    .update(users)
    .set({
      level: newLevel,
      updatedAt: now,
    })
    .where(eq(users.id, tx.userId));

  // 3. Marcar transacción como CONFIRMED
  await db
    .update(walletTransactions)
    .set({
      status: "CONFIRMED",
      validatedBy: admin.id,
      confirmedAt: now,
    })
    .where(eq(walletTransactions.id, txId));

  // 4. Registrar auditoría
  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorId: admin.id,
    action: "TOPUP_CONFIRMED",
    entity: "wallet_transactions",
    entityId: txId,
    meta: JSON.stringify({ userId: tx.userId, amountKoin: tx.amountKoin, newLevel }),
    ipAddress: "127.0.0.1",
    createdAt: now,
  });

  revalidatePath("/admin/recargas");
  revalidatePath("/admin/usuarios");
  return { success: true };
}

/**
 * Rechazar recarga USDT
 */
export async function rejectTopupAction(txId: string, notes: string) {
  const admin = await requireSuperAdmin();
  const now = new Date().toISOString();

  await db
    .update(walletTransactions)
    .set({
      status: "REJECTED",
      notes: notes || "Comprobante inválido o fondos no recibidos.",
      validatedBy: admin.id,
      confirmedAt: now,
    })
    .where(eq(walletTransactions.id, txId));

  revalidatePath("/admin/recargas");
  return { success: true };
}

/**
 * CRUD Usuarios: Actualizar rol, estado, nivel manual y permiso de descarga VIP
 */
export async function updateAdminUserAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const admin = await requireSuperAdmin();

    const userId = formData.get("userId") as string;
    const role = formData.get("role") as "SUPER_ADMIN" | "CREATOR" | "CONSUMER" | "AGENCY";
    const status = formData.get("status") as "PENDING" | "ACTIVE" | "SUSPENDED";
    const level = parseInt(formData.get("level") as string) || 0;
    const allowDownload = formData.get("allowDownload") === "1" ? 1 : 0;
    const vipMembershipId = (formData.get("vipMembershipId") as string) || null;
    const suspensionReason = (formData.get("suspensionReason") as string) || null;

    const now = new Date().toISOString();

    await db
      .update(users)
      .set({
        role,
        status,
        level: Math.min(100, Math.max(0, level)),
        allowDownload,
        vipMembershipId,
        suspensionReason: status === "SUSPENDED" ? suspensionReason : null,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    revalidatePath("/admin/usuarios");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Error al actualizar usuario." };
  }
}

/**
 * Suspender o reactivar usuario de forma inmediata
 */
export async function toggleUserSuspensionAction(userId: string, reason?: string) {
  const admin = await requireSuperAdmin();

  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!target) return { error: "Usuario no encontrado" };

  const isCurrentlySuspended = target.status === "SUSPENDED";
  const newStatus = isCurrentlySuspended ? "ACTIVE" : "SUSPENDED";
  const suspensionReason = isCurrentlySuspended ? null : (reason || "Suspensión administrativa");
  const now = new Date().toISOString();

  await db
    .update(users)
    .set({
      status: newStatus,
      suspensionReason,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  revalidatePath("/admin/usuarios");
  return { success: true, newStatus };
}

/**
 * CRUD Niveles de Inversión: Editar rango de inversión, títulos, marco y permiso de descarga
 */
export async function saveUserLevelConfigAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireSuperAdmin();

    const levelNumber = parseInt(formData.get("levelNumber") as string);
    const minSpentUsd = parseFloat(formData.get("minSpentUsd") as string);
    const maxSpentUsd = parseFloat(formData.get("maxSpentUsd") as string);
    const title = (formData.get("title") as string)?.trim();
    const badgeFrame = (formData.get("badgeFrame") as string)?.trim() || "default";
    const badgeColor = (formData.get("badgeColor") as string)?.trim() || "#3b82f6";
    const canDownload = formData.get("canDownload") === "1" ? 1 : 0;

    const now = new Date().toISOString();

    await db
      .insert(userLevels)
      .values({
        levelNumber,
        minSpentUsd,
        maxSpentUsd,
        title,
        badgeFrame,
        badgeColor,
        canDownload,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: userLevels.levelNumber,
        set: {
          minSpentUsd,
          maxSpentUsd,
          title,
          badgeFrame,
          badgeColor,
          canDownload,
        },
      });

    revalidatePath("/admin/niveles");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Error al guardar nivel." };
  }
}

/**
 * CRUD Membresías VIP: Crear o actualizar membresías con frases cortas (Ultra, Pro, etc.)
 */
export async function saveVipMembershipAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireSuperAdmin();

    const id = (formData.get("id") as string) || crypto.randomUUID();
    const name = (formData.get("name") as string)?.trim();
    const slug = (formData.get("slug") as string)?.trim().toLowerCase();
    const badgeText = (formData.get("badgeText") as string)?.trim().toUpperCase();
    const badgeColor = (formData.get("badgeColor") as string)?.trim() || "from-amber-400 to-amber-600";
    const priceKoin = parseFloat(formData.get("priceKoin") as string) || 20.0;
    const durationDays = parseInt(formData.get("durationDays") as string) || 30;
    const allowDownload = formData.get("allowDownload") === "1" ? 1 : 0;
    const description = (formData.get("description") as string)?.trim();
    const isActive = formData.get("isActive") === "1" ? 1 : 0;

    const now = new Date().toISOString();

    await db
      .insert(vipMemberships)
      .values({
        id,
        name,
        slug,
        badgeText,
        badgeColor,
        priceKoin,
        durationDays,
        allowDownload,
        description,
        isActive,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: vipMemberships.id,
        set: {
          name,
          slug,
          badgeText,
          badgeColor,
          priceKoin,
          durationDays,
          allowDownload,
          description,
          isActive,
        },
      });

    revalidatePath("/admin/membresias");
    revalidatePath("/cuenta");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Error al guardar membresía." };
  }
}

/**
 * CRUD Membresías VIP: Eliminar membresía
 */
export async function deleteVipMembershipAction(membershipId: string) {
  await requireSuperAdmin();

  await db.delete(vipMemberships).where(eq(vipMemberships.id, membershipId));
  revalidatePath("/admin/membresias");
  revalidatePath("/cuenta");
  return { success: true };
}

/**
 * Revisión y Aprobación de KYC de Creadoras
 */
export async function reviewKycAction(kycDocId: string, status: "APPROVED" | "REJECTED", reason?: string) {
  const admin = await requireSuperAdmin();
  const now = new Date().toISOString();

  const doc = await db.query.kycDocuments.findFirst({
    where: eq(kycDocuments.id, kycDocId),
  });

  if (!doc) return { error: "Documento KYC no encontrado." };

  await db
    .update(kycDocuments)
    .set({
      status,
      rejectionReason: status === "REJECTED" ? reason : null,
      reviewerId: admin.id,
      reviewedAt: now,
    })
    .where(eq(kycDocuments.id, kycDocId));

  // Si se aprueba, activar cuenta del creador y estado KYC
  if (status === "APPROVED") {
    await db
      .update(users)
      .set({
        kycStatus: "APPROVED",
        status: "ACTIVE",
        updatedAt: now,
      })
      .where(eq(users.id, doc.userId));
  } else {
    await db
      .update(users)
      .set({
        kycStatus: "REJECTED",
        updatedAt: now,
      })
      .where(eq(users.id, doc.userId));
  }

  revalidatePath("/admin/kyc");
  revalidatePath("/admin/usuarios");
  return { success: true };
}

/**
 * Moderación de contenido (Aprobar o Bloquear post)
 */
export async function moderatePostAction(postId: string, status: "APPROVED" | "REJECTED", reason?: string) {
  const admin = await requireSuperAdmin();
  const now = new Date().toISOString();

  await db
    .update(posts)
    .set({
      status,
      reviewedBy: admin.id,
      reviewedAt: now,
      rejectionReason: status === "REJECTED" ? reason : null,
      updatedAt: now,
    })
    .where(eq(posts.id, postId));

  revalidatePath("/admin/contenido");
  return { success: true };
}

/**
 * Actualizar configuraciones globales de la plataforma (CRUD SUPER_ADMIN)
 * Incluye comisiones escalonadas (Tier 1: 20%, Tier 2: 15%, Tier 3: 10%)
 */
export async function updatePlatformSettingsAction(formData: FormData) {
  await requireSuperAdmin();

  const platformFee = formData.get("platform_fee_pct") as string;
  const feeTier1Max = formData.get("fee_tier1_max") as string;
  const feeTier1Pct = formData.get("fee_tier1_pct") as string;
  const feeTier2Max = formData.get("fee_tier2_max") as string;
  const feeTier2Pct = formData.get("fee_tier2_pct") as string;
  const feeTier3Pct = formData.get("fee_tier3_pct") as string;
  const fallbackUsdVes = formData.get("fallback_usd_ves_rate") as string;
  const parity = formData.get("koin_usd_parity") as string;
  const trc20 = formData.get("usdt_trc20_address") as string;
  const bep20 = formData.get("usdt_bep20_address") as string;
  const vipDownloadMin = formData.get("vip_download_min_spent") as string;

  const now = new Date().toISOString();

  const updates = [
    { key: "platform_fee_pct", value: platformFee },
    { key: "fee_tier1_max", value: feeTier1Max },
    { key: "fee_tier1_pct", value: feeTier1Pct },
    { key: "fee_tier2_max", value: feeTier2Max },
    { key: "fee_tier2_pct", value: feeTier2Pct },
    { key: "fee_tier3_pct", value: feeTier3Pct },
    { key: "fallback_usd_ves_rate", value: fallbackUsdVes },
    { key: "koin_usd_parity", value: parity },
    { key: "usdt_trc20_address", value: trc20 },
    { key: "usdt_bep20_address", value: bep20 },
    { key: "vip_download_min_spent", value: vipDownloadMin },
  ];

  for (const u of updates) {
    if (u.value !== undefined && u.value !== null && u.value.trim() !== "") {
      await db
        .insert(settings)
        .values({ key: u.key, value: u.value.trim(), updatedAt: now })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: u.value.trim(), updatedAt: now },
        });
    }
  }

  revalidatePath("/admin/settings");
  revalidatePath("/cuenta");
  revalidatePath("/panel/pagos");
  return { success: true };
}

/**
 * Procesar corte semanal / solicitud de retiro de pago a Creadora (Marcar PAID)
 * Registra obligatoriamente el Número de Transferencia / Referencia Bancaria
 * para que quede visible de inmediato en el panel de la creadora.
 */
export async function processPayoutAction(formData: FormData) {
  const admin = await requireSuperAdmin();

  const payoutId = formData.get("payoutId") as string;
  const paymentMethodId = formData.get("paymentMethodId") as string;
  const transactionRef = (formData.get("transactionRef") as string)?.trim();
  const proofKey = (formData.get("proofKey") as string)?.trim() || "proof_confirmed";
  const now = new Date().toISOString();

  if (!payoutId) {
    return { error: "Identificador de liquidación inválido." };
  }

  if (!transactionRef) {
    return { error: "El número de transferencia o referencia bancaria es obligatorio." };
  }

  const existingPayout = await db.query.payouts.findFirst({
    where: eq(payouts.id, payoutId),
  });

  if (!existingPayout) {
    return { error: "La liquidación no fue encontrada." };
  }

  await db
    .update(payouts)
    .set({
      status: "PAID",
      paymentMethodId: paymentMethodId || existingPayout.paymentMethodId,
      paidBy: admin.id,
      paidAt: now,
      transactionRef,
      proofKey,
    })
    .where(eq(payouts.id, payoutId));

  revalidatePath("/admin/payouts");
  revalidatePath("/panel/pagos");
  return { success: true };
}
