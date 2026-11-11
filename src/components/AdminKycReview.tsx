"use client";

import { useState, useEffect } from "react";
import { reviewKycAction } from "@/actions/admin";
import {
  Check,
  X,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
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

export default function AdminKycReview({ documents }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

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

  // Atajos de teclado para el modal (ESC para cerrar, Flechas para navegar, R para rotar)
  useEffect(() => {
    if (!modalData) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalData(null);
      } else if (e.key === "ArrowLeft") {
        navigateModal(-1);
      } else if (e.key === "ArrowRight") {
        navigateModal(1);
      } else if (e.key.toLowerCase() === "r") {
        handleRotate();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalData]);

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

  const handleApprove = async (id: string, username: string) => {
    if (!confirm(`¿Aprobar validación KYC y activar la cuenta de creadora para @${username}?`)) return;

    setLoadingId(id);
    try {
      const res = await reviewKycAction(id, "APPROVED");
      if (res.error) {
        alert(res.error);
        setLoadingId(null);
        return;
      }
      window.location.reload();
    } catch (e) {
      alert("Error aprobando KYC.");
      setLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Ingresa el motivo del rechazo:", "Foto borrosa o documento no coincide con selfie");
    if (!reason) return;

    setLoadingId(id);
    try {
      await reviewKycAction(id, "REJECTED", reason);
      window.location.reload();
    } catch (e) {
      alert("Error rechazando KYC.");
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {documents.length > 0 ? (
        documents.map((doc) => (
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-950 border border-slate-800/80 rounded-2xl text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Cédula:</span>
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
                  onClick={() => handleReject(doc.id)}
                  className="px-4 py-2 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-xl text-xs font-semibold transition"
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  disabled={loadingId === doc.id}
                  onClick={() => handleApprove(doc.id, doc.username)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/30 flex items-center gap-1.5"
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
