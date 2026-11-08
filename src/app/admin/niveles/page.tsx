import { db } from "@/lib/db";
import { userLevels } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import AdminLevelsManager from "@/components/AdminLevelsManager";
import { Award } from "lucide-react";

/**
 * Vista de Gestión y Configuración de Niveles (0 al 100) (/admin/niveles)
 * Administra la escala de inversión en USD, títulos, marcos y permiso de descarga VIP
 */
export default async function AdminNivelesPage() {
  const levels = await db.query.userLevels.findMany({
    orderBy: [asc(userLevels.levelNumber)],
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Award className="w-6 h-6 text-amber-400" />
          Escala de Niveles (0 al 100) y Marcos de Inversión
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Configuración exacta de rangos en USD, marcos visuales que preceden al nombre del usuario y montos para autorizar descargas.
        </p>
      </div>

      <AdminLevelsManager initialLevels={levels} />
    </div>
  );
}
