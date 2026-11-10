"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Bookmark, Sparkles, Loader2 } from "lucide-react";
import { toggleProfileLikeAction, toggleProfileFavoriteAction } from "@/actions/interactions";

interface ProfileInteractionsProps {
  creatorId: string;
  initialLikesCount: number;
  initialIsLiked: boolean;
  initialIsFavorited: boolean;
  isOwner?: boolean;
  isAuthenticated?: boolean;
}

export default function ProfileInteractions({
  creatorId,
  initialLikesCount,
  initialIsLiked,
  initialIsFavorited,
  isOwner = false,
  isAuthenticated = false,
}: ProfileInteractionsProps) {
  const router = useRouter();
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [isLikePending, startLikeTransition] = useTransition();
  const [isFavPending, startFavTransition] = useTransition();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLike = () => {
    if (!isAuthenticated) {
      router.push("/login?redirect=back");
      return;
    }
    if (isOwner) {
      showToast("Es tu propio perfil.");
      return;
    }

    // Actualización optimista
    const nextLiked = !isLiked;
    const nextCount = nextLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    setIsLiked(nextLiked);
    setLikesCount(nextCount);

    startLikeTransition(async () => {
      const res = await toggleProfileLikeAction(creatorId);
      if (res.error) {
        // Revertir en caso de error
        setIsLiked(isLiked);
        setLikesCount(likesCount);
        showToast(res.error);
      } else if (res.likesCount !== undefined) {
        setLikesCount(res.likesCount);
        setIsLiked(!!res.liked);
      }
    });
  };

  const handleFavorite = () => {
    if (!isAuthenticated) {
      router.push("/login?redirect=back");
      return;
    }
    if (isOwner) {
      showToast("Es tu propio perfil.");
      return;
    }

    // Actualización optimista
    const nextFav = !isFavorited;
    setIsFavorited(nextFav);
    showToast(nextFav ? "¡Agregada a tus Favoritos! Puedes verla en /cuenta/favoritos" : "Eliminada de tus Favoritos.");

    startFavTransition(async () => {
      const res = await toggleProfileFavoriteAction(creatorId);
      if (res.error) {
        setIsFavorited(isFavorited);
        showToast(res.error);
      } else if (res.favorited !== undefined) {
        setIsFavorited(res.favorited);
      }
    });
  };

  return (
    <div className="flex items-center gap-2 relative">
      {/* Botón ME GUSTA (Corazón) con algoritmo de posicionamiento */}
      <button
        type="button"
        onClick={handleLike}
        disabled={isLikePending}
        title={isLiked ? "Ya te gusta este perfil (clic para quitar)" : "Dar Me Gusta a este perfil"}
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition transform active:scale-95 shadow-sm border ${
          isLiked
            ? "bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30"
            : "bg-slate-800/90 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <Heart
          className={`w-4 h-4 transition-all duration-200 ${
            isLiked ? "fill-rose-500 text-rose-500 scale-110" : "text-slate-400 group-hover:text-rose-400"
          }`}
        />
        <span>{likesCount}</span>
      </button>

      {/* Botón FAVORITO (Guardar perfil de creadora) */}
      {!isOwner && (
        <button
          type="button"
          onClick={handleFavorite}
          disabled={isFavPending}
          title={isFavorited ? "Guardada en Favoritos (clic para quitar)" : "Guardar en Favoritos para seguirla o suscribirte luego"}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition transform active:scale-95 shadow-sm border ${
            isFavorited
              ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
              : "bg-slate-800/90 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <Bookmark
            className={`w-4 h-4 transition-all duration-200 ${
              isFavorited ? "fill-amber-400 text-amber-400" : "text-slate-400"
            }`}
          />
          <span className="hidden sm:inline">
            {isFavorited ? "En Favoritos" : "Favorito"}
          </span>
        </button>
      )}

      {/* Notificación flotante rápida */}
      {toastMessage && (
        <div className="absolute -top-10 left-0 bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-medium py-1 px-3 rounded-lg shadow-xl whitespace-nowrap z-30 animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
