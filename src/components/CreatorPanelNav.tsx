"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  Settings,
  PlusCircle,
  Coins,
  Users,
  MessageCircle,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  username?: string;
  kycStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
}

/**
 * Barra de navegación principal del Estudio de Creadora estilo OnlyFans
 * Acceso directo a: Perfil, Subir Contenido, Retiros, Mensajería, Membresías de Clientes y KYC.
 */
export default function CreatorPanelNav({ username, kycStatus }: Props) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Mi Estudio",
      href: "/panel",
      icon: Sparkles,
      exact: true,
    },
    {
      label: "Subir Contenido",
      href: "/panel/nuevo",
      icon: PlusCircle,
      highlight: true,
    },
    {
      label: "Perfil y Portada",
      href: "/panel/perfil",
      icon: Settings,
    },
    {
      label: "Retiros (Bs.)",
      href: "/panel/pagos",
      icon: Coins,
    },
    {
      label: "Membresías de Clientes",
      href: "/panel/suscripciones",
      icon: Users,
    },
    {
      label: "Mensajería",
      href: "/panel/mensajes",
      icon: MessageCircle,
    },
    {
      label: "Verificación (KYC)",
      href: "/panel/kyc",
      icon: ShieldCheck,
      badge:
        kycStatus === "APPROVED"
          ? "✓"
          : kycStatus === "PENDING"
          ? "En Revisión"
          : "Falta Verificar",
      badgeColor:
        kycStatus === "APPROVED"
          ? "bg-emerald-500/20 text-emerald-400"
          : "bg-amber-500/20 text-amber-400 animate-pulse",
    },
  ];

  return (
    <div className="w-full bg-slate-900/95 border-b border-slate-800 backdrop-blur-md sticky top-16 z-30 mb-8 shadow-lg shadow-black/20">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between gap-3 overflow-x-auto py-3 scrollbar-none">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all select-none",
                    item.highlight && !isActive
                      ? "bg-rose-600/10 text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white"
                      : isActive
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/20 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1",
                        item.badgeColor
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {username && (
            <Link
              href={`/${username}`}
              target="_blank"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shrink-0 transition"
              title="Abrir tu perfil público en una nueva pestaña"
            >
              <Eye className="w-3.5 h-3.5 text-rose-400" />
              <span>Ver mi Perfil Público</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
