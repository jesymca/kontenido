"use client";

import { useState } from "react";
import {
  MessageCircle,
  Send,
  Smile,
  Lock,
  Unlock,
  User,
  Sparkles,
  Coins,
  CheckCheck,
} from "lucide-react";
import { sendMessageAction } from "@/actions/creator";
import UserLevelBadge from "@/components/UserLevelBadge";
import { validateNoExternalContact } from "@/lib/contentFilter";
import { AlertCircle } from "lucide-react";

const CHAT_EMOJIS = ["🔥", "💋", "✨", "❤️", "😍", "😈", "👑", "📸", "💎", "🥂"];

interface MessageItem {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  mediaKey?: string | null;
  mediaType?: "IMAGE" | "VIDEO" | null;
  priceKoin: number;
  isUnlocked: number;
  isRead: number;
  createdAt: string;
}

interface ConversationUser {
  id: string;
  username: string;
  displayName?: string | null;
  level: number;
  role: string;
  lastMessage?: string;
  lastMessageTime?: string;
}

interface Props {
  currentUserId: string;
  conversations: ConversationUser[];
  initialMessages: Record<string, MessageItem[]>;
}

export default function CreatorChatRoom({
  currentUserId,
  conversations,
  initialMessages,
}: Props) {
  const [activePartnerId, setActivePartnerId] = useState<string | null>(
    conversations.length > 0 ? conversations[0].id : null
  );
  const [messagesByPartner, setMessagesByPartner] = useState(initialMessages);
  const [text, setText] = useState("");
  const [ppvPrice, setPpvPrice] = useState("0");
  const [isPpv, setIsPpv] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const activePartner = conversations.find((c) => c.id === activePartnerId);
  const currentMessages = activePartnerId ? messagesByPartner[activePartnerId] || [] : [];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePartnerId || !text.trim()) return;

    setChatError(null);
    const content = text.trim();
    const filterCheck = validateNoExternalContact(content, "El mensaje");
    if (!filterCheck.valid) {
      setChatError(
        filterCheck.error ||
          "Por seguridad no se permite compartir números de teléfono, correos ni redes externas."
      );
      return;
    }

    setSending(true);
    const priceKoin = isPpv ? parseFloat(ppvPrice) || 0 : 0;

    // Optimistic message
    const tempId = crypto.randomUUID();
    const optimisticMsg: MessageItem = {
      id: tempId,
      senderId: currentUserId,
      receiverId: activePartnerId,
      content,
      priceKoin,
      isUnlocked: priceKoin > 0 ? 0 : 1,
      isRead: 0,
      createdAt: new Date().toISOString(),
    };

    setMessagesByPartner((prev) => ({
      ...prev,
      [activePartnerId]: [...(prev[activePartnerId] || []), optimisticMsg],
    }));
    setText("");
    setIsPpv(false);
    setPpvPrice("0");
    setShowEmojis(false);

    try {
      const formData = new FormData();
      formData.set("receiverId", activePartnerId);
      formData.set("content", content);
      formData.set("priceKoin", priceKoin.toString());

      const res = await sendMessageAction(formData);
      if (res?.error) {
        setChatError(res.error);
        setMessagesByPartner((prev) => ({
          ...prev,
          [activePartnerId]: (prev[activePartnerId] || []).filter((m) => m.id !== tempId),
        }));
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[620px]">
      {/* 1. LISTA DE CONVERSACIONES (PANEL IZQUIERDO) */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/60 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-rose-500" />
            Mensajes ({conversations.length})
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          {conversations.length > 0 ? (
            conversations.map((c) => {
              const isSelected = c.id === activePartnerId;
              return (
                <div
                  key={c.id}
                  onClick={() => setActivePartnerId(c.id)}
                  className={`p-3.5 cursor-pointer transition flex items-center gap-3 ${
                    isSelected
                      ? "bg-slate-800/90 border-l-4 border-rose-500"
                      : "hover:bg-slate-800/40"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {(c.displayName || c.username)[0]?.toUpperCase() || "U"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-bold text-white truncate">
                        {c.displayName || c.username}
                      </span>
                      {c.lastMessageTime && (
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {new Date(c.lastMessageTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {c.lastMessage || `@${c.username}`}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-slate-500 text-xs">
              No tienes mensajes activos todavía.
            </div>
          )}
        </div>
      </div>

      {/* 2. CHAT ACTIVO (PANEL DERECHO) */}
      <div className="flex-1 flex flex-col bg-slate-900">
        {activePartner ? (
          <>
            {/* Cabecera del chat */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-bold text-xs shrink-0">
                  {(activePartner.displayName || activePartner.username)[0]?.toUpperCase() || "U"}
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <span>{activePartner.displayName || activePartner.username}</span>
                    <span className="text-[10px] font-mono text-slate-400 font-normal">
                      @{activePartner.username}
                    </span>
                  </h4>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    ● En línea
                  </span>
                </div>
              </div>

              <UserLevelBadge
                level={activePartner.level || 0}
                username={activePartner.username}
                role={activePartner.role}
              />
            </div>

            {/* Mensajes */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col justify-end">
              {currentMessages.length > 0 ? (
                currentMessages.map((msg) => {
                  const isMine = msg.senderId === currentUserId;
                  const isPpvLocked = msg.priceKoin > 0 && msg.isUnlocked === 0 && !isMine;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[80%] ${
                        isMine ? "ml-auto items-end" : "mr-auto items-start"
                      }`}
                    >
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-md leading-relaxed ${
                          isMine
                            ? "bg-rose-600 text-white rounded-br-xs"
                            : "bg-slate-800 text-slate-100 rounded-bl-xs border border-slate-700"
                        }`}
                      >
                        {isPpvLocked ? (
                          <div className="text-center py-2 space-y-1">
                            <Lock className="w-5 h-5 mx-auto text-amber-400" />
                            <span className="font-bold block text-white">Mensaje PPV Bloqueado</span>
                            <span className="text-[11px] text-amber-300">
                              Desbloquear por {msg.priceKoin} KOIN
                            </span>
                          </div>
                        ) : (
                          <span>{msg.content}</span>
                        )}
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
                <div className="text-center py-10 text-slate-500 text-xs">
                  Inicia la conversación enviando un mensaje o contenido exclusivo a @{activePartner.username}.
                </div>
              )}
            </div>

            {/* Barra de envío */}
            <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950/80 space-y-2">
              {chatError && (
                <div className="p-2.5 bg-red-950/70 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{chatError}</span>
                </div>
              )}
              {showEmojis && (
                <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-2 flex-wrap">
                  {CHAT_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setText((t) => t + emoji)}
                      className="text-base p-1 hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {isPpv && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mensaje de Pago por Ver:</span>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={ppvPrice}
                    onChange={(e) => setPpvPrice(e.target.value)}
                    placeholder="KOIN"
                    className="w-16 bg-slate-900 border border-amber-500/50 rounded-lg px-2 py-0.5 text-amber-400 font-bold text-xs"
                  />
                  <span>KOIN para desbloquear</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmojis(!showEmojis)}
                  className="p-2 text-slate-400 hover:text-amber-400 rounded-xl hover:bg-slate-800 transition"
                  title="Emojis"
                >
                  <Smile className="w-5 h-5 text-amber-400" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsPpv(!isPpv)}
                  className={`p-2 rounded-xl transition ${
                    isPpv
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Enviar como mensaje de pago (PPV)"
                >
                  <Lock className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Mensaje a @${activePartner.username}...`}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2 px-3.5 text-white text-xs sm:text-sm focus:border-rose-500 focus:outline-hidden"
                />

                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition disabled:opacity-50 shadow-md shadow-rose-600/30"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <MessageCircle className="w-12 h-12 text-slate-700 mb-3" />
            <h4 className="text-white font-bold text-sm">Bandeja de Mensajería</h4>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Aquí puedes chatear 1 a 1 de forma privada con tus fanáticos y suscriptores.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
