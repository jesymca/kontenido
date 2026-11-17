import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  users,
  komestibleMatches,
  komestiblePhotos,
  koincidenMessages,
  komestibleSwipes,
} from "@/lib/db/schema";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { eq, and, or, desc, asc, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import KoincidenSpace, {
  type KoincidenMatchItem,
  type KoincidenMsgItem,
} from "@/components/KoincidenSpace";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "KOINCIDEN — Matches Mutuos | KONTENIDO",
  description: "Espacio exclusivo para conversar gratis con tus coincidencias mutuas de KOMESTIBLE.",
};

interface PageProps {
  searchParams: Promise<{ match?: string }>;
}

export default async function KoincidenPage({ searchParams }: PageProps) {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/koinciden");
  }

  const userId = session.user.id;
  const resolvedParams = await searchParams;
  const requestedMatchId = resolvedParams?.match?.trim() || null;

  const activeMatches = await db.query.komestibleMatches.findMany({
    where: and(
      eq(komestibleMatches.status, "ACTIVE"),
      or(
        eq(komestibleMatches.userAId, userId),
        eq(komestibleMatches.userBId, userId)
      )
    ),
    orderBy: [desc(komestibleMatches.createdAt)],
  });

  const partnerIds = activeMatches.map((m) =>
    m.userAId === userId ? m.userBId : m.userAId
  );

  const matchIds = activeMatches.map((m) => m.id);

  const [partnerUsers, partnerPhotos, allMatchMessages, likesReceivedRes] =
    await Promise.all([
      partnerIds.length > 0
        ? db.query.users.findMany({
            where: inArray(users.id, partnerIds),
            with: { profile: true },
          })
        : Promise.resolve([]),
      partnerIds.length > 0
        ? db.query.komestiblePhotos.findMany({
            where: and(
              inArray(komestiblePhotos.userId, partnerIds),
              eq(komestiblePhotos.isActive, 1)
            ),
            orderBy: [asc(komestiblePhotos.sortOrder), desc(komestiblePhotos.createdAt)],
          })
        : Promise.resolve([]),
      matchIds.length > 0
        ? db.query.koincidenMessages.findMany({
            where: inArray(koincidenMessages.matchId, matchIds),
            orderBy: [asc(koincidenMessages.createdAt)],
          })
        : Promise.resolve([]),
      db
        .select({ count: sql<number>`count(*)` })
        .from(komestibleSwipes)
        .where(
          and(
            eq(komestibleSwipes.targetUserId, userId),
            eq(komestibleSwipes.action, "LIKE")
          )
        ),
    ]);

  const partnerMap = new Map(partnerUsers.map((u) => [u.id, u]));
  const photoByPartner = new Map<string, string>();
  for (const ph of partnerPhotos) {
    if (!photoByPartner.has(ph.userId)) {
      photoByPartner.set(ph.userId, ph.mediaKey);
    }
  }

  const messagesByMatch: Record<string, KoincidenMsgItem[]> = {};
  for (const mId of matchIds) {
    messagesByMatch[mId] = [];
  }
  for (const msg of allMatchMessages) {
    if (!messagesByMatch[msg.matchId]) messagesByMatch[msg.matchId] = [];
    messagesByMatch[msg.matchId].push(msg);
  }

  const enrichedMatches: KoincidenMatchItem[] = activeMatches
    .flatMap((m): KoincidenMatchItem[] => {
      const partnerId = m.userAId === userId ? m.userBId : m.userAId;
      const partner = partnerMap.get(partnerId);
      if (!partner) return [];

      const msgs = messagesByMatch[m.id] || [];
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      const unreadCount = msgs.filter(
        (x) => x.receiverId === userId && x.isRead === 0
      ).length;

      return [
        {
          matchId: m.id,
          matchedAt: m.createdAt,
          partner: {
            id: partner.id,
            username: partner.username,
            displayName: partner.profile?.displayName || partner.username,
            role: partner.role,
            level: partner.level || 0,
            country: partner.country || "VE",
            gender: partner.gender || null,
            photoKey:
              photoByPartner.get(partner.id) || partner.profile?.avatarKey || null,
          },
          lastMessage: lastMsg?.content || null,
          lastMessageAt: lastMsg?.createdAt || null,
          unreadCount,
        },
      ];
    });

  enrichedMatches.sort((a, b) => {
    const tA = new Date(a.lastMessageAt || a.matchedAt).getTime();
    const tB = new Date(b.lastMessageAt || b.matchedAt).getTime();
    return tB - tA;
  });

  const pendingAdmirersCount = Math.max(
    0,
    Number(likesReceivedRes[0]?.count || 0) - enrichedMatches.length
  );

  return (
    <KoincidenSpace
      currentUserId={userId}
      initialMatches={enrichedMatches}
      initialMessagesByMatch={messagesByMatch}
      initialMatchId={requestedMatchId}
      pendingAdmirersCount={pendingAdmirersCount}
    />
  );
}
