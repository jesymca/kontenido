"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  MessageCircle,
  Send,
  Smile,
  Lock,
  Unlock,
  Coins,
  CheckCheck,
  AlertCircle,
  ImagePlus,
  Video,
  X,
  Settings,
  Clock,
  RefreshCw,
  Loader2,
  Sparkles,
  CheckCircle2,
  Eye,
} from "lucide-react";
import {
  sendChatMessageAction,
  unlockMessageAction,
  purchaseChatAccessAction,
  updateCreatorChatSettingsAction,
  getConversationMessagesAction,
  type SerializedMessage,
  type ChatMediaInput,
} from "@/actions/chat";
import UserLevelBadge from "@/components/UserLevelBadge";
import { validateNoExternalContact } from "@/lib/contentFilter";
import { watermarkImageFile } from "@/lib/watermarkClient";
import { uploadFileToR2, cloneFileIntoMemory, resolveClientMimeType } from "@/lib/uploadClient";

const CHAT_EMOJIS = ["🔥", "💋", "✨", "❤️", "😍", "😈", "👑", "📸", "💎", "🥂"];

export interface ConversationUser {
  id: string;
  username: string;
  displayName?: string | null;
  level: number;
  role: string;
  lastMessage?: string;
  lastMessageTime?: string;
  chatPriceKoin?: number;
  chatDurationHours?: number;
  chatPassEndsAt?: string | null;
}

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string;
  mediaType: "IMAGE" | "VIDEO";
}

interface Props {
  currentUserId: string;
  currentUserRole?: string;
  currentUsername?: string;
  managedCreatorId?: string;
  conversations: ConversationUser[];
  initialMessages: Record<string, SerializedMessage[]>;
  initialPartnerId?: string | null;
  creatorChatSettings?: {
    priceKoin: number;
    durationHours: number;
  };
}

function formatDurationLabel(hours: number): string {
  if (hours >= 24 && hours % 24 === 0) {
    const days = hours / 24;
    return `${days} ${days === 1 ? "día" : "días"}`;
  }
  return `${hours} ${hours === 1 ? "hora" : "horas"}`;
}

function formatMediaSummary(items: SerializedMessage["mediaItems"]): string {
  if (!items || items.length === 0) return "Contenido exclusivo";
  const photos = items.filter((i) => i.mediaType === "IMAGE").length;
  const videos = items.filter((i) => i.mediaType === "VIDEO").length;
  const parts: string[] = [];
  if (photos > 0) parts.push(`${photos} ${photos === 1 ? "Foto" : "Fotos"}`);
  if (videos > 0) parts.push(`${videos} ${videos === 1 ? "Video" : "Videos"}`);
  return parts.join(" + ");
}

export default function CreatorChatRoom({
  currentUserId,
  currentUserRole = "CONSUMER",
  currentUsername,
  managedCreatorId,
  conversations: initialConversations,
  initialMessages,
  initialPartnerId = null,
  creatorChatSettings,
}: Props) {
  const isCreator = currentUserRole === "CREATOR" || currentUserRole === "SUPER_ADMIN";

  const [conversations, setConversations] = useState<ConversationUser[]>(initialConversations);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(
    initialPartnerId && initialConversations.some((c) => c.id === initialPartnerId)
      ? initialPartnerId
      : initialConversations.length > 0
      ? initialConversations[0].id
      : null
  );
  const [messagesByPartner, setMessagesByPartner] =
    useState<Record<string, SerializedMessage[]>>(initialMessages);

  // Composer state
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isPpv, setIsPpv] = useState(false);
  const [ppvPrice, setPpvPrice] = useState("1");
  const [sending, setSending] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [needsRecharge, setNeedsRecharge] = useState(false);

  // Action states
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [buyingPass, setBuyingPass] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Creator chat fee/duration settings state
  const initialHours = creatorChatSettings?.durationHours ?? 168;
  const initialUseDays = initialHours >= 24 && initialHours % 24 === 0;
  const [showSettings, setShowSettings] = useState(false);
  const [cfgPrice, setCfgPrice] = useState(
    String(creatorChatSettings?.priceKoin ?? 5)
  );
  const [cfgDurationVal, setCfgDurationVal] = useState(
    String(initialUseDays ? initialHours / 24 : initialHours)
  );
  const [cfgDurationUnit, setCfgDurationUnit] = useState<"HOURS" | "DAYS">(
    initialUseDays ? "DAYS" : "HOURS"
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [savedRateDisplay, setSavedRateDisplay] = useState({
    priceKoin: creatorChatSettings?.priceKoin ?? 5,
    durationHours: initialHours,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePartner = conversations.find((c) => c.id === activePartnerId);
  const currentMessages = activePartnerId ? messagesByPartner[activePartnerId] || [] : [];

  const hasActivePass = (() => {
    if (isCreator) return true;
    if (!activePartner) return false;
    if (activePartner.role !== "CREATOR") return true;
    if (!activePartner.chatPassEndsAt) return false;
    return new Date(activePartner.chatPassEndsAt).getTime() > Date.now();
  })();

  const handleSelectPartner = async (partnerId: string) => {
    setActivePartnerId(partnerId);
    setChatError(null);
    setNeedsRecharge(false);
    setRefreshing(true);
    try {
      const res = await getConversationMessagesAction(partnerId, managedCreatorId);
      if (res?.success && res.messages) {
        setMessagesByPartner((prev) => ({
          ...prev,
          [partnerId]: res.messages,
        }));
      }
    } catch {
      // Silencioso
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshMessages = async () => {
    if (!activePartnerId) return;
    setRefreshing(true);
    try {
      const res = await getConversationMessagesAction(activePartnerId, managedCreatorId);
      if (res?.success && res.messages) {
        setMessagesByPartner((prev) => ({
          ...prev,
          [activePartnerId]: res.messages,
        }));
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);
    setChatError(null);

    try {
      const res = await updateCreatorChatSettingsAction({
        priceKoin: parseFloat(cfgPrice),
        durationValue: parseInt(cfgDurationVal, 10),
        durationUnit: cfgDurationUnit,
        managedCreatorId,
      });
      if (res?.error) {
        setChatError(res.error);
      } else if (res?.success) {
        setSavedRateDisplay({
          priceKoin: res.chatPriceKoin!,
          durationHours: res.chatDurationHours!,
        });
        setSettingsMsg("Tarifa y tiempo actualizados.");
        setTimeout(() => {
          setShowSettings(false);
          setSettingsMsg(null);
        }, 1200);
      }
    } catch {
      setChatError("Error al guardar configuración del chat.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawPicked = Array.from(e.target.files || []);
    if (rawPicked.length === 0) return;

    const picked = await Promise.all(rawPicked.map((f) => cloneFileIntoMemory(f)));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    const newItems: PendingAttachment[] = [];
    for (const file of picked) {
      const mime = resolveClientMimeType(file);
      const isImg = mime.startsWith("image/");
      const isVid = mime.startsWith("video/");
      if (!isImg && !isVid) continue;
      newItems.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        mediaType: isVid ? "VIDEO" : "IMAGE",
      });
    }

    setAttachments((prev) => {
      const merged = [...prev, ...newItems];
      // Sugerir 1 KOIN por foto si aún estaba en el valor inicial
      const photoCount = merged.filter((m) => m.mediaType === "IMAGE").length;
      if (photoCount > 0 && (!ppvPrice || ppvPrice === "1" || ppvPrice === "0")) {
        setPpvPrice(String(photoCount));
      }
      return merged;
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const handlePurchaseChatPass = async () => {
    if (!activePartnerId) return;
    setBuyingPass(true);
    setChatError(null);
    setNeedsRecharge(false);

    try {
      const res = await purchaseChatAccessAction(activePartnerId);
      if (res?.error) {
        setChatError(res.error);
        if (res.needsRecharge) setNeedsRecharge(true);
      } else if (res?.success && res.endsAt) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activePartnerId ? { ...c, chatPassEndsAt: res.endsAt } : c
          )
        );
      }
    } catch {
      setChatError("Error al procesar el pago del pase de chat.");
    } finally {
      setBuyingPass(false);
    }
  };

  const handleUnlockMessage = async (messageId: string) => {
    if (!activePartnerId) return;
    setUnlockingId(messageId);
    setChatError(null);
    setNeedsRecharge(false);

    try {
      const res = await unlockMessageAction(messageId);
      if (res?.error) {
        setChatError(res.error);
        if (res.needsRecharge) setNeedsRecharge(true);
      } else if (res?.success && res.message) {
        setMessagesByPartner((prev) => ({
          ...prev,
          [activePartnerId]: (prev[activePartnerId] || []).map((m) =>
            m.id === messageId ? res.message! : m
          ),
        }));
      }
    } catch {
      setChatError("Error al desbloquear el contenido.");
    } finally {
      setUnlockingId(null);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePartnerId || (!text.trim() && attachments.length === 0)) return;

    setChatError(null);
    setNeedsRecharge(false);

    const content = text.trim();
    if (content) {
      const filterCheck = validateNoExternalContact(content, "El mensaje");
      if (!filterCheck.valid) {
        setChatError(
          filterCheck.error ||
            "Por seguridad no se permite compartir números de teléfono, correos ni redes externas."
        );
        return;
      }
    }

    const parsedPrice = isCreator && isPpv ? parseFloat(ppvPrice) : 0;
    if (isCreator && isPpv && (!Number.isFinite(parsedPrice) || parsedPrice < 0.1)) {
      setChatError("Indica un precio válido en KOIN (ej: 1, 1.5, 3) o selecciona envío gratuito.");
      return;
    }

    setSending(true);

    try {
      const uploadedMedia: ChatMediaInput[] = [];

      for (let i = 0; i < attachments.length; i++) {
        const att = attachments[i];
        let file = att.file;

        if (att.mediaType === "IMAGE" && currentUsername) {
          setUploadStatus(`Firmando foto ${i + 1} de ${attachments.length}...`);
          try {
            file = await watermarkImageFile(file, currentUsername);
          } catch {
            // Continuar si falla watermark
          }
        }

        setUploadStatus(`Subiendo archivo ${i + 1} de ${attachments.length}...`);
        const uploaded = await uploadFileToR2(file, "chat");

        uploadedMedia.push({
          mediaKey: uploaded.key,
          mediaType: att.mediaType,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
        });
      }

      setUploadStatus("Enviando mensaje...");
      const res = await sendChatMessageAction({
        receiverId: activePartnerId,
        content,
        priceKoin: parsedPrice,
        mediaItems: uploadedMedia,
        managedCreatorId,
      });

      if (res?.error) {
        setChatError(res.error);
        if (res.requiresChatPass) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activePartnerId ? { ...c, chatPassEndsAt: null } : c
            )
          );
        }
      } else if (res?.success && res.message) {
        setMessagesByPartner((prev) => ({
          ...prev,
          [activePartnerId]: [...(prev[activePartnerId] || []), res.message!],
        }));
        attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
        setAttachments([]);
        setText("");
        setIsPpv(false);
        setPpvPrice("1");
        setShowEmojis(false);
      }
    } catch (err: any) {
      setChatError(err?.message || "Error al enviar el mensaje.");
    } finally {
      setSending(false);
      setUploadStatus(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* PANEL ADMINISTRATIVO DE TARIFA Y TIEMPO DEL CHAT (SOLO CREADORAS) */}
      {isCreator && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  Tarifa de Acceso al Chat para Compradores
                </h3>
                <p className="text-[11px] text-slate-400">
                  Los compradores deben pagar{" "}
                  <strong className="text-amber-400">
                    {savedRateDisplay.priceKoin} KOIN
                  </strong>{" "}
                  para chatear contigo durante{" "}
                  <strong className="text-white">
                    {formatDurationLabel(savedRateDisplay.durationHours)}
                  </strong>
                  .
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Settings className="w-3.5 h-3.5 text-rose-400" />
              {showSettings ? "Cerrar configuración" : "Configurar Tarifa y Tiempo"}
            </button>
          </div>

          {showSettings && (
            <form
              onSubmit={handleSaveSettings}
              className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Tarifa (KOIN)
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="any"
                  required
                  value={cfgPrice}
                  onChange={(e) => setCfgPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
                  placeholder="Ej: 5 o 1.5"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Tiempo de acceso
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={cfgDurationVal}
                  onChange={(e) => setCfgDurationVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Unidad de tiempo
                </label>
                <select
                  value={cfgDurationUnit}
                  onChange={(e) => setCfgDurationUnit(e.target.value as "HOURS" | "DAYS")}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
                >
                  <option value="HOURS">Horas</option>
                  <option value="DAYS">Días</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {savingSettings ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                Guardar Tarifa
              </button>

              {settingsMsg && (
                <p className="sm:col-span-4 text-xs text-emerald-400 font-semibold">
                  ✓ {settingsMsg}
                </p>
              )}
            </form>
          )}
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL DEL CHAT */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[660px]">
        {/* 1. LISTA DE CONVERSACIONES (PANEL IZQUIERDO) */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/60 flex flex-col max-h-52 md:max-h-none">
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
                    onClick={() => handleSelectPartner(c.id)}
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
                No tienes conversaciones activas todavía.
              </div>
            )}
          </div>
        </div>

        {/* 2. CHAT ACTIVO (PANEL DERECHO) */}
        <div className="flex-1 flex flex-col bg-slate-900 min-h-0">
          {activePartner ? (
            <>
              {/* Cabecera del chat */}
              <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {(activePartner.displayName || activePartner.username)[0]?.toUpperCase() ||
                      "U"}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 truncate">
                      <span className="truncate">
                        {activePartner.displayName || activePartner.username}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-normal shrink-0">
                        @{activePartner.username}
                      </span>
                    </h4>
                    {!isCreator && activePartner.role === "CREATOR" ? (
                      hasActivePass && activePartner.chatPassEndsAt ? (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                          <Clock className="w-3 h-3" />
                          Pase activo hasta{" "}
                          {new Date(activePartner.chatPassEndsAt).toLocaleString("es-VE", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400 flex items-center gap-1 font-semibold">
                          <Lock className="w-3 h-3" />
                          Chat de pago ({activePartner.chatPriceKoin ?? 5} KOIN /{" "}
                          {formatDurationLabel(activePartner.chatDurationHours ?? 168)})
                        </span>
                      )
                    ) : (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                        ● Chat privado 1 a 1
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRefreshMessages}
                    disabled={refreshing}
                    title="Actualizar mensajes"
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 transition"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-rose-400" : ""}`}
                    />
                  </button>
                  <UserLevelBadge
                    level={activePartner.level || 0}
                    username={activePartner.username}
                    role={activePartner.role}
                  />
                </div>
              </div>

              {/* Mensajes */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col">
                <div className="mt-auto" />
                {currentMessages.length > 0 ? (
                  currentMessages.map((msg) => {
                    const isMine = msg.senderId === currentUserId;
                    const isPpvLocked = msg.priceKoin > 0 && msg.isUnlocked === 0 && !isMine;
                    const hasMedia = msg.mediaItems && msg.mediaItems.length > 0;

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${
                          isMine ? "ml-auto items-end" : "mr-auto items-start"
                        }`}
                      >
                        <div
                          className={`rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-md leading-relaxed ${
                            isMine
                              ? "bg-rose-600 text-white rounded-br-xs"
                              : "bg-slate-800 text-slate-100 rounded-bl-xs border border-slate-700"
                          }`}
                        >
                          {isPpvLocked ? (
                            <div className="text-center py-2 px-2 space-y-2.5 min-w-[210px]">
                              <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto">
                                <Lock className="w-5 h-5 text-amber-400" />
                              </div>
                              <div>
                                <span className="font-black block text-white text-xs sm:text-sm">
                                  {hasMedia
                                    ? `🔒 ${formatMediaSummary(msg.mediaItems)}`
                                    : "🔒 Mensaje Exclusivo PPV"}
                                </span>
                                <span className="text-[11px] text-amber-300 block mt-0.5">
                                  Desbloquear por{" "}
                                  <strong>{msg.priceKoin} KOIN</strong>
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled={unlockingId === msg.id}
                                onClick={() => handleUnlockMessage(msg.id)}
                                className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-60"
                              >
                                {unlockingId === msg.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Unlock className="w-3.5 h-3.5" />
                                )}
                                Desbloquear ({msg.priceKoin} KOIN)
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {/* Badge de PPV si fue enviado por creadora o ya desbloqueado */}
                              {msg.priceKoin > 0 && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/25 text-[10px] font-bold text-amber-200">
                                  <Coins className="w-3 h-3 text-amber-300" />
                                  {isMine
                                    ? msg.isUnlocked === 1
                                      ? `PPV Pagado (${msg.priceKoin} KOIN)`
                                      : `PPV Pendiente (${msg.priceKoin} KOIN)`
                                    : `Desbloqueado (${msg.priceKoin} KOIN)`}
                                </div>
                              )}

                              {/* Grid multimedia (1 o más fotos/videos) */}
                              {hasMedia && (
                                <div
                                  className={`grid gap-2 ${
                                    msg.mediaItems.length === 1
                                      ? "grid-cols-1"
                                      : "grid-cols-2"
                                  }`}
                                  onContextMenu={(e) => e.preventDefault()}
                                >
                                  {msg.mediaItems.map((item) => {
                                    if (!item.mediaKey) return null;
                                    const src = `/api/media/${item.mediaKey}`;
                                    if (item.mediaType === "VIDEO") {
                                      return (
                                        <video
                                          key={item.id}
                                          src={src}
                                          controls
                                          controlsList="nodownload"
                                          disablePictureInPicture
                                          className="rounded-xl max-h-64 w-full bg-black object-contain select-none"
                                        />
                                      );
                                    }
                                    return (
                                      <div
                                        key={item.id}
                                        onClick={() => setLightboxUrl(src)}
                                        className="relative group cursor-pointer overflow-hidden rounded-xl bg-black/30"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={src}
                                          alt="Contenido de chat"
                                          draggable={false}
                                          className="rounded-xl max-h-60 w-full object-cover select-none group-hover:scale-[1.02] transition"
                                        />
                                        <span className="absolute bottom-1.5 right-1.5 p-1 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition">
                                          <Eye className="w-3.5 h-3.5" />
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {msg.content && <span>{msg.content}</span>}
                            </div>
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
                    {isCreator
                      ? `Inicia la conversación enviando un mensaje o contenido exclusivo a @${activePartner.username}.`
                      : `Aquí verás tus mensajes con @${activePartner.username}.`}
                  </div>
                )}
              </div>

              {/* BARRA INFERIOR: PAYWALL DE CHAT PARA COMPRADORES SIN PASE O COMPOSITOR */}
              {!isCreator && activePartner.role === "CREATOR" && !hasActivePass ? (
                <div className="p-4 border-t border-slate-800 bg-slate-950/90 space-y-3">
                  {chatError && (
                    <div className="p-2.5 bg-red-950/70 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{chatError}</span>
                      </div>
                      {needsRecharge && (
                        <Link
                          href="/cuenta"
                          className="px-2.5 py-1 bg-amber-500 text-slate-950 font-black rounded-lg text-[11px] shrink-0"
                        >
                          Recargar KOIN
                        </Link>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-amber-500/30 rounded-2xl p-4">
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-white">
                          Habilita el chat con @{activePartner.username}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Tarifa definida por la creadora:{" "}
                          <strong className="text-amber-400">
                            {activePartner.chatPriceKoin ?? 5} KOIN
                          </strong>{" "}
                          por{" "}
                          <strong className="text-white">
                            {formatDurationLabel(activePartner.chatDurationHours ?? 168)}
                          </strong>
                          .
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={buyingPass}
                      onClick={handlePurchaseChatPass}
                      className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                    >
                      {buyingPass ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Pagar {activePartner.chatPriceKoin ?? 5} KOIN y Chatear
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleSend}
                  className="p-3 border-t border-slate-800 bg-slate-950/80 space-y-2.5"
                >
                  {chatError && (
                    <div className="p-2.5 bg-red-950/70 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{chatError}</span>
                      </div>
                      {needsRecharge && (
                        <Link
                          href="/cuenta"
                          className="px-2.5 py-1 bg-amber-500 text-slate-950 font-black rounded-lg text-[11px] shrink-0"
                        >
                          Recargar KOIN
                        </Link>
                      )}
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

                  {/* Vista previa de archivos adjuntos (1+ fotos / 1+ videos) */}
                  {isCreator && attachments.length > 0 && (
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-300">
                        <span className="font-bold">
                          Archivos adjuntos ({attachments.length}):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
                            setAttachments([]);
                          }}
                          className="text-slate-400 hover:text-rose-400 text-[11px]"
                        >
                          Quitar todos
                        </button>
                      </div>

                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {attachments.map((att) => (
                          <div
                            key={att.id}
                            className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shrink-0"
                          >
                            {att.mediaType === "VIDEO" ? (
                              <div className="w-full h-full flex flex-col items-center justify-center text-rose-400">
                                <Video className="w-5 h-5" />
                                <span className="text-[9px] font-bold mt-0.5">VIDEO</span>
                              </div>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={att.previewUrl}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => removeAttachment(att.id)}
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-rose-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Configuración antes de enviar: Gratis vs Pago PPV */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => setIsPpv(false)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 ${
                            !isPpv
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          <Unlock className="w-3 h-3" />
                          Enviar Gratis (Sin KOIN)
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsPpv(true)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 ${
                            isPpv
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          <Lock className="w-3 h-3" />
                          Cobrar para ver (PPV)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Input de precio PPV (permite 1, 1.5, 3, etc.) */}
                  {isCreator && isPpv && (
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Precio para ver:</span>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={ppvPrice}
                        onChange={(e) => setPpvPrice(e.target.value)}
                        placeholder="1"
                        className="w-20 bg-slate-900 border border-amber-500/50 rounded-lg px-2 py-1 text-amber-400 font-bold text-xs focus:outline-none"
                      />
                      <span className="font-bold">KOIN</span>
                      <div className="flex items-center gap-1 ml-auto">
                        {["1", "1.5", "3", "5"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setPpvPrice(preset)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                              ppvPrice === preset
                                ? "bg-amber-500 text-slate-950 border-amber-400"
                                : "bg-slate-900 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      <p className="w-full text-[10px] text-amber-200/70">
                        Sugerencia: 1 KOIN por foto, o coloca cualquier valor (ej: 1.5, 3, etc.).
                      </p>
                    </div>
                  )}

                  {uploadStatus && (
                    <div className="text-[11px] text-rose-400 font-semibold flex items-center gap-1.5 px-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {uploadStatus}
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

                    {isCreator && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={handleFilePick}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 text-slate-300 hover:text-rose-400 rounded-xl hover:bg-slate-800 transition"
                          title="Adjuntar 1 o más fotos o videos"
                        >
                          <ImagePlus className="w-5 h-5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsPpv(!isPpv)}
                          className={`p-2 rounded-xl transition ${
                            isPpv
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                              : "text-slate-400 hover:text-white hover:bg-slate-800"
                          }`}
                          title="Configurar como contenido de pago (PPV)"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    <input
                      type="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={`Mensaje a @${activePartner.username}...`}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2 px-3.5 text-white text-xs sm:text-sm focus:border-rose-500 focus:outline-none"
                    />

                    <button
                      type="submit"
                      disabled={sending || (!text.trim() && attachments.length === 0)}
                      className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition disabled:opacity-50 shadow-md shadow-rose-600/30"
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
              <MessageCircle className="w-12 h-12 text-slate-700 mb-3" />
              <h4 className="text-white font-bold text-sm">Bandeja de Mensajería</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Aquí puedes chatear 1 a 1 de forma privada.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* LIGHTBOX PARA FOTOS DE CHAT */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          onContextMenu={(e) => e.preventDefault()}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-white hover:bg-rose-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Vista ampliada"
            draggable={false}
            className="max-w-full max-h-[90vh] rounded-2xl object-contain select-none"
          />
        </div>
      )}
    </div>
  );
}
