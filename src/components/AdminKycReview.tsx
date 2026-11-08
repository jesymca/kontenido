"use client";

import { useState } from "react";
import { reviewKycAction } from "@/actions/admin";
import { Check, X, ShieldCheck, ExternalLink, AlertCircle } from "lucide-react";

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

            {/* Galería de las 3 fotos privadas en R2 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">1. Cédula Frente</span>
                <div className="h-44 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center relative">
                  {doc.urls.frontUrl ? (
                    <img src={doc.urls.frontUrl} alt="Frente" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-600">No disponible</span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">2. Cédula Reverso</span>
                <div className="h-44 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center relative">
                  {doc.urls.backUrl ? (
                    <img src={doc.urls.backUrl} alt="Reverso" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-600">No disponible</span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 block">3. Selfie con Cédula</span>
                <div className="h-44 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center relative">
                  {doc.urls.selfieUrl ? (
                    <img src={doc.urls.selfieUrl} alt="Selfie" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-600">No disponible</span>
                  )}
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
    </div>
  );
}
