"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  Users,
  Award,
  Star,
  Coins,
  FileCheck,
  ImageIcon,
  DollarSign,
  AlertOctagon,
  Settings,
  ChevronRight,
  Percent,
  Flame,
  Loader2,
  Mail,
  Building2,
} from "lucide-react";

const NAV_LINKS = [
  { href: "/admin", label: "Resumen Global", icon: Shield, exact: true },
  { href: "/admin/usuarios", label: "Usuarios y Roles", icon: Users },
  { href: "/agencia", label: "Panel de Agencias", icon: Building2 },
  { href: "/admin/komestible", label: "KOMESTIBLE & KOINCIDEN", icon: Flame },
  { href: "/admin/comisiones", label: "Comisiones de Creadoras", icon: Percent },
  { href: "/admin/niveles", label: "Niveles (0 a 100)", icon: Award },
  { href: "/admin/membresias", label: "Membresías VIP", icon: Star },
  { href: "/admin/recargas", label: "Validar Recargas USDT", icon: Coins },
  { href: "/admin/contenido", label: "Moderación de Contenido", icon: ImageIcon },
  { href: "/admin/kyc", label: "Validación KYC Cédula", icon: FileCheck },
  { href: "/admin/payouts", label: "Cortes Semanales", icon: DollarSign },
  { href: "/admin/infracciones", label: "Infracciones Anti-Descarga", icon: AlertOctagon },
  { href: "/admin/correos", label: "Sistema de Correos", icon: Mail },
  { href: "/admin/settings", label: "Configuración General", icon: Settings },
];

export default function AdminSidebarNav() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <nav className="space-y-1">
      {NAV_LINKS.map((item) => {
        const Icon = item.icon;
        const isCurrent = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const isPending = pendingHref === item.href && !isCurrent;
        const isHighlighted = pendingHref ? pendingHref === item.href : isCurrent;

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            onClick={() => {
              if (!isCurrent) setPendingHref(item.href);
            }}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition group ${
              isHighlighted
                ? "bg-rose-600/20 text-white border border-rose-500/40 font-bold"
                : "text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon
                className={`w-4 h-4 transition ${
                  isHighlighted ? "text-rose-400" : "text-slate-400 group-hover:text-rose-400"
                }`}
              />
              <span>{item.label}</span>
            </div>
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 text-rose-400 animate-spin" />
            ) : (
              <ChevronRight
                className={`w-3.5 h-3.5 transition ${
                  isHighlighted
                    ? "text-rose-400 translate-x-0.5"
                    : "text-slate-600 group-hover:translate-x-0.5"
                }`}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
