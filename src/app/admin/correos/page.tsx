import { auth } from "@/auth";
import { db } from "@/lib/db";
import { emailLogs, users } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { ensureEmailSchema } from "@/lib/db/initEmail";
import { getEmailSystemConfig, isResendConfigured } from "@/lib/email";
import AdminEmailManager from "@/components/AdminEmailManager";
import { Mail } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Panel de Configuración y Gestión del Sistema de Correos (/admin/correos)
 * Ubicado inmediatamente antes de /admin/settings.
 * Permite configurar remitente Resend, editar plantillas con vista previa en vivo,
 * enviar correos dirigidos a cualquier usuario registrado y revisar el historial de entregas.
 */
export default async function AdminCorreosPage() {
  await ensureEmailSchema();

  const [session, config, recentLogs, registeredUsers] = await Promise.all([
    auth(),
    getEmailSystemConfig(),
    db.query.emailLogs
      .findMany({
        orderBy: [desc(emailLogs.createdAt)],
        limit: 50,
      })
      .catch(() => []),
    db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        status: users.status,
        kycStatus: users.kycStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
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
          Personaliza tus plantillas automáticas, edita el llamado a la acción (CTA) cuando quieras y envía correos directos a usuarios específicos.
        </p>
      </div>

      <AdminEmailManager
        initialConfig={config}
        initialLogs={recentLogs}
        usersList={registeredUsers}
        resendConfigured={isResendConfigured()}
        adminEmail={session?.user?.email || "webmaster@kontenido.online"}
      />
    </div>
  );
}
