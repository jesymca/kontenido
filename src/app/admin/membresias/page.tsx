import { db } from "@/lib/db";
import { vipMemberships } from "@/lib/db/schema";
import AdminVipManager from "@/components/AdminVipManager";
import { Star } from "lucide-react";

/**
 * Vista de Administración y CRUD de Membresías VIP (/admin/membresias)
 * Gestiona frases distintivas (Ultra, Pro, Bronce, Silver, Golden, Platinum),
 * precios en KOIN, gradientes y permisos de descarga.
 */
export default async function AdminMembresiasPage() {
  const memberships = await db.query.vipMemberships.findMany();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Star className="w-6 h-6 text-amber-400" />
          CRUD de Membresías VIP y Badges de Distinción
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Configura membresías especiales con frases pequeñas distintivas (Ultra, Pro, Golden, etc.) y define beneficios exclusivos como descargas de contenido.
        </p>
      </div>

      <AdminVipManager initialMemberships={memberships} />
    </div>
  );
}
