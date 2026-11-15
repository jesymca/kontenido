"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  ImagePlus,
  CreditCard,
  MessageCircle,
  ExternalLink,
  Trash2,
} from "lucide-react";
import ProfileForm from "@/components/ProfileForm";
import SocialPostComposer from "@/components/SocialPostComposer";
import DeletePostButton from "@/components/DeletePostButton";
import CreatorPlansManager from "@/components/CreatorPlansManager";
import CreatorChatRoom, { type ConversationUser } from "@/components/CreatorChatRoom";
import type { SerializedMessage } from "@/actions/chat";
import { getCreatorCategoryMeta } from "@/lib/creatorCategories";

interface PostItem {
  id: string;
  title: string;
  description: string | null;
  priceKoin: number;
  isPublicTeaser: number;
  createdAt: string;
  mediaCount: number;
}

interface PlanItem {
  id: string;
  name: string;
  durationDays: number;
  priceKoin: number;
  description?: string | null;
  orderIndex: number;
  isActive: number;
}

interface Props {
  creator: {
    id: string;
    username: string;
    kycStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  };
  profile: {
    displayName: string;
    bio: string | null;
    subscriptionPriceKoin: number;
    creatorCategory?: string | null;
    isPublished: number;
    isAiGenerated?: number;
    avatarKey?: string | null;
    bannerKey?: string | null;
    chatPriceKoin?: number;
    chatDurationHours?: number;
  } | null;
  posts: PostItem[];
  plans: PlanItem[];
  conversations: ConversationUser[];
  initialMessages: Record<string, SerializedMessage[]>;
}

export default function AgencyCreatorWorkspace({
  creator,
  profile,
  posts,
  plans,
  conversations,
  initialMessages,
}: Props) {
  const [activeTab, setActiveTab] = useState<"perfil" | "contenido" | "planes" | "chat">("perfil");
  const catMeta = getCreatorCategoryMeta(profile?.creatorCategory);

  const tabs = [
    { id: "perfil" as const, label: "Perfil y Categoría", icon: User },
    { id: "contenido" as const, label: `Contenido (${posts.length})`, icon: ImagePlus },
    { id: "planes" as const, label: `Planes (${plans.length}/3)`, icon: CreditCard },
    { id: "chat" as const, label: "Mensajería y Tarifa Chat", icon: MessageCircle },
  ];

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-5">
        <div className="flex items-center gap-3">
          <Link
            href="/agencia"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Volver al Panel de Agencia"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-white">
                {profile?.displayName || creator.username}
              </h1>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${catMeta.badgeClass}`}>
                {catMeta.label}
              </span>
            </div>
            <p className="text-xs text-rose-400 font-mono">@{creator.username}</p>
          </div>
        </div>

        <Link
          href={`/${creator.username}`}
          target="_blank"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>Ver Perfil Público</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Pestañas */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenido de cada pestaña */}
      {activeTab === "perfil" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <ProfileForm
            profile={profile}
            username={creator.username}
            kycStatus={creator.kycStatus}
            managedCreatorId={creator.id}
          />
        </div>
      )}

      {activeTab === "contenido" && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h2 className="text-base font-black text-white mb-4">
              Publicar Nuevo Contenido para @{creator.username}
            </h2>
            <SocialPostComposer
              username={creator.username}
              isKycApproved={creator.kycStatus === "APPROVED"}
              managedCreatorId={creator.id}
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-base font-black text-white mb-4">
              Publicaciones Activas ({posts.length})
            </h3>
            {posts.length > 0 ? (
              <div className="space-y-3">
                {posts.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-white">{p.title}</h4>
                      <p className="text-xs text-slate-400">
                        {p.isPublicTeaser === 1
                          ? "Muestra Gratuita"
                          : p.priceKoin > 0
                          ? `PPV: ${p.priceKoin} KOIN`
                          : "Exclusivo Suscriptores"}{" "}
                        · {p.mediaCount} archivo(s)
                      </p>
                    </div>
                    <DeletePostButton postId={p.id} postTitle={p.title} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-6">
                Este perfil aún no tiene publicaciones.
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === "planes" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <CreatorPlansManager plans={plans} managedCreatorId={creator.id} />
        </div>
      )}

      {activeTab === "chat" && (
        <CreatorChatRoom
          currentUserId={creator.id}
          currentUserRole="CREATOR"
          currentUsername={creator.username}
          managedCreatorId={creator.id}
          conversations={conversations}
          initialMessages={initialMessages}
          creatorChatSettings={{
            priceKoin: profile?.chatPriceKoin ?? 5.0,
            durationHours: profile?.chatDurationHours ?? 168,
          }}
        />
      )}
    </div>
  );
}
