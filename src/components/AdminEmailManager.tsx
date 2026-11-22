"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Send,
  Save,
  Eye,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Settings,
  History,
  Sparkles,
  Loader2,
  Monitor,
  Smartphone,
  ShieldCheck,
  Code2,
  Bell,
  UserCheck,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  EMAIL_TEMPLATE_ORDER,
  SAMPLE_EMAIL_VARS,
  buildKontenidoEmailHtml,
  type EmailSystemConfig,
  type EmailTemplateConfig,
  type EmailTemplateKey,
} from "@/lib/emailTemplates";
import {
  saveEmailGlobalConfigAction,
  saveEmailTemplateAction,
  resetEmailTemplateAction,
  sendTestEmailAction,
  sendEmailToUserAction,
} from "@/actions/emailAdmin";

export interface EmailLogItem {
  id: string;
  toEmail: string;
  templateKey: string;
  subject: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  providerId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface EmailRecipientUser {
  id: string;
  username: string;
  email: string;
  role: "SUPER_ADMIN" | "CREATOR" | "CONSUMER" | "AGENCY";
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  kycStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

interface Props {
  initialConfig: EmailSystemConfig;
  initialLogs: EmailLogItem[];
  usersList: EmailRecipientUser[];
  resendConfigured: boolean;
  adminEmail: string;
}

function getTemplateShortTag(key: EmailTemplateKey): string {
  switch (key) {
    case "WELCOME":
      return "Registro";
    case "ACCOUNT_APPROVED":
      return "Aprobado";
    case "ACCOUNT_REJECTED":
      return "Rechazo KYC";
    case "PAYOUT_REQUESTED":
      return "Retiro";
    case "PAYOUT_APPROVED":
      return "Pago";
    case "PLATFORM_CTA":
      return "Llamado CTA";
  }
}

function getUserRoleLabel(role: EmailRecipientUser["role"]): string {
  switch (role) {
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

function getUserStatusLabel(status: EmailRecipientUser["status"]): string {
  if (status === "ACTIVE") return "ACTIVO";
  if (status === "SUSPENDED") return "SUSPENDIDO";
  return "PENDIENTE";
}

export default function AdminEmailManager({
  initialConfig,
  initialLogs,
  usersList,
  resendConfigured,
  adminEmail,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"templates" | "send-user" | "config" | "logs">(
    "templates"
  );

  // Estado global de configuración Resend
  const [globalCfg, setGlobalCfg] = useState(initialConfig.global);
  const [savingGlobal, setSavingGlobal] = useState(false);

  // Estado de plantillas
  const [templates, setTemplates] = useState<Record<EmailTemplateKey, EmailTemplateConfig>>(
    initialConfig.templates
  );
  const [selectedKey, setSelectedKey] = useState<EmailTemplateKey>("WELCOME");
  const [savingTpl, setSavingTpl] = useState(false);
  const [resettingTpl, setResettingTpl] = useState(false);

  // Vista previa y envío de prueba
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [testEmail, setTestEmail] = useState(adminEmail || "webmaster@kontenido.online");
  const [sendingTest, setSendingTest] = useState(false);

  // Estado de la sección SEPARADA: Enviar a Usuario específico
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"ALL" | "CREATOR" | "CONSUMER" | "AGENCY">(
    "ALL"
  );
  const [selectedUserId, setSelectedUserId] = useState<string>(usersList[0]?.id || "");
  const [directTemplateKey, setDirectTemplateKey] = useState<EmailTemplateKey>("PLATFORM_CTA");
  const [useCustomOverride, setUseCustomOverride] = useState(false);
  const [customSubject, setCustomSubject] = useState("");
  const [customHeadline, setCustomHeadline] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [customCtaText, setCustomCtaText] = useState("");
  const [customCtaPath, setCustomCtaPath] = useState("");
  const [directPreviewDevice, setDirectPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [sendingDirect, setSendingDirect] = useState(false);

  // Feedback in-app
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const currentTpl = templates[selectedKey];

  // Usuarios filtrados en la pestaña "Enviar a Usuario"
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return usersList.filter((u) => {
      if (userRoleFilter !== "ALL" && u.role !== userRoleFilter) return false;
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        getUserRoleLabel(u.role).toLowerCase().includes(q) ||
        getUserStatusLabel(u.status).toLowerCase().includes(q)
      );
    });
  }, [usersList, userSearch, userRoleFilter]);

  const selectedUser = useMemo(
    () => usersList.find((u) => u.id === selectedUserId) || null,
    [usersList, selectedUserId]
  );

  // HTML de vista previa en vivo mientras el Super Admin edita
  const livePreview = useMemo(() => {
    const sample = SAMPLE_EMAIL_VARS[selectedKey];
    return buildKontenidoEmailHtml({
      global: globalCfg,
      template: currentTpl,
      vars: sample.vars,
      highlights: sample.highlights,
    });
  }, [globalCfg, currentTpl, selectedKey]);

  // HTML de vista previa personalizada para el usuario seleccionado en la pestaña "Enviar a Usuario"
  const directUserPreview = useMemo(() => {
    const baseTpl = templates[directTemplateKey];
    const effectiveTpl: EmailTemplateConfig = useCustomOverride
      ? {
          ...baseTpl,
          subject: customSubject.trim() || baseTpl.subject,
          headline: customHeadline.trim() || baseTpl.headline,
          body: customBody.trim() || baseTpl.body,
          ctaText: customCtaText.trim() || baseTpl.ctaText,
          ctaPath: customCtaPath.trim() || baseTpl.ctaPath,
        }
      : baseTpl;

    const sample = SAMPLE_EMAIL_VARS[directTemplateKey];
    const username = selectedUser?.username || sample.vars.username || "usuario";
    const roleLabel = selectedUser
      ? getUserRoleLabel(selectedUser.role)
      : sample.vars.roleLabel || "Creador de Contenido";
    const statusLabel = selectedUser
      ? getUserStatusLabel(selectedUser.status)
      : sample.vars.statusLabel || "ACTIVO";

    const mergedVars: Record<string, string> = {
      ...sample.vars,
      username,
      roleLabel,
      statusLabel,
      appUrl: globalCfg.appUrl,
    };

    const previewHighlights =
      directTemplateKey === "PLATFORM_CTA"
        ? [
            { label: "Tu cuenta", value: `@${username}` },
            { label: "Tipo de perfil", value: roleLabel },
            {
              label: "Estatus actual",
              value: statusLabel === "ACTIVO" ? "ACTIVO ✓" : statusLabel,
              highlight: true,
            },
            { label: "Explora gratis", value: "KOMESTIBLE & KOINCIDEN" },
          ]
        : directTemplateKey === "ACCOUNT_APPROVED"
        ? [
            { label: "Usuario", value: `@${username}` },
            { label: "Cuenta", value: roleLabel },
            {
              label: "Estatus del Perfil",
              value: statusLabel === "ACTIVO" ? "ACTIVO ✓" : statusLabel,
              highlight: true,
            },
          ]
        : directTemplateKey === "WELCOME"
        ? [
            { label: "Usuario", value: `@${username}` },
            { label: "Tipo de cuenta", value: roleLabel, highlight: true },
            { label: "Estatus actual", value: statusLabel },
          ]
        : sample.highlights.map((h) =>
            h.label.toLowerCase().includes("usuario")
              ? { ...h, value: `@${username}` }
              : h
          );

    return buildKontenidoEmailHtml({
      global: globalCfg,
      template: effectiveTpl,
      vars: mergedVars,
      highlights: previewHighlights,
    });
  }, [
    globalCfg,
    templates,
    directTemplateKey,
    selectedUser,
    useCustomOverride,
    customSubject,
    customHeadline,
    customBody,
    customCtaText,
    customCtaPath,
  ]);

  const updateCurrentTemplateField = <K extends keyof EmailTemplateConfig>(
    field: K,
    value: EmailTemplateConfig[K]
  ) => {
    setTemplates((prev) => ({
      ...prev,
      [selectedKey]: {
        ...prev[selectedKey],
        [field]: value,
      },
    }));
  };

  const insertTokenIntoBody = (token: string) => {
    const el = bodyTextareaRef.current;
    const currentText = currentTpl.body;
    if (!el) {
      updateCurrentTemplateField("body", `${currentText} ${token}`);
      return;
    }
    const start = el.selectionStart ?? currentText.length;
    const end = el.selectionEnd ?? currentText.length;
    const next = `${currentText.slice(0, start)}${token}${currentText.slice(end)}`;
    updateCurrentTemplateField("body", next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    }, 10);
  };

  const handleSaveGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGlobal(true);
    setFeedback(null);

    try {
      const fd = new FormData();
      fd.set("email_enabled", globalCfg.enabled ? "1" : "0");
      fd.set("email_from_name", globalCfg.fromName);
      fd.set("email_from_address", globalCfg.fromAddress);
      fd.set("email_reply_to", globalCfg.replyTo);
      fd.set("email_app_url", globalCfg.appUrl);
      fd.set("email_logo_url", globalCfg.logoUrl);
      fd.set("email_footer_text", globalCfg.footerText);
      fd.set("email_admin_notify_address", globalCfg.adminNotifyEmail);

      const res = await saveEmailGlobalConfigAction(fd);
      if (res.error) {
        setFeedback({ type: "error", message: res.error });
      } else {
        setFeedback({
          type: "success",
          message: "Configuración general del sistema de correos guardada correctamente.",
        });
        router.refresh();
      }
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTpl(true);
    setFeedback(null);

    try {
      const fd = new FormData();
      fd.set("templateKey", selectedKey);
      fd.set("enabled", currentTpl.enabled ? "1" : "0");
      fd.set("subject", currentTpl.subject);
      fd.set("badgeText", currentTpl.badgeText);
      fd.set("headline", currentTpl.headline);
      fd.set("body", currentTpl.body);
      fd.set("ctaText", currentTpl.ctaText);
      fd.set("ctaPath", currentTpl.ctaPath);

      const res = await saveEmailTemplateAction(fd);
      if (res.error) {
        setFeedback({ type: "error", message: res.error });
      } else {
        setFeedback({
          type: "success",
          message: `Plantilla "${currentTpl.label}" guardada con éxito.`,
        });
        router.refresh();
      }
    } finally {
      setSavingTpl(false);
    }
  };

  const handleResetTemplate = async () => {
    setResettingTpl(true);
    setFeedback(null);
    try {
      const res = await resetEmailTemplateAction(selectedKey);
      if (res.error) {
        setFeedback({ type: "error", message: res.error });
      } else if (res.template) {
        setTemplates((prev) => ({
          ...prev,
          [selectedKey]: res.template!,
        }));
        setFeedback({
          type: "success",
          message: `Plantilla "${currentTpl.label}" restaurada a los valores originales de KONTENIDO.`,
        });
        router.refresh();
      }
    } finally {
      setResettingTpl(false);
    }
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    setFeedback(null);
    try {
      // Guardar primero la plantilla actual para que el correo de prueba refleje cualquier edición reciente
      const fd = new FormData();
      fd.set("templateKey", selectedKey);
      fd.set("enabled", currentTpl.enabled ? "1" : "0");
      fd.set("subject", currentTpl.subject);
      fd.set("badgeText", currentTpl.badgeText);
      fd.set("headline", currentTpl.headline);
      fd.set("body", currentTpl.body);
      fd.set("ctaText", currentTpl.ctaText);
      fd.set("ctaPath", currentTpl.ctaPath);
      await saveEmailTemplateAction(fd);

      const res = await sendTestEmailAction(selectedKey, testEmail);
      if (res.error) {
        setFeedback({ type: "error", message: res.error });
      } else {
        setFeedback({
          type: "success",
          message: res.message || `Correo de prueba enviado a ${testEmail}.`,
        });
        router.refresh();
      }
    } finally {
      setSendingTest(false);
    }
  };

  const handleSelectDirectTemplate = (key: EmailTemplateKey) => {
    setDirectTemplateKey(key);
    const tpl = templates[key];
    if (useCustomOverride) {
      setCustomSubject(tpl.subject);
      setCustomHeadline(tpl.headline);
      setCustomBody(tpl.body);
      setCustomCtaText(tpl.ctaText);
      setCustomCtaPath(tpl.ctaPath);
    }
    setFeedback(null);
  };

  const handleToggleCustomOverride = (checked: boolean) => {
    setUseCustomOverride(checked);
    if (checked) {
      const tpl = templates[directTemplateKey];
      setCustomSubject(tpl.subject);
      setCustomHeadline(tpl.headline);
      setCustomBody(tpl.body);
      setCustomCtaText(tpl.ctaText);
      setCustomCtaPath(tpl.ctaPath);
    }
  };

  const handleSendDirectToUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setFeedback({ type: "error", message: "Selecciona primero un usuario de la lista." });
      return;
    }

    setSendingDirect(true);
    setFeedback(null);
    try {
      const res = await sendEmailToUserAction({
        userId: selectedUser.id,
        templateKey: directTemplateKey,
        ...(useCustomOverride
          ? {
              customSubject,
              customHeadline,
              customBody,
              customCtaText,
              customCtaPath,
            }
          : {}),
      });

      if (res.error) {
        setFeedback({ type: "error", message: res.error });
      } else {
        setFeedback({
          type: "success",
          message:
            res.message ||
            `Correo enviado correctamente a @${selectedUser.username} (${selectedUser.email}).`,
        });
        router.refresh();
      }
    } finally {
      setSendingDirect(false);
    }
  };

  const sentCount = initialLogs.filter((l) => l.status === "SENT").length;
  const failedCount = initialLogs.filter((l) => l.status === "FAILED").length;

  return (
    <div className="space-y-6">
      {/* Estado de Resend y resumen rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 ${
            resendConfigured
              ? "bg-emerald-950/35 border-emerald-500/35"
              : "bg-red-950/40 border-red-500/40"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              resendConfigured
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Conexión Resend API
            </span>
            <span
              className={`text-xs font-bold block truncate ${
                resendConfigured ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {resendConfigured ? "RESEND_API_KEY Activa ✓" : "Falta RESEND_API_KEY en .env / Vercel"}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Remitente Activo
            </span>
            <span className="text-xs font-bold text-white block truncate font-mono">
              {globalCfg.fromAddress}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Últimos Envíos
            </span>
            <span className="text-xs font-bold text-white">
              <span className="text-emerald-400">{sentCount} enviados</span>
              {failedCount > 0 && (
                <span className="text-red-400 ml-2">• {failedCount} fallidos</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Notificación de estado */}
      {feedback && (
        <div
          role="status"
          className={`p-4 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-200"
              : "bg-red-950/70 border-red-500/40 text-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Pestañas principales */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => {
            setActiveTab("templates");
            setFeedback(null);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
            activeTab === "templates"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Plantillas y Mensajes ({EMAIL_TEMPLATE_ORDER.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("send-user");
            setFeedback(null);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
            activeTab === "send-user"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          Enviar a Usuario ({usersList.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("config");
            setFeedback(null);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
            activeTab === "config"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Remitente y Configuración Resend
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("logs");
            setFeedback(null);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
            activeTab === "logs"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Historial de Envíos ({initialLogs.length})
        </button>
      </div>

      {/* PESTAÑA 1: EDITOR DE PLANTILLAS + VISTA PREVIA EN VIVO */}
      {activeTab === "templates" && (
        <div className="space-y-5">
          {/* Selector de evento/plantilla */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {EMAIL_TEMPLATE_ORDER.map((key) => {
              const item = templates[key];
              const active = selectedKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedKey(key);
                    setFeedback(null);
                  }}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    active
                      ? "bg-rose-600/20 border-rose-500 text-white shadow-md shadow-rose-600/15"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {getTemplateShortTag(key)}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.enabled ? "bg-emerald-400" : "bg-slate-600"
                      }`}
                      title={item.enabled ? "Activado" : "Desactivado"}
                    />
                  </div>
                  <span className="text-xs font-bold block leading-snug">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Formulario editor */}
            <form
              onSubmit={handleSaveTemplate}
              className="xl:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4"
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-black text-white">{currentTpl.label}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{currentTpl.description}</p>
                </div>

                <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
                  <span className="text-[11px] font-bold text-slate-300">
                    {currentTpl.enabled ? "Activo" : "Pausado"}
                  </span>
                  <input
                    type="checkbox"
                    checked={currentTpl.enabled}
                    onChange={(e) => updateCurrentTemplateField("enabled", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Asunto del Correo (Subject)
                </label>
                <input
                  type="text"
                  required
                  value={currentTpl.subject}
                  onChange={(e) => updateCurrentTemplateField("subject", e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-xs sm:text-sm focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Etiqueta Superior (Badge)
                  </label>
                  <input
                    type="text"
                    required
                    value={currentTpl.badgeText}
                    onChange={(e) => updateCurrentTemplateField("badgeText", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Titular Principal del Correo
                  </label>
                  <input
                    type="text"
                    required
                    value={currentTpl.headline}
                    onChange={(e) => updateCurrentTemplateField("headline", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Mensaje del Correo (Usa doble salto de línea para nuevos párrafos)
                  </label>
                </div>
                <textarea
                  ref={bodyTextareaRef}
                  rows={8}
                  required
                  value={currentTpl.body}
                  onChange={(e) => updateCurrentTemplateField("body", e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-xs sm:text-sm leading-relaxed focus:border-rose-500 focus:outline-hidden"
                />

                {/* Chips de variables insertables */}
                <div className="mt-2 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1.5">
                    <Code2 className="w-3 h-3 text-rose-400" />
                    Variables dinámicas (haz clic para insertar en el mensaje):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentTpl.availableVars.map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onClick={() => insertTokenIntoBody(v.token)}
                        title={v.desc}
                        className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-rose-600/20 border border-slate-700 hover:border-rose-500/50 text-[11px] font-mono text-rose-300 transition cursor-pointer"
                      >
                        {v.token}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Texto del Botón (Llamado a la Acción)
                  </label>
                  <input
                    type="text"
                    required
                    value={currentTpl.ctaText}
                    onChange={(e) => updateCurrentTemplateField("ctaText", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Ruta Destino del Botón
                  </label>
                  <input
                    type="text"
                    required
                    value={currentTpl.ctaPath}
                    onChange={(e) => updateCurrentTemplateField("ctaPath", e.target.value)}
                    placeholder="/login"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs font-mono focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={resettingTpl}
                  onClick={handleResetTemplate}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {resettingTpl ? "Restaurando..." : "Restaurar original"}
                </button>

                <button
                  type="submit"
                  disabled={savingTpl}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {savingTpl ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{savingTpl ? "Guardando..." : "Guardar Plantilla"}</span>
                </button>
              </div>

              {/* Caja de Envío de Correo de Prueba */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  Probar envío real con Resend
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    disabled={sendingTest || !resendConfigured}
                    onClick={handleSendTest}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {sendingTest ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{sendingTest ? "Enviando..." : "Enviar Prueba"}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Vista Previa HTML en vivo */}
            <div className="xl:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-rose-400" />
                    Vista Previa en Vivo
                  </span>
                  <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                    Asunto: <strong className="text-slate-200">{livePreview.subject}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      previewDevice === "desktop"
                        ? "bg-rose-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Vista Escritorio"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      previewDevice === "mobile"
                        ? "bg-rose-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Vista Móvil"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 rounded-2xl p-2 flex justify-center border border-slate-800 overflow-hidden">
                <iframe
                  title="Vista previa de correo KONTENIDO"
                  srcDoc={livePreview.html}
                  sandbox=""
                  className={`h-[640px] rounded-xl bg-[#020617] border-0 transition-all ${
                    previewDevice === "mobile" ? "w-[360px]" : "w-full"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA SEPARADA: ENVIAR CORREO A UN USUARIO ESPECÍFICO */}
      {activeTab === "send-user" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSendDirectToUser}
            className="xl:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5"
          >
            <div className="pb-3 border-b border-slate-800">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-rose-400" />
                Envío Directo a Usuario Específico
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Sección independiente del editor de formatos. Elige a cualquier usuario registrado y envíale cualquiera de las 6 plantillas establecidas.
              </p>
            </div>

            {/* PASO 1: BUSCAR Y SELECCIONAR USUARIO */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                  1. Selecciona el Usuario Destinatario
                </span>
                <span className="text-[11px] text-slate-400">
                  {filteredUsers.length} de {usersList.length} usuarios
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Buscar por @usuario, correo, rol o estatus..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: "ALL", label: "Todos" },
                    { id: "CREATOR", label: "Creadoras" },
                    { id: "CONSUMER", label: "Consumidores" },
                    { id: "AGENCY", label: "Agencias" },
                  ] as const
                ).map((roleOpt) => (
                  <button
                    key={roleOpt.id}
                    type="button"
                    onClick={() => setUserRoleFilter(roleOpt.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      userRoleFilter === roleOpt.id
                        ? "bg-rose-600 text-white"
                        : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    {roleOpt.label}
                  </button>
                ))}
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 rounded-2xl bg-slate-950 border border-slate-800 p-2">
                {filteredUsers.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-500">
                    No se encontraron usuarios con ese criterio.
                  </p>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = selectedUserId === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSelectedUserId(u.id);
                          setFeedback(null);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? "bg-rose-600/20 border-rose-500 text-white"
                            : "bg-slate-900/70 border-slate-800/80 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white truncate">
                              @{u.username}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-slate-800 text-slate-300">
                              {u.role === "CREATOR"
                                ? "Creador"
                                : u.role === "AGENCY"
                                ? "Agencia"
                                : u.role === "SUPER_ADMIN"
                                ? "Admin"
                                : "Consumidor"}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 block truncate mt-0.5">
                            {u.email}
                          </span>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              u.status === "ACTIVE"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35"
                                : u.status === "SUSPENDED"
                                ? "bg-red-500/20 text-red-300 border border-red-500/35"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/35"
                            }`}
                          >
                            {getUserStatusLabel(u.status)}
                          </span>
                          {u.kycStatus === "APPROVED" && (
                            <span className="text-[9px] font-bold text-cyan-300">KYC +18 ✓</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* PASO 2: ELEGIR PLANTILLA ESTABLECIDA */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <span className="text-xs font-black uppercase tracking-wider text-rose-400 block">
                2. Elige el Correo / Plantilla a Enviar
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EMAIL_TEMPLATE_ORDER.map((key) => {
                  const tpl = templates[key];
                  const active = directTemplateKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectDirectTemplate(key)}
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                        active
                          ? "bg-rose-600/20 border-rose-500 text-white shadow-sm shadow-rose-600/20"
                          : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 block mb-0.5">
                        {getTemplateShortTag(key)}
                      </span>
                      <span className="text-xs font-bold block leading-snug">{tpl.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* OPCIONAL: PERSONALIZACIÓN SOLO PARA ESTE ENVÍO */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  Personalizar texto solo para este envío (sin modificar la plantilla base)
                </span>
                <input
                  type="checkbox"
                  checked={useCustomOverride}
                  onChange={(e) => handleToggleCustomOverride(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-rose-500 cursor-pointer"
                />
              </label>

              {useCustomOverride && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Asunto personalizado
                    </label>
                    <input
                      type="text"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Titular principal
                    </label>
                    <input
                      type="text"
                      value={customHeadline}
                      onChange={(e) => setCustomHeadline(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Mensaje
                    </label>
                    <textarea
                      rows={5}
                      value={customBody}
                      onChange={(e) => setCustomBody(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white leading-relaxed focus:border-rose-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Texto del botón CTA
                      </label>
                      <input
                        type="text"
                        value={customCtaText}
                        onChange={(e) => setCustomCtaText(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:border-rose-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Ruta del botón
                      </label>
                      <input
                        type="text"
                        value={customCtaPath}
                        onChange={(e) => setCustomCtaPath(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs font-mono text-white focus:border-rose-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RESUMEN Y BOTÓN DE ENVÍO */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
              {selectedUser ? (
                <div className="text-xs text-slate-300 space-y-1">
                  <div>
                    Destinatario:{" "}
                    <strong className="text-white">@{selectedUser.username}</strong>{" "}
                    <span className="font-mono text-rose-300">({selectedUser.email})</span>
                  </div>
                  <div>
                    Plantilla:{" "}
                    <strong className="text-emerald-300">
                      {templates[directTemplateKey].label}
                    </strong>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-300">
                  Selecciona un usuario en la lista de arriba para habilitar el envío.
                </p>
              )}

              <button
                type="submit"
                disabled={sendingDirect || !selectedUser || !resendConfigured}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition cursor-pointer disabled:opacity-50"
              >
                {sendingDirect ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {sendingDirect
                    ? "Enviando correo vía Resend..."
                    : selectedUser
                    ? `Enviar Correo a @${selectedUser.username}`
                    : "Selecciona un Usuario"}
                </span>
              </button>
            </div>
          </form>

          {/* VISTA PREVIA PERSONALIZADA PARA EL USUARIO SELECCIONADO */}
          <div className="xl:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="min-w-0">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-rose-400" />
                  Vista Previa Personalizada
                  {selectedUser && (
                    <span className="text-rose-400 font-mono">@{selectedUser.username}</span>
                  )}
                </span>
                <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                  Para:{" "}
                  <strong className="text-slate-200 font-mono">
                    {selectedUser?.email || "—"}
                  </strong>
                </span>
                <span className="text-[11px] text-slate-400 block truncate">
                  Asunto: <strong className="text-slate-200">{directUserPreview.subject}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setDirectPreviewDevice("desktop")}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    directPreviewDevice === "desktop"
                      ? "bg-rose-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Vista Escritorio"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDirectPreviewDevice("mobile")}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    directPreviewDevice === "mobile"
                      ? "bg-rose-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Vista Móvil"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="bg-slate-950 rounded-2xl p-2 flex justify-center border border-slate-800 overflow-hidden">
              <iframe
                title="Vista previa personalizada para usuario"
                srcDoc={directUserPreview.html}
                sandbox=""
                className={`h-[680px] rounded-xl bg-[#020617] border-0 transition-all ${
                  directPreviewDevice === "mobile" ? "w-[360px]" : "w-full"
                }`}
              />
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: CONFIGURACIÓN GENERAL DE RESEND Y REMITENTE */}
      {activeTab === "config" && (
        <form
          onSubmit={handleSaveGlobal}
          className="max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5"
        >
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-black text-white block">
                Envío Automático de Correos (Switch Global)
              </span>
              <span className="text-xs text-slate-400">
                Activa o pausa el disparo automático de bienvenida, aprobaciones y retiros vía Resend.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={globalCfg.enabled}
                onChange={(e) =>
                  setGlobalCfg((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nombre del Remitente
              </label>
              <input
                type="text"
                required
                value={globalCfg.fromName}
                onChange={(e) =>
                  setGlobalCfg((prev) => ({ ...prev, fromName: e.target.value }))
                }
                placeholder="KONTENIDO"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Correo Remitente (Dominio Verificado en Resend)
              </label>
              <input
                type="email"
                required
                value={globalCfg.fromAddress}
                onChange={(e) =>
                  setGlobalCfg((prev) => ({ ...prev, fromAddress: e.target.value }))
                }
                placeholder="webmaster@kontenido.online"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white font-mono focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Correo de Respuesta (Reply-To)
              </label>
              <input
                type="email"
                value={globalCfg.replyTo}
                onChange={(e) =>
                  setGlobalCfg((prev) => ({ ...prev, replyTo: e.target.value }))
                }
                placeholder="webmaster@kontenido.online"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white font-mono focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-300 mb-1.5 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                Correo de Alerta Admin (Copia de Retiros — Opcional)
              </label>
              <input
                type="email"
                value={globalCfg.adminNotifyEmail}
                onChange={(e) =>
                  setGlobalCfg((prev) => ({ ...prev, adminNotifyEmail: e.target.value }))
                }
                placeholder="ej: webmaster@kontenido.online"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white font-mono focus:border-rose-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Si colocas un correo aquí, recibirás aviso cada vez que una creadora solicite un retiro.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                URL Principal del Sitio (para botones CTA)
              </label>
              <input
                type="url"
                required
                value={globalCfg.appUrl}
                onChange={(e) =>
                  setGlobalCfg((prev) => ({ ...prev, appUrl: e.target.value }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white font-mono focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                URL del Logotipo en los Correos
              </label>
              <input
                type="url"
                required
                value={globalCfg.logoUrl}
                onChange={(e) =>
                  setGlobalCfg((prev) => ({ ...prev, logoUrl: e.target.value }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white font-mono focus:border-rose-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Pie de Página Legal de los Correos
            </label>
            <textarea
              rows={3}
              value={globalCfg.footerText}
              onChange={(e) =>
                setGlobalCfg((prev) => ({ ...prev, footerText: e.target.value }))
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs sm:text-sm text-white focus:border-rose-500 focus:outline-hidden"
            />
          </div>

          <button
            type="submit"
            disabled={savingGlobal}
            className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition cursor-pointer disabled:opacity-50"
          >
            {savingGlobal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{savingGlobal ? "Guardando..." : "Guardar Configuración de Correos"}</span>
          </button>
        </form>
      )}

      {/* PESTAÑA 3: HISTORIAL DE CORREOS ENVIADOS */}
      {activeTab === "logs" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-black text-white">Registro de Envíos Recientes</h2>
              <p className="text-xs text-slate-400">
                Auditoría de correos disparados por KONTENIDO a través de Resend.
              </p>
            </div>
          </div>

          {initialLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Fecha</th>
                    <th className="py-3 px-3">Evento</th>
                    <th className="py-3 px-3">Destinatario</th>
                    <th className="py-3 px-3">Asunto</th>
                    <th className="py-3 px-3">Estado</th>
                    <th className="py-3 px-3">Resend ID / Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {initialLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("es-VE")}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-amber-300 font-bold whitespace-nowrap">
                        {log.templateKey}
                      </td>
                      <td className="py-3 px-3 text-white font-mono text-[11px]">
                        {log.toEmail}
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                        {log.subject}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {log.status === "SENT" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Enviado ✓
                          </span>
                        )}
                        {log.status === "FAILED" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            Fallido
                          </span>
                        )}
                        {log.status === "SKIPPED" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                            Omitido
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[11px] font-mono text-slate-400 max-w-xs truncate">
                        {log.errorMessage ? (
                          <span className="text-red-300">{log.errorMessage}</span>
                        ) : (
                          log.providerId || "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              Aún no se han enviado correos desde la plataforma. Usa el botón &quot;Enviar Prueba&quot; en la pestaña de Plantillas para verificar Resend ahora mismo.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
