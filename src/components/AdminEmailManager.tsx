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

interface Props {
  initialConfig: EmailSystemConfig;
  initialLogs: EmailLogItem[];
  resendConfigured: boolean;
  adminEmail: string;
}

export default function AdminEmailManager({
  initialConfig,
  initialLogs,
  resendConfigured,
  adminEmail,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"templates" | "config" | "logs">("templates");

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

  // Feedback in-app
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const currentTpl = templates[selectedKey];

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
          onClick={() => setActiveTab("templates")}
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
          onClick={() => setActiveTab("config")}
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
          onClick={() => setActiveTab("logs")}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
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
                      {key === "WELCOME"
                        ? "Registro"
                        : key === "ACCOUNT_APPROVED"
                        ? "Aprobado"
                        : key === "ACCOUNT_REJECTED"
                        ? "Rechazo KYC"
                        : key === "PAYOUT_REQUESTED"
                        ? "Retiro"
                        : "Pago"}
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
