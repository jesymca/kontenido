import Link from "next/link";
import { auth, signOut } from "@/auth";
import UserLevelBadge from "./UserLevelBadge";
import CreatorPanelNav from "./CreatorPanelNav";
import ConsumerPanelNav, { type SubscribedCreatorItem } from "./ConsumerPanelNav";
import { Coins, Shield, Sparkles, LayoutDashboard, LogOut, User, DollarSign } from "lucide-react";
import { db } from "@/lib/db";
import { wallets, vipMemberships, users, subscriptions, profiles } from "@/lib/db/schema";
import { eq, or, desc } from "drizzle-orm";
import Image from "next/image";

/**
 * Barra de navegación principal de KONTENIDO
 * Muestra saldo KOIN en tiempo real, nivel de usuario con marco [Lv. X],
 * distintivo VIP y despliega el menú completo del Estudio de Creadora cuando el usuario es CREATOR.
 */
export default async function Navbar() {
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logotipo KONTENIDO */}
        <Link href="/" className="flex items-center gap-2.5 group">
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

        {/* Acciones derechas */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {sessionUser ? (
            <>
              {/* Billetera KOIN: Para creadoras lleva al Hub de Retiros (/panel/pagos), para consumidores a Billetera/Recargas (/cuenta) */}
              <Link
                href={effectiveRole === "CREATOR" ? "/panel/pagos" : "/cuenta"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition text-xs font-semibold"
                title={
                  effectiveRole === "CREATOR"
                    ? "Tus ganancias y retiros en Bolívares"
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
                    title="Retiros y cortes en Bolívares"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Retiros (Bs.)</span>
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

      {/* Menú desplegado permanente para Creadoras de Contenido en toda la plataforma */}
      {sessionUser && effectiveRole === "CREATOR" && (
        <CreatorPanelNav
          username={effectiveUsername}
          kycStatus={effectiveKycStatus}
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
