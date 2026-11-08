"use client";

import { useState } from "react";
import { moderatePostAction } from "@/actions/admin";
import { deletePostWithBackupAction } from "@/actions/creator";
import { Check, X, Trash2, Eye, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";

interface PostItem {
  id: string;
  creatorId: string;
  title: string;
  description: string | null;
  priceKoin: number;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  isDeleted: number;
  createdAt: string;
  creator: {
    username: string;
  };
  media: any[];
}

interface Props {
  posts: PostItem[];
}

export default function AdminContentModeration({ posts }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleModerate = async (postId: string, status: "APPROVED" | "REJECTED") => {
    let reason: string | undefined = undefined;
    if (status === "REJECTED") {
      const r = prompt("Motivo del bloqueo / rechazo:", "Incumplimiento de normas de contenido");
      if (!r) return;
      reason = r;
    }

    setLoadingId(postId);
    try {
      await moderatePostAction(postId, status, reason);
      window.location.reload();
    } catch (e) {
      alert("Error en moderación.");
      setLoadingId(null);
    }
  };

  const handleDeleteWithBackup = async (postId: string, title: string) => {
    if (!confirm(`¿Eliminar "${title}" de la plataforma? Se conservará respaldo seguro de los archivos en R2.`)) {
      return;
    }

    setLoadingId(postId);
    try {
      const res = await deletePostWithBackupAction(postId);
      alert(res.message || "Contenido eliminado y respaldado.");
      window.location.reload();
    } catch (e) {
      alert("Error al eliminar contenido.");
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <div
            key={post.id}
            className={`p-5 rounded-3xl border flex flex-col justify-between shadow-xl transition ${
              post.isDeleted === 1
                ? "bg-slate-950/70 border-slate-900 opacity-60"
                : "bg-slate-900 border-slate-800"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <Link
                  href={`/${post.creator.username}`}
                  target="_blank"
                  className="text-xs font-bold text-rose-400 hover:underline"
                >
                  @{post.creator.username}
                </Link>

                <div className="flex items-center gap-1.5">
                  {post.isDeleted === 1 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                      Eliminado (Respaldado)
                    </span>
                  ) : post.status === "APPROVED" ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                      Aprobado
                    </span>
                  ) : post.status === "PENDING_REVIEW" ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 animate-pulse">
                      Por Moderar
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">
                      Bloqueado
                    </span>
                  )}
                </div>
              </div>

              <h3 className="text-white font-bold text-sm mb-1">{post.title}</h3>
              <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                {post.description || "Sin descripción."}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span>{post.media?.length || 0} archivo(s)</span>
                <span className="font-bold text-amber-400">{post.priceKoin} KOIN</span>
              </div>
            </div>

            {post.isDeleted === 0 && (
              <div className="flex items-center justify-between gap-2 mt-5 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={loadingId === post.id}
                    onClick={() => handleModerate(post.id, "APPROVED")}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                    title="Aprobar post"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Aprobar
                  </button>
                  <button
                    type="button"
                    disabled={loadingId === post.id}
                    onClick={() => handleModerate(post.id, "REJECTED")}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-400 rounded-lg text-xs font-bold transition flex items-center gap-1"
                    title="Bloquear post"
                  >
                    <X className="w-3.5 h-3.5" />
                    Bloquear
                  </button>
                </div>

                <button
                  type="button"
                  disabled={loadingId === post.id}
                  onClick={() => handleDeleteWithBackup(post.id, post.title)}
                  className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                  title="Eliminar de la plataforma y respaldar archivos"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
