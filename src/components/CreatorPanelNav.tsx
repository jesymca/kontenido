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
  FileCheck,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  username?: string;
  kycStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  inHeader?: boolean;
}

/**
 * Barra de navegación principal desplegada del Estudio de Creadora estilo OnlyFans
 * Se despliega de forma permanente en la navegación superior para que la creadora
 * visualice todo su menú de herramientas en cualquier momento.
 */
export default function CreatorPanelNav({ username, kycStatus, inHeader = false }: Props) {
  const pathname = usePathname();

  // Si se invoca desde el interior de una página individual, no duplicar ya que está fijo en el Navbar global
  if (!inHeader) {
    return null;
  }

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
          ? "✓ Verificada"
          : kycStatus === "PENDING"
          ? "En Revisión"
          : "Falta Verificar",
      badgeColor:
        kycStatus === "APPROVED"
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse",
    },
    {
      label: "Contrato Legal",
      href: "/panel/contrato",
      icon: FileCheck,
    },
  ];

  return (
    <div className="w-full bg-slate-900/95 border-t border-slate-800/90 backdrop-blur-md shadow-lg shadow-black/30">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between gap-3 overflow-x-auto py-2.5 scrollbar-none">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="hidden xl:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg mr-1">
              Menú Creadora
            </span>
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
                      ? "bg-rose-600/15 text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white"
                      : isActive
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/25 font-bold"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1",
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shrink-0 transition border border-slate-700"
              title="Ver cómo luce tu perfil público"
            >
              <Eye className="w-3.5 h-3.5 text-rose-400" />
              <span>Mi Perfil Público</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
