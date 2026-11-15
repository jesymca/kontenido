"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  users,
  profiles,
  wallets,
  walletTransactions,
  purchases,
  messages,
  messageMedia,
  chatPasses,
} from "@/lib/db/schema";
import { ensureChatSchema } from "@/lib/db/initChat";
import { resolveCreatorTarget } from "@/lib/creatorTarget";
import { validateNoExternalContact } from "@/lib/contentFilter";
import { eq, and, or, gt, asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface ChatMediaInput {
  mediaKey: string;
  mediaType: "IMAGE" | "VIDEO";
  mimeType?: string;
  sizeBytes?: number;
}

export interface SerializedMessageMedia {
  id: string;
  mediaKey: string | null;
  mediaType: "IMAGE" | "VIDEO";
  sortOrder: number;
}

export interface SerializedMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  mediaKey?: string | null;
  mediaType?: "IMAGE" | "VIDEO" | null;
  mediaItems: SerializedMessageMedia[];
  priceKoin: number;
  isUnlocked: number;
  isRead: number;
  createdAt: string;
}

/**
 * Redacta las claves R2 de mensajes PPV bloqueados cuando el espectador es el receptor.
 * Mantiene el conteo/tipo de archivos para mostrar "Pack de X fotos / Y videos" sin exponer el archivo.
 */
function serializeMessageForViewer(
  msg: typeof messages.$inferSelect & { media?: (typeof messageMedia.$inferSelect)[] },
  viewerId: string
): SerializedMessage {
  const isMine = msg.senderId === viewerId;
  const isLocked = msg.priceKoin > 0 && msg.isUnlocked === 0 && !isMine;

  const rawItems =
    msg.media && msg.media.length > 0
      ? [...msg.media].sort((a, b) => a.sortOrder - b.sortOrder)
      : msg.mediaKey && msg.mediaType
      ? [
          {
            id: `${msg.id}-legacy`,
            mediaKey: msg.mediaKey,
            mediaType: msg.mediaType,
            sortOrder: 0,
          },
        ]
      : [];

  return {
    id: msg.id,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    content: isLocked ? "Contenido exclusivo bloqueado" : msg.content,
    mediaKey: isLocked ? null : msg.mediaKey,
    mediaType: msg.mediaType,
    mediaItems: rawItems.map((item) => ({
      id: item.id,
      mediaKey: isLocked ? null : item.mediaKey,
      mediaType: item.mediaType,
      sortOrder: item.sortOrder,
    })),
    priceKoin: msg.priceKoin,
    isUnlocked: msg.isUnlocked,
    isRead: msg.isRead,
    createdAt: msg.createdAt,
  };
}

/**
 * La creadora configura la tarifa (KOIN) y el tiempo (horas/días) para que los compradores usen su chat.
 */
export async function updateCreatorChatSettingsAction(input: {
  priceKoin: number;
  durationValue: number;
  durationUnit: "HOURS" | "DAYS";
  managedCreatorId?: string;
}) {
  await ensureChatSchema();

  const session = await auth();
  if (!session?.user) {
    return { error: "Debes iniciar sesión." };
  }

  const target = await resolveCreatorTarget(session.user, input.managedCreatorId);
  if (!target.ok) {
    return { error: "Solo las creadoras o su agencia pueden configurar la tarifa del chat." };
  }

  const priceKoin = Number(input.priceKoin);
  const durationValue = Math.floor(Number(input.durationValue));

  if (!Number.isFinite(priceKoin) || priceKoin <= 0) {
    return { error: "La tarifa del chat debe ser mayor a 0 KOIN." };
  }

  if (!Number.isFinite(durationValue) || durationValue < 1) {
    return { error: "El tiempo de acceso al chat debe ser al menos 1 hora o 1 día." };
  }

  const durationHours =
    input.durationUnit === "DAYS" ? durationValue * 24 : durationValue;

  if (durationHours > 24 * 365) {
    return { error: "El tiempo máximo permitido es de 365 días." };
  }

  const now = new Date().toISOString();

  await db
    .update(profiles)
    .set({
      chatPriceKoin: Math.round(priceKoin * 100) / 100,
      chatDurationHours: durationHours,
      updatedAt: now,
    })
    .where(eq(profiles.userId, target.creatorId));

  revalidatePath("/panel/mensajes");
  revalidatePath("/cuenta/mensajes");
  revalidatePath(`/${target.username}`);
  revalidatePath(`/agencia/creadoras/${target.creatorId}`);

  return {
    success: true,
    chatPriceKoin: Math.round(priceKoin * 100) / 100,
    chatDurationHours: durationHours,
  };
}

/**
 * El comprador paga en KOIN para habilitar el chat con una creadora por el tiempo configurado.
 */
export async function purchaseChatAccessAction(creatorId: string) {
  await ensureChatSchema();

  const session = await auth();
  if (!session?.user) {
    return { error: "Debes iniciar sesión para desbloquear el chat." };
  }

  const buyerId = session.user.id;
  if (buyerId === creatorId) {
    return { error: "No puedes comprar acceso al chat contigo mismo." };
  }

  const creator = await db.query.users.findFirst({
    where: eq(users.id, creatorId),
    with: { profile: true },
  });

  if (!creator) {
    return { error: "Creadora no encontrada." };
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // Verificar si ya tiene un pase activo
  const activePass = await db.query.chatPasses.findFirst({
    where: and(
      eq(chatPasses.buyerId, buyerId),
      eq(chatPasses.creatorId, creatorId),
      eq(chatPasses.status, "ACTIVE"),
      gt(chatPasses.endsAt, nowIso)
    ),
  });

  if (activePass) {
    return {
      success: true,
      alreadyActive: true,
      endsAt: activePass.endsAt,
    };
  }

  const priceKoin = creator.profile?.chatPriceKoin ?? 5.0;
  const durationHours = creator.profile?.chatDurationHours ?? 168;

  const buyerWallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, buyerId),
  });

  if (!buyerWallet || buyerWallet.balanceKoin < priceKoin) {
    return {
      error: `Saldo insuficiente. Necesitas ${priceKoin.toFixed(2)} KOIN para habilitar el chat. Tu saldo actual es ${(buyerWallet?.balanceKoin ?? 0).toFixed(2)} KOIN.`,
      needsRecharge: true,
    };
  }

  const endsAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString();
  const passId = crypto.randomUUID();

  // 1. Debitar de la billetera del comprador
  await db
    .update(wallets)
    .set({
      balanceKoin: sql`${wallets.balanceKoin} - ${priceKoin}`,
      updatedAt: nowIso,
    })
    .where(eq(wallets.userId, buyerId));

  // 2. Acreditar ganancias a la creadora
  const creatorWallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, creatorId),
  });
  if (creatorWallet) {
    await db
      .update(wallets)
      .set({
        totalEarnedKoin: sql`${wallets.totalEarnedKoin} + ${priceKoin}`,
        updatedAt: nowIso,
      })
      .where(eq(wallets.userId, creatorId));
  } else {
    await db.insert(wallets).values({
      userId: creatorId,
      balanceKoin: 0,
      totalSpentUsd: 0,
      totalEarnedKoin: priceKoin,
      updatedAt: nowIso,
    });
  }

  // 3. Crear pase de chat
  await db.insert(chatPasses).values({
    id: passId,
    buyerId,
    creatorId,
    priceKoinSnapshot: priceKoin,
    durationHours,
    startsAt: nowIso,
    endsAt,
    status: "ACTIVE",
    createdAt: nowIso,
  });

  // 4. Registrar compra y transacción
  await db.insert(purchases).values({
    id: crypto.randomUUID(),
    buyerId,
    creatorId,
    itemType: "CHAT_ACCESS",
    itemId: passId,
    priceKoin,
    status: "COMPLETED",
    createdAt: nowIso,
  });

  await db.insert(walletTransactions).values({
    id: crypto.randomUUID(),
    userId: buyerId,
    type: "PURCHASE",
    amountKoin: priceKoin,
    reference: `CHAT_${creatorId.slice(0, 8)}`,
    status: "CONFIRMED",
    notes: `Pase de chat con @${creator.username} (${durationHours}h)`,
    createdAt: nowIso,
    confirmedAt: nowIso,
  });

  revalidatePath("/cuenta/mensajes");
  revalidatePath("/panel/mensajes");
  revalidatePath(`/${creator.username}`);

  return {
    success: true,
    passId,
    endsAt,
    durationHours,
  };
}

/**
 * Enviar mensaje 1 a 1 con soporte para:
 * - Verificación de pase de chat pagado cuando un comprador escribe a una creadora
 * - Adjuntar 1 o más fotos o 1 o más videos
 * - Configurar precio PPV en KOIN (ej: 1, 1.5, 3...) o gratuito (0)
 */
export async function sendChatMessageAction(input: {
  receiverId: string;
  content?: string;
  priceKoin?: number;
  mediaItems?: ChatMediaInput[];
  managedCreatorId?: string;
}) {
  await ensureChatSchema();

  const session = await auth();
  if (!session?.user) {
    return { error: "Debes iniciar sesión para enviar mensajes." };
  }

  let senderId = session.user.id;
  if (input.managedCreatorId && input.managedCreatorId !== session.user.id) {
    const target = await resolveCreatorTarget(session.user, input.managedCreatorId);
    if (!target.ok) return { error: target.error };
    senderId = target.creatorId;
  }
  const receiverId = input.receiverId?.trim();
  const content = (input.content || "").trim();
  const mediaItems = input.mediaItems || [];

  if (!receiverId || (!content && mediaItems.length === 0)) {
    return { error: "Destinatario y contenido o archivos son obligatorios." };
  }

  if (senderId === receiverId) {
    return { error: "No puedes enviarte mensajes a ti mismo." };
  }

  const [senderUser, receiverUser] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, senderId) }),
    db.query.users.findFirst({ where: eq(users.id, receiverId) }),
  ]);

  if (!senderUser || !receiverUser) {
    return { error: "Usuario no encontrado." };
  }

  // Verificar si el remitente es comprador escribiendo a una creadora
  const isSenderCreatorOrAdmin =
    senderUser.role === "CREATOR" || senderUser.role === "SUPER_ADMIN";

  if (!isSenderCreatorOrAdmin && receiverUser.role === "CREATOR") {
    const nowIso = new Date().toISOString();
    const activePass = await db.query.chatPasses.findFirst({
      where: and(
        eq(chatPasses.buyerId, senderId),
        eq(chatPasses.creatorId, receiverId),
        eq(chatPasses.status, "ACTIVE"),
        gt(chatPasses.endsAt, nowIso)
      ),
    });

    if (!activePass) {
      return {
        error:
          "Debes pagar la tarifa de chat de esta creadora para poder comunicarte con ella.",
        requiresChatPass: true,
      };
    }
  }

  // Solo las creadoras (o admin) pueden enviar packs multimedia de pago (PPV)
  let priceKoin = 0;
  if (isSenderCreatorOrAdmin && input.priceKoin && Number(input.priceKoin) > 0) {
    const parsedPrice = Number(input.priceKoin);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0.1) {
      return { error: "El precio PPV debe ser de al menos 0.1 KOIN." };
    }
    priceKoin = Math.round(parsedPrice * 100) / 100;
  }

  if (content) {
    const msgFilter = validateNoExternalContact(content, "El mensaje");
    if (!msgFilter.valid) {
      return { error: msgFilter.error };
    }
  }

  const now = new Date().toISOString();
  const msgId = crypto.randomUUID();
  const firstMedia = mediaItems[0];

  const fallbackContent =
    mediaItems.length > 0
      ? mediaItems.length === 1
        ? firstMedia.mediaType === "VIDEO"
          ? "Video exclusivo"
          : "Foto exclusiva"
        : `Pack multimedia (${mediaItems.length} archivos)`
      : "Mensaje";

  await db.insert(messages).values({
    id: msgId,
    senderId,
    receiverId,
    content: content || fallbackContent,
    mediaKey: firstMedia?.mediaKey || null,
    mediaType: firstMedia?.mediaType || null,
    priceKoin,
    isUnlocked: priceKoin > 0 ? 0 : 1,
    isRead: 0,
    createdAt: now,
  });

  const insertedMedia: SerializedMessageMedia[] = [];
  if (mediaItems.length > 0) {
    for (let i = 0; i < mediaItems.length; i++) {
      const item = mediaItems[i];
      const itemId = crypto.randomUUID();
      await db.insert(messageMedia).values({
        id: itemId,
        messageId: msgId,
        mediaKey: item.mediaKey,
        mediaType: item.mediaType,
        mimeType: item.mimeType || null,
        sizeBytes: item.sizeBytes || null,
        sortOrder: i,
        createdAt: now,
      });
      insertedMedia.push({
        id: itemId,
        mediaKey: item.mediaKey,
        mediaType: item.mediaType,
        sortOrder: i,
      });
    }
  }

  revalidatePath("/panel/mensajes");
  revalidatePath("/cuenta/mensajes");

  return {
    success: true,
    message: {
      id: msgId,
      senderId,
      receiverId,
      content: content || fallbackContent,
      mediaKey: firstMedia?.mediaKey || null,
      mediaType: firstMedia?.mediaType || null,
      mediaItems: insertedMedia,
      priceKoin,
      isUnlocked: priceKoin > 0 ? 0 : 1,
      isRead: 0,
      createdAt: now,
    } satisfies SerializedMessage,
  };
}

/**
 * Desbloquear un mensaje PPV (foto, pack de fotos, video o pack de videos) usando KOIN de la billetera.
 */
export async function unlockMessageAction(messageId: string) {
  await ensureChatSchema();

  const session = await auth();
  if (!session?.user) {
    return { error: "Debes iniciar sesión para desbloquear contenido." };
  }

  const buyerId = session.user.id;

  const msg = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
    with: {
      media: true,
    },
  });

  if (!msg) {
    return { error: "Mensaje no encontrado." };
  }

  if (msg.receiverId !== buyerId) {
    return { error: "No tienes permiso para desbloquear este mensaje." };
  }

  if (msg.priceKoin <= 0 || msg.isUnlocked === 1) {
    return {
      success: true,
      message: serializeMessageForViewer(msg, buyerId),
    };
  }

  const buyerWallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, buyerId),
  });

  if (!buyerWallet || buyerWallet.balanceKoin < msg.priceKoin) {
    return {
      error: `Saldo insuficiente. Necesitas ${msg.priceKoin.toFixed(2)} KOIN. Tu saldo es ${(buyerWallet?.balanceKoin ?? 0).toFixed(2)} KOIN.`,
      needsRecharge: true,
    };
  }

  const nowIso = new Date().toISOString();

  // 1. Debitar del comprador
  await db
    .update(wallets)
    .set({
      balanceKoin: sql`${wallets.balanceKoin} - ${msg.priceKoin}`,
      updatedAt: nowIso,
    })
    .where(eq(wallets.userId, buyerId));

  // 2. Acreditar a la creadora
  const creatorWallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, msg.senderId),
  });
  if (creatorWallet) {
    await db
      .update(wallets)
      .set({
        totalEarnedKoin: sql`${wallets.totalEarnedKoin} + ${msg.priceKoin}`,
        updatedAt: nowIso,
      })
      .where(eq(wallets.userId, msg.senderId));
  } else {
    await db.insert(wallets).values({
      userId: msg.senderId,
      balanceKoin: 0,
      totalSpentUsd: 0,
      totalEarnedKoin: msg.priceKoin,
      updatedAt: nowIso,
    });
  }

  // 3. Marcar mensaje como desbloqueado
  await db
    .update(messages)
    .set({ isUnlocked: 1 })
    .where(eq(messages.id, messageId));

  // 4. Registrar compra y transacción
  await db.insert(purchases).values({
    id: crypto.randomUUID(),
    buyerId,
    creatorId: msg.senderId,
    itemType: "MESSAGE_PPV",
    itemId: messageId,
    priceKoin: msg.priceKoin,
    status: "COMPLETED",
    createdAt: nowIso,
  });

  await db.insert(walletTransactions).values({
    id: crypto.randomUUID(),
    userId: buyerId,
    type: "PURCHASE",
    amountKoin: msg.priceKoin,
    reference: `MSG_${messageId.slice(0, 8)}`,
    status: "CONFIRMED",
    notes: `Desbloqueo de contenido en chat (${msg.priceKoin} KOIN)`,
    createdAt: nowIso,
    confirmedAt: nowIso,
  });

  const updatedMsg = { ...msg, isUnlocked: 1 };

  revalidatePath("/cuenta/mensajes");
  revalidatePath("/panel/mensajes");

  return {
    success: true,
    message: serializeMessageForViewer(updatedMsg, buyerId),
  };
}

/**
 * Recargar mensajes de una conversación activa (para sincronización manual o al cambiar de chat).
 */
export async function getConversationMessagesAction(
  partnerId: string,
  managedCreatorId?: string
) {
  await ensureChatSchema();

  const session = await auth();
  if (!session?.user) {
    return { error: "No autorizado" };
  }

  let userId = session.user.id;
  if (managedCreatorId && managedCreatorId !== session.user.id) {
    const target = await resolveCreatorTarget(session.user, managedCreatorId);
    if (!target.ok) return { error: target.error };
    userId = target.creatorId;
  }

  const rows = await db.query.messages.findMany({
    where: or(
      and(eq(messages.senderId, userId), eq(messages.receiverId, partnerId)),
      and(eq(messages.senderId, partnerId), eq(messages.receiverId, userId))
    ),
    orderBy: [asc(messages.createdAt)],
    with: {
      media: true,
    },
  });

  return {
    success: true,
    messages: rows.map((m) => serializeMessageForViewer(m, userId)),
  };
}
