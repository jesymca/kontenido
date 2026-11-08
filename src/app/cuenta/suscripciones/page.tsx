import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscriptions, profiles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Heart,
  Calendar,
  ExternalLink,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Vista de Perfiles Suscritos del Consumidor (/cuenta/suscripciones)
 * Muestra todas las creadoras a las que el consumidor está suscrito con acceso directo a sus contenidos.
 */
export default async function MisSuscripcionesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id;

  const userSubs = await db.query.subscriptions.findMany({
    where: eq(subscriptions.subscriberId, userId),
    orderBy: [desc(subscriptions.startsAt)],
    with: {
      creator: true,
    },
  });

  const allProfiles = await db.query.profiles.findMany();
  const profileMap = new Map(allProfiles.map((p) => [p.userId, p]));

  const nowIso = new Date().toISOString();

  const enrichedSubs = userSubs
    .filter((s) => s.creator)
    .map((s) => {
      const profile = profileMap.get(s.creatorId);
      const isExpired = s.endsAt < nowIso || s.status !== "ACTIVE";
      return {
        id: s.id,
        creatorId: s.creatorId,
        username: s.creator.username,
        displayName: profile?.displayName || s.creator.username,
        bio: profile?.bio || "Creadora verificada en KONTENIDO.",
        avatarUrl: profile?.avatarKey ? `/api/media/${profile.avatarKey}` : null,
        bannerUrl: profile?.bannerKey ? `/api/media/${profile.bannerKey}` : null,
        priceKoin: s.priceKoinSnapshot,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        isActive: !isExpired,
      };
    });

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <Heart className="w-7 h-7 text-rose-500 fill-rose-500/20" />
            Mis Perfiles Suscritos
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Accede con un clic a las publicaciones exclusivas, fotos, videos y chat privado de tus creadoras favoritas.
          </p>
        </div>
        <Link
          href="/"
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-700 transition self-start sm:self-auto flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          Descubrir más Creadoras
        </Link>
      </div>

      {enrichedSubs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {enrichedSubs.map((sub) => (
            <div
              key={sub.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between hover:border-rose-500/40 transition group"
            >
              <div>
                {/* Banner */}
                <div className="h-28 bg-gradient-to-r from-rose-900/50 via-slate-900 to-amber-900/40 relative">
                  {sub.bannerUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sub.bannerUrl}
                      alt={sub.displayName}
                      className="w-full h-full object-cover opacity-75"
                    />
                  )}
                  <div className="absolute top-3 right-3">
                    {sub.isActive ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        SUSCRIPCIÓN ACTIVA
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-950/90 text-amber-400 border border-amber-500/40 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        VENCIDA
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Creadora */}
                <div className="p-5 pt-0 relative">
                  <div className="w-16 h-16 rounded-2xl border-4 border-slate-900 bg-slate-800 -mt-8 mb-3 overflow-hidden flex items-center justify-center shadow-lg">
                    {sub.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sub.avatarUrl}
                        alt={sub.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-black text-rose-400 uppercase">
                        {sub.displayName.charAt(0)}
                      </span>
                    )}
                  </div>

                  <h2 className="text-lg font-black text-white group-hover:text-rose-400 transition">
                    {sub.displayName}
                  </h2>
                  <p className="text-xs text-rose-400 font-mono">@{sub.username}</p>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">{sub.bio}</p>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Vence: <strong className="text-slate-200">{new Date(sub.endsAt).toLocaleDateString("es-VE")}</strong>
                    </span>
                    <span className="text-amber-400 font-bold">
                      {sub.priceKoin.toFixed(2)} KOIN
                    </span>
                  </div>
                </div>
              </div>

              {/* Botones de Acción Directa */}
              <div className="p-5 pt-0 flex items-center gap-2.5">
                <Link
                  href={`/${sub.username}`}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5"
                >
                  <span>Ver Contenido Exclusivo</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/panel/mensajes"
                  className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  title="Enviar mensaje privado"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
                  <span>Chat</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <Heart className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white">
            Aún no estás suscrito a ningún perfil
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Explora el catálogo de creadoras de KONTENIDO, suscríbete con tus KOIN y accede desde aquí directamente a todas sus fotos y videos exclusivos.
          </p>
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-600/30"
            >
              <Sparkles className="w-4 h-4" />
              Explorar Creadoras Ahora
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
