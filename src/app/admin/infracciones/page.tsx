import { db } from "@/lib/db";
import { downloadInfractions, users } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { AlertOctagon, ShieldAlert, User, CheckCircle2 } from "lucide-react";
import UserLevelBadge from "@/components/UserLevelBadge";

/**
 * Vista de Auditoría de Infracciones Anti-Descarga (/admin/infracciones)
 * Monitorea consumidores sancionados por intentar descargar o capturar fotos/videos.
 */
export default async function AdminInfraccionesPage() {
  const infractions = await db.query.downloadInfractions.findMany({
    orderBy: [desc(downloadInfractions.createdAt)],
  });

  const allUsers = await db.query.users.findMany();
  const userMap = new Map(allUsers.map((u) => [u.id, u.username]));

  const enrichedInfractions = infractions.map((item) => ({
    ...item,
    username: userMap.get(item.userId) || "Usuario",
  }));

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <AlertOctagon className="w-6 h-6 text-red-500" />
          Infracciones Anti-Descarga y Suspensiones
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Registro en tiempo real de intentos de descarga o extracción de contenido por parte de consumidores sin permiso VIP.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {enrichedInfractions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Fecha y Hora</th>
                  <th className="py-3.5 px-4">Consumidor</th>
                  <th className="py-3.5 px-4">Acción Detectada</th>
                  <th className="py-3.5 px-4">Dirección IP</th>
                  <th className="py-3.5 px-4">Sanción Aplicada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {enrichedInfractions.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(item.createdAt).toLocaleString("es-VE")}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      @{item.username}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-red-400 font-semibold">
                      {item.detectedAction}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                      {item.ipAddress || "127.0.0.1"}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.isSuspended === 1 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                          Cuenta Suspendida
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">
                          Advertencia
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 text-xs">
            No se han registrado infracciones de descarga hasta el momento.
          </div>
        )}
      </div>
    </div>
  );
}
