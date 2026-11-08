import Link from "next/link";
import { auth, signOut } from "@/auth";
import UserLevelBadge from "./UserLevelBadge";
import { Coins, Shield, Sparkles, LayoutDashboard, LogOut, User, DollarSign } from "lucide-react";
import { db } from "@/lib/db";
import { wallets, vipMemberships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Image from "next/image";

/**
 * Barra de navegación principal de KONTENIDO
 * Muestra saldo KOIN en tiempo real, nivel de usuario con marco [Lv. X],
 * distintivo VIP y accesos directos según el rol de la sesión.
 */
export default async function Navbar() {
  const session = await auth();
  const user = session?.user;

  // Obtener saldo de billetera si está autenticado
  let balanceKoin = 0;
  let vipBadgeText: string | null = null;
  let vipBadgeColor: string | null = null;

  if (user) {
    try {
      const userWallet = await db.query.wallets.findFirst({
        where: eq(wallets.userId, user.id),
      });
      balanceKoin = userWallet?.balanceKoin || 0;

      if (user.vipMembershipId) {
        const membership = await db.query.vipMemberships.findFirst({
          where: eq(vipMemberships.id, user.vipMembershipId),
        });
        if (membership) {
          vipBadgeText = membership.badgeText;
          vipBadgeColor = membership.badgeColor;
        }
      }
    } catch (err) {
      console.error("Error al consultar billetera/membresía en Navbar:", err);
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
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
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Billetera KOIN: Para creadoras lleva al Hub de Retiros (/panel/pagos), para consumidores a Billetera/Recargas (/cuenta) */}
              <Link
                href={user.role === "CREATOR" ? "/panel/pagos" : "/cuenta"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition text-xs font-semibold"
                title={user.role === "CREATOR" ? "Tus ganancias y retiros en Bolívares" : "Tu saldo KOIN disponible"}
              >
                <Coins className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>{balanceKoin.toFixed(2)} KOIN</span>
              </Link>

              {/* Badge de nivel con marco y distintivo VIP */}
              <div className="hidden sm:flex items-center">
                <UserLevelBadge
                  level={user.level || 0}
                  username={user.username}
                  vipBadgeText={vipBadgeText}
                  vipBadgeColor={vipBadgeColor}
                  role={user.role}
                  kycStatus={user.kycStatus}
                  showRoleBadge
                />
              </div>

              {/* Botones de navegación según rol */}
              {user.role === "SUPER_ADMIN" && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition shadow-sm"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Panel Admin</span>
                </Link>
              )}

              {user.role === "CREATOR" && (
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

              {user.role === "AGENCY" && (
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
                href={`/${user.username}`}
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
                  className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
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
    </header>
  );
}
