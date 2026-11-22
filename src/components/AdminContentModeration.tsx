"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { moderatePostAction } from "@/actions/admin";
import { deletePostWithBackupAction } from "@/actions/creator";
import {
  Check,
  X,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Film,
  Image as ImageIcon,
  ExternalLink,
  Ban,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

interface MediaItem {
  id: string;
  type: "IMAGE" | "VIDEO";
  originalKey: string;
  previewKey: string;
  moderationStatus?: "PENDING" | "OK" | "BLOCKED";
}

interface PostItem {
  id: string;
  creatorId: string;
  title: string;
  description: string | null;
  priceKoin: number;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  isDeleted: number;
  createdAt: string;
  creator: {
    username: string;
  };
  media: MediaItem[];
}

interface Props {
  posts: PostItem[];
}

const BLOCK_REASON_PRESETS = [
  "Incumplimiento de normas de contenido",
  "Contenido duplicado o de baja calidad",
  "Material no permitido o sin derechos",
  "Reportado por usuarios / en revisión",
];

function resolveMediaUrl(key?: string | null): string | null {
  if (!key) return null;
  if (key.startsWith("http://") || key.startsWith("https://") || key.startsWith("/")) {
    return key;
  }
  return `/api/media/${key}`;
}

export default function AdminContentModeration({ posts }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<PostItem[]>(posts);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "DELETED"
  >("ALL");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [blockModal, setBlockModal] = useState<{
    post: PostItem;
    reason: string;
    formError: string | null;
  } | null>(null);

  const [deleteModal, setDeleteModal] = useState<PostItem | null>(null);

  useEffect(() => {
    setItems(posts);
  }, [posts]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleApprove = async (post: PostItem) => {
    setLoadingId(post.id);
    setFeedback(null);
    try {
      const res = await moderatePostAction(post.id, "APPROVED");
      if (res?.error) {
        setFeedback({ type: "error", message: res.error });
        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? { ...item, status: "APPROVED", rejectionReason: null }
            : item
        )
      );
      setFeedback({
        type: "success",
        message: `Contenido "${post.title}" de @${post.creator.username} APROBADO y visible en la plataforma.`,
      });
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Ocurrió un error al aprobar la publicación.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleConfirmBlock = async () => {
    if (!blockModal) return;
    const trimmed = blockModal.reason.trim();
    if (!trimmed) {
      setBlockModal((prev) =>
        prev ? { ...prev, formError: "Indica el motivo del bloqueo." } : null
      );
      return;
    }

    const { post } = blockModal;
    setLoadingId(post.id);
    setFeedback(null);

    try {
      const res = await moderatePostAction(post.id, "REJECTED", trimmed);
      if (res?.error) {
        setBlockModal((prev) =>
          prev ? { ...prev, formError: res.error } : null
        );
        setFeedback({ type: "error", message: res.error });
        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? { ...item, status: "REJECTED", rejectionReason: trimmed }
            : item
        )
      );
      setBlockModal(null);
      setFeedback({
        type: "success",
        message: `Contenido "${post.title}" de @${post.creator.username} BLOQUEADO correctamente.`,
      });
      router.refresh();
    } catch {
      setBlockModal((prev) =>
        prev ? { ...prev, formError: "No se pudo bloquear el contenido." } : null
      );
    } finally {
      setLoadingId(null);
    }
  };

  const handleConfirmDeleteWithBackup = async () => {
    if (!deleteModal) return;
    const post = deleteModal;
    setLoadingId(post.id);
    setFeedback(null);

    try {
      const res = await deletePostWithBackupAction(post.id);
      if ("error" in res && res.error) {
        setFeedback({ type: "error", message: res.error });
        setDeleteModal(null);
        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === post.id ? { ...item, isDeleted: 1 } : item
        )
      );
      setDeleteModal(null);
      setFeedback({
        type: "success",
        message:
          ("message" in res && res.message) ||
          `Contenido "${post.title}" eliminado y respaldado en R2.`,
      });
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Error al eliminar el contenido.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  const pendingCount = items.filter(
    (p) => p.isDeleted === 0 && p.status === "PENDING_REVIEW"
  ).length;
  const approvedCount = items.filter(
    (p) => p.isDeleted === 0 && p.status === "APPROVED"
  ).length;
  const rejectedCount = items.filter(
    (p) => p.isDeleted === 0 && p.status === "REJECTED"
  ).length;
  const deletedCount = items.filter((p) => p.isDeleted === 1).length;

  const filteredItems = items.filter((p) => {
    if (statusFilter === "PENDING_REVIEW") {
      return p.isDeleted === 0 && p.status === "PENDING_REVIEW";
    }
    if (statusFilter === "APPROVED") {
      return p.isDeleted === 0 && p.status === "APPROVED";
    }
    if (statusFilter === "REJECTED") {
      return p.isDeleted === 0 && p.status === "REJECTED";
    }
    if (statusFilter === "DELETED") {
      return p.isDeleted === 1;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Barra de filtros por estatus */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-900/90 border border-slate-800 rounded-2xl">
        {(
          [
            { id: "ALL", label: `Todos (${items.length})` },
            { id: "PENDING_REVIEW", label: `Por Moderar (${pendingCount})` },
            { id: "APPROVED", label: `Aprobados (${approvedCount})` },
            { id: "REJECTED", label: `Bloqueados (${rejectedCount})` },
            { id: "DELETED", label: `Eliminados (${deletedCount})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === tab.id
                ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notificación in-app */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-xs sm:text-sm font-semibold shadow-lg ${
            feedback.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
              : "bg-red-950/90 border-red-500/40 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-white/10 transition shrink-0"
            aria-label="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-400 text-xs sm:text-sm">
          No hay publicaciones en esta categoría.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((post) => {
            const firstMedia = post.media?.[0];
            const mediaSrc = resolveMediaUrl(
              firstMedia?.originalKey || firstMedia?.previewKey
            );
            const isBusy = loadingId === post.id;

            return (
              <div
                key={post.id}
                className={`p-5 rounded-3xl border flex flex-col justify-between shadow-xl transition ${
                  post.isDeleted === 1
                    ? "bg-slate-950/70 border-slate-900 opacity-65"
                    : post.status === "REJECTED"
                    ? "bg-slate-900 border-red-900/60"
                    : "bg-slate-900 border-slate-800"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <Link
                      href={`/${post.creator.username}`}
                      target="_blank"
                      className="text-xs font-bold text-rose-400 hover:underline inline-flex items-center gap-1"
                    >
                      @{post.creator.username}
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </Link>

                    <div className="flex items-center gap-1.5">
                      {post.isDeleted === 1 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                          Eliminado (Respaldado)
                        </span>
                      ) : post.status === "APPROVED" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Aprobado ✓
                        </span>
                      ) : post.status === "PENDING_REVIEW" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                          Por Moderar
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                          Bloqueado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vista previa rápida del primer archivo */}
                  {mediaSrc && (
                    <div className="relative h-40 mb-3 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                      {firstMedia?.type === "VIDEO" ? (
                        <video
                          src={mediaSrc}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaSrc}
                          alt={post.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-slate-950/85 border border-slate-700/80 text-[10px] font-bold text-slate-200 inline-flex items-center gap-1">
                        {firstMedia?.type === "VIDEO" ? (
                          <>
                            <Film className="w-3 h-3 text-rose-400" />
                            Video
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-3 h-3 text-sky-400" />
                            Foto
                          </>
                        )}
                        {post.media.length > 1 && ` (+${post.media.length - 1})`}
                      </span>
                    </div>
                  )}

                  <h3 className="text-white font-bold text-sm mb-1">{post.title}</h3>
                  <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                    {post.description || "Sin descripción."}
                  </p>

                  {post.status === "REJECTED" && post.rejectionReason && post.isDeleted === 0 && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-red-950/50 border border-red-500/30 text-[11px] text-red-200">
                      <strong className="text-red-300">Motivo bloqueo:</strong> {post.rejectionReason}
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{post.media?.length || 0} archivo(s)</span>
                    <span className="font-bold text-amber-400">
                      {post.priceKoin > 0 ? `${post.priceKoin} KOIN` : "Suscripción / Gratis"}
                    </span>
                  </div>
                </div>

                {post.isDeleted === 0 && (
                  <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-800">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {post.status !== "APPROVED" ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleApprove(post)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/25 cursor-pointer disabled:opacity-50"
                          title={
                            post.status === "REJECTED"
                              ? "Reactivar y aprobar publicación"
                              : "Aprobar publicación"
                          }
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : post.status === "REJECTED" ? (
                            <RotateCcw className="w-3.5 h-3.5" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {post.status === "REJECTED" ? "Reactivar / Aprobar" : "Aprobar"}
                          </span>
                        </button>
                      ) : (
                        <span className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Publicado
                        </span>
                      )}

                      {post.status !== "REJECTED" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            setBlockModal({
                              post,
                              reason: BLOCK_REASON_PRESETS[0],
                              formError: null,
                            })
                          }
                          className="px-3 py-1.5 bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          title="Bloquear publicación"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Bloquear</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setDeleteModal(post)}
                      className="p-2 text-slate-400 hover:text-red-400 rounded-xl hover:bg-red-950/50 transition cursor-pointer disabled:opacity-50"
                      title="Eliminar de la plataforma y respaldar archivos"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal in-app para Bloquear Publicación */}
      {blockModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => {
            if (!loadingId) setBlockModal(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Bloquear Publicación</h3>
                  <p className="text-xs text-slate-400">
                    &quot;{blockModal.post.title}&quot; (@{blockModal.post.creator.username})
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(loadingId)}
                onClick={() => setBlockModal(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-300">
                Motivo del bloqueo
              </label>
              <div className="flex flex-wrap gap-1.5">
                {BLOCK_REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setBlockModal((prev) =>
                        prev ? { ...prev, reason: preset, formError: null } : null
                      )
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                      blockModal.reason.trim() === preset
                        ? "bg-red-500/20 border-red-500/50 text-red-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={blockModal.reason}
                onChange={(e) =>
                  setBlockModal((prev) =>
                    prev ? { ...prev, reason: e.target.value, formError: null } : null
                  )
                }
                placeholder="Describe el motivo del bloqueo..."
                className="w-full rounded-2xl bg-slate-950 border border-slate-800 focus:border-red-500/60 focus:outline-none px-3.5 py-2.5 text-xs text-white resize-none"
              />
            </div>

            {blockModal.formError && (
              <div className="px-3 py-2 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs font-semibold">
                {blockModal.formError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={Boolean(loadingId)}
                onClick={() => setBlockModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(loadingId)}
                onClick={handleConfirmBlock}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50"
              >
                {loadingId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Ban className="w-3.5 h-3.5" />
                )}
                <span>Confirmar Bloqueo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal in-app para Eliminar con Respaldo */}
      {deleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => {
            if (!loadingId) setDeleteModal(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Eliminar y Respaldar</h3>
                  <p className="text-xs text-slate-400">@{deleteModal.creator.username}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(loadingId)}
                onClick={() => setDeleteModal(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              ¿Deseas retirar <strong className="text-white">&quot;{deleteModal.title}&quot;</strong> de la plataforma? Los archivos multimedia se mantendrán respaldados en el almacenamiento seguro R2.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={Boolean(loadingId)}
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(loadingId)}
                onClick={handleConfirmDeleteWithBackup}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50"
              >
                {loadingId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Eliminar con Respaldo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
