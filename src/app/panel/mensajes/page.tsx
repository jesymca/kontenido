import { auth } from "@/auth";
import { db } from "@/lib/db";
import { messages, users, subscriptions } from "@/lib/db/schema";
import { ensureChatSchema } from "@/lib/db/initChat";
import { eq, or, desc, and } from "drizzle-orm";
import CreatorPanelNav from "@/components/CreatorPanelNav";
import CreatorChatRoom, { type ConversationUser } from "@/components/CreatorChatRoom";
import type { SerializedMessage } from "@/actions/chat";
import { MessageCircle } from "lucide-react";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Mensajería Privada | KONTENIDO Studio",
  description: "Chat 1 a 1 con tus suscriptores y clientes con soporte PPV y multimedia.",
};

export default async function CreatorMessagesPage() {
  await ensureChatSchema();

  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/panel/mensajes");
  }

  const userId = session.user.id;

  // 0. Obtener usuario actual con su perfil para tarifa y tiempo de chat
  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      profile: true,
    },
  });

  // 1. Obtener todos los mensajes donde participe el usuario (incluyendo multimedia)
  const allUserMessages = await db.query.messages.findMany({
    where: or(eq(messages.senderId, userId), eq(messages.receiverId, userId)),
    orderBy: [desc(messages.createdAt)],
    with: {
      media: true,
    },
  });

  // 2. Obtener suscriptores activos para que el creador pueda iniciarles conversación
  const activeSubs = await db.query.subscriptions.findMany({
    where: and(eq(subscriptions.creatorId, userId), eq(subscriptions.status, "ACTIVE")),
    with: {
      subscriber: {
        with: {
          profile: true,
        },
      },
    },
  });

  // 3. Mapear IDs de los interlocutores únicos
  const partnerIdsSet = new Set<string>();

  for (const msg of allUserMessages) {
    const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
    partnerIdsSet.add(partnerId);
  }

  for (const sub of activeSubs) {
    if (sub.subscriberId !== userId) {
      partnerIdsSet.add(sub.subscriberId);
    }
  }

  const partnerIds = Array.from(partnerIdsSet);

  // 4. Cargar datos de los usuarios interlocutores
  const partnerUsers =
    partnerIds.length > 0
      ? await db.query.users.findMany({
          where: (u, { inArray }) => inArray(u.id, partnerIds),
          with: {
            profile: true,
          },
        })
      : [];

  const partnerMap = new Map(partnerUsers.map((u) => [u.id, u]));

  // 5. Organizar mensajes por interlocutor (cronológico ascendente)
  const initialMessages: Record<string, SerializedMessage[]> = {};
  for (const partnerId of partnerIds) {
    initialMessages[partnerId] = [];
  }

  const reversedMessages = [...allUserMessages].reverse();
  for (const msg of reversedMessages) {
    const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
    if (!initialMessages[partnerId]) {
      initialMessages[partnerId] = [];
    }
    const isMine = msg.senderId === userId;
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

    initialMessages[partnerId].push({
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
    });
  }

  // 6. Construir lista de conversaciones
  const conversations: ConversationUser[] = partnerIds.map((partnerId) => {
    const partner = partnerMap.get(partnerId);
    const msgs = initialMessages[partnerId] || [];
    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

    return {
      id: partnerId,
      username: partner?.username || "Usuario",
      displayName: partner?.profile?.displayName || partner?.username || "Usuario",
      level: partner?.level || 0,
      role: partner?.role || "CONSUMER",
      lastMessage: lastMsg
        ? lastMsg.priceKoin > 0 && lastMsg.isUnlocked === 0
          ? "🔒 Mensaje de pago (PPV)"
          : lastMsg.content
        : "Sin mensajes aún",
      lastMessageTime: lastMsg ? lastMsg.createdAt : undefined,
    };
  });

  conversations.sort((a, b) => {
    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    return timeB - timeA;
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <CreatorPanelNav
        username={session.user.username}
        kycStatus={currentUser?.kycStatus || "NONE"}
      />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-rose-500" />
            Mensajería Privada
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Configura tu tarifa de chat para compradores y envía fotos o videos gratuitos o exclusivos (PPV).
          </p>
        </div>
      </div>

      <CreatorChatRoom
        currentUserId={userId}
        currentUserRole={currentUser?.role || "CREATOR"}
        currentUsername={currentUser?.username || session.user.username}
        conversations={conversations}
        initialMessages={initialMessages}
        creatorChatSettings={{
          priceKoin: currentUser?.profile?.chatPriceKoin ?? 5.0,
          durationHours: currentUser?.profile?.chatDurationHours ?? 168,
        }}
      />
    </div>
  );
}
