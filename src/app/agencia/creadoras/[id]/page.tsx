import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  users,
  posts,
  creatorSubscriptionPlans,
  messages,
  subscriptions,
} from "@/lib/db/schema";
import { ensureChatSchema } from "@/lib/db/initChat";
import { resolveCreatorTarget } from "@/lib/creatorTarget";
import { eq, and, desc, or } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import AgencyCreatorWorkspace from "@/components/AgencyCreatorWorkspace";
import type { ConversationUser } from "@/components/CreatorChatRoom";
import type { SerializedMessage } from "@/actions/chat";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AgencyCreatorManagePage({ params }: PageProps) {
  await ensureChatSchema();

  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/agencia");
  }

  const { id } = await params;

  const target = await resolveCreatorTarget(session.user, id);
  if (!target.ok) {
    redirect("/agencia");
  }

  const creator = await db.query.users.findFirst({
    where: eq(users.id, target.creatorId),
    with: {
      profile: true,
    },
  });

  if (!creator) {
    notFound();
  }

  const [creatorPosts, plans, allUserMessages, activeSubs] = await Promise.all([
    db.query.posts.findMany({
      where: and(eq(posts.creatorId, creator.id), eq(posts.isDeleted, 0)),
      orderBy: [desc(posts.createdAt)],
      with: {
        media: true,
      },
    }),
    db.query.creatorSubscriptionPlans.findMany({
      where: eq(creatorSubscriptionPlans.creatorId, creator.id),
      orderBy: [creatorSubscriptionPlans.orderIndex],
    }),
    db.query.messages.findMany({
      where: or(
        eq(messages.senderId, creator.id),
        eq(messages.receiverId, creator.id)
      ),
      orderBy: [desc(messages.createdAt)],
      with: {
        media: true,
      },
    }),
    db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.creatorId, creator.id),
        eq(subscriptions.status, "ACTIVE")
      ),
    }),
  ]);

  const partnerIdsSet = new Set<string>();
  for (const msg of allUserMessages) {
    const partnerId =
      msg.senderId === creator.id ? msg.receiverId : msg.senderId;
    partnerIdsSet.add(partnerId);
  }
  for (const sub of activeSubs) {
    if (sub.subscriberId !== creator.id) {
      partnerIdsSet.add(sub.subscriberId);
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
  const initialMessages: Record<string, SerializedMessage[]> = {};
  for (const partnerId of partnerIds) {
    initialMessages[partnerId] = [];
  }

  const reversedMessages = [...allUserMessages].reverse();
  for (const msg of reversedMessages) {
    const partnerId =
      msg.senderId === creator.id ? msg.receiverId : msg.senderId;
    if (!initialMessages[partnerId]) {
      initialMessages[partnerId] = [];
    }
    const isMine = msg.senderId === creator.id;
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
      <AgencyCreatorWorkspace
        creator={{
          id: creator.id,
          username: creator.username,
          kycStatus: creator.kycStatus,
        }}
        profile={creator.profile || null}
        posts={creatorPosts.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          priceKoin: p.priceKoin,
          isPublicTeaser: p.isPublicTeaser,
          createdAt: p.createdAt,
          mediaCount: p.media?.length || 0,
        }))}
        plans={plans}
        conversations={conversations}
        initialMessages={initialMessages}
      />
    </div>
  );
}
