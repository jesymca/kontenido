"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Upload, AlertCircle, CheckCircle2, ArrowRight, Camera, FileText } from "lucide-react";
import { getKycUploadUrlsAction, submitKycAction } from "@/actions/kyc";
import Link from "next/link";

/**
 * Pantalla de Validación de Identidad (KYC) para Creadoras
 * Sube frente, reverso y selfie directamente a Cloudflare R2 privado.
 */
export default function KycPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!frontFile || !backFile || !selfieFile) {
      setError("Debes seleccionar las 3 fotos requeridas (frente, reverso y selfie).");
      setLoading(false);
      return;
    }

    try {
      // 1. Obtener URLs prefirmadas para subida directa a R2 privado
      const urlsRes = await getKycUploadUrlsAction();
      if (urlsRes.error || !urlsRes.urls) {
        setError(urlsRes.error || "Error generando URLs de subida.");
        setLoading(false);
        return;
      }

      // 2. Subir directamente a Cloudflare R2 sin pasar por Vercel
      await Promise.all([
        fetch(urlsRes.urls.front, { method: "PUT", body: frontFile, headers: { "Content-Type": "image/jpeg" } }),
        fetch(urlsRes.urls.back, { method: "PUT", body: backFile, headers: { "Content-Type": "image/jpeg" } }),
        fetch(urlsRes.urls.selfie, { method: "PUT", body: selfieFile, headers: { "Content-Type": "image/jpeg" } }),
      ]);

      // 3. Confirmar datos en base de datos
      const formEl = e.currentTarget;
      const formData = new FormData(formEl);
      formData.set("docId", urlsRes.docId);
      formData.set("frontKey", urlsRes.frontKey);
      formData.set("backKey", urlsRes.backKey);
      formData.set("selfieKey", urlsRes.selfieKey);

      const submitRes = await submitKycAction(formData);
      if (submitRes.error) {
        setError(submitRes.error);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/panel/contrato");
      }, 1500);
    } catch (err: any) {
      setError("Error durante la subida o procesamiento de los documentos.");
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Validación de Mayoría de Edad (KYC)</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Requisito obligatorio para creadoras venezolanas en KONTENIDO.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Documentos enviados con éxito. Redirigiendo a la firma del contrato...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Número de Cédula de Identidad
              </label>
              <input
                name="idNumber"
                type="text"
                required
                placeholder="ej: V-25123456"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nombres y Apellidos completos
              </label>
              <input
                name="fullName"
                type="text"
                required
                placeholder="Como figura en la cédula"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Fecha de Nacimiento (Debes tener ≥ 18 años)
            </label>
            <input
              name="birthDate"
              type="date"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden transition"
            />
          </div>

          {/* Subida de fotos */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-rose-500" />
              Fotografías requeridas (Claras y legibles)
            </h3>

            {/* Frente */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-200 block">1. Frente de la Cédula</span>
                <span className="text-[11px] text-slate-500">Sin reflejos, donde se vea la foto y datos.</span>
              </div>
              <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition shrink-0 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                {frontFile ? "Cargado ✓" : "Seleccionar"}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {/* Reverso */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-200 block">2. Reverso de la Cédula</span>
                <span className="text-[11px] text-slate-500">Fotografía posterior del documento.</span>
              </div>
              <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition shrink-0 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                {backFile ? "Cargado ✓" : "Seleccionar"}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => setBackFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {/* Selfie */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-200 block">3. Selfie sosteniendo la Cédula</span>
                <span className="text-[11px] text-slate-500">Tu rostro y el documento deben verse nítidos.</span>
              </div>
              <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition shrink-0 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                {selfieFile ? "Cargado ✓" : "Seleccionar"}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || success}
              className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl transition text-sm shadow-lg shadow-rose-600/30 disabled:opacity-50"
            >
              {loading ? "Subiendo documentos a R2..." : "Enviar a Validación y Continuar"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
