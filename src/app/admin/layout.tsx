import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";

/**
 * Layout principal del panel SUPER_ADMIN (/admin)
 * Navegación completa para el CRUD total de la plataforma
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  const navLinks = [
    { href: "/admin", label: "Resumen Global", icon: Shield },
    { href: "/admin/usuarios", label: "Usuarios y Roles", icon: Users },
    { href: "/admin/comisiones", label: "Comisiones de Creadoras", icon: Percent },
    { href: "/admin/niveles", label: "Niveles (0 a 100)", icon: Award },
    { href: "/admin/membresias", label: "Membresías VIP", icon: Star },
    { href: "/admin/recargas", label: "Validar Recargas USDT", icon: Coins },
    { href: "/admin/contenido", label: "Moderación de Contenido", icon: ImageIcon },
    { href: "/admin/kyc", label: "Validación KYC Cédula", icon: FileCheck },
    { href: "/admin/payouts", label: "Cortes Semanales", icon: DollarSign },
    { href: "/admin/infracciones", label: "Infracciones Anti-Descarga", icon: AlertOctagon },
    { href: "/admin/settings", label: "Configuración General", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row">
      {/* Menú lateral izquierdo */}
      <aside className="w-full md:w-64 border-r border-slate-800 bg-slate-950/70 p-4 shrink-0">
        <div className="flex items-center gap-2 px-3 py-2.5 mb-6 bg-red-950/30 border border-red-500/30 rounded-2xl">
          <Shield className="w-5 h-5 text-red-500 shrink-0" />
          <div className="overflow-hidden">
            <span className="text-xs font-black text-white uppercase tracking-wider block">
              SUPER_ADMIN
            </span>
            <span className="text-[10px] text-red-400 truncate block">
              {session.user.email}
            </span>
          </div>
        </div>

        <nav className="space-y-1">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 transition group"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-slate-400 group-hover:text-rose-400 transition" />
                  <span>{item.label}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:translate-x-0.5 transition" />
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Contenido principal del panel */}
      <div className="flex-1 p-4 sm:p-8 overflow-x-hidden">{children}</div>
    </div>
  );
}
