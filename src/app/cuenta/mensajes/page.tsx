import { auth } from "@/auth";
import { db } from "@/lib/db";
import { messages, users, subscriptions, chatPasses } from "@/lib/db/schema";
import { ensureChatSchema } from "@/lib/db/initChat";
import { eq, or, desc, and, gt } from "drizzle-orm";
import CreatorChatRoom, { type ConversationUser } from "@/components/CreatorChatRoom";
import type { SerializedMessage } from "@/actions/chat";
import { MessageCircle } from "lucide-react";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Mensajes Privados | KONTENIDO",
  description: "Comunícate en privado con tus creadoras favoritas y desbloquea contenido exclusivo.",
};

interface PageProps {
  searchParams: Promise<{ creator?: string }>;
}

export default async function ConsumerMessagesPage({ searchParams }: PageProps) {
  await ensureChatSchema();

  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/cuenta/mensajes");
  }

  const userId = session.user.id;
  const resolvedParams = await searchParams;
  const requestedCreatorId = resolvedParams?.creator?.trim() || null;

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  const nowIso = new Date().toISOString();

  const [allUserMessages, activeSubs, activePasses] = await Promise.all([
    db.query.messages.findMany({
      where: or(eq(messages.senderId, userId), eq(messages.receiverId, userId)),
      orderBy: [desc(messages.createdAt)],
      with: {
        media: true,
      },
    }),
    db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.subscriberId, userId),
        eq(subscriptions.status, "ACTIVE")
      ),
    }),
    db.query.chatPasses.findMany({
      where: and(
        eq(chatPasses.buyerId, userId),
        eq(chatPasses.status, "ACTIVE"),
        gt(chatPasses.endsAt, nowIso)
      ),
      orderBy: [desc(chatPasses.endsAt)],
    }),
  ]);

  const partnerIdsSet = new Set<string>();

  if (requestedCreatorId && requestedCreatorId !== userId) {
    partnerIdsSet.add(requestedCreatorId);
  }

  for (const msg of allUserMessages) {
    const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
    partnerIdsSet.add(partnerId);
  }

  for (const sub of activeSubs) {
    if (sub.creatorId !== userId) {
      partnerIdsSet.add(sub.creatorId);
    }
  }

  for (const pass of activePasses) {
    if (pass.creatorId !== userId) {
      partnerIdsSet.add(pass.creatorId);
    }
  }

  const partnerIds = Array.from(partnerIdsSet);

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

  // Mapear pase activo más reciente por creadora
  const passByCreator = new Map<string, string>();
  for (const pass of activePasses) {
    if (!passByCreator.has(pass.creatorId)) {
      passByCreator.set(pass.creatorId, pass.endsAt);
    }
  }

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

  const conversations: ConversationUser[] = partnerIds
    .filter((id) => partnerMap.has(id))
    .map((partnerId) => {
      const partner = partnerMap.get(partnerId)!;
      const msgs = initialMessages[partnerId] || [];
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

      return {
        id: partnerId,
        username: partner.username,
        displayName: partner.profile?.displayName || partner.username,
        level: partner.level || 0,
        role: partner.role || "CREATOR",
        chatPriceKoin: partner.profile?.chatPriceKoin ?? 5.0,
        chatDurationHours: partner.profile?.chatDurationHours ?? 168,
        chatPassEndsAt: passByCreator.get(partnerId) || null,
        lastMessage: lastMsg
          ? lastMsg.priceKoin > 0 && lastMsg.isUnlocked === 0
            ? "🔒 Contenido exclusivo (PPV)"
            : lastMsg.content
          : "Sin mensajes aún",
        lastMessageTime: lastMsg ? lastMsg.createdAt : undefined,
      };
    });

  conversations.sort((a, b) => {
    if (requestedCreatorId && a.id === requestedCreatorId) return -1;
    if (requestedCreatorId && b.id === requestedCreatorId) return 1;
    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    return timeB - timeA;
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-rose-500" />
            Mensajes Privados
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Adquiere el pase de chat de cada creadora para conversar en privado y desbloquear fotos o videos exclusivos.
          </p>
        </div>
      </div>

      <CreatorChatRoom
        currentUserId={userId}
        currentUserRole={currentUser?.role || "CONSUMER"}
        currentUsername={currentUser?.username || session.user.username}
        conversations={conversations}
        initialMessages={initialMessages}
        initialPartnerId={requestedCreatorId}
      />
    </div>
  );
}
