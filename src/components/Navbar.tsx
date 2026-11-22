import Link from "next/link";
import { auth, signOut } from "@/auth";
import UserLevelBadge from "./UserLevelBadge";
import CreatorPanelNav from "./CreatorPanelNav";
import ConsumerPanelNav, { type SubscribedCreatorItem } from "./ConsumerPanelNav";
import { Coins, Shield, Sparkles, LayoutDashboard, LogOut, User, DollarSign, Flame, MessageCircleHeart } from "lucide-react";
import { db } from "@/lib/db";
import { wallets, vipMemberships, subscriptions, profiles, komestibleMatches } from "@/lib/db/schema";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { getCurrentDbUser } from "@/lib/session";
import { isVenezuelanUser } from "@/lib/countries";
import { eq, or, desc, and, inArray } from "drizzle-orm";
import Image from "next/image";

/**
 * Barra de navegación principal de KONTENIDO
 * Muestra saldo KOIN en tiempo real, nivel de usuario con marco [Lv. X],
 * accesos a KOMESTIBLE / KOINCIDEN y menú completo según rol.
 */
export default async function Navbar() {
  await ensureKomestibleSchema();
  const session = await auth();
  const sessionUser = session?.user;

  // Obtener usuario sincronizado desde Turso DB, saldo de billetera y membresía VIP
  let balanceKoin = 0;
  let vipBadgeText: string | null = null;
  let vipBadgeColor: string | null = null;

  let effectiveRole = sessionUser?.role;
  let effectiveUsername = sessionUser?.username || "";
  let effectiveKycStatus = sessionUser?.kycStatus || "NONE";
  let effectiveLevel = sessionUser?.level || 0;
  let effectiveCountry = sessionUser?.country || "VE";
  let koincidenCount = 0;
  let consumerSubscriptions: SubscribedCreatorItem[] = [];

  if (sessionUser) {
    try {
      const dbUser = await getCurrentDbUser();

      const targetUserId = dbUser?.id || sessionUser.id;
      if (dbUser) {
        effectiveRole = dbUser.role;
        effectiveUsername = dbUser.username;
        effectiveKycStatus = dbUser.kycStatus;
        effectiveLevel = dbUser.level;
        effectiveCountry = dbUser.country || "VE";
      }

      const vipId = dbUser?.vipMembershipId ?? sessionUser.vipMembershipId;

      // Ejecutar en paralelo todas las consultas del Navbar (en lugar de secuencialmente)
      const [matchesTotal, userWallet, membership, subs] = await Promise.all([
        targetUserId
          ? (async () => {
              try {
                return await db.$count(
                  komestibleMatches,
                  and(
                    eq(komestibleMatches.status, "ACTIVE"),
                    or(
                      eq(komestibleMatches.userAId, targetUserId),
                      eq(komestibleMatches.userBId, targetUserId)
                    )
                  )
                );
              } catch {
                return 0;
              }
            })()
          : Promise.resolve(0),
        targetUserId
          ? db.query.wallets.findFirst({ where: eq(wallets.userId, targetUserId) })
          : Promise.resolve(null),
        vipId
          ? db.query.vipMemberships.findFirst({ where: eq(vipMemberships.id, vipId) })
          : Promise.resolve(null),
        effectiveRole === "CONSUMER" && targetUserId
          ? db.query.subscriptions.findMany({
              where: eq(subscriptions.subscriberId, targetUserId),
              orderBy: [desc(subscriptions.startsAt)],
              with: { creator: true },
            })
          : Promise.resolve([]),
      ]);

      koincidenCount = matchesTotal;
      balanceKoin = userWallet?.balanceKoin || 0;
      if (membership) {
        vipBadgeText = membership.badgeText;
        vipBadgeColor = membership.badgeColor;
      }

      // Cargar únicamente los perfiles de los creadores a los que está suscrito (sin full-table scan)
      if (subs.length > 0) {
        const nowIso = new Date().toISOString();
        const activeSubs = subs.filter(
          (s) => s.creator && s.status === "ACTIVE" && s.endsAt >= nowIso
        );
        const creatorIds = Array.from(new Set(activeSubs.map((s) => s.creatorId)));

        if (creatorIds.length > 0) {
          const subscribedProfiles = await db.query.profiles.findMany({
            where: inArray(profiles.userId, creatorIds),
          });
          const profileMap = new Map(subscribedProfiles.map((p) => [p.userId, p]));
          const seenCreators = new Set<string>();

          for (const s of activeSubs) {
            if (!s.creator || seenCreators.has(s.creatorId)) continue;
            seenCreators.add(s.creatorId);
            const prof = profileMap.get(s.creatorId);
            consumerSubscriptions.push({
              creatorId: s.creatorId,
              username: s.creator.username,
              displayName: prof?.displayName || s.creator.username,
              avatarUrl: prof?.avatarKey ? `/api/media/${prof.avatarKey}` : null,
              endsAt: s.endsAt,
            });
          }
        }
      }
    } catch (err) {
      console.error("Error al consultar usuario/billetera en Navbar:", err);
    }
  }

  const isVenezuela = isVenezuelanUser(effectiveCountry);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur-md overflow-x-clip">
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-2.5 min-h-[3.5rem] sm:min-h-[4rem] flex flex-wrap items-center justify-between gap-x-2 sm:gap-x-3 gap-y-2">
        {/* Logotipo KONTENIDO y accesos desktop */}
        <div className="flex items-center gap-3 lg:gap-4 min-w-0">
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2.5 group shrink-0">
            <Image
              src="/img/favicon.svg"
              alt="KONTENIDO Icon"
              width={32}
              height={32}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg shadow-md group-hover:scale-105 transition-transform shrink-0"
            />
            <Image
              src="/img/logo.png"
              alt="KONTENIDO"
              width={165}
              height={28}
              priority
              className="h-4 sm:h-6 md:h-7 w-auto max-w-[96px] sm:max-w-[180px] object-contain shrink-0"
            />
          </Link>

          {/* Accesos rápidos a KOMESTIBLE y KOINCIDEN en pantallas desktop (>= lg) */}
          <div className="hidden lg:flex items-center gap-1.5 shrink-0">
            <Link
              href="/komestible"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600/20 to-amber-500/20 border border-rose-500/40 text-rose-300 hover:text-white hover:border-rose-400 transition text-xs font-black whitespace-nowrap shrink-0"
              title="Sección gratuita estilo encuentros para valorar fotos"
            >
              <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
              <span>KOMESTIBLE</span>
            </Link>

            {sessionUser && (
              <Link
                href="/koinciden"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:border-rose-500/50 transition text-xs font-bold whitespace-nowrap shrink-0"
                title="Matches mutuos de KOMESTIBLE"
              >
                <MessageCircleHeart className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                <span>KOINCIDEN</span>
                {koincidenCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black leading-none">
                    {koincidenCount}
                  </span>
                )}
              </Link>
            )}
          </div>
        </div>

        {/* Acciones derechas */}
        <div className="flex items-center justify-end gap-1 sm:gap-2 shrink-0 ml-auto">
          {sessionUser ? (
            <>
              {/* Billetera KOIN: Para creadoras lleva al Hub de Retiros (/panel/pagos), para consumidores a Billetera/Recargas (/cuenta) */}
              <Link
                href={effectiveRole === "CREATOR" ? "/panel/pagos" : "/cuenta"}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0"
                title={
                  effectiveRole === "CREATOR"
                    ? isVenezuela
                      ? "Tus ganancias y retiros en Bolívares o USDT"
                      : "Tus ganancias y retiros en USDT"
                    : "Tu saldo KOIN disponible"
                }
              >
                <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                <span>
                  {balanceKoin.toFixed(2)}
                  <span className="hidden sm:inline"> KOIN</span>
                </span>
              </Link>

              {/* Badge de nivel con marco y distintivo VIP (visible desde md para evitar colisiones en móvil) */}
              <div className="hidden md:flex items-center shrink-0 max-w-[240px] overflow-hidden">
                <UserLevelBadge
                  level={effectiveLevel}
                  username={effectiveUsername}
                  vipBadgeText={vipBadgeText}
                  vipBadgeColor={vipBadgeColor}
                  role={effectiveRole}
                  kycStatus={effectiveKycStatus}
                  showRoleBadge
                  className="flex-nowrap whitespace-nowrap"
                />
              </div>

              {/* Botones de navegación según rol */}
              {effectiveRole === "SUPER_ADMIN" && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-600 text-white text-[11px] sm:text-xs font-bold hover:bg-red-700 transition shadow-sm whitespace-nowrap shrink-0"
                  title="Panel de Administración"
                >
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden md:inline">Panel Admin</span>
                </Link>
              )}

              {effectiveRole === "CREATOR" && (
                <>
                  <Link
                    href="/panel"
                    className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-rose-600 text-white text-[11px] sm:text-xs font-bold hover:bg-rose-700 transition shadow-sm shadow-rose-600/30 whitespace-nowrap shrink-0"
                    title="Panel de Estudio para Creadoras"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span className="sm:hidden">Estudio</span>
                    <span className="hidden sm:inline">Mi Estudio</span>
                  </Link>

                  <Link
                    href="/panel/pagos"
                    className="hidden xl:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-amber-400 text-xs font-semibold hover:bg-slate-700 transition border border-amber-500/20 whitespace-nowrap shrink-0"
                    title={isVenezuela ? "Retiros y cortes en Bolívares o USDT" : "Retiros internacionales en USDT"}
                  >
                    <DollarSign className="w-3.5 h-3.5 shrink-0" />
                    <span>{isVenezuela ? "Retiros (Bs.)" : "Retiros (USDT)"}</span>
                  </Link>
                </>
              )}

              {effectiveRole === "CONSUMER" && (
                <Link
                  href="/panel"
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600 hover:text-white text-[11px] sm:text-xs font-bold transition whitespace-nowrap shrink-0"
                  title="Activa tu Estudio para subir y vender contenido"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="sm:hidden">Vender</span>
                  <span className="hidden sm:inline">Vender Contenido</span>
                </Link>
              )}

              {(effectiveRole === "AGENCY" || effectiveRole === "SUPER_ADMIN") && (
                <Link
                  href="/agencia"
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[11px] sm:text-xs font-bold hover:bg-indigo-700 transition whitespace-nowrap shrink-0"
                  title="Panel de Agencia"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Agencia</span>
                </Link>
              )}

              {/* Perfil del usuario */}
              <Link
                href={`/${effectiveUsername}`}
                className="p-1.5 sm:p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition shrink-0"
                title="Ver mi perfil público"
              >
                <User className="w-4 h-4" />
              </Link>

              {/* Botón Cerrar Sesión */}
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
                className="shrink-0"
              >
                <button
                  type="submit"
                  className="p-1.5 sm:p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Link
                href="/login"
                className="text-[11px] sm:text-sm font-medium text-slate-300 hover:text-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-slate-800 transition whitespace-nowrap shrink-0"
              >
                Iniciar Sesión
              </Link>
              <Link
                href="/registro"
                className="text-[11px] sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition shadow-md shadow-rose-600/20 whitespace-nowrap shrink-0"
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Acceso móvil y tablet (< lg) dedicado a KOMESTIBLE / KOINCIDEN en su propia fila sin superponerse al logotipo */}
      <div className="lg:hidden border-t border-slate-800/70 bg-slate-950/95">
        <div className="container mx-auto px-3 sm:px-4 py-1.5 flex items-center justify-center gap-2">
          <Link
            href="/komestible"
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-600/15 border border-rose-500/30 text-rose-300 hover:text-white text-[11px] font-black whitespace-nowrap"
          >
            <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
            <span className="truncate">KOMESTIBLE (Gratis)</span>
          </Link>
          {sessionUser && (
            <Link
              href="/koinciden"
              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:text-white text-[11px] font-bold whitespace-nowrap"
            >
              <MessageCircleHeart className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              <span className="truncate">KOINCIDEN ({koincidenCount})</span>
            </Link>
          )}
        </div>
      </div>

      {/* Menú desplegado permanente para Creadoras de Contenido en toda la plataforma */}
      {sessionUser && effectiveRole === "CREATOR" && (
        <CreatorPanelNav
          username={effectiveUsername}
          kycStatus={effectiveKycStatus}
          isVenezuela={isVenezuela}
          inHeader
        />
      )}

      {/* Menú desplegado permanente para Consumidores con sus perfiles suscritos */}
      {sessionUser && effectiveRole === "CONSUMER" && (
        <ConsumerPanelNav subscriptions={consumerSubscriptions} />
      )}
    </header>
  );
}
