import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  posts,
  wallets,
  subscriptions,
  users,
  paymentMethods,
  creatorSubscriptionPlans,
  messages,
} from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import Link from "next/link";
import {
  Sparkles,
  Plus,
  Image as ImageIcon,
  Video,
  Eye,
  ShieldCheck,
  Wallet,
  Settings,
  CreditCard,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import DeletePostButton from "@/components/DeletePostButton";
import CreatorPanelNav from "@/components/CreatorPanelNav";
import SocialPostComposer from "@/components/SocialPostComposer";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Estudio de Creadora | KONTENIDO",
  description: "Panel de administración y publicaciones para creadoras de contenido en Venezuela.",
};

/**
 * Panel de Control / Estudio de la Creadora (/panel)
 * Permite gestionar contenido, revisar estadísticas de suscripción, saldo KOIN y checklist OnlyFans.
 */
export default async function PanelPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/panel");
  }

  const userId = session.user.id;

  // 1. Obtener datos del usuario creador y su perfil
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      profile: true,
    },
  });

  const wallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, userId),
  });

  const creatorPosts = await db.query.posts.findMany({
    where: and(eq(posts.creatorId, userId), eq(posts.isDeleted, 0)),
    orderBy: [desc(posts.createdAt)],
    with: {
      media: true,
    },
  });

  const totalSubs = await db.$count(
    subscriptions,
    and(eq(subscriptions.creatorId, userId), eq(subscriptions.status, "ACTIVE"))
  );

  const paymentMethod = await db.query.paymentMethods.findFirst({
    where: eq(paymentMethods.creatorId, userId),
  });

  const existingPlans = await db.query.creatorSubscriptionPlans.findMany({
    where: eq(creatorSubscriptionPlans.creatorId, userId),
  });

  const unreadMessagesCount = await db.$count(
    messages,
    and(eq(messages.receiverId, userId), eq(messages.isRead, 0))
  );

  // 2. Checklist de configuración estilo OnlyFans
  const checklist = [
    {
      title: "Foto de perfil (Avatar)",
      desc: "Muestra tu rostro o imagen distintiva",
      completed: !!user?.profile?.avatarKey,
      href: "/panel/perfil",
    },
    {
      title: "Foto de portada (Banner)",
      desc: "Banner superior panorámico para tu perfil",
      completed: !!user?.profile?.bannerKey,
      href: "/panel/perfil",
    },
    {
      title: "Biografía y Nombre público",
      desc: "Escribe tu presentación para tus fans",
      completed: !!user?.profile?.bio && user.profile.bio !== "Creadora de contenido en KONTENIDO.",
      href: "/panel/perfil",
    },
    {
      title: "Validación de Cédula (KYC)",
      desc: "Verificación de mayoría de edad con cédula venezolana",
      completed: user?.kycStatus === "APPROVED",
      inReview: user?.kycStatus === "PENDING",
      href: "/panel/kyc",
    },
    {
      title: "Método de Cobro (Venezuela)",
      desc: "Configura tu PagoMóvil, Transferencia bancaria o Binance",
      completed: !!paymentMethod,
      href: "/panel/pagos",
    },
    {
      title: "Planes de Suscripción",
      desc: "Configura hasta 3 opciones de precios y duración en días",
      completed: existingPlans.length > 0,
      href: "/panel/suscripciones",
    },
  ];

  const completedSteps = checklist.filter((item) => item.completed).length;
  const progressPercent = Math.round((completedSteps / checklist.length) * 100);
  const isKycApproved = user?.kycStatus === "APPROVED";

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Subnavegador de pestañas del estudio */}
      <CreatorPanelNav
        username={session.user.username}
        kycStatus={user?.kycStatus || "NONE"}
      />

      {/* Alerta de Verificación de Cédula si aún no está aprobada */}
      {!isKycApproved && (
        <div className="mb-8 p-5 bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/50 border border-amber-500/40 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <ShieldCheck className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider rounded-md border border-amber-500/30">
                  {user?.kycStatus === "PENDING" ? "En Revisión" : "Falta Verificar"}
                </span>
                <h4 className="text-white font-bold text-sm">
                  {user?.kycStatus === "PENDING"
                    ? "Tu documento de identidad está siendo validado por el administrador"
                    : "Tu cuenta de creadora aún no ha sido verificada"}
                </h4>
              </div>
              <p className="text-amber-200/80 text-xs mt-1 leading-relaxed">
                {user?.kycStatus === "PENDING"
                  ? "Revisamos los datos extraídos de tu cédula y la selfie con documento para garantizar la seguridad de la comunidad."
                  : "Sube tu cédula de identidad venezolana para activar tu insignia de Verificada y habilitar retiros bancarios."}
              </p>
            </div>
          </div>
          <Link
            href="/panel/kyc"
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition shrink-0 shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
          >
            {user?.kycStatus === "PENDING" ? "Ver Estado KYC" : "Escanear Cédula"}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Cabecera del Estudio */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-rose-500" />
            Estudio de Creadora
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Administra tus fotos, videos, suscripciones en KOIN y retiros directos en Bolívares.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/${session.user.username}`}
            target="_blank"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Eye className="w-4 h-4 text-rose-400" />
            Ver mi Perfil Público
          </Link>
          <Link
            href="/panel/pagos"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Wallet className="w-4 h-4 text-amber-400" />
            Retiros y Pagos
          </Link>
          <Link
            href="/panel/nuevo"
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-rose-600/30"
          >
            <Plus className="w-4 h-4" />
            Nueva Publicación
          </Link>
        </div>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Saldo acumulado</span>
            <Wallet className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 flex items-center gap-1.5">
            <span>{wallet?.balanceKoin?.toFixed(2) || "0.00"}</span>
            <span className="text-sm font-bold text-amber-500/80">KOIN</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            ≈ ${(wallet?.balanceKoin || 0).toFixed(2)} USDT liquidables en Bs.
          </span>
        </div>

        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Suscriptores activos</span>
            <TrendingUp className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-white">{totalSubs}</div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            Planes activos de fans
          </span>
        </div>

        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Publicaciones</span>
            <ImageIcon className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">{creatorPosts.length}</div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            Fotos y videos en tu galería
          </span>
        </div>

        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Mensajes sin leer</span>
            <MessageCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{unreadMessagesCount}</div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            Chat 1 a 1 con tus clientes
          </span>
        </div>
      </div>

      {/* Checklist de Progreso de Configuración estilo OnlyFans */}
      {progressPercent < 100 && (
        <div className="mb-10 bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                  Paso a paso para Creadoras
                </span>
                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[11px] font-black rounded-full">
                  {completedSteps} de {checklist.length} completados
                </span>
              </div>
              <h2 className="text-lg font-black text-white mt-1">
                Configura tu perfil para empezar a monetizar
              </h2>
            </div>
            <div className="text-right sm:min-w-36">
              <span className="text-2xl font-black text-white">{progressPercent}%</span>
              <span className="text-xs text-slate-400 block">Completado</span>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Pasos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {checklist.map((item, idx) => (
              <Link
                key={idx}
                href={item.href}
                className={`p-3.5 rounded-2xl border transition flex items-start gap-3 ${
                  item.completed
                    ? "bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/60"
                    : item.inReview
                    ? "bg-amber-950/20 border-amber-500/30 hover:border-amber-500/60"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {item.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : item.inReview ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500">
                      {idx + 1}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-tight mt-0.5 line-clamp-1">
                    {item.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Editor Rápido de Publicaciones Estilo Red Social */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-rose-500" />
            Publicar Contenido Nuevo
          </h2>
          <span className="text-xs text-slate-400">
            Sube fotos o videos con emojis, etiquetas y precio PPV
          </span>
        </div>

        <SocialPostComposer
          isKycApproved={isKycApproved}
          username={session.user.username}
        />
      </div>

      {/* Listado de Publicaciones del Creador */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white tracking-tight">Tus Publicaciones</h2>
          <Link
            href={`/${session.user.username}`}
            className="text-xs text-rose-400 hover:underline flex items-center gap-1"
            target="_blank"
          >
            <Eye className="w-3.5 h-3.5" />
            Ver perfil público
          </Link>
        </div>

        {creatorPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creatorPosts.map((post) => (
              <div
                key={post.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-md hover:border-slate-700 transition"
              >
                <div className="h-48 bg-slate-950 relative flex items-center justify-center overflow-hidden">
                  {post.media && post.media.length > 0 ? (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500">
                      {post.media[0]?.type === "VIDEO" ? (
                        <div className="flex flex-col items-center gap-2">
                          <Video className="w-10 h-10 text-rose-500" />
                          <span className="text-[11px] text-slate-400 font-semibold">Video</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <ImageIcon className="w-10 h-10 text-rose-500" />
                          <span className="text-[11px] text-slate-400 font-semibold">Foto</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <ImageIcon className="w-10 h-10 text-slate-700" />
                  )}

                  <div className="absolute top-2.5 right-2.5 bg-slate-950/80 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-400 border border-amber-500/30">
                    {post.priceKoin > 0 ? `${post.priceKoin} KOIN` : "Suscripción"}
                  </div>

                  {post.media && post.media.length > 1 && (
                    <div className="absolute bottom-2.5 right-2.5 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      +{post.media.length - 1} más
                    </div>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-white font-bold text-base line-clamp-1">{post.title}</h3>
                  <p className="text-slate-400 text-xs mt-1 line-clamp-2 leading-relaxed flex-1 whitespace-pre-line">
                    {post.description || "Sin descripción."}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      {new Date(post.createdAt).toLocaleDateString("es-VE")}
                    </span>

                    {/* Botón de eliminación con advertencia de respaldo seguro */}
                    <DeletePostButton postId={post.id} postTitle={post.title} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-3xl p-8">
            <ImageIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <h3 className="text-white font-bold text-base">Aún no has publicado contenido</h3>
            <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto mb-5 leading-relaxed">
              Sube tus mejores fotografías o videos arriba para que tus fans puedan desbloquearlos o suscribirse.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
