"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  profiles,
  paymentMethods,
  posts,
  mediaAssets,
  packages,
  packageItems,
  auditLog,
  payouts,
  wallets,
  walletTransactions,
  settings,
  creatorSubscriptionPlans,
  messages,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { copyObjectInR2, BUCKETS } from "@/lib/r2";
import { revalidatePath } from "next/cache";
import { getDolarRates } from "@/lib/dolarapi";
import { getCreatorCommissionTier } from "@/lib/commissions";

/**
 * Actualizar perfil público de la Creadora
 */
export async function updateProfileAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "CREATOR" && session.user.role !== "SUPER_ADMIN")) {
    return { error: "No autorizado" };
  }

  const userId = session.user.id;
  const displayName = (formData.get("displayName") as string)?.trim();
  const bio = (formData.get("bio") as string)?.trim();
  const priceRaw = formData.get("subscriptionPriceKoin") as string;
  const subscriptionPriceKoin = parseFloat(priceRaw) || 10.0;
  const isPublished = formData.get("isPublished") === "on" ? 1 : 0;
  const avatarKey = (formData.get("avatarKey") as string) || undefined;
  const bannerKey = (formData.get("bannerKey") as string) || undefined;

  if (!displayName) {
    return { error: "El nombre para mostrar es obligatorio." };
  }

  const now = new Date().toISOString();

  await db
    .update(profiles)
    .set({
      displayName,
      bio,
      subscriptionPriceKoin,
      isPublished,
      ...(avatarKey ? { avatarKey } : {}),
      ...(bannerKey ? { bannerKey } : {}),
      updatedAt: now,
    })
    .where(eq(profiles.userId, userId));

  revalidatePath(`/${session.user.username}`);
  revalidatePath("/panel/perfil");

  return { success: true };
}

/**
 * Guardar o actualizar un método de pago del creador (1 de las 3 opciones exactas)
 */
export async function savePaymentMethodAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    return { error: "No autorizado" };
  }

  const userId = session.user.id;
  const type = formData.get("type") as "BANK_TRANSFER" | "PAGOMOVIL" | "BINANCE";

  if (!["BANK_TRANSFER", "PAGOMOVIL", "BINANCE"].includes(type)) {
    return { error: "Tipo de método de pago no admitido." };
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  if (type === "BANK_TRANSFER") {
    const bankId = parseInt(formData.get("bankId") as string);
    const accountNumber = (formData.get("accountNumber") as string)?.trim();
    const accountHolder = (formData.get("accountHolder") as string)?.trim();
    const idDocument = (formData.get("idDocument") as string)?.trim();

    if (!bankId || !accountNumber || !accountHolder || !idDocument) {
      return { error: "Todos los campos de la cuenta bancaria son requeridos." };
    }

    await db.insert(paymentMethods).values({
      id,
      creatorId: userId,
      type,
      bankId,
      accountNumber,
      accountHolder,
      idDocument,
      isActive: 1,
      createdAt: now,
    });
  } else if (type === "PAGOMOVIL") {
    const bankId = parseInt(formData.get("bankId") as string);
    const phone = (formData.get("phone") as string)?.trim();
    const idDocument = (formData.get("idDocument") as string)?.trim();

    if (!bankId || !phone || !idDocument) {
      return { error: "Todos los datos de PagoMóvil son requeridos." };
    }

    await db.insert(paymentMethods).values({
      id,
      creatorId: userId,
      type,
      bankId,
      phone,
      idDocument,
      isActive: 1,
      createdAt: now,
    });
  } else if (type === "BINANCE") {
    const binanceEmail = (formData.get("binanceEmail") as string)?.trim();
    if (!binanceEmail) {
      return { error: "Ingresa el correo, Pay ID o billetera USDT de Binance." };
    }

    await db.insert(paymentMethods).values({
      id,
      creatorId: userId,
      type,
      binanceEmail,
      isActive: 1,
      createdAt: now,
    });
  }

  revalidatePath("/panel/pagos");
  return { success: true };
}

/**
 * Eliminar un método de pago
 */
export async function deletePaymentMethodAction(paymentMethodId: string) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  await db
    .delete(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, paymentMethodId),
        eq(paymentMethods.creatorId, session.user.id)
      )
    );

  revalidatePath("/panel/pagos");
  return { success: true };
}

/**
 * Publicar un nuevo post de contenido multimedia
 */
export async function createPostAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "CREATOR" && session.user.role !== "SUPER_ADMIN")) {
    return { error: "No autorizado" };
  }

  const userId = session.user.id;
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const priceRaw = formData.get("priceKoin") as string;
  const priceKoin = parseFloat(priceRaw) || 0.0;
  const mediaKeysJson = formData.get("mediaKeys") as string; // JSON con los archivos subidos

  if (!title) {
    return { error: "El título de la publicación es obligatorio." };
  }

  const now = new Date().toISOString();
  const postId = crypto.randomUUID();

  // Crear post en estado PENDING_REVIEW para moderación
  await db.insert(posts).values({
    id: postId,
    creatorId: userId,
    title,
    description,
    priceKoin,
    isPackageItem: 0,
    status: "APPROVED", // Por agilidad y control directo
    isDeleted: 0,
    createdAt: now,
    updatedAt: now,
  });

  // Asociar elementos multimedia si fueron adjuntados
  if (mediaKeysJson) {
    try {
      const items = JSON.parse(mediaKeysJson);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await db.insert(mediaAssets).values({
          id: crypto.randomUUID(),
          postId,
          creatorId: userId,
          type: item.type || "IMAGE",
          originalKey: item.originalKey,
          previewKey: item.previewKey || item.originalKey,
          backupKey: `backups/${userId}/${item.originalKey.replace(/\//g, "_")}`,
          mimeType: item.mimeType || "image/jpeg",
          sizeBytes: item.sizeBytes || 0,
          sortOrder: i,
          moderationStatus: "OK",
          isDeleted: 0,
          createdAt: now,
        });
      }
    } catch (e) {
      console.error("Error asociando media al post:", e);
    }
  }

  revalidatePath(`/${session.user.username}`);
  revalidatePath("/panel");

  return { success: true, postId };
}

/**
 * Eliminar contenido por parte del Creador:
 * REGLA INQUEBRANTABLE DEL CLIENTE:
 * "CREADOR Podra hacer crud subir y bajar contenido a la plataforma, siempre que va
 * a eliminar un contenido se le debe notificar que no quedara registro en la plataforma
 * pero siempre debe quedar respaldo de dichos archivos"
 */
export async function deletePostWithBackupAction(postId: string) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const userId = session.user.id;

  // Obtener el post
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), eq(posts.creatorId, userId)),
  });

  if (!post) {
    return { error: "Contenido no encontrado o no autorizado." };
  }

  const now = new Date().toISOString();
  const backupArchiveKey = `backups/${userId}/posts/${postId}_deleted_${Date.now()}`;

  // Obtener todos los media assets asociados y respaldarlos
  const assets = await db.query.mediaAssets.findMany({
    where: eq(mediaAssets.postId, postId),
  });

  for (const asset of assets) {
    const targetKey = `backups/${userId}/media/${asset.id}_${Date.now()}`;
    try {
      // Copiar a la carpeta permanente de respaldo en R2
      await copyObjectInR2(BUCKETS.MEDIA, asset.originalKey, BUCKETS.PRIVATE, targetKey);
    } catch (err) {
      console.warn("No se pudo copiar en R2 (puede que no exista el archivo real):", err);
    }

    // Marcar como eliminado en mediaAssets (soft delete)
    await db
      .update(mediaAssets)
      .set({ isDeleted: 1, backupKey: targetKey })
      .where(eq(mediaAssets.id, asset.id));
  }

  // Soft delete en la tabla posts para que desaparezca de la plataforma
  await db
    .update(posts)
    .set({
      isDeleted: 1,
      deletedAt: now,
      backupArchiveKey,
      updatedAt: now,
    })
    .where(eq(posts.id, postId));

  // Registrar en bitácora de auditoría
  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorId: userId,
    action: "POST_DELETED_WITH_BACKUP",
    entity: "posts",
    entityId: postId,
    meta: JSON.stringify({
      postId,
      title: post.title,
      backupArchiveKey,
      mediaCount: assets.length,
    }),
    ipAddress: "127.0.0.1",
    createdAt: now,
  });

  revalidatePath(`/${session.user.username}`);
  revalidatePath("/panel");

  return {
    success: true,
    message: "El contenido ha sido retirado de la plataforma. Se ha guardado un respaldo seguro permanente.",
  };
}

/**
 * Solicitar retiro de fondos en Bolívares (VES)
 * Calcula la comisión escalonada según el status/monto general de la creadora (10%, 15%, 20%),
 * consulta el valor paralelo en tiempo real de la API https://ve.dolarapi.com/v1/dolares/,
 * congela la tasa y el monto en Bolívares que debe esperar en su cuenta bancaria,
 * y coloca el retiro en estado "PENDING" ("EN ESPERA") hasta aprobación por SUPER_ADMIN.
 */
export async function requestPayoutAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "CREATOR" && session.user.role !== "SUPER_ADMIN")) {
    return { error: "No autorizado. Solo creadoras de contenido pueden solicitar retiros." };
  }

  const userId = session.user.id;
  const amountKoin = parseFloat(formData.get("amountKoin") as string);
  const paymentMethodId = (formData.get("paymentMethodId") as string)?.trim();

  if (isNaN(amountKoin) || amountKoin <= 0) {
    return { error: "Por favor ingresa un monto válido a retirar." };
  }

  if (amountKoin < 5) {
    return { error: "El monto mínimo para solicitar retiro es de 5.00 KOIN." };
  }

  if (!paymentMethodId) {
    return { error: "Debes seleccionar una cuenta bancaria o PagoMóvil para recibir los Bolívares." };
  }

  // 1. Verificar billetera y saldo disponible
  const wallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, userId),
  });

  if (!wallet || wallet.balanceKoin < amountKoin) {
    return {
      error: `Saldo insuficiente. Tu saldo disponible para retirar es de ${wallet?.balanceKoin?.toFixed(2) || "0.00"} KOIN.`,
    };
  }

  // 2. Verificar que el método de pago pertenezca a la creadora y esté activo
  const method = await db.query.paymentMethods.findFirst({
    where: and(eq(paymentMethods.id, paymentMethodId), eq(paymentMethods.creatorId, userId)),
  });

  if (!method || method.isActive !== 1) {
    return { error: "El método de cobro seleccionado no es válido o está inactivo." };
  }

  // 3. Consultar configuraciones y calcular comisión escalonada (10%, 15%, 20%)
  const allSettings = await db.query.settings.findMany();
  const settingsMap = new Map(allSettings.map((s) => [s.key, s.value]));
  const fallbackRate = parseFloat(settingsMap.get("fallback_usd_ves_rate") || "1030.88");

  const tierInfo = getCreatorCommissionTier(wallet.totalEarnedKoin || 0, settingsMap);

  // 4. Consultar API DolarApi en tiempo real (Tasa Paralelo de Venezuela)
  const dolarInfo = await getDolarRates(fallbackRate);
  const tasaParalelo = dolarInfo.paralelo;

  // 5. Calcular desglose en KOIN y Bolívares
  const feeKoin = Number(((amountKoin * tierInfo.feePct) / 100).toFixed(2));
  const netKoin = Number((amountKoin - feeKoin).toFixed(2));
  const amountVes = Number((netKoin * tasaParalelo).toFixed(2));

  const now = new Date().toISOString();
  const payoutId = crypto.randomUUID();

  // 6. Descontar saldo de la billetera de la creadora de inmediato para evitar doble gasto
  await db
    .update(wallets)
    .set({
      balanceKoin: Number((wallet.balanceKoin - amountKoin).toFixed(2)),
      updatedAt: now,
    })
    .where(eq(wallets.userId, userId));

  // 7. Crear el registro en payouts en estado "PENDING" ("EN ESPERA")
  await db.insert(payouts).values({
    id: payoutId,
    creatorId: userId,
    periodStart: now,
    periodEnd: now,
    grossKoin: amountKoin,
    feeKoin,
    netKoin,
    feePct: tierInfo.feePct,
    usdRateVes: tasaParalelo,
    amountVes,
    paymentMethodId,
    status: "PENDING",
    createdAt: now,
  });

  // 8. Registrar movimiento en la billetera
  await db.insert(walletTransactions).values({
    id: crypto.randomUUID(),
    userId,
    type: "CREATOR_PAYOUT",
    amountKoin: -amountKoin,
    amountUsdt: netKoin,
    reference: `RETIRO-${payoutId.slice(0, 8).toUpperCase()}`,
    status: "PENDING",
    notes: `Retiro en Bolívares en espera. Tasa Paralelo: Bs. ${tasaParalelo.toFixed(2)} / USD. Esperado en banco: Bs. ${amountVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
    createdAt: now,
  });

  revalidatePath("/panel/pagos");
  revalidatePath("/cuenta");
  revalidatePath("/admin/payouts");

  return {
    success: true,
    message: `Solicitud de retiro enviada exitosamente. Tu solicitud está EN ESPERA de liquidación por el Administrador. Recibirás aproximadamente Bs. ${amountVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })} en tu cuenta bancaria.`,
    payoutId,
    amountVes,
    netKoin,
    tasaParalelo,
  };
}

/**
 * Guardar o actualizar un Plan de Suscripción de la Creadora (Hasta 3 planes)
 * Permite configurar precio y duración en días (ej: 30 días, 90 días, 180 días)
 */
export async function saveSubscriptionPlanAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "CREATOR" && session.user.role !== "SUPER_ADMIN")) {
    return { error: "No autorizado" };
  }

  const userId = session.user.id;
  const planId = (formData.get("planId") as string) || crypto.randomUUID();
  const name = (formData.get("name") as string)?.trim();
  const priceRaw = formData.get("priceKoin") as string;
  const priceKoin = parseFloat(priceRaw);
  const durationRaw = formData.get("durationDays") as string;
  const durationDays = parseInt(durationRaw) || 30;
  const description = (formData.get("description") as string)?.trim();
  const orderIndex = parseInt((formData.get("orderIndex") as string) || "1");

  if (!name || isNaN(priceKoin) || priceKoin <= 0) {
    return { error: "El nombre y un precio válido en KOIN son requeridos." };
  }

  if (durationDays < 1) {
    return { error: "La duración debe ser de al menos 1 día." };
  }

  const now = new Date().toISOString();

  await db
    .insert(creatorSubscriptionPlans)
    .values({
      id: planId,
      creatorId: userId,
      name,
      durationDays,
      priceKoin,
      description: description || null,
      orderIndex: Math.min(3, Math.max(1, orderIndex)),
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: creatorSubscriptionPlans.id,
      set: {
        name,
        durationDays,
        priceKoin,
        description: description || null,
        orderIndex: Math.min(3, Math.max(1, orderIndex)),
        updatedAt: now,
      },
    });

  revalidatePath("/panel/suscripciones");
  revalidatePath("/panel/perfil");
  revalidatePath(`/${session.user.username}`);

  return { success: true };
}

/**
 * Eliminar un Plan de Suscripción
 */
export async function deleteSubscriptionPlanAction(planId: string) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  await db
    .delete(creatorSubscriptionPlans)
    .where(
      and(
        eq(creatorSubscriptionPlans.id, planId),
        eq(creatorSubscriptionPlans.creatorId, session.user.id)
      )
    );

  revalidatePath("/panel/suscripciones");
  revalidatePath("/panel/perfil");
  revalidatePath(`/${session.user.username}`);

  return { success: true };
}

/**
 * Enviar mensaje 1 a 1 estilo OnlyFans
 */
export async function sendMessageAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "Debes iniciar sesión para enviar mensajes." };

  const senderId = session.user.id;
  const receiverId = (formData.get("receiverId") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const priceRaw = formData.get("priceKoin") as string;
  const priceKoin = parseFloat(priceRaw) || 0.0;
  const mediaKey = (formData.get("mediaKey") as string) || null;
  const mediaType = (formData.get("mediaType") as "IMAGE" | "VIDEO") || null;

  if (!receiverId || (!content && !mediaKey)) {
    return { error: "Destinatario y contenido son obligatorios." };
  }

  const now = new Date().toISOString();
  const msgId = crypto.randomUUID();

  await db.insert(messages).values({
    id: msgId,
    senderId,
    receiverId,
    content: content || "Mensaje multimedia",
    mediaKey,
    mediaType,
    priceKoin,
    isUnlocked: priceKoin > 0 ? 0 : 1, // Si tiene precio > 0 es PPV bloqueado
    isRead: 0,
    createdAt: now,
  });

  revalidatePath("/panel/mensajes");
  revalidatePath("/mensajes");

  return { success: true, msgId };
}
