"use client";

import { useState } from "react";
import { X, ExternalLink, Image as ImageIcon, Video, Lock, Unlock, Calendar, Sparkles } from "lucide-react";
import Link from "next/link";
import MediaWatermark from "@/components/MediaWatermark";

export interface CreatorPostModalItem {
  id: string;
  title: string;
  description: string | null;
  priceKoin: number;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  createdAt: string;
  media: Array<{
    id: string;
    type: "IMAGE" | "VIDEO";
    previewKey?: string | null;
    originalKey: string;
    mimeType?: string | null;
  }>;
}

interface CreatorContentModalProps {
  username: string;
  displayName?: string | null;
  posts: CreatorPostModalItem[];
  onClose: () => void;
}

export default function CreatorContentModal({
  username,
  displayName,
  posts,
  onClose,
}: CreatorContentModalProps) {
  const [selectedPost, setSelectedPost] = useState<CreatorPostModalItem | null>(
    posts.length > 0 ? posts[0] : null
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white">
                Contenido de {displayName || username}
              </h3>
              <span className="text-xs text-rose-400 font-mono">@{username}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {posts.length} {posts.length === 1 ? "publicación registrada" : "publicaciones registradas"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/${username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-600/30"
              title="Abrir perfil público en nueva pestaña"
            >
              <span>Ver Perfil</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido / Grilla de Publicaciones */}
        {posts.length > 0 ? (
          <div className="py-4 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 pr-1">
            {posts.map((post) => {
              const firstMedia = post.media?.[0];
              const mediaUrl = firstMedia?.originalKey ? `/api/media/${firstMedia.originalKey}` : null;

              return (
                <div
                  key={post.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between hover:border-slate-700 transition"
                >
                  {/* Visualización de Media preservando aspecto vertical u horizontal */}
                  <div className="relative min-h-[240px] max-h-[380px] bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden p-2">
                    {mediaUrl ? (
                      firstMedia?.type === "VIDEO" ? (
                        <video
                          src={mediaUrl}
                          controls
                          className="max-h-[360px] w-auto max-w-full object-contain rounded-lg"
                          preload="metadata"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaUrl}
                          alt={post.title}
                          className="max-h-[360px] w-auto max-w-full object-contain rounded-lg"
                        />
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-600 p-4">
                        <ImageIcon className="w-8 h-8 mb-1" />
                        <span className="text-[11px]">Sin archivo multimedia</span>
                      </div>
                    )}

                    {/* MARCA DE AGUA OFICIAL KONTENIDO SOBRE LA FOTO/VIDEO */}
                    {mediaUrl && <MediaWatermark username={username} />}

                    {/* Badge de tipo de contenido */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      {post.priceKoin > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/90 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-400" />
                          PPV {post.priceKoin} KOIN
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <Unlock className="w-3 h-3 text-emerald-400" />
                          Suscripción
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2 right-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          post.status === "APPROVED"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : post.status === "REJECTED"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {post.status}
                      </span>
                    </div>
                  </div>

                  {/* Detalles del Post */}
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white line-clamp-1">{post.title}</h4>
                      {post.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {post.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(post.createdAt).toLocaleDateString("es-VE")}
                      </span>
                      <span>{post.media?.length || 0} archivo(s)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <Sparkles className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-medium text-slate-400">
              Esta creadora aún no ha subido publicaciones de contenido.
            </p>
          </div>
        )}

        {/* Pie del modal */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <Link
            href="/admin/contenido"
            className="text-xs text-slate-400 hover:text-white underline transition"
          >
            Ir a Moderación General de Contenidos →
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
