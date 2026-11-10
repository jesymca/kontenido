"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Heart,
  Wallet,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Bookmark,
} from "lucide-react";

export interface SubscribedCreatorItem {
  creatorId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  endsAt: string;
}

interface ConsumerPanelNavProps {
  subscriptions: SubscribedCreatorItem[];
}

/**
 * Barra de Navegación Superior para Consumidores (Fans)
 * Permite acceder rápidamente al listado de perfiles a los que está suscrito
 * el consumidor y saltar con 1 clic a ver el contenido de cada creadora.
 */
export default function ConsumerPanelNav({ subscriptions }: ConsumerPanelNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/",
      label: "Explorar Creadoras",
      icon: Compass,
      exact: true,
    },
    {
      href: "/cuenta/suscripciones",
      label: `Mis Suscripciones (${subscriptions.length})`,
      icon: Heart,
      exact: false,
    },
    {
      href: "/cuenta/favoritos",
      label: "Mis Favoritos",
      icon: Bookmark,
      exact: false,
    },
    {
      href: "/cuenta",
      label: "Billetera y VIP",
      icon: Wallet,
      exact: true,
    },
    {
      href: "/panel/mensajes",
      label: "Mensajes Privados",
      icon: MessageSquare,
      exact: false,
    },
  ];

  return (
    <div className="bg-slate-900/95 border-t border-slate-800/80">
      <div className="container mx-auto px-4 py-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
        {/* Menú Principal del Consumidor */}
        <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  isActive
                    ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Acceso Rápido Directo a los Perfiles Suscritos */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 lg:pt-0 border-t lg:border-t-0 border-slate-800/60">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3" />
            Tus Creadoras Suscritas:
          </span>

          {subscriptions.length > 0 ? (
            <div className="flex items-center gap-1.5">
              {subscriptions.map((sub) => {
                const isCurrentProfile = pathname === `/${sub.username}`;
                return (
                  <Link
                    key={sub.creatorId}
                    href={`/${sub.username}`}
                    title={`Ir al contenido de ${sub.displayName} (@${sub.username})`}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap transition border ${
                      isCurrentProfile
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                        : "bg-slate-950/90 text-slate-200 border-slate-800 hover:border-rose-500/50 hover:text-rose-300"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 text-[9px] font-black text-white flex items-center justify-center uppercase shrink-0">
                      {sub.displayName.charAt(0)}
                    </span>
                    <span className="truncate max-w-[110px]">{sub.displayName}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-60 shrink-0" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <Link
              href="/"
              className="text-[11px] text-slate-400 hover:text-rose-400 underline whitespace-nowrap"
            >
              Aún no sigues perfiles — Explorar creadoras →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
