"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  MessageCircleHeart,
  Send,
  RefreshCw,
  Sparkles,
  ExternalLink,
  HeartOff,
  Flame,
  AlertCircle,
  CheckCheck,
  Smile,
  ArrowLeft,
} from "lucide-react";
import {
  getKoincidenMessagesAction,
  sendKoincidenMessageAction,
  unmatchKoincidenAction,
} from "@/actions/komestible";
import { getCountryMeta, getUserGenderMeta } from "@/lib/countries";

export interface KoincidenMatchItem {
  matchId: string;
  matchedAt: string;
  partner: {
    id: string;
    username: string;
    displayName: string;
    role: string;
    level: number;
    country: string;
    gender: string | null;
    photoKey: string | null;
  };
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface KoincidenMsgItem {
  id: string;
  matchId: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: number;
  createdAt: string;
}

interface Props {
  currentUserId: string;
  initialMatches: KoincidenMatchItem[];
  initialMessagesByMatch: Record<string, KoincidenMsgItem[]>;
  initialMatchId?: string | null;
  pendingAdmirersCount: number;
}

const QUICK_EMOJIS = ["🔥", "❤️", "😍", "😘", "✨", "🥂", "👀", "😊", "💋", "🌹"];

export default function KoincidenSpace({
  currentUserId,
  initialMatches,
  initialMessagesByMatch,
  initialMatchId = null,
  pendingAdmirersCount,
}: Props) {
  const [matches, setMatches] = useState<KoincidenMatchItem[]>(initialMatches);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(
    initialMatchId && initialMatches.some((m) => m.matchId === initialMatchId)
      ? initialMatchId
      : initialMatches[0]?.matchId || null
  );
  const [messagesByMatch, setMessagesByMatch] =
    useState<Record<string, KoincidenMsgItem[]>>(initialMessagesByMatch);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(Boolean(initialMatchId));

  const endRef = useRef<HTMLDivElement>(null);

  const activeMatch = matches.find((m) => m.matchId === activeMatchId) || null;
  const activeMessages = activeMatchId ? messagesByMatch[activeMatchId] || [] : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, activeMatchId]);

  const loadMessages = async (matchId: string, silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await getKoincidenMessagesAction(matchId);
      if (res.success && res.messages) {
        setMessagesByMatch((prev) => ({
          ...prev,
          [matchId]: res.messages!,
        }));
        setMatches((prev) =>
          prev.map((m) => (m.matchId === matchId ? { ...m, unreadCount: 0 } : m))
        );
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!activeMatchId) return;
    const timer = setInterval(() => {
      loadMessages(activeMatchId, true);
    }, 12000);
    return () => clearInterval(timer);
  }, [activeMatchId]);

  const handleSelectMatch = async (matchId: string) => {
    setActiveMatchId(matchId);
    setMobileShowChat(true);
    setErrorMsg(null);
    await loadMessages(matchId);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatchId || !text.trim() || sending) return;
    setSending(true);
    setErrorMsg(null);

    try {
      const res = await sendKoincidenMessageAction({
        matchId: activeMatchId,
        content: text.trim(),
      });

      if (res.error) {
        setErrorMsg(res.error);
        return;
      }

      if (res.success && res.message) {
        setMessagesByMatch((prev) => ({
          ...prev,
          [activeMatchId]: [...(prev[activeMatchId] || []), res.message!],
        }));
        setMatches((prev) =>
          prev.map((m) =>
            m.matchId === activeMatchId
              ? {
                  ...m,
                  lastMessage: res.message!.content,
                  lastMessageAt: res.message!.createdAt,
                }
              : m
          )
        );
        setText("");
        setShowEmojis(false);
      }
    } catch {
      setErrorMsg("Error al enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  const handleUnmatch = async (matchId: string, displayName: string) => {
    if (!confirm(`¿Seguro deseas deshacer tu KOINCIDEN con ${displayName}?`)) return;
    const res = await unmatchKoincidenAction(matchId);
    if (res.success) {
      const remaining = matches.filter((m) => m.matchId !== matchId);
      setMatches(remaining);
      setActiveMatchId(remaining[0]?.matchId || null);
      setMobileShowChat(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <MessageCircleHeart className="w-7 h-7 text-rose-500" />
            Espacio KOINCIDEN
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Tus matches mutuos de KOMESTIBLE. Chatea gratis y conecta con quienes también te dieron Like ❤️.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {pendingAdmirersCount > 0 && (
            <Link
              href="/komestible"
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-500/25 transition"
            >
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
              {pendingAdmirersCount} Likes por descubrir
            </Link>
          )}
          <Link
            href="/komestible"
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition"
          >
            <Flame className="w-4 h-4" />
            Volver a KOMESTIBLE
          </Link>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center max-w-xl mx-auto space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
            <MessageCircleHeart className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white">Aún no tienes matches en KOINCIDEN</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Cuando tú y otra persona se den <strong>Me Gusta ❤️</strong> mutuamente en{" "}
            <strong className="text-rose-400">KOMESTIBLE</strong>, aparecerán aquí automáticamente para chatear gratis.
          </p>
          <Link
            href="/komestible"
            className="inline-flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-rose-600/30 transition"
          >
            <Flame className="w-4 h-4" />
            Explorar perfiles en KOMESTIBLE
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[640px]">
          {/* LISTA DE MATCHES */}
          <div
            className={`w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/70 flex flex-col ${
              mobileShowChat ? "hidden md:flex" : "flex flex-1 md:flex-none"
            }`}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                Tus Koincidencias ({matches.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
              {matches.map((m) => {
                const isSelected = m.matchId === activeMatchId;
                return (
                  <button
                    key={m.matchId}
                    type="button"
                    onClick={() => handleSelectMatch(m.matchId)}
                    className={`w-full text-left p-3.5 flex items-center gap-3 transition ${
                      isSelected
                        ? "bg-slate-800/90 border-l-4 border-rose-500"
                        : "hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
                      {m.partner.photoKey ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/media/${m.partner.photoKey}`}
                          alt={m.partner.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-base font-black text-white">
                          {m.partner.displayName[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white truncate">
                          {m.partner.displayName}
                        </span>
                        {m.unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                            {m.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {m.lastMessage || "¡Nuevo Koinciden! Envía el primer saludo 👋"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ÁREA DE CHAT DEL MATCH */}
          <div
            className={`flex-1 flex flex-col bg-slate-900 min-h-0 ${
              mobileShowChat ? "flex" : "hidden md:flex"
            }`}
          >
            {activeMatch ? (
              <>
                <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileShowChat(false)}
                      className="md:hidden p-1.5 rounded-xl bg-slate-800 text-slate-300"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
                      {activeMatch.partner.photoKey ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/media/${activeMatch.partner.photoKey}`}
                          alt={activeMatch.partner.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-black text-white">
                          {activeMatch.partner.displayName[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-white truncate flex items-center gap-1.5">
                        <span className="truncate">{activeMatch.partner.displayName}</span>
                        <span className="text-xs font-normal text-slate-400">
                          {getCountryMeta(activeMatch.partner.country).flag}
                        </span>
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>@{activeMatch.partner.username}</span>
                        {activeMatch.partner.gender && (
                          <span>• {getUserGenderMeta(activeMatch.partner.gender).label}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {activeMatch.partner.role === "CREATOR" && (
                      <Link
                        href={`/${activeMatch.partner.username}`}
                        className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-[11px] font-bold flex items-center gap-1 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Perfil Creadora</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => loadMessages(activeMatch.matchId)}
                      disabled={refreshing}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Actualizar mensajes"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-rose-400" : ""}`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleUnmatch(activeMatch.matchId, activeMatch.partner.displayName)
                      }
                      className="p-2 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 transition"
                      title="Deshacer Koinciden"
                    >
                      <HeartOff className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Mensajes */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col">
                  <div className="mt-auto" />
                  {activeMessages.length > 0 ? (
                    activeMessages.map((msg) => {
                      const isMine = msg.senderId === currentUserId;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[82%] sm:max-w-[70%] ${
                            isMine ? "ml-auto items-end" : "mr-auto items-start"
                          }`}
                        >
                          <div
                            className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-md ${
                              isMine
                                ? "bg-rose-600 text-white rounded-br-xs"
                                : "bg-slate-800 text-slate-100 rounded-bl-xs border border-slate-700"
                            }`}
                          >
                            {msg.content}
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {isMine && <CheckCheck className="w-3 h-3 text-rose-400" />}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 text-xs text-slate-500">
                      ¡Hicieron match en KOMESTIBLE! Rompe el hielo con un saludo gratis.
                    </div>
                  )}
                  <div ref={endRef} />
                </div>

                {/* Formulario de envío */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-2.5">
                  {errorMsg && (
                    <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {showEmojis && (
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-2 flex-wrap">
                      {QUICK_EMOJIS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setText((prev) => prev + em)}
                          className="text-lg hover:scale-125 transition-transform px-1"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleSend} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEmojis(!showEmojis)}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 hover:bg-slate-800 transition"
                      title="Emojis"
                    >
                      <Smile className="w-4 h-4" />
                    </button>

                    <input
                      type="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={`Escribe un mensaje gratis a ${activeMatch.partner.displayName}...`}
                      maxLength={1000}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs sm:text-sm text-white focus:border-rose-500 focus:outline-hidden"
                    />

                    <button
                      type="submit"
                      disabled={sending || !text.trim()}
                      className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/30 disabled:opacity-50 transition"
                    >
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline">Enviar</span>
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                Selecciona una coincidencia para chatear.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
