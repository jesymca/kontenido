import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  users,
  profiles,
  mediaAssets,
  agencyCreators,
  profileFavorites,
} from "@/lib/db/schema";
import { ensureChatSchema } from "@/lib/db/initChat";
import { ensureInteractionsSchema } from "@/lib/db/initInteractions";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { CREATOR_CATEGORIES, getCreatorCategoryMeta } from "@/lib/creatorCategories";
import { getCountryMeta } from "@/lib/countries";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import UserLevelBadge from "@/components/UserLevelBadge";
import {
  Sparkles,
  Coins,
  ShieldCheck,
  Flame,
  ArrowRight,
  Heart,
  Star,
  Bookmark,
  Building2,
  MessageCircleHeart,
  Globe,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams?: Promise<{ categoria?: string; pagina?: string }>;
}

interface RawCreatorRow {
  id: string;
  username: string;
  level: number;
  country: string | null;
  displayName: string | null;
  bio: string | null;
  avatarKey: string | null;
  bannerKey: string | null;
  priceKoin: number;
  creatorCategory: string;
  likesCount: number;
  isAiGenerated: number;
}

interface EnrichedCreatorCard {
  id: string;
  username: string;
  level: number;
  country: string;
  displayName: string | null;
  bio: string | null;
  avatarKey: string | null;
  bannerKey: string | null;
  priceKoin: number;
  creatorCategory: string;
  likesCount: number;
  favoritesCount: number;
  isAiGenerated: number;
  photosCount: number;
  videosCount: number;
  agencyBadgeText: string | null;
  agencyBadgeColor: string | null;
}

async function enrichCreatorCards(
  rawRows: RawCreatorRow[],
  favoritesCountMap: Map<string, number>
): Promise<EnrichedCreatorCard[]> {
  return Promise.all(
    rawRows.map(async (c) => {
      let photos = 0;
      let videos = 0;
      let agencyBadgeText: string | null = null;
      let agencyBadgeColor: string | null = null;
      try {
        const [mediaCounts, agencyLink] = await Promise.all([
          db
            .select({
              type: mediaAssets.type,
              count: sql<number>`count(*)`,
            })
            .from(mediaAssets)
            .where(
              and(eq(mediaAssets.creatorId, c.id), eq(mediaAssets.isDeleted, 0))
            )
            .groupBy(mediaAssets.type),
          db.query.agencyCreators.findFirst({
            where: and(
              eq(agencyCreators.creatorId, c.id),
              eq(agencyCreators.status, "ACCEPTED")
            ),
            with: {
              agency: true,
            },
          }),
        ]);

        for (const m of mediaCounts) {
          if (m.type === "IMAGE") photos = Number(m.count);
          if (m.type === "VIDEO") videos = Number(m.count);
        }

        if (
          agencyLink?.agency &&
          agencyLink.agency.status === "ACTIVE" &&
          agencyLink.agency.showBadge === 1
        ) {
          agencyBadgeText = agencyLink.agency.badgeText || agencyLink.agency.name;
          agencyBadgeColor = agencyLink.agency.badgeColor;
        }
      } catch {
        // Fallback seguro
      }

      return {
        ...c,
        country: c.country || "VE",
        creatorCategory: c.creatorCategory || "MUJER",
        likesCount: c.likesCount || 0,
        favoritesCount: favoritesCountMap.get(c.id) || 0,
        isAiGenerated: c.isAiGenerated || 0,
        photosCount: photos,
        videosCount: videos,
        agencyBadgeText,
        agencyBadgeColor,
      };
    })
  );
}

function CreatorDirectoryCard({
  creator,
  rankNumber,
}: {
  creator: EnrichedCreatorCard;
  rankNumber?: number;
}) {
  const countryMeta = getCountryMeta(creator.country);

  return (
    <Link
      href={`/${creator.username}`}
      className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition flex flex-col shadow-lg"
    >
      <div className="h-32 bg-gradient-to-r from-rose-900/60 to-purple-900/60 relative overflow-hidden">
        {creator.bannerKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/media/${creator.bannerKey}`}
            alt="Portada"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-rose-950 via-purple-950 to-slate-900 opacity-80" />
        )}

        {rankNumber !== undefined && (
          <div className="absolute top-3 left-3 bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-md flex items-center gap-1">
            <Bookmark className="w-3 h-3 fill-slate-950" />
            Top #{rankNumber}
          </div>
        )}

        <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] font-bold text-amber-400 border border-amber-500/30 shadow-md">
          {creator.priceKoin} KOIN/mes
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col -mt-10 relative">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-900 overflow-hidden flex items-center justify-center text-white font-bold text-xl mb-3 shadow-md shrink-0">
          {creator.avatarKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/media/${creator.avatarKey}`}
              alt={creator.displayName || creator.username}
              className="w-full h-full object-cover"
            />
          ) : (
            (creator.displayName || creator.username)[0]?.toUpperCase() || "K"
          )}
        </div>

        <UserLevelBadge
          level={creator.level || 0}
          username={creator.username}
          isAiGenerated={creator.isAiGenerated === 1}
          className="mb-1"
        />

        <h3 className="text-white font-bold text-base mt-1 group-hover:text-rose-400 transition">
          {creator.displayName || creator.username}
        </h3>

        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
              getCreatorCategoryMeta(creator.creatorCategory).badgeClass
            }`}
          >
            {getCreatorCategoryMeta(creator.creatorCategory).label}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
            {countryMeta.flag} {countryMeta.code === "OTHER" ? "Int." : countryMeta.code}
          </span>
          {creator.agencyBadgeText && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r ${
                creator.agencyBadgeColor ||
                "from-indigo-500 via-purple-500 to-rose-500"
              } shadow-sm`}
            >
              <Building2 className="w-2.5 h-2.5" />
              {creator.agencyBadgeText}
            </span>
          )}
        </div>

        <p className="text-slate-400 text-xs mt-1.5 line-clamp-2 leading-relaxed flex-1">
          {creator.bio || "Creadora de contenido exclusiva en KONTENIDO."}
        </p>

        {/* Métricas intuitivas de contenido: Fotos, Videos, Likes y Favoritos */}
        <div
          className={`grid gap-1.5 py-2 px-2.5 my-3 bg-slate-950/70 border border-slate-800/80 rounded-xl text-center ${
            creator.favoritesCount > 0 ? "grid-cols-4" : "grid-cols-3"
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-white block">
              {creator.photosCount}
            </span>
            <span className="text-[9px] text-slate-500 uppercase tracking-wider block">
              Fotos
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-purple-400 block">
              {creator.videosCount}
            </span>
            <span className="text-[9px] text-slate-500 uppercase tracking-wider block">
              Videos
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-rose-500 flex items-center justify-center gap-0.5">
              <Heart className="w-2.5 h-2.5 fill-rose-500" />
              {creator.likesCount}
            </span>
            <span className="text-[9px] text-slate-500 uppercase tracking-wider block">
              Likes
            </span>
          </div>
          {creator.favoritesCount > 0 && (
            <div>
              <span className="text-[11px] font-bold text-amber-400 flex items-center justify-center gap-0.5">
                <Bookmark className="w-2.5 h-2.5 fill-amber-400" />
                {creator.favoritesCount}
              </span>
              <span className="text-[9px] text-slate-500 uppercase tracking-wider block">
                Favs
              </span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Ver perfil completo</span>
          <ArrowRight className="w-4 h-4 text-rose-500 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}

/**
 * Página de inicio (Landing Page) de KONTENIDO
 * - Perfiles ordenados desde el último registrado hasta el primero (descendente por fecha)
 * - Cuando existen más de 20 registros de creadores, muestra la sección destacada de los que tienen más FAVORITOS
 * - Acceso destacado a la sección gratuita KOMESTIBLE & KOINCIDEN
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  await ensureChatSchema();
  await ensureInteractionsSchema();
  await ensureKomestibleSchema();

  const session = await auth();
  const resolvedSearch = searchParams ? await searchParams : {};
  const activeCategory = CREATOR_CATEGORIES.some(
    (c) => c.value === resolvedSearch?.categoria
  )
    ? resolvedSearch.categoria!
    : null;

  const pageSize = 48;
  const requestedPage = Math.max(1, parseInt(resolvedSearch?.pagina || "1", 10) || 1);

  let creatorsList: EnrichedCreatorCard[] = [];
  let topFavoritesCreators: EnrichedCreatorCard[] = [];
  let totalCreatorRecords = 0;
  let filteredTotalCount = 0;

  try {
    // 1. Contar total global de registros de creadores y contar favoritos por creadora
    const [globalCountRes, filteredCountRes, favAggRows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .where(eq(users.role, "CREATOR")),
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .where(
          activeCategory
            ? and(
                eq(users.role, "CREATOR"),
                eq(profiles.creatorCategory, activeCategory as any)
              )
            : eq(users.role, "CREATOR")
        ),
      db
        .select({
          creatorId: profileFavorites.creatorId,
          count: sql<number>`count(*)`,
        })
        .from(profileFavorites)
        .groupBy(profileFavorites.creatorId)
        .orderBy(desc(sql`count(*)`)),
    ]);

    totalCreatorRecords = Number(globalCountRes[0]?.count || 0);
    filteredTotalCount = Number(filteredCountRes[0]?.count || 0);

    const favoritesCountMap = new Map<string, number>();
    for (const row of favAggRows) {
      favoritesCountMap.set(row.creatorId, Number(row.count || 0));
    }

    // 2. Obtener perfiles ordenados desde el ÚLTIMO hasta el PRIMERO
    const offset = (requestedPage - 1) * pageSize;
    const rawCreators = await db
      .select({
        id: users.id,
        username: users.username,
        level: users.level,
        country: users.country,
        displayName: profiles.displayName,
        bio: profiles.bio,
        avatarKey: profiles.avatarKey,
        bannerKey: profiles.bannerKey,
        priceKoin: profiles.subscriptionPriceKoin,
        creatorCategory: profiles.creatorCategory,
        likesCount: profiles.likesCount,
        isAiGenerated: profiles.isAiGenerated,
      })
      .from(users)
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(
        activeCategory
          ? and(
              eq(users.role, "CREATOR"),
              eq(profiles.creatorCategory, activeCategory as any)
            )
          : eq(users.role, "CREATOR")
      )
      .orderBy(desc(users.createdAt), desc(profiles.createdAt))
      .limit(pageSize)
      .offset(offset);

    creatorsList = await enrichCreatorCards(rawCreators, favoritesCountMap);

    // 3. Cuando existan más de 20 registros, mostrar sección con los que tengan más FAVORITOS
    if (totalCreatorRecords > 20) {
      const topFavIds = favAggRows
        .filter((r) => Number(r.count) > 0)
        .slice(0, 12)
        .map((r) => r.creatorId);

      let rawTopFavs: RawCreatorRow[] = [];

      if (topFavIds.length > 0) {
        const fetched = await db
          .select({
            id: users.id,
            username: users.username,
            level: users.level,
            country: users.country,
            displayName: profiles.displayName,
            bio: profiles.bio,
            avatarKey: profiles.avatarKey,
            bannerKey: profiles.bannerKey,
            priceKoin: profiles.subscriptionPriceKoin,
            creatorCategory: profiles.creatorCategory,
            likesCount: profiles.likesCount,
            isAiGenerated: profiles.isAiGenerated,
          })
          .from(users)
          .innerJoin(profiles, eq(users.id, profiles.userId))
          .where(and(eq(users.role, "CREATOR"), inArray(users.id, topFavIds)));

        const rowById = new Map(fetched.map((f) => [f.id, f]));
        rawTopFavs = topFavIds
          .flatMap((id) => {
            const found = rowById.get(id);
            return found ? [found] : [];
          })
          .slice(0, 8);
      } else {
        // Respaldo ordenado si aún nadie ha marcado favoritos
        rawTopFavs = await db
          .select({
            id: users.id,
            username: users.username,
            level: users.level,
            country: users.country,
            displayName: profiles.displayName,
            bio: profiles.bio,
            avatarKey: profiles.avatarKey,
            bannerKey: profiles.bannerKey,
            priceKoin: profiles.subscriptionPriceKoin,
            creatorCategory: profiles.creatorCategory,
            likesCount: profiles.likesCount,
            isAiGenerated: profiles.isAiGenerated,
          })
          .from(users)
          .innerJoin(profiles, eq(users.id, profiles.userId))
          .where(eq(users.role, "CREATOR"))
          .orderBy(desc(profiles.likesCount), desc(users.level))
          .limit(8);
      }

      topFavoritesCreators = await enrichCreatorCards(rawTopFavs, favoritesCountMap);
      topFavoritesCreators.sort(
        (a, b) => b.favoritesCount - a.favoritesCount || b.likesCount - a.likesCount
      );
    }
  } catch (err) {
    console.error(
      "Error al consultar creadores en HomePage (verificar TURSO_DATABASE_URL):",
      err
    );
  }

  const totalPages = Math.max(1, Math.ceil(filteredTotalCount / pageSize));

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. SECCIÓN HERO */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b border-slate-900 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(225,29,72,0.18),rgba(255,255,255,0))]" />

        <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
          <div className="flex justify-center mb-6">
            <Image
              src="/img/logo.png"
              alt="KONTENIDO"
              width={260}
              height={44}
              priority
              className="h-10 sm:h-12 w-auto object-contain filter drop-shadow-[0_4px_12px_rgba(225,29,72,0.25)]"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold tracking-wide uppercase mb-6 animate-pulse">
            <Flame className="w-4 h-4 text-rose-500" />
            Venezuela y el Mundo • 100% KOIN (USDT)
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.08] mb-6">
            Tus fotos y videos <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 bg-clip-text text-transparent">
              en 1 solo clic.
            </span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
            Monetiza tu comunidad con suscripciones en <strong>KOIN (USDT)</strong>. Cobra directamente en <strong>USDT (Binance / Wallet)</strong> en cualquier país, o en <strong>PagoMóvil y Bancos Nacionales</strong> en Venezuela.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href={session ? "/panel" : "/registro?rol=creador"}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-base transition shadow-xl shadow-rose-600/30 hover:scale-105"
            >
              <Sparkles className="w-5 h-5" />
              {session?.user.role === "CREATOR"
                ? "Ir a mi Estudio (/panel)"
                : "Quiero Crear y Vender"}
            </Link>

            <Link
              href="/komestible"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-black text-base transition shadow-xl shadow-amber-500/20 hover:scale-105"
            >
              <Flame className="w-5 h-5 fill-slate-950" />
              Entrar a KOMESTIBLE (Gratis)
            </Link>

            <Link
              href="#directorio-creadores"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-base transition border border-slate-700"
            >
              Explorar Creadores
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mt-12 pt-8 border-t border-slate-800/80 text-center">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white">Gratis</div>
              <div className="text-xs text-slate-400 mt-1">KOMESTIBLE & KOINCIDEN</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400">1:1</div>
              <div className="text-xs text-slate-400 mt-1">KOIN ≈ USDT Global</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-rose-500">30+</div>
              <div className="text-xs text-slate-400 mt-1">Bancos VE + Cripto</div>
            </div>
          </div>
        </div>
      </section>

      {/* BANNER INTERACTIVO KOMESTIBLE & KOINCIDEN */}
      <section className="py-6 bg-slate-950 border-b border-slate-900">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-to-r from-rose-950/70 via-slate-900 to-amber-950/50 border border-rose-500/30 rounded-3xl p-5 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-xl">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                <Flame className="w-3 h-3 text-rose-400 fill-rose-400" />
                Nuevo • Sección Gratuita estilo Encuentros
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Descubre <span className="text-rose-400">KOMESTIBLE</span> y conecta en{" "}
                <span className="text-amber-400">KOINCIDEN</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Sube tus fotos gratis para que la comunidad las valore, desliza perfiles y si ambos se dan Like ❤️, ¡encuéntrense y chateen gratis en KOINCIDEN! Además puedes perfilarte como Creador/a para generar ingresos.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <Link
                href="/komestible"
                className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-rose-600/30 transition"
              >
                <Flame className="w-4 h-4 fill-white" />
                Ir a KOMESTIBLE
              </Link>
              <Link
                href="/koinciden"
                className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold flex items-center gap-2 transition"
              >
                <MessageCircleHeart className="w-4 h-4 text-pink-400" />
                Ver KOINCIDEN
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN DE PERFILES CON MÁS FAVORITOS (SE MUESTRA SOLO CUANDO EXISTEN > 20 REGISTROS) */}
      {totalCreatorRecords > 20 && topFavoritesCreators.length > 0 && (
        <section className="py-12 bg-gradient-to-b from-slate-950 via-amber-950/10 to-slate-950 border-b border-slate-900">
          <div className="container mx-auto px-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
                  <Bookmark className="w-6 h-6 text-amber-400 fill-amber-400" />
                  Perfiles con Más Favoritos
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Los perfiles más guardados y deseados por la comunidad entre los {totalCreatorRecords} creadores activos.
                </p>
              </div>
              <span className="px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold self-start sm:self-auto">
                Top {topFavoritesCreators.length} en Favoritos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {topFavoritesCreators.map((creator, idx) => (
                <CreatorDirectoryCard
                  key={`fav-${creator.id}`}
                  creator={creator}
                  rankNumber={idx + 1}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 2. DIRECTORIO DE CREADORES (ORDENADOS DEL ÚLTIMO AL PRIMERO) */}
      <section id="directorio-creadores" className="py-14 bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                Creadores en KONTENIDO
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Ordenados del más reciente al primero ({filteredTotalCount} {filteredTotalCount === 1 ? "perfil" : "perfiles"}).
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/"
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  !activeCategory
                    ? "bg-rose-600 text-white border-rose-500"
                    : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                }`}
              >
                Todas
              </Link>
              {CREATOR_CATEGORIES.map((cat) => (
                <Link
                  key={cat.value}
                  href={`/?categoria=${cat.value}`}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                    activeCategory === cat.value
                      ? "bg-rose-600 text-white border-rose-500"
                      : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {cat.plural}
                </Link>
              ))}
            </div>
          </div>

          {creatorsList.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {creatorsList.map((creator) => (
                  <CreatorDirectoryCard key={creator.id} creator={creator} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-10">
                  {requestedPage > 1 && (
                    <Link
                      href={`/?${new URLSearchParams({
                        ...(activeCategory ? { categoria: activeCategory } : {}),
                        pagina: String(requestedPage - 1),
                      }).toString()}`}
                      className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white hover:border-rose-500/50 transition"
                    >
                      ← Más recientes
                    </Link>
                  )}
                  <span className="text-xs text-slate-400 font-semibold">
                    Página {requestedPage} de {totalPages}
                  </span>
                  {requestedPage < totalPages && (
                    <Link
                      href={`/?${new URLSearchParams({
                        ...(activeCategory ? { categoria: activeCategory } : {}),
                        pagina: String(requestedPage + 1),
                      }).toString()}`}
                      className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white hover:border-rose-500/50 transition"
                    >
                      Anteriores →
                    </Link>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 max-w-xl mx-auto">
              <Sparkles className="w-10 h-10 text-rose-500 mx-auto mb-3" />
              <h3 className="text-white font-bold text-lg">
                Sé la primera creadora en KONTENIDO
              </h3>
              <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto leading-relaxed mb-6">
                Regístrate ahora, completa tu validación de identidad y publica tus primeras fotos o paquetes para comenzar a recibir ingresos semanales.
              </p>
              <Link
                href="/registro?rol=creador"
                className="inline-flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-rose-600/30"
              >
                Crear mi cuenta de Creadora
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* 3. PROPUESTA DE VALOR */}
      <section className="py-16 bg-slate-900/50 border-t border-slate-800/80">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Diseñado para Venezuela y Creadores Internacionales
            </h2>
            <p className="text-slate-400 text-sm mt-2">
              Pagos flexibles: Bolívares (PagoMóvil y 30 bancos) en Venezuela, o 100% directo en USDT para todo el mundo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Billetera KOIN Global</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Recargas fáciles con USDT (TRC20/BEP20/Binance Pay). 1 KOIN equivale a 1 USDT. Creadores internacionales cobran directo en USDT y en Venezuela en Bs. o USDT.
              </p>
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                <Flame className="w-6 h-6" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">KOMESTIBLE & KOINCIDEN</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Comunidad gratuita estilo encuentros para subir fotos, recibir valoraciones, hacer matches mutuos en KOINCIDEN y escalar a Creador de Contenido.
              </p>
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Seguridad y Respaldo</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Protección anti-descargas estricta para creadoras. Cloudflare R2 privado con URLs prefirmadas de 60 segundos y respaldo permanente garantizado.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
