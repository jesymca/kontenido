import { db } from "@/lib/db";
import {
  users,
  komestiblePhotos,
  komestibleSwipes,
  komestibleMatches,
  koincidenMessages,
} from "@/lib/db/schema";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { getKomestibleConfig, computeUserLikeQuota } from "@/actions/komestible";
import { desc, eq } from "drizzle-orm";
import AdminKomestibleManager, {
  type AdminKomestiblePhotoItem,
  type AdminMaleQuotaItem,
  type AdminMatchItem,
} from "@/components/AdminKomestibleManager";
import { Flame } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminKomestiblePage() {
  await ensureKomestibleSchema();
  const config = await getKomestibleConfig();

  const [allUsers, allPhotos, allSwipes, allMatches, allMatchMsgs] = await Promise.all([
    db.query.users.findMany({ orderBy: [desc(users.createdAt)] }),
    db.query.komestiblePhotos.findMany({ orderBy: [desc(komestiblePhotos.createdAt)] }),
    db.query.komestibleSwipes.findMany(),
    db.query.komestibleMatches.findMany({ orderBy: [desc(komestibleMatches.createdAt)] }),
    db.query.koincidenMessages.findMany(),
  ]);

  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  const photos: AdminKomestiblePhotoItem[] = allPhotos.map((p) => {
    const owner = userMap.get(p.userId);
    return {
      id: p.id,
      userId: p.userId,
      username: owner?.username || "usuario",
      gender: owner?.gender || null,
      country: owner?.country || "VE",
      mediaKey: p.mediaKey,
      caption: p.caption,
      likesReceived: p.likesReceived,
      avgRating: p.avgRating,
      ratingCount: p.ratingCount,
      status: p.status,
      createdAt: p.createdAt,
    };
  });

  const maleUsersRaw = allUsers.filter((u) => u.gender === "HOMBRE");
  const totalLikesByUser = new Map<string, number>();
  const periodLikesByUser = new Map<string, number>();

  const now = new Date();
  const periodStartIso =
    config.maleLimitPeriod === "DAILY"
      ? `${now.toISOString().slice(0, 10)}T00:00:00.000Z`
      : config.maleLimitPeriod === "WEEKLY"
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;

  let totalLikes = 0;
  let totalPasses = 0;
  for (const s of allSwipes) {
    if (s.action === "LIKE") {
      totalLikes++;
      totalLikesByUser.set(s.swiperId, (totalLikesByUser.get(s.swiperId) || 0) + 1);
      if (!periodStartIso || s.createdAt >= periodStartIso) {
        periodLikesByUser.set(s.swiperId, (periodLikesByUser.get(s.swiperId) || 0) + 1);
      }
    } else {
      totalPasses++;
    }
  }

  // Cálculo 100% en memoria a partir de allSwipes (0 consultas N+1 adicionales a Turso)
  const maleUsers: AdminMaleQuotaItem[] = maleUsersRaw.map((u) => {
    const used = periodLikesByUser.get(u.id) || 0;
    const isUnlimited = config.vipUnlimited && Boolean(u.vipMembershipId);
    const effectiveLimit = Math.max(0, config.maleLikesLimit + (u.komestibleBonusLikes || 0));
    return {
      id: u.id,
      username: u.username,
      country: u.country || "VE",
      role: u.role,
      likesUsedInPeriod: used,
      totalLikesGiven: totalLikesByUser.get(u.id) || 0,
      bonusLikes: u.komestibleBonusLikes || 0,
      effectiveLimit,
      remaining: isUnlimited ? 9999 : Math.max(0, effectiveLimit - used),
    };
  });

  const msgCountByMatch = new Map<string, number>();
  for (const m of allMatchMsgs) {
    msgCountByMatch.set(m.matchId, (msgCountByMatch.get(m.matchId) || 0) + 1);
  }

  const matches: AdminMatchItem[] = allMatches.map((m) => ({
    id: m.id,
    userAUsername: userMap.get(m.userAId)?.username || "usuario",
    userBUsername: userMap.get(m.userBId)?.username || "usuario",
    status: m.status,
    messagesCount: msgCountByMatch.get(m.id) || 0,
    createdAt: m.createdAt,
  }));

  const activeMatches = matches.filter((m) => m.status === "ACTIVE").length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Flame className="w-6 h-6 text-rose-500 fill-rose-500" />
          Control KOMESTIBLE & KOINCIDEN
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Administra el límite de Likes para HOMBRES, modera fotos gratuitas y supervisa los matches de KOINCIDEN.
        </p>
      </div>

      <AdminKomestibleManager
        config={config}
        photos={photos}
        maleUsers={maleUsers}
        matches={matches}
        stats={{
          totalPhotos: photos.length,
          totalLikes,
          totalPasses,
          activeMatches,
        }}
      />
    </div>
  );
}
