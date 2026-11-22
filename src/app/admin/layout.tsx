import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import AdminSidebarNav from "@/components/AdminSidebarNav";

/**
 * Layout principal del panel SUPER_ADMIN (/admin)
 * Navegación completa para el CRUD total de la plataforma con feedback instantáneo.
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

        <AdminSidebarNav />
      </aside>

      {/* Contenido principal del panel */}
      <div className="flex-1 p-4 sm:p-8 overflow-x-hidden">{children}</div>
    </div>
  );
}
