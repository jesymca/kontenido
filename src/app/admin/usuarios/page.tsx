import { db } from "@/lib/db";
import { users, vipMemberships } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import AdminUsersTable from "@/components/AdminUsersTable";
import { Users, AlertCircle } from "lucide-react";
import { ensureInteractionsSchema } from "@/lib/db/initInteractions";

export const dynamic = "force-dynamic";

/**
 * Vista de Administración y CRUD de Usuarios (/admin/usuarios)
 */
export default async function AdminUsuariosPage() {
  let allUsers: any[] = [];
  let memberships: any[] = [];
  let loadError: string | null = null;

  try {
    await ensureInteractionsSchema();

    allUsers = await db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
      with: {
        profile: true,
        posts: {
          where: (p, { eq }) => eq(p.isDeleted, 0),
          orderBy: (p, { desc }) => [desc(p.createdAt)],
          with: {
            media: true,
          },
        },
      },
    });

    memberships = await db.query.vipMemberships.findMany();
  } catch (err: any) {
    console.error("Error cargando usuarios en /admin/usuarios:", err);
    loadError = err?.message || "Ocurrió un error al consultar la base de datos.";
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-rose-500" />
          Gestión y CRUD de Usuarios
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Control total: cambio de roles, modificación de niveles (0 a 100), asignación de membresías VIP y suspensión inmediata.
        </p>
      </div>

      {loadError && (
        <div className="p-4 bg-red-950/60 border border-red-500/40 rounded-2xl text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>Aviso: {loadError}</span>
        </div>
      )}

      <AdminUsersTable users={allUsers} memberships={memberships} />
    </div>
  );
}
