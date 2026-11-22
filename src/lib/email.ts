import { db } from "@/lib/db";
import { settings, emailLogs } from "@/lib/db/schema";
import { ensureEmailSchema } from "@/lib/db/initEmail";
import {
  buildKontenidoEmailHtml,
  resolveEmailSystemConfigFromSettingsMap,
  SAMPLE_EMAIL_VARS,
  type EmailSystemConfig,
  type EmailTemplateKey,
} from "@/lib/emailTemplates";
import { formatBs } from "@/lib/dolarapi";

export interface SendEmailResult {
  success: boolean;
  skipped?: boolean;
  providerId?: string;
  error?: string;
}

/**
 * Indica si la variable RESEND_API_KEY está configurada en el entorno actual.
 */
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * Lee toda la configuración de correos y plantillas desde Turso DB (tabla settings).
 */
export async function getEmailSystemConfig(): Promise<EmailSystemConfig> {
  const allSettings = await db.query.settings.findMany();
  const map = new Map(allSettings.map((s) => [s.key, s.value]));
  return resolveEmailSystemConfigFromSettingsMap(map, {
    fromEmail: process.env.RESEND_FROM_EMAIL?.trim() || "webmaster@kontenido.online",
    appUrl:
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.NEXTAUTH_URL?.trim() ||
      "https://www.kontenido.online",
  });
}

/**
 * Envía un correo vía API oficial de Resend y registra el resultado en email_logs.
 * Nunca lanza excepciones no capturadas para no interrumpir flujos de negocio.
 */
async function dispatchResendEmail(params: {
  to: string;
  templateKey: EmailTemplateKey | "TEST";
  subject: string;
  html: string;
  text: string;
  fromName: string;
  fromAddress: string;
  replyTo?: string;
  meta?: Record<string, unknown>;
  bypassGlobalDisabled?: boolean;
  globalEnabled?: boolean;
}): Promise<SendEmailResult> {
  const now = new Date().toISOString();
  const cleanTo = params.to?.trim().toLowerCase();

  if (!cleanTo || !cleanTo.includes("@")) {
    return { success: false, error: "Correo destinatario inválido." };
  }

  await ensureEmailSchema();

  if (!params.bypassGlobalDisabled && params.globalEnabled === false) {
    await db
      .insert(emailLogs)
      .values({
        id: crypto.randomUUID(),
        toEmail: cleanTo,
        templateKey: params.templateKey,
        subject: params.subject,
        status: "SKIPPED",
        errorMessage: "Sistema de correos pausado globalmente en /admin/correos.",
        meta: params.meta ? JSON.stringify(params.meta) : null,
        createdAt: now,
      })
      .catch(() => {});
    return { success: false, skipped: true, error: "Envío global pausado." };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    const errMsg = "RESEND_API_KEY no está configurada en las variables de entorno.";
    await db
      .insert(emailLogs)
      .values({
        id: crypto.randomUUID(),
        toEmail: cleanTo,
        templateKey: params.templateKey,
        subject: params.subject,
        status: "FAILED",
        errorMessage: errMsg,
        meta: params.meta ? JSON.stringify(params.meta) : null,
        createdAt: now,
      })
      .catch(() => {});
    return { success: false, error: errMsg };
  }

  const fromHeader = `${params.fromName.replace(/[<>]/g, "").trim() || "KONTENIDO"} <${params.fromAddress.trim()}>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [cleanTo],
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.replyTo?.trim() ? { reply_to: params.replyTo.trim() } : {}),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg =
        (data as any)?.message ||
        (data as any)?.error ||
        `Error Resend HTTP ${response.status}`;

      await db
        .insert(emailLogs)
        .values({
          id: crypto.randomUUID(),
          toEmail: cleanTo,
          templateKey: params.templateKey,
          subject: params.subject,
          status: "FAILED",
          errorMessage: errMsg,
          meta: params.meta ? JSON.stringify(params.meta) : null,
          createdAt: now,
        })
        .catch(() => {});

      console.error("Error enviando correo con Resend:", errMsg);
      return { success: false, error: errMsg };
    }

    const providerId = (data as any)?.id || null;
    await db
      .insert(emailLogs)
      .values({
        id: crypto.randomUUID(),
        toEmail: cleanTo,
        templateKey: params.templateKey,
        subject: params.subject,
        status: "SENT",
        providerId,
        meta: params.meta ? JSON.stringify(params.meta) : null,
        createdAt: now,
      })
      .catch(() => {});

    return { success: true, providerId: providerId || undefined };
  } catch (err: any) {
    const errMsg = err?.message || "Error de conexión con api.resend.com";
    await db
      .insert(emailLogs)
      .values({
        id: crypto.randomUUID(),
        toEmail: cleanTo,
        templateKey: params.templateKey,
        subject: params.subject,
        status: "FAILED",
        errorMessage: errMsg,
        meta: params.meta ? JSON.stringify(params.meta) : null,
        createdAt: now,
      })
      .catch(() => {});

    console.error("Excepción enviando correo vía Resend:", errMsg);
    return { success: false, error: errMsg };
  }
}

export function getRoleDisplayLabel(role?: string | null): string {
  switch ((role || "").toUpperCase()) {
    case "CREATOR":
      return "Creador de Contenido";
    case "AGENCY":
      return "Agencia";
    case "SUPER_ADMIN":
      return "Administrador";
    default:
      return "Consumidor de Contenido";
  }
}

export function formatPaymentMethodLabel(method?: {
  type?: string | null;
  bank?: { nombreBanco?: string | null } | null;
  phone?: string | null;
  accountNumber?: string | null;
  binanceEmail?: string | null;
  usdtNetwork?: string | null;
} | null): string {
  if (!method?.type) return "Método de cobro configurado";
  if (method.type === "PAGOMOVIL") {
    const bankName = method.bank?.nombreBanco ? ` — ${method.bank.nombreBanco}` : "";
    return `PagoMóvil${bankName}`;
  }
  if (method.type === "BANK_TRANSFER") {
    const bankName = method.bank?.nombreBanco ? ` — ${method.bank.nombreBanco}` : "";
    return `Transferencia Bancaria${bankName}`;
  }
  if (method.type === "BINANCE") {
    return "Binance Pay / USDT";
  }
  if (method.type === "USDT_WALLET") {
    return `Wallet USDT (${method.usdtNetwork || "Cripto"})`;
  }
  return method.type;
}

/**
 * 1. Correo de BIENVENIDA al registrarse (Creador, Consumidor o Agencia)
 */
export async function sendWelcomeEmail(input: {
  to: string;
  username: string;
  role: "CREATOR" | "CONSUMER" | "AGENCY" | string;
}): Promise<SendEmailResult> {
  try {
    const config = await getEmailSystemConfig();
    const tpl = config.templates.WELCOME;
    if (!config.global.enabled || !tpl.enabled) {
      return { success: false, skipped: true };
    }

    const baseAppUrl = config.global.appUrl.replace(/\/+$/, "");
    const roleLabel = getRoleDisplayLabel(input.role);
    const destinationPath =
      input.role === "CREATOR"
        ? "/panel/perfil?completar=1"
        : input.role === "AGENCY"
        ? "/agencia"
        : "/cuenta?completar=1";

    const { subject, html, text } = buildKontenidoEmailHtml({
      global: config.global,
      template: tpl,
      vars: {
        username: input.username,
        roleLabel,
      },
      ctaUrlOverride: `${baseAppUrl}${destinationPath}`,
      highlights: [
        { label: "Usuario", value: `@${input.username}` },
        { label: "Tipo de cuenta", value: roleLabel, highlight: true },
        {
          label: "Siguiente paso",
          value:
            input.role === "AGENCY"
              ? "Abrir tu Panel de Agencia"
              : "Completar perfil básico y KOMESTIBLE",
        },
      ],
    });

    return await dispatchResendEmail({
      to: input.to,
      templateKey: "WELCOME",
      subject,
      html,
      text,
      fromName: config.global.fromName,
      fromAddress: config.global.fromAddress,
      replyTo: config.global.replyTo,
      globalEnabled: config.global.enabled,
      meta: { username: input.username, role: input.role },
    });
  } catch (err: any) {
    console.error("Error en sendWelcomeEmail:", err);
    return { success: false, error: err?.message || "Error inesperado" };
  }
}

/**
 * 2. Correo de APROBACIÓN DE ACCESO / CAMBIO DE ESTATUS A APROBADO
 */
export async function sendAccountApprovedEmail(input: {
  to: string;
  username: string;
  role?: string | null;
  detail?: string;
}): Promise<SendEmailResult> {
  try {
    const config = await getEmailSystemConfig();
    const tpl = config.templates.ACCOUNT_APPROVED;
    if (!config.global.enabled || !tpl.enabled) {
      return { success: false, skipped: true };
    }

    const baseAppUrl = config.global.appUrl.replace(/\/+$/, "");
    const roleLabel = getRoleDisplayLabel(input.role);
    const ctaPath =
      input.role === "CREATOR"
        ? "/panel"
        : input.role === "AGENCY"
        ? "/agencia"
        : "/cuenta";
    const approvalDetail =
      input.detail ||
      "Tu identidad y acceso en KONTENIDO han sido verificados y aprobados correctamente.";

    const { subject, html, text } = buildKontenidoEmailHtml({
      global: config.global,
      template: tpl,
      vars: {
        username: input.username,
        roleLabel,
        statusLabel: "APROBADO / ACTIVO",
        approvalDetail,
      },
      ctaUrlOverride: `${baseAppUrl}${ctaPath}`,
      highlights: [
        { label: "Usuario", value: `@${input.username}` },
        { label: "Cuenta", value: roleLabel },
        { label: "Nuevo Estatus", value: "APROBADO Y ACTIVO ✓", highlight: true },
      ],
    });

    return await dispatchResendEmail({
      to: input.to,
      templateKey: "ACCOUNT_APPROVED",
      subject,
      html,
      text,
      fromName: config.global.fromName,
      fromAddress: config.global.fromAddress,
      replyTo: config.global.replyTo,
      globalEnabled: config.global.enabled,
      meta: { username: input.username, role: input.role },
    });
  } catch (err: any) {
    console.error("Error en sendAccountApprovedEmail:", err);
    return { success: false, error: err?.message || "Error inesperado" };
  }
}

/**
 * 3. Correo de RECHAZO DE VERIFICACIÓN KYC (permite reintentar con claridad)
 */
export async function sendAccountRejectedEmail(input: {
  to: string;
  username: string;
  reason?: string | null;
}): Promise<SendEmailResult> {
  try {
    const config = await getEmailSystemConfig();
    const tpl = config.templates.ACCOUNT_REJECTED;
    if (!config.global.enabled || !tpl.enabled) {
      return { success: false, skipped: true };
    }

    const reasonText =
      input.reason?.trim() ||
      "No fue posible validar con claridad las fotografías enviadas.";

    const { subject, html, text } = buildKontenidoEmailHtml({
      global: config.global,
      template: tpl,
      vars: {
        username: input.username,
        reason: reasonText,
      },
      highlights: [
        { label: "Usuario", value: `@${input.username}` },
        { label: "Estatus", value: "Requiere corrección", highlight: true },
        { label: "Motivo", value: reasonText },
      ],
    });

    return await dispatchResendEmail({
      to: input.to,
      templateKey: "ACCOUNT_REJECTED",
      subject,
      html,
      text,
      fromName: config.global.fromName,
      fromAddress: config.global.fromAddress,
      replyTo: config.global.replyTo,
      globalEnabled: config.global.enabled,
      meta: { username: input.username, reason: reasonText },
    });
  } catch (err: any) {
    console.error("Error en sendAccountRejectedEmail:", err);
    return { success: false, error: err?.message || "Error inesperado" };
  }
}

/**
 * 4. Correo de SOLICITUD DE RETIRO DE DINERO RECIBIDA
 */
export async function sendPayoutRequestedEmail(input: {
  to: string;
  username: string;
  payoutId: string;
  grossKoin: number;
  feeKoin: number;
  feePct: number;
  netKoin: number;
  amountVes?: number | null;
  usdRateVes?: number | null;
  paymentMethodLabel: string;
}): Promise<SendEmailResult> {
  try {
    const config = await getEmailSystemConfig();
    const tpl = config.templates.PAYOUT_REQUESTED;
    if (!config.global.enabled || !tpl.enabled) {
      return { success: false, skipped: true };
    }

    const payoutRef = `RETIRO-${input.payoutId.slice(0, 8).toUpperCase()}`;
    const amountVesFormatted =
      input.amountVes && input.amountVes > 0 ? formatBs(input.amountVes) : "N/A (USDT directo)";

    const highlights: Array<{ label: string; value: string; highlight?: boolean }> = [
      { label: "Código de Solicitud", value: payoutRef },
      { label: "Monto Solicitado", value: `${input.grossKoin.toFixed(2)} KOIN` },
      { label: "Comisión Aplicada", value: `${input.feePct}% (${input.feeKoin.toFixed(2)} KOIN)` },
      {
        label: "Neto a Recibir",
        value:
          input.amountVes && input.amountVes > 0
            ? `${input.netKoin.toFixed(2)} KOIN (${amountVesFormatted})`
            : `$${input.netKoin.toFixed(2)} USDT`,
        highlight: true,
      },
      { label: "Método de Cobro", value: input.paymentMethodLabel },
      { label: "Estatus Actual", value: "EN ESPERA DE LIQUIDACIÓN" },
    ];

    const { subject, html, text } = buildKontenidoEmailHtml({
      global: config.global,
      template: tpl,
      vars: {
        username: input.username,
        payoutRef,
        grossKoin: input.grossKoin.toFixed(2),
        feePct: String(input.feePct),
        feeKoin: input.feeKoin.toFixed(2),
        netKoin: input.netKoin.toFixed(2),
        amountVesFormatted,
        paymentMethod: input.paymentMethodLabel,
      },
      highlights,
    });

    const primaryRes = await dispatchResendEmail({
      to: input.to,
      templateKey: "PAYOUT_REQUESTED",
      subject,
      html,
      text,
      fromName: config.global.fromName,
      fromAddress: config.global.fromAddress,
      replyTo: config.global.replyTo,
      globalEnabled: config.global.enabled,
      meta: { payoutId: input.payoutId, username: input.username, netKoin: input.netKoin },
    });

    // Notificación opcional al correo del administrador si fue configurado en /admin/correos
    const adminEmail = config.global.adminNotifyEmail?.trim();
    if (adminEmail && adminEmail.toLowerCase() !== input.to.toLowerCase()) {
      const baseAppUrl = config.global.appUrl.replace(/\/+$/, "");
      const adminPayload = buildKontenidoEmailHtml({
        global: config.global,
        template: {
          ...tpl,
          badgeText: "ALERTA ADMIN • NUEVA SOLICITUD DE RETIRO",
          headline: `NUEVO RETIRO SOLICITADO POR @${input.username.toUpperCase()}`,
          body: `La creadora @${input.username} acaba de solicitar un retiro de fondos en KONTENIDO.\n\nRevisa el detalle y liquídalo desde el panel de Cortes Semanales.`,
          ctaText: "Ir a Liquidar Retiros (/admin/payouts) →",
          ctaPath: "/admin/payouts",
        },
        vars: {
          username: input.username,
          payoutRef,
          netKoin: input.netKoin.toFixed(2),
        },
        ctaUrlOverride: `${baseAppUrl}/admin/payouts`,
        highlights,
      });

      await dispatchResendEmail({
        to: adminEmail,
        templateKey: "PAYOUT_REQUESTED",
        subject: `🔔 [Admin] Nuevo retiro de @${input.username}: ${input.netKoin.toFixed(2)} KOIN`,
        html: adminPayload.html,
        text: adminPayload.text,
        fromName: config.global.fromName,
        fromAddress: config.global.fromAddress,
        replyTo: config.global.replyTo,
        globalEnabled: config.global.enabled,
        meta: { payoutId: input.payoutId, adminCopy: true },
      });
    }

    return primaryRes;
  } catch (err: any) {
    console.error("Error en sendPayoutRequestedEmail:", err);
    return { success: false, error: err?.message || "Error inesperado" };
  }
}

/**
 * 5. Correo de RETIRO DE DINERO APROBADO Y PAGADO
 */
export async function sendPayoutApprovedEmail(input: {
  to: string;
  username: string;
  payoutId: string;
  netKoin: number;
  amountVes?: number | null;
  transactionRef: string;
  paymentMethodLabel: string;
  paidAt: string;
}): Promise<SendEmailResult> {
  try {
    const config = await getEmailSystemConfig();
    const tpl = config.templates.PAYOUT_APPROVED;
    if (!config.global.enabled || !tpl.enabled) {
      return { success: false, skipped: true };
    }

    const payoutRef = `RETIRO-${input.payoutId.slice(0, 8).toUpperCase()}`;
    const amountVesFormatted =
      input.amountVes && input.amountVes > 0 ? formatBs(input.amountVes) : "USDT directo";
    const paidAtFormatted = new Date(input.paidAt).toLocaleString("es-VE");

    const highlights: Array<{ label: string; value: string; highlight?: boolean }> = [
      { label: "Código de Retiro", value: payoutRef },
      {
        label: "Monto Transferido",
        value:
          input.amountVes && input.amountVes > 0
            ? `${input.netKoin.toFixed(2)} KOIN (${amountVesFormatted})`
            : `$${input.netKoin.toFixed(2)} USDT`,
        highlight: true,
      },
      { label: "Nro. de Referencia", value: input.transactionRef, highlight: true },
      { label: "Método de Cobro", value: input.paymentMethodLabel },
      { label: "Fecha de Liquidación", value: paidAtFormatted },
      { label: "Estatus", value: "APROBADO Y PAGADO ✓" },
    ];

    const { subject, html, text } = buildKontenidoEmailHtml({
      global: config.global,
      template: tpl,
      vars: {
        username: input.username,
        payoutRef,
        netKoin: input.netKoin.toFixed(2),
        amountVesFormatted,
        transactionRef: input.transactionRef,
        paymentMethod: input.paymentMethodLabel,
        paidAt: paidAtFormatted,
      },
      highlights,
    });

    return await dispatchResendEmail({
      to: input.to,
      templateKey: "PAYOUT_APPROVED",
      subject,
      html,
      text,
      fromName: config.global.fromName,
      fromAddress: config.global.fromAddress,
      replyTo: config.global.replyTo,
      globalEnabled: config.global.enabled,
      meta: {
        payoutId: input.payoutId,
        username: input.username,
        transactionRef: input.transactionRef,
      },
    });
  } catch (err: any) {
    console.error("Error en sendPayoutApprovedEmail:", err);
    return { success: false, error: err?.message || "Error inesperado" };
  }
}

/**
 * Envía un correo de prueba con datos de muestra desde /admin/correos
 */
export async function sendTestTemplateEmail(input: {
  to: string;
  templateKey: EmailTemplateKey;
}): Promise<SendEmailResult> {
  const config = await getEmailSystemConfig();
  const tpl = config.templates[input.templateKey];
  const sample = SAMPLE_EMAIL_VARS[input.templateKey];

  const { subject, html, text } = buildKontenidoEmailHtml({
    global: config.global,
    template: tpl,
    vars: sample.vars,
    highlights: sample.highlights,
  });

  return await dispatchResendEmail({
    to: input.to,
    templateKey: "TEST",
    subject: `[PRUEBA] ${subject}`,
    html,
    text,
    fromName: config.global.fromName,
    fromAddress: config.global.fromAddress,
    replyTo: config.global.replyTo,
    bypassGlobalDisabled: true,
    meta: { testedTemplate: input.templateKey },
  });
}
