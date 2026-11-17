"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Heart,
  X,
  Flame,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ExternalLink,
  MessageCircleHeart,
  AlertCircle,
  Lock,
  CheckCircle2,
  Bot,
} from "lucide-react";
import {
  swipeKomestibleAction,
  rateKomestiblePhotoAction,
  resetMyKomestiblePassesAction,
  type KomestibleDeckCard,
  type LikeQuotaInfo,
} from "@/actions/komestible";
import { getCountryMeta, getUserGenderMeta } from "@/lib/countries";

interface Props {
  initialCards: KomestibleDeckCard[];
  initialQuota: LikeQuotaInfo;
  onQuotaChange?: (quota: LikeQuotaInfo) => void;
  onMatchCreated?: () => void;
}

interface MatchModalData {
  matchId: string;
  username: string;
  displayName: string;
  photoKey: string | null;
  role: string;
}

export default function KomestibleSwipeDeck({
  initialCards,
  initialQuota,
  onQuotaChange,
  onMatchCreated,
}: Props) {
  const [cards, setCards] = useState<KomestibleDeckCard[]>(initialCards);
  const [photoIdxByUser, setPhotoIdxByUser] = useState<Record<string, number>>({});
  const [quota, setQuota] = useState<LikeQuotaInfo>(initialQuota);

  // Estado de drag (Tinder/Badoo Swipe Card Stack)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [flyDirection, setFlyDirection] = useState<"LEFT" | "RIGHT" | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ratingFeedback, setRatingFeedback] = useState<string | null>(null);
  const [matchModal, setMatchModal] = useState<MatchModalData | null>(null);
  const [resetting, setResetting] = useState(false);

  const pointerStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  useEffect(() => {
    setQuota(initialQuota);
  }, [initialQuota]);

  const topCard = cards[0] || null;
  const secondCard = cards[1] || null;
  const thirdCard = cards[2] || null;

  const currentPhotoIdx = topCard
    ? Math.min(photoIdxByUser[topCard.userId] || 0, Math.max(0, topCard.photos.length - 1))
    : 0;
  const currentPhoto = topCard?.photos[currentPhotoIdx] || null;

  const isLimitReached =
    quota.isLimited && quota.remaining !== null && quota.remaining <= 0;

  const cyclePhoto = (userId: string, totalPhotos: number, delta: number) => {
    if (totalPhotos <= 1) return;
    setPhotoIdxByUser((prev) => {
      const curr = prev[userId] || 0;
      const next = (curr + delta + totalPhotos) % totalPhotos;
      return { ...prev, [userId]: next };
    });
  };

  const commitSwipe = useCallback(
    async (action: "LIKE" | "PASS") => {
      if (!topCard || busy) return;

      if (action === "LIKE" && isLimitReached) {
        const periodLabel =
          quota.period === "DAILY"
            ? "hoy"
            : quota.period === "WEEKLY"
            ? "esta semana"
            : "en total";
        setErrorMsg(
          `Has alcanzado tu límite de ${quota.limit} Likes ${periodLabel} en KOMESTIBLE. Puedes seguir explorando con "Pasar" o visitar tus matches en KOINCIDEN.`
        );
        setDragOffset({ x: 0, y: 0 });
        return;
      }

      setBusy(true);
      setErrorMsg(null);
      setFlyDirection(action === "LIKE" ? "RIGHT" : "LEFT");

      const targetCard = topCard;
      const activePhoto = targetCard.photos[currentPhotoIdx] || targetCard.photos[0];

      // Pequeña pausa para animación de salida de la tarjeta
      setTimeout(async () => {
        try {
          const res = await swipeKomestibleAction({
            targetUserId: targetCard.userId,
            photoId: activePhoto?.id || null,
            action,
          });

          if (res.quota) {
            setQuota(res.quota);
            onQuotaChange?.(res.quota);
          }

          if (res.error) {
            setErrorMsg(res.error);
            setFlyDirection(null);
            setDragOffset({ x: 0, y: 0 });
            setBusy(false);
            return;
          }

          setCards((prev) => prev.filter((c) => c.userId !== targetCard.userId));
          setFlyDirection(null);
          setDragOffset({ x: 0, y: 0 });

          if (res.isMatch && res.matchedUser && res.matchId) {
            setMatchModal({
              matchId: res.matchId,
              username: res.matchedUser.username,
              displayName: res.matchedUser.displayName,
              photoKey: res.matchedUser.photoKey,
              role: res.matchedUser.role,
            });
            onMatchCreated?.();
          }
        } catch {
          setErrorMsg("Error procesando tu interacción. Intenta de nuevo.");
          setFlyDirection(null);
          setDragOffset({ x: 0, y: 0 });
        } finally {
          setBusy(false);
        }
      }, 210);
    },
    [topCard, busy, isLimitReached, quota, currentPhotoIdx, onQuotaChange, onMatchCreated]
  );

  // Atajos de teclado (Flecha izquierda = Pasar, Flecha derecha = Like)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matchModal || !topCard || busy) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        commitSwipe("PASS");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        commitSwipe("LIKE");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [matchModal, topCard, busy, commitSwipe]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (busy || flyDirection || !topCard) return;
    // Ignorar si el clic viene de botones interactivos internos
    if ((e.target as HTMLElement).closest("[data-no-swipe]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerStartRef.current = { x: e.clientX, y: e.clientY, moved: false };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !pointerStartRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      pointerStartRef.current.moved = true;
    }
    setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !pointerStartRef.current) return;
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    setIsDragging(false);

    if (!start.moved && topCard && cardRef.current) {
      // Tap simple sobre la foto: navegar entre fotos del carrusel
      const rect = cardRef.current.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      if (relX < rect.width * 0.4) {
        cyclePhoto(topCard.userId, topCard.photos.length, -1);
      } else {
        cyclePhoto(topCard.userId, topCard.photos.length, 1);
      }
      setDragOffset({ x: 0, y: 0 });
      return;
    }

    const threshold = 105;
    if (dragOffset.x > threshold) {
      commitSwipe("LIKE");
    } else if (dragOffset.x < -threshold) {
      commitSwipe("PASS");
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const handleRatePhoto = async (photoId: string, score: number) => {
    try {
      const res = await rateKomestiblePhotoAction({ photoId, score });
      if (res.error) {
        setErrorMsg(res.error);
        return;
      }
      if (res.success) {
        setCards((prev) =>
          prev.map((card) => ({
            ...card,
            photos: card.photos.map((p) =>
              p.id === photoId
                ? {
                    ...p,
                    avgRating: res.avgRating ?? p.avgRating,
                    ratingCount: res.ratingCount ?? p.ratingCount,
                    myRating: score,
                  }
                : p
            ),
          }))
        );
        setRatingFeedback(`¡Foto valorada con ${score}/5 🔥!`);
        setTimeout(() => setRatingFeedback(null), 2000);
      }
    } catch {
      setErrorMsg("Error guardando valoración.");
    }
  };

  const handleResetPasses = async () => {
    setResetting(true);
    try {
      await resetMyKomestiblePassesAction();
      window.location.reload();
    } finally {
      setResetting(false);
    }
  };

  const likeOpacity = Math.min(1, Math.max(0, (dragOffset.x - 25) / 95));
  const passOpacity = Math.min(1, Math.max(0, (-dragOffset.x - 25) / 95));

  const cardTransform =
    flyDirection === "RIGHT"
      ? "translate3d(650px, -40px, 0) rotate(22deg)"
      : flyDirection === "LEFT"
      ? "translate3d(-650px, -40px, 0) rotate(-22deg)"
      : `translate3d(${dragOffset.x}px, ${dragOffset.y * 0.3}px, 0) rotate(${dragOffset.x * 0.045}deg)`;

  return (
    <div className="flex flex-col items-center">
      {errorMsg && (
        <div className="w-full max-w-md mb-4 p-3.5 bg-red-950/70 border border-red-500/40 rounded-2xl text-red-200 text-xs flex items-start gap-2 shadow-lg">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {ratingFeedback && (
        <div className="w-full max-w-md mb-3 p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span>{ratingFeedback}</span>
        </div>
      )}

      {topCard && currentPhoto ? (
        <>
          {/* PILA DE TARJETAS DESLIZABLES (SWIPE CARD STACK) */}
          <div className="relative w-full max-w-[400px] h-[540px] sm:h-[580px] select-none touch-none">
            {/* Tarjeta 3 (fondo) */}
            {thirdCard && (
              <div className="absolute inset-0 rounded-3xl bg-slate-900 border border-slate-800/80 scale-[0.91] translate-y-6 opacity-40 pointer-events-none shadow-xl" />
            )}

            {/* Tarjeta 2 (siguiente) */}
            {secondCard && (
              <div className="absolute inset-0 rounded-3xl bg-slate-900 border border-slate-800 scale-[0.955] translate-y-3 opacity-75 pointer-events-none overflow-hidden shadow-xl">
                {secondCard.photos[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/media/${secondCard.photos[0].mediaKey}`}
                    alt={secondCard.displayName}
                    className="w-full h-full object-cover opacity-60"
                  />
                )}
              </div>
            )}

            {/* Tarjeta Principal (Draggable) */}
            <div
              ref={cardRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => {
                setIsDragging(false);
                setDragOffset({ x: 0, y: 0 });
              }}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                transform: cardTransform,
                transition: isDragging
                  ? "none"
                  : "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease",
              }}
              className="absolute inset-0 rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing"
            >
              {/* Imagen activa del carrusel */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/media/${currentPhoto.mediaKey}`}
                alt={topCard.displayName}
                draggable={false}
                className="w-full h-full object-cover select-none pointer-events-none"
              />

              {/* Gradiente superior e inferior para legibilidad */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/90 pointer-events-none" />

              {/* Indicadores superiores de fotos (estilo Badoo/Tinder) */}
              <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-1.5 pointer-events-none">
                {topCard.photos.map((ph, idx) => (
                  <div
                    key={ph.id}
                    className={`h-1 flex-1 rounded-full transition-all ${
                      idx === currentPhotoIdx
                        ? "bg-white shadow-sm"
                        : "bg-white/35"
                    }`}
                  />
                ))}
              </div>

              {/* Botones discretos de navegación de fotos */}
              {topCard.photos.length > 1 && (
                <div
                  data-no-swipe
                  className="absolute top-1/2 -translate-y-1/2 left-2 right-2 z-20 flex justify-between pointer-events-none"
                >
                  <button
                    type="button"
                    onClick={() => cyclePhoto(topCard.userId, topCard.photos.length, -1)}
                    className="pointer-events-auto p-1.5 rounded-full bg-black/45 hover:bg-black/70 text-white/90 backdrop-blur-xs transition"
                    title="Foto anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => cyclePhoto(topCard.userId, topCard.photos.length, 1)}
                    className="pointer-events-auto p-1.5 rounded-full bg-black/45 hover:bg-black/70 text-white/90 backdrop-blur-xs transition"
                    title="Siguiente foto"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Badges superiores: País, Género, Creadora */}
              <div className="absolute top-7 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/60 backdrop-blur-md text-white border border-white/15">
                    {getCountryMeta(topCard.country).flag} {getCountryMeta(topCard.country).name}
                  </span>
                  {topCard.gender && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md ${
                        getUserGenderMeta(topCard.gender).badgeClass
                      }`}
                    >
                      {getUserGenderMeta(topCard.gender).label}
                    </span>
                  )}
                  {topCard.isAiGenerated && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                      <Bot className="w-3 h-3" /> IA
                    </span>
                  )}
                </div>

                {topCard.role === "CREATOR" && (
                  <Link
                    data-no-swipe
                    href={`/${topCard.username}`}
                    className="pointer-events-auto px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-600/90 hover:bg-rose-500 text-white border border-rose-400/50 shadow-lg flex items-center gap-1 transition"
                  >
                    <Sparkles className="w-3 h-3" />
                    Creadora
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                )}
              </div>

              {/* SELLOS DINÁMICOS DE SWIPE: ME GUSTA / PASAR */}
              {likeOpacity > 0.05 && (
                <div
                  style={{ opacity: likeOpacity }}
                  className="absolute top-16 left-5 z-30 border-4 border-emerald-400 text-emerald-400 bg-black/40 backdrop-blur-xs px-4 py-1.5 rounded-2xl font-black text-2xl tracking-wider -rotate-12 pointer-events-none shadow-xl"
                >
                  ME GUSTA ❤️
                </div>
              )}

              {passOpacity > 0.05 && (
                <div
                  style={{ opacity: passOpacity }}
                  className="absolute top-16 right-5 z-30 border-4 border-rose-500 text-rose-500 bg-black/40 backdrop-blur-xs px-4 py-1.5 rounded-2xl font-black text-2xl tracking-wider rotate-12 pointer-events-none shadow-xl"
                >
                  PASAR ✕
                </div>
              )}

              {/* PIE DE TARJETA: Datos + Valoración de Foto (1-5 🔥) */}
              <div
                data-no-swipe
                className="absolute bottom-0 left-0 right-0 z-20 p-4 sm:p-5 space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xl sm:text-2xl font-black text-white leading-tight flex items-center gap-2">
                        <span>{topCard.displayName}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white/15 text-amber-300">
                          Lv.{topCard.level}
                        </span>
                      </h3>
                      <span className="text-xs font-mono text-rose-300">
                        @{topCard.username}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="px-2.5 py-1 rounded-xl bg-black/55 border border-white/15 text-xs font-black text-amber-400 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span>
                          {currentPhoto.avgRating > 0
                            ? currentPhoto.avgRating.toFixed(1)
                            : "Nueva"}
                        </span>
                        {currentPhoto.ratingCount > 0 && (
                          <span className="text-[10px] text-slate-300 font-normal">
                            ({currentPhoto.ratingCount})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {(currentPhoto.caption || topCard.bio) && (
                    <p className="text-xs text-slate-200 mt-1.5 line-clamp-2 leading-relaxed">
                      {currentPhoto.caption || topCard.bio}
                    </p>
                  )}
                </div>

                {/* Barra de Valoración de Foto (1 a 5 Llamas) */}
                <div className="p-2.5 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-200">
                    Valora esta foto:
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((score) => {
                      const active = (currentPhoto.myRating || 0) >= score;
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => handleRatePhoto(currentPhoto.id, score)}
                          className={`p-1.5 rounded-lg transition hover:scale-110 ${
                            active
                              ? "bg-amber-500/25 text-amber-400"
                              : "text-slate-400 hover:text-amber-300 hover:bg-white/10"
                          }`}
                          title={`Valorar con ${score} de 5`}
                        >
                          <Flame
                            className={`w-4 h-4 ${
                              active ? "fill-amber-400 text-amber-400" : ""
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BOTONES DE ACCIÓN BADOO DEBAJO DE LA TARJETA */}
          <div className="mt-6 flex items-center justify-center gap-5">
            <button
              type="button"
              disabled={busy}
              onClick={() => commitSwipe("PASS")}
              className="w-16 h-16 rounded-full bg-slate-900 hover:bg-slate-800 border-2 border-slate-700 hover:border-rose-500/70 text-rose-400 flex items-center justify-center shadow-xl transition hover:scale-105 active:scale-95 disabled:opacity-50"
              title="Pasar (Flecha ←)"
            >
              <X className="w-8 h-8 stroke-[2.75]" />
            </button>

            {topCard.role === "CREATOR" && (
              <Link
                href={`/${topCard.username}`}
                className="px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-lg transition hover:scale-105"
                title="Ver perfil exclusivo en KONTENIDO"
              >
                <Sparkles className="w-4 h-4" />
                <span>Perfil VIP</span>
              </Link>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => commitSwipe("LIKE")}
              className={`w-16 h-16 rounded-full border-2 flex items-center justify-center shadow-xl transition hover:scale-105 active:scale-95 disabled:opacity-50 relative ${
                isLimitReached
                  ? "bg-slate-900 border-slate-700 text-slate-500"
                  : "bg-gradient-to-br from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 border-rose-300/60 text-white shadow-rose-600/40"
              }`}
              title={
                isLimitReached
                  ? "Límite de Likes alcanzado"
                  : "Me Gusta (Flecha →)"
              }
            >
              {isLimitReached ? (
                <Lock className="w-7 h-7" />
              ) : (
                <Heart className="w-8 h-8 fill-white" />
              )}
            </button>
          </div>

          <p className="text-[11px] text-slate-500 mt-3 text-center">
            Desliza la tarjeta a la derecha para dar <strong>Me Gusta ❤️</strong> o a la izquierda para <strong>Pasar ✕</strong>. Toca los bordes de la foto para ver más fotos.
          </p>
        </>
      ) : (
        /* ESTADO SIN MÁS TARJETAS EN EL DECK */
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-white">
            ¡Viste todos los perfiles disponibles por ahora!
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            No quedan tarjetas nuevas sin evaluar con los filtros actuales. Puedes volver a revisar los perfiles que pasaste, revisar tus matches en <strong>KOINCIDEN</strong> o subir nuevas fotos tuyas.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              disabled={resetting}
              onClick={handleResetPasses}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {resetting ? "Recargando..." : "Volver a ver perfiles pasados"}
            </button>
            <Link
              href="/koinciden"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30 transition"
            >
              <MessageCircleHeart className="w-3.5 h-3.5" />
              Ir a KOINCIDEN
            </Link>
          </div>
        </div>
      )}

      {/* MODAL CELEBRACIÓN DOUBLE OPT-IN MATCH: ¡ES UN KOINCIDEN! */}
      {matchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="max-w-sm w-full bg-gradient-to-b from-slate-900 via-slate-900 to-rose-950/60 border border-rose-500/50 rounded-3xl p-7 text-center shadow-2xl relative space-y-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 text-[11px] font-black uppercase tracking-wider animate-bounce">
              <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
              Match Mutuo
            </div>

            <h2 className="text-3xl font-black bg-gradient-to-r from-rose-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
              ¡ES UN KOINCIDEN!
            </h2>

            <div className="w-28 h-28 rounded-3xl mx-auto overflow-hidden border-4 border-rose-500 shadow-2xl shadow-rose-500/30 bg-slate-800 flex items-center justify-center">
              {matchModal.photoKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/media/${matchModal.photoKey}`}
                  alt={matchModal.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-black text-white">
                  {matchModal.displayName[0]?.toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <p className="text-sm text-white font-bold">
                Tú y {matchModal.displayName} se gustaron mutuamente
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Ahora pueden encontrarse y conversar gratis en el espacio de{" "}
                <strong className="text-rose-400">KOINCIDEN</strong>.
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <Link
                href={`/koinciden?match=${matchModal.matchId}`}
                className="w-full py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition"
              >
                <MessageCircleHeart className="w-4 h-4" />
                Chatear en KOINCIDEN ahora
              </Link>

              {matchModal.role === "CREATOR" && (
                <Link
                  href={`/${matchModal.username}`}
                  className="w-full py-2.5 px-5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ver su perfil exclusivo KONTENIDO
                </Link>
              )}

              <button
                type="button"
                onClick={() => setMatchModal(null)}
                className="w-full py-2.5 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Seguir descubriendo en KOMESTIBLE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
