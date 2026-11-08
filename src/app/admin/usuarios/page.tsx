import { db } from "@/lib/db";
import { users, vipMemberships } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import AdminUsersTable from "@/components/AdminUsersTable";
import { Users } from "lucide-react";

/**
 * Vista de Administración y CRUD de Usuarios (/admin/usuarios)
 */
export default async function AdminUsuariosPage() {
  const allUsers = await db.query.users.findMany({
    orderBy: [desc(users.createdAt)],
  });

  const memberships = await db.query.vipMemberships.findMany();

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

      <AdminUsersTable users={allUsers} memberships={memberships} />
    </div>
  );
}
