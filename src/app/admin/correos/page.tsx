import { auth } from "@/auth";
import { db } from "@/lib/db";
import { emailLogs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { ensureEmailSchema } from "@/lib/db/initEmail";
import { getEmailSystemConfig, isResendConfigured } from "@/lib/email";
import AdminEmailManager from "@/components/AdminEmailManager";
import { Mail } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Panel de Configuración y Gestión del Sistema de Correos (/admin/correos)
 * Ubicado inmediatamente antes de /admin/settings.
 * Permite configurar remitente Resend, editar mensajes con vista previa en vivo,
 * enviar correos de prueba y revisar el historial de entregas.
 */
export default async function AdminCorreosPage() {
  await ensureEmailSchema();

  const [session, config, recentLogs] = await Promise.all([
    auth(),
    getEmailSystemConfig(),
    db.query.emailLogs
      .findMany({
        orderBy: [desc(emailLogs.createdAt)],
        limit: 50,
      })
      .catch(() => []),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Mail className="w-6 h-6 text-rose-500" />
          Sistema de Envío de Correos (Resend)
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Personaliza los correos automáticos de bienvenida, aprobación de acceso, solicitud de retiro y confirmación de pago.
        </p>
      </div>

      <AdminEmailManager
        initialConfig={config}
        initialLogs={recentLogs}
        resendConfigured={isResendConfigured()}
        adminEmail={session?.user?.email || "webmaster@kontenido.online"}
      />
    </div>
  );
}
