import Link from "next/link";
import { auth, signOut } from "@/auth";
import UserLevelBadge from "./UserLevelBadge";
import CreatorPanelNav from "./CreatorPanelNav";
import ConsumerPanelNav, { type SubscribedCreatorItem } from "./ConsumerPanelNav";
import { Coins, Shield, Sparkles, LayoutDashboard, LogOut, User, DollarSign, Flame, MessageCircleHeart } from "lucide-react";
import { db } from "@/lib/db";
import { wallets, vipMemberships, users, subscriptions, profiles, komestibleMatches } from "@/lib/db/schema";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { isVenezuelanUser } from "@/lib/countries";
import { eq, or, desc, and } from "drizzle-orm";
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
      const dbUser = sessionUser.email
        ? await db.query.users.findFirst({
            where: sessionUser.id
              ? or(eq(users.id, sessionUser.id), eq(users.email, sessionUser.email.toLowerCase().trim()))
              : eq(users.email, sessionUser.email.toLowerCase().trim()),
          })
        : sessionUser.id
        ? await db.query.users.findFirst({
            where: eq(users.id, sessionUser.id),
          })
        : null;

      const targetUserId = dbUser?.id || sessionUser.id;
      if (dbUser) {
        effectiveRole = dbUser.role;
        effectiveUsername = dbUser.username;
        effectiveKycStatus = dbUser.kycStatus;
        effectiveLevel = dbUser.level;
        effectiveCountry = dbUser.country || "VE";
      }

      if (targetUserId) {
        try {
          koincidenCount = await db.$count(
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
          koincidenCount = 0;
        }
      }

      const userWallet = await db.query.wallets.findFirst({
        where: eq(wallets.userId, targetUserId),
      });
      balanceKoin = userWallet?.balanceKoin || 0;

      const vipId = dbUser?.vipMembershipId ?? sessionUser.vipMembershipId;
      if (vipId) {
        const membership = await db.query.vipMemberships.findFirst({
          where: eq(vipMemberships.id, vipId),
        });
        if (membership) {
          vipBadgeText = membership.badgeText;
          vipBadgeColor = membership.badgeColor;
        }
      }

      // Si es CONSUMIDOR, cargar los perfiles a los que está suscrito para el Navbar rápido
      if (effectiveRole === "CONSUMER" && targetUserId) {
        const subs = await db.query.subscriptions.findMany({
          where: eq(subscriptions.subscriberId, targetUserId),
          orderBy: [desc(subscriptions.startsAt)],
          with: {
            creator: true,
          },
        });
        if (subs.length > 0) {
          const allProfiles = await db.query.profiles.findMany();
          const profileMap = new Map(allProfiles.map((p) => [p.userId, p]));
          const nowIso = new Date().toISOString();
          const seenCreators = new Set<string>();

          for (const s of subs) {
            if (!s.creator || seenCreators.has(s.creatorId)) continue;
            if (s.status === "ACTIVE" && s.endsAt >= nowIso) {
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
      }
    } catch (err) {
      console.error("Error al consultar usuario/billetera en Navbar:", err);
    }
  }

  const isVenezuela = isVenezuelanUser(effectiveCountry);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">
        {/* Logotipo KONTENIDO */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <Image
              src="/img/favicon.svg"
              alt="KONTENIDO Icon"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg shadow-md group-hover:scale-105 transition-transform"
            />
            <Image
              src="/img/logo.png"
              alt="KONTENIDO"
              width={150}
              height={28}
              priority
              className="h-6 sm:h-7 w-auto object-contain"
            />
          </Link>

          {/* Accesos rápidos a KOMESTIBLE y KOINCIDEN */}
          <div className="hidden md:flex items-center gap-1.5">
            <Link
              href="/komestible"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600/20 to-amber-500/20 border border-rose-500/40 text-rose-300 hover:text-white hover:border-rose-400 transition text-xs font-black"
              title="Sección gratuita estilo encuentros para valorar fotos"
            >
              <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              <span>KOMESTIBLE</span>
            </Link>

            {sessionUser && (
              <Link
                href="/koinciden"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:border-rose-500/50 transition text-xs font-bold"
                title="Matches mutuos de KOMESTIBLE"
              >
                <MessageCircleHeart className="w-3.5 h-3.5 text-pink-400" />
                <span>KOINCIDEN</span>
                {koincidenCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black">
                    {koincidenCount}
                  </span>
                )}
              </Link>
            )}
          </div>
        </div>

        {/* Acciones derechas */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {sessionUser ? (
            <>
              {/* Billetera KOIN: Para creadoras lleva al Hub de Retiros (/panel/pagos), para consumidores a Billetera/Recargas (/cuenta) */}
              <Link
                href={effectiveRole === "CREATOR" ? "/panel/pagos" : "/cuenta"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition text-xs font-semibold"
                title={
                  effectiveRole === "CREATOR"
                    ? isVenezuela
                      ? "Tus ganancias y retiros en Bolívares o USDT"
                      : "Tus ganancias y retiros en USDT"
                    : "Tu saldo KOIN disponible"
                }
              >
                <Coins className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>{balanceKoin.toFixed(2)} KOIN</span>
              </Link>

              {/* Badge de nivel con marco y distintivo VIP */}
              <div className="hidden sm:flex items-center">
                <UserLevelBadge
                  level={effectiveLevel}
                  username={effectiveUsername}
                  vipBadgeText={vipBadgeText}
                  vipBadgeColor={vipBadgeColor}
                  role={effectiveRole}
                  kycStatus={effectiveKycStatus}
                  showRoleBadge
                />
              </div>

              {/* Botones de navegación según rol */}
              {effectiveRole === "SUPER_ADMIN" && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition shadow-sm"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Panel Admin</span>
                </Link>
              )}

              {effectiveRole === "CREATOR" && (
                <>
                  <Link
                    href="/panel"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition shadow-sm shadow-rose-600/30"
                    title="Panel de Estudio para Creadoras"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Mi Estudio</span>
                  </Link>

                  <Link
                    href="/panel/pagos"
                    className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-amber-400 text-xs font-semibold hover:bg-slate-700 transition border border-amber-500/20"
                    title={isVenezuela ? "Retiros y cortes en Bolívares o USDT" : "Retiros internacionales en USDT"}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>{isVenezuela ? "Retiros (Bs.)" : "Retiros (USDT)"}</span>
                  </Link>
                </>
              )}

              {effectiveRole === "AGENCY" && (
                <Link
                  href="/agencia"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Agencia</span>
                </Link>
              )}

              {/* Perfil del usuario */}
              <Link
                href={`/${effectiveUsername}`}
                className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition"
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
              >
                <button
                  type="submit"
                  className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/komestible"
                className="md:hidden flex items-center gap-1 text-xs font-black text-rose-400 px-2.5 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>KOMESTIBLE</span>
              </Link>
              <Link
                href="/login"
                className="text-xs sm:text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition"
              >
                Iniciar Sesión
              </Link>
              <Link
                href="/registro"
                className="text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl transition shadow-md shadow-rose-600/20"
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Acceso móvil rápido a KOMESTIBLE / KOINCIDEN cuando está autenticado */}
      {sessionUser && (
        <div className="md:hidden border-t border-slate-800/70 bg-slate-950/90 px-4 py-1.5 flex items-center justify-center gap-2">
          <Link
            href="/komestible"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-rose-600/15 border border-rose-500/30 text-rose-300 text-[11px] font-black"
          >
            <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            KOMESTIBLE (Gratis)
          </Link>
          <Link
            href="/koinciden"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-bold"
          >
            <MessageCircleHeart className="w-3.5 h-3.5 text-pink-400" />
            KOINCIDEN ({koincidenCount})
          </Link>
        </div>
      )}

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
