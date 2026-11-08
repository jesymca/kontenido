import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, profiles, posts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import UserLevelBadge from "@/components/UserLevelBadge";
import { Sparkles, Coins, ShieldCheck, Flame, ArrowRight, Heart, Star, Check } from "lucide-react";

/**
 * Página de inicio (Landing Page) de KONTENIDO
 * Presenta creadores destacados, propuesta de valor venezolana y accesos rápidos
 */
export default async function HomePage() {
  const session = await auth();

  // Obtener creadores destacados para mostrar en la página de inicio
  const featuredCreators = await db
    .select({
      id: users.id,
      username: users.username,
      level: users.level,
      displayName: profiles.displayName,
      bio: profiles.bio,
      avatarKey: profiles.avatarKey,
      bannerKey: profiles.bannerKey,
      priceKoin: profiles.subscriptionPriceKoin,
    })
    .from(users)
    .innerJoin(profiles, eq(users.id, profiles.userId))
    .where(eq(users.role, "CREATOR"))
    .limit(8);

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. SECCIÓN HERO */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32 border-b border-slate-900 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
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
            La plataforma líder en Venezuela
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.08] mb-6">
            Tus fotos y videos <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 bg-clip-text text-transparent">
              en 1 solo clic.
            </span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
            Monetiza tu comunidad con suscripciones en <strong>KOIN (USDT)</strong>. Recibe tus cortes semanales directamente en <strong>PagoMóvil, Transferencia Bancaria o Binance</strong>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={session ? (session.user.role === "CREATOR" ? "/panel" : "/cuenta") : "/registro"}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-base transition shadow-xl shadow-rose-600/30 hover:scale-105"
            >
              <Sparkles className="w-5 h-5" />
              {session?.user.role === "CREATOR"
                ? "Ir a mi Estudio"
                : "Quiero Crear Contenido"}
            </Link>

            <Link
              href="/registro"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-base transition border border-slate-700"
            >
              Explorar Creadores
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mt-14 pt-10 border-t border-slate-800/80 text-center">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white">100%</div>
              <div className="text-xs text-slate-400 mt-1">Nativo Vercel + Turso</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400">1:1</div>
              <div className="text-xs text-slate-400 mt-1">KOIN ≈ USDT</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-rose-500">30</div>
              <div className="text-xs text-slate-400 mt-1">Bancos VE Soportados</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CREADORES DESTACADOS */}
      <section className="py-16 bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                Creadores en KONTENIDO
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Descubre perfiles verificados con contenido exclusivo y sube de nivel apoyándolos.
              </p>
            </div>
            <Link
              href="/registro"
              className="hidden sm:flex items-center gap-1 text-xs text-rose-400 font-bold hover:underline"
            >
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {featuredCreators.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredCreators.map((creator) => (
                <Link
                  key={creator.id}
                  href={`/${creator.username}`}
                  className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition flex flex-col shadow-lg"
                >
                  <div className="h-32 bg-gradient-to-r from-rose-900/60 to-purple-900/60 relative">
                    <div className="absolute top-3 right-3 bg-slate-950/70 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] font-bold text-amber-400 border border-amber-500/30">
                      {creator.priceKoin} KOIN/mes
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col -mt-10 relative">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-900 overflow-hidden flex items-center justify-center text-white font-bold text-xl mb-3 shadow-md">
                      {creator.displayName[0]?.toUpperCase()}
                    </div>

                    <UserLevelBadge
                      level={creator.level || 0}
                      username={creator.username}
                      className="mb-1"
                    />

                    <h3 className="text-white font-bold text-base mt-1 group-hover:text-rose-400 transition">
                      {creator.displayName}
                    </h3>

                    <p className="text-slate-400 text-xs mt-1.5 line-clamp-2 leading-relaxed flex-1">
                      {creator.bio || "Creadora de contenido exclusiva en KONTENIDO."}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span>Ver perfil completo</span>
                      <ArrowRight className="w-4 h-4 text-rose-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 max-w-xl mx-auto">
              <Sparkles className="w-10 h-10 text-rose-500 mx-auto mb-3" />
              <h3 className="text-white font-bold text-lg">Sé la primera creadora en KONTENIDO</h3>
              <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto leading-relaxed mb-6">
                Regístrate ahora, completa tu validación de cédula y publica tus primeras fotos o paquetes para comenzar a recibir ingresos semanales.
              </p>
              <Link
                href="/registro"
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
              Diseñado para Creadoras y Fans en Venezuela
            </h2>
            <p className="text-slate-400 text-sm mt-2">
              Sin enredos bancarios extranjeros, con paridad clara y seguridad integral.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
                <Coins className="w-6 h-6" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Billetera KOIN</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Recargas fáciles con USDT (TRC20/BEP20) validadas de forma segura. 1 KOIN equivale a 1 USDT para que siempre tengas el control exacto de tu dinero.
              </p>
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                <Star className="w-6 h-6" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Niveles 0 a 100</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Destaca ante creadoras y otros usuarios con tu marco de nivel [Lv. X] dinámico. A mayor inversión o actividad, mayores beneficios y membresías VIP.
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
