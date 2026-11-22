"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { settings, auditLog } from "@/lib/db/schema";
import { ensureEmailSchema } from "@/lib/db/initEmail";
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_ORDER,
  type EmailTemplateKey,
} from "@/lib/emailTemplates";
import { sendTestTemplateEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Acceso denegado: Se requieren permisos de SUPER_ADMIN.");
  }
  return session.user;
}

async function upsertSettingsBatch(
  items: Array<{ key: string; value: string; description?: string }>
) {
  const now = new Date().toISOString();
  await Promise.all(
    items.map((item) =>
      db
        .insert(settings)
        .values({
          key: item.key,
          value: item.value,
          description: item.description || null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: item.value,
            updatedAt: now,
          },
        })
    )
  );
}

/**
 * Guarda la configuración general del sistema de correos (Resend, remitente, logo, pie de página)
 */
export async function saveEmailGlobalConfigAction(formData: FormData) {
  try {
    const admin = await requireSuperAdmin();
    await ensureEmailSchema();

    const enabled = formData.get("email_enabled") === "1" ? "1" : "0";
    const fromName = (formData.get("email_from_name") as string)?.trim() || "KONTENIDO";
    const fromAddress =
      (formData.get("email_from_address") as string)?.trim().toLowerCase() ||
      "webmaster@kontenido.online";
    const replyTo =
      (formData.get("email_reply_to") as string)?.trim().toLowerCase() || fromAddress;
    const appUrl =
      ((formData.get("email_app_url") as string)?.trim() || "https://www.kontenido.online").replace(
        /\/+$/,
        ""
      );
    const logoUrl =
      (formData.get("email_logo_url") as string)?.trim() || `${appUrl}/img/logo.png`;
    const footerText = (formData.get("email_footer_text") as string)?.trim() || "";
    const adminNotifyEmail =
      (formData.get("email_admin_notify_address") as string)?.trim().toLowerCase() || "";

    if (!fromAddress.includes("@")) {
      return { error: "Ingresa una dirección de correo remitente válida (ej: webmaster@kontenido.online)." };
    }

    await upsertSettingsBatch([
      { key: "email_enabled", value: enabled, description: "Habilita (1) o pausa (0) el envío de correos automáticos" },
      { key: "email_from_name", value: fromName, description: "Nombre visible del remitente en correos" },
      { key: "email_from_address", value: fromAddress, description: "Dirección remitente verificada en Resend" },
      { key: "email_reply_to", value: replyTo, description: "Correo de respuesta (Reply-To)" },
      { key: "email_app_url", value: appUrl, description: "URL base para los botones de los correos" },
      { key: "email_logo_url", value: logoUrl, description: "URL del logotipo incrustado en correos" },
      { key: "email_footer_text", value: footerText, description: "Texto legal del pie de página de los correos" },
      { key: "email_admin_notify_address", value: adminNotifyEmail, description: "Correo del administrador para copia de solicitudes de retiro" },
    ]);

    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: admin.id,
      action: "EMAIL_GLOBAL_CONFIG_UPDATED",
      entity: "settings",
      entityId: "email_global",
      meta: JSON.stringify({ enabled, fromName, fromAddress, adminNotifyEmail }),
      ipAddress: "127.0.0.1",
      createdAt: new Date().toISOString(),
    });

    revalidatePath("/admin/correos");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "No se pudo guardar la configuración de correos." };
  }
}

/**
 * Guarda la personalización de una plantilla de correo específica
 */
export async function saveEmailTemplateAction(formData: FormData) {
  try {
    const admin = await requireSuperAdmin();
    await ensureEmailSchema();

    const templateKey = (formData.get("templateKey") as string)?.trim().toUpperCase() as EmailTemplateKey;
    if (!EMAIL_TEMPLATE_ORDER.includes(templateKey)) {
      return { error: "Plantilla de correo no válida." };
    }

    const enabled = formData.get("enabled") === "1" ? "1" : "0";
    const subject = (formData.get("subject") as string)?.trim();
    const badgeText = (formData.get("badgeText") as string)?.trim();
    const headline = (formData.get("headline") as string)?.trim();
    const body = (formData.get("body") as string)?.trim();
    const ctaText = (formData.get("ctaText") as string)?.trim();
    const ctaPath = (formData.get("ctaPath") as string)?.trim() || "/";

    if (!subject || !headline || !body || !ctaText) {
      return {
        error: "El asunto, titular principal, mensaje y texto del botón son obligatorios.",
      };
    }

    const prefix = `email_tpl_${templateKey.toLowerCase()}`;

    await upsertSettingsBatch([
      { key: `${prefix}_enabled`, value: enabled },
      { key: `${prefix}_subject`, value: subject },
      { key: `${prefix}_badge`, value: badgeText || DEFAULT_EMAIL_TEMPLATES[templateKey].badgeText },
      { key: `${prefix}_headline`, value: headline },
      { key: `${prefix}_body`, value: body },
      { key: `${prefix}_cta_text`, value: ctaText },
      { key: `${prefix}_cta_path`, value: ctaPath },
    ]);

    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: admin.id,
      action: "EMAIL_TEMPLATE_UPDATED",
      entity: "settings",
      entityId: prefix,
      meta: JSON.stringify({ templateKey, enabled, subject }),
      ipAddress: "127.0.0.1",
      createdAt: new Date().toISOString(),
    });

    revalidatePath("/admin/correos");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "No se pudo guardar la plantilla." };
  }
}

/**
 * Restaura los textos por defecto de una plantilla de correo
 */
export async function resetEmailTemplateAction(templateKey: EmailTemplateKey) {
  try {
    await requireSuperAdmin();
    await ensureEmailSchema();

    if (!EMAIL_TEMPLATE_ORDER.includes(templateKey)) {
      return { error: "Plantilla no válida." };
    }

    const def = DEFAULT_EMAIL_TEMPLATES[templateKey];
    const prefix = `email_tpl_${templateKey.toLowerCase()}`;

    await upsertSettingsBatch([
      { key: `${prefix}_enabled`, value: "1" },
      { key: `${prefix}_subject`, value: def.subject },
      { key: `${prefix}_badge`, value: def.badgeText },
      { key: `${prefix}_headline`, value: def.headline },
      { key: `${prefix}_body`, value: def.body },
      { key: `${prefix}_cta_text`, value: def.ctaText },
      { key: `${prefix}_cta_path`, value: def.ctaPath },
    ]);

    revalidatePath("/admin/correos");
    return { success: true, template: def };
  } catch (err: any) {
    return { error: err?.message || "No se pudo restaurar la plantilla." };
  }
}

/**
 * Envía un correo de prueba real usando Resend para validar diseño y entrega
 */
export async function sendTestEmailAction(templateKey: EmailTemplateKey, toEmail: string) {
  try {
    await requireSuperAdmin();
    await ensureEmailSchema();

    const cleanEmail = toEmail?.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { error: "Ingresa un correo electrónico de destino válido para la prueba." };
    }

    if (!EMAIL_TEMPLATE_ORDER.includes(templateKey)) {
      return { error: "Plantilla inválida." };
    }

    const res = await sendTestTemplateEmail({
      to: cleanEmail,
      templateKey,
    });

    revalidatePath("/admin/correos");

    if (!res.success) {
      return {
        error: res.error || "No se pudo enviar el correo de prueba.",
      };
    }

    return {
      success: true,
      providerId: res.providerId,
      message: `Correo de prueba enviado a ${cleanEmail} vía Resend${
        res.providerId ? ` (ID: ${res.providerId})` : ""
      }.`,
    };
  } catch (err: any) {
    return { error: err?.message || "Error inesperado enviando correo de prueba." };
  }
}
