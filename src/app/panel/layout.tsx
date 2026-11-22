import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, profiles } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Sparkles, ShieldCheck, ArrowRight } from "lucide-react";

import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { getCurrentDbUser } from "@/lib/session";
import { isVenezuelanUser } from "@/lib/countries";

/**
 * Layout del Estudio de Creadora (/panel/*)
 * Verifica el rol contra Turso DB usando la consulta deduplicada por petición (React.cache)
 * y permite activar el modo creadora en 1 clic si la cuenta se creó inicialmente como consumidor.
 */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/panel");
  }

  const dbUser = await getCurrentDbUser();

  if (!dbUser) {
    redirect("/login?callbackUrl=/panel");
  }

  // Si es Creadora o Super Admin en la base de datos, permitir acceso total a /panel y todas sus subrutas
  if (dbUser.role === "CREATOR" || dbUser.role === "SUPER_ADMIN") {
    return <>{children}</>;
  }

  // Si la cuenta tiene rol CONSUMER y entró a /panel, ofrecer activación en 1 clic a Creadora de Contenido
  async function upgradeToCreatorAction() {
    "use server";
    const currentSession = await auth();
    if (!currentSession?.user) return;

    const now = new Date().toISOString();
    const targetEmail = currentSession.user.email?.toLowerCase().trim();
    const targetUser = targetEmail
      ? await db.query.users.findFirst({
          where: or(eq(users.id, currentSession.user.id), eq(users.email, targetEmail)),
        })
      : await db.query.users.findFirst({
          where: eq(users.id, currentSession.user.id),
        });

    if (!targetUser) return;

    const existingProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, targetUser.id),
    });

    await db
      .update(users)
      .set({
        role: "CREATOR",
        status: targetUser.kycStatus === "APPROVED" ? "ACTIVE" : "PENDING",
        updatedAt: now,
      })
      .where(eq(users.id, targetUser.id));

    if (existingProfile) {
      const isPlaceholderBio =
        !existingProfile.bio ||
        existingProfile.bio.includes("Usuario en KONTENIDO") ||
        existingProfile.bio.includes("Estoy usando KONTENIDO");
      await db
        .update(profiles)
        .set({
          bio: isPlaceholderBio ? "Creadora de contenido en KONTENIDO." : existingProfile.bio,
          subscriptionPriceKoin:
            existingProfile.subscriptionPriceKoin > 0 ? existingProfile.subscriptionPriceKoin : 10.0,
          updatedAt: now,
        })
        .where(eq(profiles.userId, targetUser.id));
    } else {
      await db.insert(profiles).values({
        userId: targetUser.id,
        displayName: targetUser.username,
        bio: "Creadora de contenido en KONTENIDO.",
        subscriptionPriceKoin: 10.0,
        isPublished: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    revalidatePath("/", "layout");
    revalidatePath("/panel");
    revalidatePath("/panel/perfil");
    revalidatePath("/cuenta");
    redirect("/panel");
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-xl">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto mb-5">
          <Sparkles className="w-8 h-8" />
        </div>
        <span className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-black uppercase tracking-wider">
          Estudio de Creador/a • Crear para Vender
        </span>
        <h1 className="text-2xl font-black text-white tracking-tight mt-3">
          Activa tu Estudio para Vender Contenido
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
          Tu cuenta (<strong>@{dbUser.username}</strong>) está actualmente solo en{" "}
          <strong className="text-sky-300">Modo Consumidor</strong> (ver y comprar contenido). Si deseas subir tus propias fotos y videos, crear planes de suscripción y retirar ganancias{" "}
          {isVenezuelanUser(dbUser.country) ? "en Bolívares o USDT" : "directamente en USDT"}, activa tu Estudio de Creador/a en 1 clic.
        </p>

        <div className="mt-6 p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Conservas intactos tu saldo KOIN, nivel, membresía VIP y suscripciones activas para seguir comprando en <strong className="text-white">/cuenta</strong>.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Para cobrar tus ventas se requerirá validar tu{" "}
              {isVenezuelanUser(dbUser.country) ? "cédula de identidad" : "documento oficial o pasaporte"} (KYC).
            </span>
          </div>
        </div>

        <form action={upgradeToCreatorAction} className="mt-6 space-y-3">
          <button
            type="submit"
            className="w-full py-3.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Activar Modo Creador/a (Crear y Vender)
            <ArrowRight className="w-4 h-4" />
          </button>

          <Link
            href="/cuenta"
            className="block w-full py-3 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
          >
            Seguir solo como Consumidor en mi Billetera
          </Link>
        </form>
      </div>
    </div>
  );
}
