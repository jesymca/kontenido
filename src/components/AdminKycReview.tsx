"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { reviewKycAction } from "@/actions/admin";
import {
  Check,
  X,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sparkles,
} from "lucide-react";

interface KycItem {
  id: string;
  userId: string;
  username: string;
  documentType: string;
  extractedCedula: string | null;
  extractedFullName: string | null;
  extractedBirthDate: string | null;
  ageVerified: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  createdAt: string;
  urls: {
    frontUrl: string;
    backUrl: string;
    selfieUrl: string;
  };
}

interface Props {
  documents: KycItem[];
}

const REJECTION_PRESETS = [
  "Foto borrosa o ilegible",
  "Documento no coincide con la selfie",
  "Documento vencido o incompleto",
  "No cumple mayoría de edad (+18)",
  "Falta cara frontal o reverso nítido",
];

export default function AdminKycReview({ documents }: Props) {
  const router = useRouter();
  const [docs, setDocs] = useState<KycItem[]>(documents);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Estado de notificación in-app (sin alert nativo)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Estado del Modal personalizado de Aprobación / Rechazo (sin confirm/prompt nativos)
  const [decisionModal, setDecisionModal] = useState<{
    type: "APPROVED" | "REJECTED";
    doc: KycItem;
    reason: string;
    formError: string | null;
  } | null>(null);

  // Sincronizar si cambian props del servidor
  useEffect(() => {
    setDocs(documents);
  }, [documents]);

  // Auto-ocultar notificación de éxito/error después de unos segundos
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Estados para el Modal de Inspección de Fotos en Alta Resolución
  const [modalData, setModalData] = useState<{
    url: string;
    title: string;
    username: string;
    extractedCedula: string | null;
    extractedFullName: string | null;
    extractedBirthDate: string | null;
    currentIndex: number; // 0: front, 1: back, 2: selfie
    urls: { frontUrl: string; backUrl: string; selfieUrl: string };
  } | null>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Atajos de teclado para modales (ESC para cerrar, Flechas para navegar, R para rotar en lightbox)
  useEffect(() => {
    if (!modalData && !decisionModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (decisionModal && !loadingId) {
          setDecisionModal(null);
          return;
        }
        if (modalData) {
          setModalData(null);
        }
        return;
      }

      if (!modalData || decisionModal) return;
      if (e.key === "ArrowLeft") {
        navigateModal(-1);
      } else if (e.key === "ArrowRight") {
        navigateModal(1);
      } else if (e.key.toLowerCase() === "r") {
        handleRotate();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalData, decisionModal, loadingId]);

  const openModal = (doc: KycItem, index: number) => {
    const titles = ["1. Cédula Frente", "2. Cédula Reverso", "3. Selfie con Cédula"];
    const urls = [doc.urls.frontUrl, doc.urls.backUrl, doc.urls.selfieUrl];

    setZoom(1);
    setRotation(0);
    setModalData({
      url: urls[index],
      title: titles[index],
      username: doc.username,
      extractedCedula: doc.extractedCedula,
      extractedFullName: doc.extractedFullName,
      extractedBirthDate: doc.extractedBirthDate,
      currentIndex: index,
      urls: doc.urls,
    });
  };

  const navigateModal = (direction: number) => {
    if (!modalData) return;
    const titles = ["1. Cédula Frente", "2. Cédula Reverso", "3. Selfie con Cédula"];
    const urlList = [modalData.urls.frontUrl, modalData.urls.backUrl, modalData.urls.selfieUrl];

    let newIndex = modalData.currentIndex + direction;
    if (newIndex < 0) newIndex = 2;
    if (newIndex > 2) newIndex = 0;

    setZoom(1);
    setRotation(0);
    setModalData({
      ...modalData,
      currentIndex: newIndex,
      title: titles[newIndex],
      url: urlList[newIndex],
    });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.max(0.5, Math.min(3, +(prev + delta).toFixed(2))));
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const openApproveModal = (doc: KycItem) => {
    setFeedback(null);
    setDecisionModal({
      type: "APPROVED",
      doc,
      reason: "",
      formError: null,
    });
  };

  const openRejectModal = (doc: KycItem) => {
    setFeedback(null);
    setDecisionModal({
      type: "REJECTED",
      doc,
      reason: "Foto borrosa o documento no coincide con selfie",
      formError: null,
    });
  };

  const handleConfirmDecision = async () => {
    if (!decisionModal) return;

    const { type, doc, reason } = decisionModal;
    const trimmedReason = reason.trim();

    if (type === "REJECTED" && !trimmedReason) {
      setDecisionModal((prev) =>
        prev ? { ...prev, formError: "Debes indicar el motivo del rechazo antes de continuar." } : null
      );
      return;
    }

    setLoadingId(doc.id);
    setDecisionModal((prev) => (prev ? { ...prev, formError: null } : null));

    try {
      const res = await reviewKycAction(
        doc.id,
        type,
        type === "REJECTED" ? trimmedReason : undefined
      );

      if (res?.error) {
        setDecisionModal((prev) => (prev ? { ...prev, formError: res.error } : null));
        setFeedback({ type: "error", message: res.error });
        setLoadingId(null);
        return;
      }

      setDocs((prev) =>
        prev.map((item) =>
          item.id === doc.id
            ? {
                ...item,
                status: type,
                rejectionReason: type === "REJECTED" ? trimmedReason : null,
              }
            : item
        )
      );
      setDecisionModal(null);
      setLoadingId(null);
      setFeedback({
        type: "success",
        message:
          type === "APPROVED"
            ? `Validación KYC de @${doc.username} aprobada y cuenta activada correctamente.`
            : `Solicitud KYC de @${doc.username} rechazada correctamente.`,
      });
      router.refresh();
    } catch {
      const fallbackError =
        type === "APPROVED" ? "Error aprobando la validación KYC." : "Error rechazando la validación KYC.";
      setDecisionModal((prev) => (prev ? { ...prev, formError: fallbackError } : null));
      setFeedback({ type: "error", message: fallbackError });
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-xs sm:text-sm font-semibold shadow-lg transition-all ${
            feedback.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-300"
              : "bg-red-950/90 border-red-500/40 text-red-300"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-white/10 transition shrink-0"
            aria-label="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {docs.length > 0 ? (
        docs.map((doc) => (
          <div
            key={doc.id}
            className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl flex flex-col gap-5"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-slate-400 block mb-0.5">
                  Creadora: <strong className="text-white text-sm">@{doc.username}</strong>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Enviado: {new Date(doc.createdAt).toLocaleString("es-VE")}
                </span>
              </div>

              <div>
                {doc.status === "PENDING" && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                    Pendiente de Revisión
                  </span>
                )}
                {doc.status === "APPROVED" && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Aprobado ✓
                  </span>
                )}
                {doc.status === "REJECTED" && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                    Rechazado ({doc.rejectionReason})
                  </span>
                )}
              </div>
            </div>

            {/* Datos extraídos */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-slate-950 border border-slate-800/80 rounded-2xl text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Tipo Doc:</span>
                <span className="text-amber-300 font-bold text-xs">{doc.documentType}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Número ID / Cédula:</span>
                <span className="text-white font-mono font-bold text-sm">{doc.extractedCedula || "—"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Nombre Completo:</span>
                <span className="text-white font-semibold">{doc.extractedFullName || "—"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Nacimiento:</span>
                <span className="text-emerald-400 font-semibold">{doc.extractedBirthDate || "—"} (≥ 18 años)</span>
              </div>
            </div>

            {/* Galería interactiva de las 3 fotos privadas en R2 con clic para abrir modal */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-rose-400" />
                  Documentación Fotográfica (Haz clic en cualquier imagen para abrirla y hacer zoom)
                </span>
                <span className="text-[11px] text-slate-500">
                  Preserva orientación nativa
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Frente */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 block">1. Cédula Frente</span>
                  <div
                    onClick={() => doc.urls.frontUrl && openModal(doc, 0)}
                    className="h-52 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 hover:border-rose-500/70 flex items-center justify-center relative cursor-pointer group transition p-2 shadow-inner"
                    title="Haz clic para ampliar la foto frontal"
                  >
                    {doc.urls.frontUrl ? (
                      <>
                        <img
                          src={doc.urls.frontUrl}
                          alt="Frente"
                          className="max-h-full w-auto max-w-full object-contain rounded-lg transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 backdrop-blur-xs">
                          <div className="p-2 rounded-full bg-rose-600 text-white shadow-lg">
                            <ZoomIn className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-bold text-white bg-slate-900/90 px-3 py-1 rounded-full border border-slate-700 shadow-md">
                            Ampliar Frente
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-slate-600">No disponible</span>
                    )}
                  </div>
                </div>

                {/* 2. Reverso */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 block">2. Cédula Reverso</span>
                  <div
                    onClick={() => doc.urls.backUrl && openModal(doc, 1)}
                    className="h-52 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 hover:border-rose-500/70 flex items-center justify-center relative cursor-pointer group transition p-2 shadow-inner"
                    title="Haz clic para ampliar la foto posterior"
                  >
                    {doc.urls.backUrl ? (
                      <>
                        <img
                          src={doc.urls.backUrl}
                          alt="Reverso"
                          className="max-h-full w-auto max-w-full object-contain rounded-lg transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 backdrop-blur-xs">
                          <div className="p-2 rounded-full bg-rose-600 text-white shadow-lg">
                            <ZoomIn className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-bold text-white bg-slate-900/90 px-3 py-1 rounded-full border border-slate-700 shadow-md">
                            Ampliar Reverso
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-slate-600">No disponible</span>
                    )}
                  </div>
                </div>

                {/* 3. Selfie */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 block">3. Selfie con Cédula</span>
                  <div
                    onClick={() => doc.urls.selfieUrl && openModal(doc, 2)}
                    className="h-52 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 hover:border-rose-500/70 flex items-center justify-center relative cursor-pointer group transition p-2 shadow-inner"
                    title="Haz clic para ampliar la selfie de prueba de vida"
                  >
                    {doc.urls.selfieUrl ? (
                      <>
                        <img
                          src={doc.urls.selfieUrl}
                          alt="Selfie"
                          className="max-h-full w-auto max-w-full object-contain rounded-lg transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 backdrop-blur-xs">
                          <div className="p-2 rounded-full bg-rose-600 text-white shadow-lg">
                            <ZoomIn className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-bold text-white bg-slate-900/90 px-3 py-1 rounded-full border border-slate-700 shadow-md">
                            Ampliar Selfie
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-slate-600">No disponible</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            {doc.status === "PENDING" && (
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={loadingId === doc.id}
                  onClick={() => openRejectModal(doc)}
                  className="px-4 py-2 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  disabled={loadingId === doc.id}
                  onClick={() => openApproveModal(doc)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/30 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Aprobar Mayoría de Edad
                </button>
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="text-center py-12 text-slate-500 text-xs">
          No hay solicitudes de KYC pendientes por revisar.
        </div>
      )}

      {/* MODAL PERSONALIZADO DE CONFIRMACIÓN / RECHAZO KYC (SIN ALERT/CONFIRM/PROMPT NATIVOS) */}
      {decisionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => {
            if (!loadingId) setDecisionModal(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="kyc-decision-title"
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                    decisionModal.type === "APPROVED"
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-red-500/15 border-red-500/30 text-red-400"
                  }`}
                >
                  {decisionModal.type === "APPROVED" ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 id="kyc-decision-title" className="text-base sm:text-lg font-black text-white">
                    {decisionModal.type === "APPROVED"
                      ? "Aprobar Verificación KYC"
                      : "Rechazar Verificación KYC"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Creadora:{" "}
                    <strong className="text-rose-400 font-mono">@{decisionModal.doc.username}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={Boolean(loadingId)}
                onClick={() => setDecisionModal(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition disabled:opacity-50"
                aria-label="Cerrar ventana"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {decisionModal.type === "APPROVED" ? (
              <div className="space-y-3">
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  ¿Confirmas aprobar la validación de identidad y activar la cuenta de creadora para{" "}
                  <strong className="text-white">@{decisionModal.doc.username}</strong>?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Documento</span>
                    <span className="text-amber-300 font-bold">
                      {decisionModal.doc.documentType} · {decisionModal.doc.extractedCedula || "Sin ID"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Nombre</span>
                    <span className="text-white font-semibold">
                      {decisionModal.doc.extractedFullName || "—"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-300">
                  Motivo del rechazo (visible para la creadora)
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {REJECTION_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setDecisionModal((prev) =>
                          prev ? { ...prev, reason: preset, formError: null } : null
                        )
                      }
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition font-medium ${
                        decisionModal.reason.trim() === preset
                          ? "bg-red-500/20 border-red-500/50 text-red-300"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={decisionModal.reason}
                  onChange={(e) =>
                    setDecisionModal((prev) =>
                      prev ? { ...prev, reason: e.target.value, formError: null } : null
                    )
                  }
                  placeholder="Describe claramente por qué se rechaza el documento..."
                  className="w-full rounded-2xl bg-slate-950 border border-slate-800 focus:border-red-500/60 focus:outline-none px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-600 resize-none"
                />
              </div>
            )}

            {decisionModal.formError && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{decisionModal.formError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={Boolean(loadingId)}
                onClick={() => setDecisionModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(loadingId)}
                onClick={handleConfirmDecision}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md disabled:opacity-50 ${
                  decisionModal.type === "APPROVED"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30"
                    : "bg-red-600 hover:bg-red-700 shadow-red-600/30"
                }`}
              >
                {loadingId ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : decisionModal.type === "APPROVED" ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirmar Aprobación</span>
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Confirmar Rechazo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LIGHTBOX PARA INSPECCIONAR FOTOS KYC EN ALTA RESOLUCIÓN */}
      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
            {/* Cabecera del Modal */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    {modalData.title}
                  </h3>
                  <span className="text-xs text-rose-400 font-mono">@{modalData.username}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                  {modalData.extractedCedula && (
                    <span className="bg-slate-950 px-2 py-0.5 rounded-md font-mono text-slate-300 border border-slate-800">
                      Cédula: <strong className="text-white">{modalData.extractedCedula}</strong>
                    </span>
                  )}
                  {modalData.extractedFullName && (
                    <span className="bg-slate-950 px-2 py-0.5 rounded-md text-slate-300 border border-slate-800">
                      Nombre: <strong className="text-white">{modalData.extractedFullName}</strong>
                    </span>
                  )}
                  {modalData.extractedBirthDate && (
                    <span className="bg-slate-950 px-2 py-0.5 rounded-md text-emerald-300 border border-emerald-500/30">
                      Nacimiento: <strong>{modalData.extractedBirthDate}</strong> (≥ 18)
                    </span>
                  )}
                </div>
              </div>

              {/* Barra de herramientas (Zoom, Rotar, Enlace externo y Cerrar) */}
              <div className="flex items-center gap-1.5 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => handleZoom(-0.2)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Alejar (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold text-slate-400 px-1 min-w-[42px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => handleZoom(0.2)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Acercar (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRotate}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Girar 90 grados (R)"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                {(zoom !== 1 || rotation !== 0) && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white transition"
                    title="Restablecer vista"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <a
                  href={modalData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Abrir imagen original en nueva pestaña"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setModalData(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white transition ml-1"
                  title="Cerrar modal (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Visor central de imagen en alta resolución */}
            <div className="py-3 flex-1 flex items-center justify-center min-h-[380px] max-h-[66vh] overflow-hidden relative bg-black/70 rounded-2xl border border-slate-800/80 my-3">
              {/* Botón imagen anterior */}
              <button
                type="button"
                onClick={() => navigateModal(-1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 z-10 transition backdrop-blur-xs shadow-xl"
                title="Foto anterior (←)"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={modalData.url}
                alt={modalData.title}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
                className="max-h-[62vh] w-auto max-w-full object-contain transition-transform duration-200 select-none drop-shadow-2xl"
              />

              {/* Botón siguiente imagen */}
              <button
                type="button"
                onClick={() => navigateModal(1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 z-10 transition backdrop-blur-xs shadow-xl"
                title="Foto siguiente (→)"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de fotos inferior */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-400">
                Usa las flechas del teclado <strong className="text-slate-300">← →</strong> para alternar o <strong className="text-slate-300">R</strong> para rotar.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openModal({ ...modalData, id: "", userId: "", documentType: "CEDULA_VE", ageVerified: 1, status: "PENDING", createdAt: "", urls: modalData.urls }, 0)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    modalData.currentIndex === 0
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  1. Frente
                </button>
                <button
                  type="button"
                  onClick={() => openModal({ ...modalData, id: "", userId: "", documentType: "CEDULA_VE", ageVerified: 1, status: "PENDING", createdAt: "", urls: modalData.urls }, 1)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    modalData.currentIndex === 1
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  2. Reverso
                </button>
                <button
                  type="button"
                  onClick={() => openModal({ ...modalData, id: "", userId: "", documentType: "CEDULA_VE", ageVerified: 1, status: "PENDING", createdAt: "", urls: modalData.urls }, 2)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    modalData.currentIndex === 2
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  3. Selfie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
