import { auth } from "@/auth";
import { db } from "@/lib/db";
import { posts, mediaAssets, wallets, subscriptions, users } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import Link from "next/link";
import { Sparkles, Plus, Image as ImageIcon, Video, Eye, Trash2, ShieldCheck, Wallet, Settings, FileCheck } from "lucide-react";
import DeletePostButton from "@/components/DeletePostButton";

/**
 * Panel de Control / Estudio de la Creadora (/panel)
 * Permite gestionar contenido, revisar estadísticas de suscripción y saldo KOIN.
 */
export default async function PanelPage() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;

  // Obtener datos del creador, saldo y publicaciones
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Aviso de verificación KYC si aún está pendiente */}
      {user?.kycStatus !== "APPROVED" && (
        <div className="mb-8 p-4 bg-amber-950/50 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">
                {user?.kycStatus === "PENDING"
                  ? "Verificación de cédula en revisión"
                  : "Verificación de mayoría de edad pendiente"}
              </h4>
              <p className="text-amber-200/80 text-xs mt-0.5">
                {user?.kycStatus === "PENDING"
                  ? "Tus documentos están siendo validados por el equipo administrativo."
                  : "Para recibir pagos y publicar contenido público, valida tu cédula venezolana y firma el contrato."}
              </p>
            </div>
          </div>
          {user?.kycStatus !== "PENDING" && (
            <Link
              href="/panel/kyc"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition shrink-0"
            >
              Completar KYC
            </Link>
          )}
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
            Administra tus fotos, videos, precios de suscripción y métodos de pago semanal.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/panel/perfil"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Settings className="w-4 h-4" />
            Perfil
          </Link>
          <Link
            href="/panel/pagos"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Wallet className="w-4 h-4" />
            Métodos de Cobro
          </Link>
          <Link
            href="/panel/nuevo"
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-rose-600/30"
          >
            <Plus className="w-4 h-4" />
            Subir Contenido
          </Link>
        </div>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <span className="text-slate-400 text-xs font-semibold block mb-1">Saldo acumulado</span>
          <div className="text-2xl font-black text-amber-400 flex items-center gap-1.5">
            <span>{wallet?.balanceKoin?.toFixed(2) || "0.00"}</span>
            <span className="text-sm font-bold text-amber-500/80">KOIN</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            ≈ ${(wallet?.balanceKoin || 0).toFixed(2)} USDT liquidables
          </span>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <span className="text-slate-400 text-xs font-semibold block mb-1">Suscriptores activos</span>
          <div className="text-2xl font-black text-white">{totalSubs}</div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            Cobro mensual automatizado en KOIN
          </span>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <span className="text-slate-400 text-xs font-semibold block mb-1">Publicaciones activas</span>
          <div className="text-2xl font-black text-white">{creatorPosts.length}</div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            Respaldo seguro garantizado al eliminar
          </span>
        </div>
      </div>

      {/* Lista de Publicaciones */}
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
                <div className="h-44 bg-slate-950 relative flex items-center justify-center overflow-hidden">
                  {post.media && post.media.length > 0 ? (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500">
                      {post.media[0]?.type === "VIDEO" ? (
                        <Video className="w-10 h-10 text-rose-500" />
                      ) : (
                        <ImageIcon className="w-10 h-10 text-rose-500" />
                      )}
                    </div>
                  ) : (
                    <ImageIcon className="w-10 h-10 text-slate-700" />
                  )}

                  <div className="absolute top-2.5 right-2.5 bg-slate-950/80 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-400 border border-amber-500/30">
                    {post.priceKoin > 0 ? `${post.priceKoin} KOIN` : "Suscripción"}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-white font-bold text-base line-clamp-1">{post.title}</h3>
                  <p className="text-slate-400 text-xs mt-1 line-clamp-2 leading-relaxed flex-1">
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
          <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
            <ImageIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <h3 className="text-white font-bold text-base">Aún no has publicado contenido</h3>
            <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto mb-5 leading-relaxed">
              Sube tus mejores fotografías o videos para que tus fans puedan desbloquearlos o suscribirse.
            </p>
            <Link
              href="/panel/nuevo"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-rose-600/30"
            >
              <Plus className="w-4 h-4" />
              Subir primera publicación
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
