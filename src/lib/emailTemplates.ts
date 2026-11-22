/**
 * Registro de plantillas de correos transaccionales y motor de renderizado HTML de KONTENIDO.
 * Este módulo es puro (compatible con Cliente y Servidor) para permitir
 * vista previa HTML en vivo dentro de /admin/correos.
 */

export type EmailTemplateKey =
  | "WELCOME"
  | "ACCOUNT_APPROVED"
  | "ACCOUNT_REJECTED"
  | "PAYOUT_REQUESTED"
  | "PAYOUT_APPROVED";

export interface EmailTemplateConfig {
  key: EmailTemplateKey;
  label: string;
  description: string;
  accent: "rose" | "emerald" | "amber" | "sky";
  enabled: boolean;
  subject: string;
  badgeText: string;
  headline: string;
  body: string;
  ctaText: string;
  ctaPath: string;
  availableVars: Array<{ token: string; desc: string }>;
}

export interface EmailGlobalConfig {
  enabled: boolean;
  fromName: string;
  fromAddress: string;
  replyTo: string;
  appUrl: string;
  logoUrl: string;
  footerText: string;
  adminNotifyEmail: string;
}

export interface EmailSystemConfig {
  global: EmailGlobalConfig;
  templates: Record<EmailTemplateKey, EmailTemplateConfig>;
}

export const DEFAULT_EMAIL_GLOBAL: EmailGlobalConfig = {
  enabled: true,
  fromName: "KONTENIDO",
  fromAddress: "webmaster@kontenido.online",
  replyTo: "webmaster@kontenido.online",
  appUrl: "https://www.kontenido.online",
  logoUrl: "https://www.kontenido.online/img/logo.png",
  footerText:
    "Recibes este correo automático porque tienes una cuenta registrada en KONTENIDO. Si necesitas ayuda, responde directamente a webmaster@kontenido.online.",
  adminNotifyEmail: "",
};

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateKey, EmailTemplateConfig> = {
  WELCOME: {
    key: "WELCOME",
    label: "Bienvenida al Registrarse",
    description:
      "Se envía automáticamente cuando un nuevo usuario (Creador, Consumidor o Agencia) se registra en KONTENIDO.",
    accent: "rose",
    enabled: true,
    subject: "¡Bienvenido a KONTENIDO, {{username}}! ✨ Tu cuenta ya está lista",
    badgeText: "BIENVENIDA OFICIAL • NUEVA CUENTA",
    headline: "¡BIENVENIDO A KONTENIDO!",
    body: `Hola {{username}},

¡Qué alegría tenerte con nosotros! Tu cuenta como {{roleLabel}} en KONTENIDO ya fue creada con éxito.

A partir de ahora formas parte de nuestra comunidad exclusiva donde puedes conectar, descubrir contenido increíble, participar gratis en KOMESTIBLE & KOINCIDEN y disfrutar de pagos respaldados en KOIN (USDT y Bolívares).

Tu siguiente paso es muy sencillo: ingresa a tu cuenta, completa tu información básica de perfil y comienza a explorar todo lo que KONTENIDO tiene preparado para ti.`,
    ctaText: "Ingresar a KONTENIDO ahora →",
    ctaPath: "/login",
    availableVars: [
      { token: "{{username}}", desc: "Usuario registrado" },
      { token: "{{roleLabel}}", desc: "Tipo de cuenta (Creador / Consumidor / Agencia)" },
      { token: "{{appUrl}}", desc: "URL principal de la web" },
    ],
  },

  ACCOUNT_APPROVED: {
    key: "ACCOUNT_APPROVED",
    label: "Acceso y Estatus Aprobado",
    description:
      "Se envía cuando el estatus del usuario cambia a APROBADO / ACTIVO (aprobación automática +18 o validación del Administrador).",
    accent: "emerald",
    enabled: true,
    subject: "✅ ¡Tu acceso en KONTENIDO ha sido APROBADO, @{{username}}!",
    badgeText: "ESTATUS ACTUALIZADO • APROBADO ✓",
    headline: "¡TU ACCESO FUE APROBADO!",
    body: `Hola {{username}},

¡Excelentes noticias! Tu estatus en KONTENIDO ha cambiado oficialmente a APROBADO y ACTIVO.

{{approvalDetail}}

Ya cuentas con acceso completo dentro de la plataforma para publicar contenido exclusivo, gestionar tus suscripciones, participar en KOMESTIBLE y solicitar tus retiros sin restricciones.

Haz clic en el botón de abajo para entrar ahora mismo a tu panel.`,
    ctaText: "Entrar a mi Panel ahora →",
    ctaPath: "/panel",
    availableVars: [
      { token: "{{username}}", desc: "Usuario aprobado" },
      { token: "{{statusLabel}}", desc: "Nuevo estatus (APROBADO / ACTIVO)" },
      { token: "{{approvalDetail}}", desc: "Detalle del motivo de aprobación" },
      { token: "{{roleLabel}}", desc: "Rol del usuario" },
    ],
  },

  ACCOUNT_REJECTED: {
    key: "ACCOUNT_REJECTED",
    label: "Verificación Rechazada / Corrección",
    description:
      "Se envía si una verificación KYC es rechazada para que el usuario conozca el motivo y pueda corregir sus fotos.",
    accent: "amber",
    enabled: true,
    subject: "⚠️ Actualización sobre tu verificación en KONTENIDO (@{{username}})",
    badgeText: "ACCIÓN REQUERIDA • VERIFICACIÓN KYC",
    headline: "NECESITAMOS REVISAR TUS DOCUMENTOS",
    body: `Hola {{username}},

Tu solicitud de verificación de identidad en KONTENIDO no pudo ser aprobada en este intento.

Motivo indicado: {{reason}}

No te preocupes: puedes ingresar nuevamente a tu sección de verificación (KYC) y subir fotos nítidas y bien iluminadas para activar tu cuenta de inmediato.`,
    ctaText: "Volver a Enviar Verificación →",
    ctaPath: "/panel/kyc",
    availableVars: [
      { token: "{{username}}", desc: "Usuario" },
      { token: "{{reason}}", desc: "Motivo del rechazo" },
    ],
  },

  PAYOUT_REQUESTED: {
    key: "PAYOUT_REQUESTED",
    label: "Solicitud de Retiro Recibida",
    description:
      "Se envía automáticamente cuando una creadora solicita un retiro de sus ganancias.",
    accent: "sky",
    enabled: true,
    subject: "💸 Solicitud de retiro recibida ({{netKoin}} KOIN) — KONTENIDO",
    badgeText: "RETIRO EN PROCESO • EN ESPERA",
    headline: "RECIBIMOS TU SOLICITUD DE RETIRO",
    body: `Hola {{username}},

Hemos recibido correctamente tu solicitud de retiro de fondos en KONTENIDO. Tu saldo fue reservado de forma segura y la solicitud se encuentra actualmente EN ESPERA de liquidación por nuestro equipo administrativo.

A continuación puedes revisar el resumen completo de tu retiro. Te enviaremos otro correo automáticamente con el número de referencia tan pronto el pago sea aprobado y transferido.`,
    ctaText: "Ver Estatus de mi Retiro →",
    ctaPath: "/panel/pagos",
    availableVars: [
      { token: "{{username}}", desc: "Usuario de la creadora" },
      { token: "{{payoutRef}}", desc: "Código de solicitud" },
      { token: "{{grossKoin}}", desc: "Monto bruto solicitado en KOIN" },
      { token: "{{feePct}}", desc: "Porcentaje de comisión" },
      { token: "{{feeKoin}}", desc: "Comisión descontada en KOIN" },
      { token: "{{netKoin}}", desc: "Monto neto a recibir en KOIN" },
      { token: "{{amountVesFormatted}}", desc: "Equivalente en Bolívares (si aplica)" },
      { token: "{{paymentMethod}}", desc: "Método de cobro elegido" },
    ],
  },

  PAYOUT_APPROVED: {
    key: "PAYOUT_APPROVED",
    label: "Retiro Aprobado y Pagado",
    description:
      "Se envía automáticamente cuando el SUPER_ADMIN aprueba y liquida el retiro de dinero de la creadora.",
    accent: "emerald",
    enabled: true,
    subject: "🎉 ¡Tu retiro de {{netKoin}} KOIN fue APROBADO y PAGADO! — KONTENIDO",
    badgeText: "RETIRO APROBADO • PAGO LIQUIDADO ✓",
    headline: "¡TU RETIRO FUE APROBADO Y PAGADO!",
    body: `Hola {{username}},

¡Tu solicitud de retiro en KONTENIDO ha sido APROBADA y LIQUIDADA con éxito!

Los fondos ya fueron transferidos a tu método de cobro configurado. Debajo encontrarás tu comprobante resumido junto con el número de referencia oficial de la operación.

¡Gracias por crear contenido increíble en KONTENIDO!`,
    ctaText: "Ver mi Comprobante de Pago →",
    ctaPath: "/panel/pagos",
    availableVars: [
      { token: "{{username}}", desc: "Usuario de la creadora" },
      { token: "{{payoutRef}}", desc: "Código del retiro" },
      { token: "{{netKoin}}", desc: "Monto neto transferido en KOIN" },
      { token: "{{amountVesFormatted}}", desc: "Monto transferido en Bolívares (si aplica)" },
      { token: "{{transactionRef}}", desc: "Número de referencia / transferencia" },
      { token: "{{paymentMethod}}", desc: "Método de cobro" },
      { token: "{{paidAt}}", desc: "Fecha y hora del pago" },
    ],
  },
};

export const EMAIL_TEMPLATE_ORDER: EmailTemplateKey[] = [
  "WELCOME",
  "ACCOUNT_APPROVED",
  "PAYOUT_REQUESTED",
  "PAYOUT_APPROVED",
  "ACCOUNT_REJECTED",
];

/**
 * Datos de ejemplo para Vista Previa en vivo y Envío de Prueba desde /admin/correos
 */
export const SAMPLE_EMAIL_VARS: Record<
  EmailTemplateKey,
  {
    vars: Record<string, string>;
    highlights: Array<{ label: string; value: string; highlight?: boolean }>;
  }
> = {
  WELCOME: {
    vars: {
      username: "sofia_vip",
      roleLabel: "Creador de Contenido",
      appUrl: "https://www.kontenido.online",
    },
    highlights: [
      { label: "Usuario", value: "@sofia_vip" },
      { label: "Tipo de cuenta", value: "Creador de Contenido" },
      { label: "Estado inicial", value: "Cuenta Registrada ✓", highlight: true },
    ],
  },
  ACCOUNT_APPROVED: {
    vars: {
      username: "sofia_vip",
      statusLabel: "APROBADO / ACTIVO",
      roleLabel: "Creador de Contenido",
      approvalDetail:
        "Tu validación de identidad y mayoría de edad (+18) fue verificada exitosamente.",
    },
    highlights: [
      { label: "Usuario", value: "@sofia_vip" },
      { label: "Nuevo Estatus", value: "APROBADO Y ACTIVO ✓", highlight: true },
      { label: "Acceso", value: "Habilitado al 100%" },
    ],
  },
  ACCOUNT_REJECTED: {
    vars: {
      username: "sofia_vip",
      reason: "La fotografía frontal del documento se veía borrosa. Por favor súbela con buena luz.",
    },
    highlights: [
      { label: "Usuario", value: "@sofia_vip" },
      { label: "Estatus", value: "Requiere nueva verificación" },
    ],
  },
  PAYOUT_REQUESTED: {
    vars: {
      username: "sofia_vip",
      payoutRef: "RETIRO-8F3A21C0",
      grossKoin: "100.00",
      feePct: "15",
      feeKoin: "15.00",
      netKoin: "85.00",
      amountVesFormatted: "Bs. 87.624,80",
      paymentMethod: "PagoMóvil — Banco de Venezuela",
    },
    highlights: [
      { label: "Código de Solicitud", value: "RETIRO-8F3A21C0" },
      { label: "Monto Solicitado", value: "100.00 KOIN" },
      { label: "Comisión Aplicada", value: "15% (15.00 KOIN)" },
      { label: "Neto a Recibir", value: "85.00 KOIN (Bs. 87.624,80)", highlight: true },
      { label: "Método de Cobro", value: "PagoMóvil — Banco de Venezuela" },
      { label: "Estatus", value: "EN ESPERA DE LIQUIDACIÓN" },
    ],
  },
  PAYOUT_APPROVED: {
    vars: {
      username: "sofia_vip",
      payoutRef: "RETIRO-8F3A21C0",
      netKoin: "85.00",
      amountVesFormatted: "Bs. 87.624,80",
      transactionRef: "REF-0049281746",
      paymentMethod: "PagoMóvil — Banco de Venezuela",
      paidAt: "22/11/2026, 12:15 p. m.",
    },
    highlights: [
      { label: "Código de Retiro", value: "RETIRO-8F3A21C0" },
      { label: "Monto Pagado", value: "85.00 KOIN (Bs. 87.624,80)", highlight: true },
      { label: "Nro. de Referencia", value: "REF-0049281746", highlight: true },
      { label: "Método de Cobro", value: "PagoMóvil — Banco de Venezuela" },
      { label: "Fecha de Pago", value: "22/11/2026, 12:15 p. m." },
      { label: "Estatus", value: "APROBADO Y PAGADO ✓" },
    ],
  },
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Reemplaza variables {{token}} en texto plano (para subject)
 */
export function interpolateText(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return vars[key] !== undefined ? vars[key] : "";
  });
}

/**
 * Convierte el cuerpo editable en párrafos HTML limpios y seguros
 */
function renderBodyParagraphs(bodyText: string, vars: Record<string, string>): string {
  const interpolated = interpolateText(bodyText, vars).trim();
  const paragraphs = interpolated
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs
    .map((p) => {
      const safe = escapeHtml(p).replace(/\n/g, "<br />");
      return `<p style="margin:0 0 16px 0;color:#cbd5e1;font-size:15px;line-height:1.65;">${safe}</p>`;
    })
    .join("");
}

/**
 * Genera el HTML completo y responsive del correo con identidad visual oficial de KONTENIDO.
 */
export function buildKontenidoEmailHtml(params: {
  global: EmailGlobalConfig;
  template: EmailTemplateConfig;
  vars: Record<string, string>;
  ctaUrlOverride?: string;
  highlights?: Array<{ label: string; value: string; highlight?: boolean }>;
}): { subject: string; html: string; text: string } {
  const { global, template, vars, ctaUrlOverride, highlights } = params;

  const baseAppUrl = (global.appUrl || DEFAULT_EMAIL_GLOBAL.appUrl).replace(/\/+$/, "");
  const allVars: Record<string, string> = {
    appUrl: baseAppUrl,
    ...vars,
  };

  const subject = interpolateText(template.subject, allVars);
  const badgeText = escapeHtml(interpolateText(template.badgeText, allVars));
  const headline = escapeHtml(interpolateText(template.headline, allVars));
  const ctaText = escapeHtml(interpolateText(template.ctaText, allVars));
  const bodyHtml = renderBodyParagraphs(template.body, allVars);
  const footerText = escapeHtml(interpolateText(global.footerText, allVars));

  const resolvedCtaPath = template.ctaPath.startsWith("http")
    ? template.ctaPath
    : `${baseAppUrl}${template.ctaPath.startsWith("/") ? "" : "/"}${template.ctaPath}`;
  const ctaUrl = ctaUrlOverride || resolvedCtaPath;
  const safeCtaUrl = escapeHtml(ctaUrl);
  const safeLogoUrl = escapeHtml(global.logoUrl || `${baseAppUrl}/img/logo.png`);
  const year = new Date().getFullYear();

  const accentPalette = {
    rose: {
      gradient: "linear-gradient(135deg, #e11d48 0%, #ec4899 55%, #f59e0b 100%)",
      badgeBg: "#3b0a1d",
      badgeBorder: "#f43f5e",
      badgeColor: "#fda4af",
      btnBg: "#e11d48",
      highlightColor: "#fda4af",
    },
    emerald: {
      gradient: "linear-gradient(135deg, #059669 0%, #10b981 55%, #06b6d4 100%)",
      badgeBg: "#052e22",
      badgeBorder: "#10b981",
      badgeColor: "#6ee7b7",
      btnBg: "#059669",
      highlightColor: "#6ee7b7",
    },
    amber: {
      gradient: "linear-gradient(135deg, #d97706 0%, #f59e0b 55%, #e11d48 100%)",
      badgeBg: "#3b1d06",
      badgeBorder: "#f59e0b",
      badgeColor: "#fcd34d",
      btnBg: "#d97706",
      highlightColor: "#fcd34d",
    },
    sky: {
      gradient: "linear-gradient(135deg, #0284c7 0%, #6366f1 55%, #ec4899 100%)",
      badgeBg: "#08243d",
      badgeBorder: "#38bdf8",
      badgeColor: "#7dd3fc",
      btnBg: "#e11d48",
      highlightColor: "#7dd3fc",
    },
  }[template.accent || "rose"];

  const highlightsHtml =
    highlights && highlights.length > 0
      ? `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0 24px 0;background-color:#020617;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:16px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${highlights
                  .map(
                    (row, idx) => `
                  <tr>
                    <td style="padding:7px 0;color:#94a3b8;font-size:13px;font-weight:600;${
                      idx < highlights.length - 1 ? "border-bottom:1px solid #0f172a;" : ""
                    }">${escapeHtml(row.label)}</td>
                    <td align="right" style="padding:7px 0;font-size:13px;font-weight:${
                      row.highlight ? "800" : "700"
                    };color:${row.highlight ? accentPalette.highlightColor : "#f8fafc"};${
                      idx < highlights.length - 1 ? "border-bottom:1px solid #0f172a;" : ""
                    }">${escapeHtml(row.value)}</td>
                  </tr>
                `
                  )
                  .join("")}
              </table>
            </td>
          </tr>
        </table>
      `
      : "";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#020617;padding:32px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#0f172a;border:1px solid #1e293b;border-radius:24px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.6);">
          <!-- Banda superior gradiente de marca -->
          <tr>
            <td style="height:6px;background:${accentPalette.gradient};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Cabecera con Logo Oficial KONTENIDO -->
          <tr>
            <td align="center" style="padding:32px 28px 18px 28px;background:radial-gradient(circle at top center, rgba(225,29,72,0.16), rgba(15,23,42,0) 70%);">
              <a href="${escapeHtml(baseAppUrl)}" target="_blank" style="text-decoration:none;display:inline-block;">
                <img src="${safeLogoUrl}" alt="KONTENIDO" width="190" style="display:block;max-width:190px;height:auto;border:0;margin:0 auto 18px auto;" />
              </a>

              <div style="display:inline-block;padding:6px 14px;border-radius:999px;background-color:${accentPalette.badgeBg};border:1px solid ${accentPalette.badgeBorder};color:${accentPalette.badgeColor};font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">
                ${badgeText}
              </div>

              <h1 style="margin:18px 0 0 0;color:#ffffff;font-size:26px;line-height:1.25;font-weight:900;letter-spacing:-0.02em;">
                ${headline}
              </h1>
            </td>
          </tr>

          <!-- Cuerpo principal -->
          <tr>
            <td style="padding:10px 30px 30px 30px;">
              ${bodyHtml}
              ${highlightsHtml}

              <!-- Botón de Llamado a la Acción (CTA) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 18px 0;">
                <tr>
                  <td align="center">
                    <a href="${safeCtaUrl}" target="_blank" style="display:inline-block;padding:15px 34px;border-radius:14px;background-color:${accentPalette.btnBg};background:${accentPalette.gradient};color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:0.01em;box-shadow:0 10px 25px rgba(225,29,72,0.35);">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;text-align:center;color:#64748b;font-size:12px;line-height:1.5;">
                Si el botón no abre automáticamente, copia y pega este enlace en tu navegador:<br />
                <a href="${safeCtaUrl}" target="_blank" style="color:#fb7185;text-decoration:underline;word-break:break-all;">${safeCtaUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Pie de página -->
          <tr>
            <td style="padding:22px 28px;background-color:#020617;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0 0 8px 0;color:#94a3b8;font-size:12px;line-height:1.55;">
                ${footerText}
              </p>
              <p style="margin:0;color:#475569;font-size:11px;">
                © ${year} KONTENIDO • <a href="${escapeHtml(baseAppUrl)}" style="color:#94a3b8;text-decoration:none;">www.kontenido.online</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const plainHighlights =
    highlights && highlights.length > 0
      ? `\n\n${highlights.map((h) => `- ${h.label}: ${h.value}`).join("\n")}`
      : "";
  const text = `${interpolateText(template.headline, allVars)}\n\n${interpolateText(
    template.body,
    allVars
  )}${plainHighlights}\n\n${interpolateText(template.ctaText, allVars)}: ${ctaUrl}\n\n${interpolateText(
    global.footerText,
    allVars
  )}`;

  return { subject, html, text };
}

/**
 * Reconstruye la configuración completa de correos combinando los valores de la tabla settings
 * con los valores por defecto.
 */
export function resolveEmailSystemConfigFromSettingsMap(
  settingsMap: Map<string, string>,
  envOverrides?: { fromEmail?: string; appUrl?: string }
): EmailSystemConfig {
  const defaultAppUrl = (
    envOverrides?.appUrl || DEFAULT_EMAIL_GLOBAL.appUrl
  ).replace(/\/+$/, "");

  const global: EmailGlobalConfig = {
    enabled: settingsMap.get("email_enabled") !== "0",
    fromName: settingsMap.get("email_from_name") || DEFAULT_EMAIL_GLOBAL.fromName,
    fromAddress:
      settingsMap.get("email_from_address") ||
      envOverrides?.fromEmail ||
      DEFAULT_EMAIL_GLOBAL.fromAddress,
    replyTo:
      settingsMap.get("email_reply_to") ||
      settingsMap.get("email_from_address") ||
      envOverrides?.fromEmail ||
      DEFAULT_EMAIL_GLOBAL.replyTo,
    appUrl: settingsMap.get("email_app_url") || defaultAppUrl,
    logoUrl:
      settingsMap.get("email_logo_url") || `${defaultAppUrl}/img/logo.png`,
    footerText:
      settingsMap.get("email_footer_text") || DEFAULT_EMAIL_GLOBAL.footerText,
    adminNotifyEmail: settingsMap.get("email_admin_notify_address") || "",
  };

  const templates = {} as Record<EmailTemplateKey, EmailTemplateConfig>;
  for (const key of EMAIL_TEMPLATE_ORDER) {
    const base = DEFAULT_EMAIL_TEMPLATES[key];
    const prefix = `email_tpl_${key.toLowerCase()}`;
    templates[key] = {
      ...base,
      enabled: settingsMap.get(`${prefix}_enabled`) !== "0",
      subject: settingsMap.get(`${prefix}_subject`) || base.subject,
      badgeText: settingsMap.get(`${prefix}_badge`) || base.badgeText,
      headline: settingsMap.get(`${prefix}_headline`) || base.headline,
      body: settingsMap.get(`${prefix}_body`) || base.body,
      ctaText: settingsMap.get(`${prefix}_cta_text`) || base.ctaText,
      ctaPath: settingsMap.get(`${prefix}_cta_path`) || base.ctaPath,
    };
  }

  return { global, templates };
}
