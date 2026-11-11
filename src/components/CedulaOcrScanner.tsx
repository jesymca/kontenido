"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Upload,
  AlertCircle,
  CheckCircle2,
  Camera,
  Scan,
  RefreshCw,
  Eye,
  Info,
  Lock,
} from "lucide-react";
import { getKycUploadUrlsAction, submitKycAction } from "@/actions/kyc";
import { parseVenezuelanId, ParsedVenezuelanId } from "@/lib/cedulaParser";
import MediaCaptureModal from "@/components/MediaCaptureModal";
import { Smartphone } from "lucide-react";

declare global {
  interface Window {
    Tesseract?: any;
  }
}

export default function CedulaOcrScanner() {
  const router = useRouter();

  // Estados de archivos
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  // Previsualizaciones locales
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  // Estados de OCR
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState("");
  const [extractedData, setExtractedData] = useState<ParsedVenezuelanId | null>(null);

  // Formulario editable
  const [idNumber, setIdNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);

  // Estados de envío
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Estados de captura de cámara (trasera vs selfie)
  const [cameraModalData, setCameraModalData] = useState<{
    target: "front" | "back" | "selfie";
    defaultFacingMode: "user" | "environment";
    title: string;
  } | null>(null);

  const handleCameraCapture = (file: File) => {
    if (!cameraModalData) return;

    if (cameraModalData.target === "front") {
      handleFrontFileChange(file);
    } else if (cameraModalData.target === "back") {
      setBackFile(file);
      setBackPreview(URL.createObjectURL(file));
    } else if (cameraModalData.target === "selfie") {
      setSelfieFile(file);
      setSelfiePreview(URL.createObjectURL(file));
    }

    setCameraModalData(null);
  };

  // Cargar script de Tesseract.js dinámicamente en el cliente
  useEffect(() => {
    if (typeof window !== "undefined" && !window.Tesseract) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Manejar selección de foto frontal y disparar OCR
  const handleFrontFileChange = async (file: File | null) => {
    if (!file) return;
    setFrontFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFrontPreview(objectUrl);
    setError(null);

    // Ejecutar extracción OCR automática
    await runClientOcr(file);
  };

  // Motor OCR Client-side inspirado en jesymca/reconocimiento_cedula
  const runClientOcr = async (file: File) => {
    setOcrLoading(true);
    setOcrProgress(10);
    setOcrStatusText("Preparando motor OCR...");

    try {
      // Esperar a que Tesseract.js esté disponible
      let attempts = 0;
      while (!window.Tesseract && attempts < 25) {
        await new Promise((r) => setTimeout(r, 200));
        attempts++;
      }

      if (!window.Tesseract) {
        throw new Error("No se pudo cargar el motor OCR. Puedes completar los campos manualmente.");
      }

      setOcrStatusText("Analizando documento de identidad...");
      const worker = await window.Tesseract.createWorker("spa", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            const p = Math.round((m.progress || 0) * 100);
            setOcrProgress(Math.max(20, p));
            setOcrStatusText(`Reconociendo texto: ${p}%`);
          }
        },
      });

      setOcrStatusText("Extrayendo campos (Cédula, Nombres, Fecha)...");
      const ret = await worker.recognize(file);
      const text = ret.data?.text || "";
      await worker.terminate();

      // Procesar texto mediante el parser especializado
      const parsed = parseVenezuelanId(text);
      setExtractedData(parsed);

      if (parsed.cedula) {
        setIdNumber(parsed.cedula);
      }
      if (parsed.fullName) {
        setFullName(parsed.fullName);
      }
      if (parsed.birthDateIso) {
        setBirthDate(parsed.birthDateIso);
        setCalculatedAge(parsed.age);
      }

      setOcrProgress(100);
      setOcrStatusText("¡Datos extraídos con éxito! Revisa y ajusta si es necesario.");
    } catch (err: any) {
      console.warn("OCR client-side notice:", err);
      setOcrStatusText("Extracción manual disponible. Ingresa tus datos en los campos a continuación.");
    } finally {
      setOcrLoading(false);
    }
  };

  // Recalcular edad si cambia manualmente la fecha de nacimiento
  const handleBirthDateChange = (val: string) => {
    setBirthDate(val);
    if (!val) {
      setCalculatedAge(null);
      return;
    }
    const birth = new Date(val);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    setCalculatedAge(age);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!frontFile || !backFile || !selfieFile) {
      setError("Debes subir las 3 fotografías requeridas: Cédula Frente, Cédula Reverso y Selfie con Cédula.");
      setSubmitting(false);
      return;
    }

    if (!idNumber.trim() || !fullName.trim() || !birthDate) {
      setError("Por favor completa tu número de cédula, nombre completo y fecha de nacimiento.");
      setSubmitting(false);
      return;
    }

    if (calculatedAge !== null && calculatedAge < 18) {
      setError("No cumples con la mayoría de edad requerida (18 años o más) para ser creadora de contenido.");
      setSubmitting(false);
      return;
    }

    try {
      // 1. Obtener URLs prefirmadas de subida para R2 Privado
      const urlsRes = await getKycUploadUrlsAction();
      if (urlsRes.error || !urlsRes.urls) {
        throw new Error(urlsRes.error || "Error al obtener URLs prefirmadas de R2.");
      }

      // 2. Subir directamente a Cloudflare R2 Privado
      await Promise.all([
        fetch(urlsRes.urls.front, { method: "PUT", body: frontFile, headers: { "Content-Type": "image/jpeg" } }),
        fetch(urlsRes.urls.back, { method: "PUT", body: backFile, headers: { "Content-Type": "image/jpeg" } }),
        fetch(urlsRes.urls.selfie, { method: "PUT", body: selfieFile, headers: { "Content-Type": "image/jpeg" } }),
      ]);

      // 3. Registrar documento en la base de datos
      const formData = new FormData();
      formData.set("docId", urlsRes.docId);
      formData.set("frontKey", urlsRes.frontKey);
      formData.set("backKey", urlsRes.backKey);
      formData.set("selfieKey", urlsRes.selfieKey);
      formData.set("idNumber", idNumber.trim());
      formData.set("fullName", fullName.trim());
      formData.set("birthDate", birthDate);

      const submitRes = await submitKycAction(formData);
      if (submitRes.error) {
        throw new Error(submitRes.error);
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/panel/contrato");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al enviar tu documentación.");
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative">
      {/* Aviso de Confidencialidad y Privacidad estricta */}
      <div className="mb-6 p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-start gap-3">
        <Lock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-white block font-semibold mb-0.5">
            Documento estrictamente privado y confidencial
          </strong>
          Tus fotos de la cédula y selfie se guardan en almacenamiento cifrado de alta seguridad.{" "}
          <span className="text-emerald-400 font-semibold">
            Nunca serán públicas ni visibles para tus suscriptores.
          </span>{" "}
          Solo se utilizarán para validar que eres mayor de edad según las leyes venezolanas y activar tu perfil.
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
          <span>
            ¡Documentación enviada con éxito! Tu cuenta queda en estado{" "}
            <strong>FALTA VERIFICAR (En revisión por Super Admin)</strong>. Redirigiendo a firma de contrato...
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PASO 1: Subir Frente de la Cédula con OCR */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Scan className="w-4 h-4 text-rose-500" />
              1. Cédula Frente (Con Escáner Inteligente)
            </label>
            {ocrLoading && (
              <span className="text-xs text-rose-400 animate-pulse flex items-center gap-1 font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Escaneando documento...
              </span>
            )}
          </div>

          <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/60 rounded-2xl p-5 text-center transition relative overflow-hidden">
            {frontPreview ? (
              <div className="flex flex-col items-center">
                <img
                  src={frontPreview}
                  alt="Cédula Frente"
                  className="max-h-52 w-auto object-contain rounded-xl border border-slate-800 mb-3"
                />
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    Cambiar foto de frente
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleFrontFileChange(e.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setCameraModalData({
                        target: "front",
                        defaultFacingMode: "environment",
                        title: "Tomar foto frontal de la Cédula",
                      })
                    }
                    className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Tomar con Cámara
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center">
                <Upload className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                <span className="text-white text-xs font-bold block mb-1">
                  Foto frontal de tu cédula
                </span>
                <span className="text-slate-500 text-[11px] mb-4 max-w-sm block">
                  El sistema leerá automáticamente tu cédula, nombre y fecha de nacimiento.
                </span>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    Subir desde Galería / Archivos
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleFrontFileChange(e.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setCameraModalData({
                        target: "front",
                        defaultFacingMode: "environment",
                        title: "Tomar foto frontal de la Cédula",
                      })
                    }
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Tomar con Cámara (Trasera / Selfie)
                  </button>
                </div>
              </div>
            )}

            {ocrLoading && (
              <div className="mt-3">
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 transition-all duration-300"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">{ocrStatusText}</span>
              </div>
            )}
          </div>
        </div>

        {/* PASO 2: Datos reconocidos editables */}
        <div className="p-5 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Datos Extraídos de la Cédula
            </h4>
            {calculatedAge !== null && (
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  calculatedAge >= 18
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}
              >
                {calculatedAge >= 18
                  ? `✓ Mayor de edad (${calculatedAge} años)`
                  : `Menor de edad (${calculatedAge} años)`}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Número de Cédula de Identidad
              </label>
              <input
                type="text"
                required
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="ej: V-18452921"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white font-mono text-sm focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nombres y Apellidos Completos
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Como figura en tu cédula"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Fecha de Nacimiento (Debe tener ≥ 18 años)
            </label>
            <input
              type="date"
              required
              value={birthDate}
              onChange={(e) => handleBirthDateChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* PASO 3: Fotos complementarias (Reverso y Selfie) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Reverso */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">2. Cédula Reverso</span>
              <span className="text-[11px] text-slate-500">Fotografía posterior de tu documento.</span>
            </div>
            {backPreview && (
              <div className="bg-slate-900/50 rounded-xl p-1 flex items-center justify-center">
                <img
                  src={backPreview}
                  alt="Reverso"
                  className="max-h-44 w-auto max-w-full object-contain rounded-lg border border-slate-800"
                />
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex-1 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition text-center flex items-center justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                {backFile ? "Cargado ✓ Cambiar" : "Galería"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setBackFile(f);
                    if (f) setBackPreview(URL.createObjectURL(f));
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setCameraModalData({
                    target: "back",
                    defaultFacingMode: "environment",
                    title: "Tomar foto del reverso de la Cédula",
                  })
                }
                className="flex-1 px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Cámara
              </button>
            </div>
          </div>

          {/* Selfie */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">3. Selfie con Cédula en Mano</span>
              <span className="text-[11px] text-slate-500">
                Prueba de vida: tu rostro y la cédula deben verse nítidos.
              </span>
            </div>
            {selfiePreview && (
              <div className="bg-slate-900/50 rounded-xl p-1 flex items-center justify-center">
                <img
                  src={selfiePreview}
                  alt="Selfie"
                  className="max-h-44 w-auto max-w-full object-contain rounded-lg border border-slate-800"
                />
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex-1 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition text-center flex items-center justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                {selfieFile ? "Cargado ✓ Cambiar" : "Galería"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setSelfieFile(f);
                    if (f) setSelfiePreview(URL.createObjectURL(f));
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setCameraModalData({
                    target: "selfie",
                    defaultFacingMode: "user",
                    title: "Tomar Selfie con Cédula en Mano",
                  })
                }
                className="flex-1 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Camera className="w-3.5 h-3.5" />
                Selfie
              </button>
            </div>
          </div>
        </div>

        {/* Botón de envío */}
        <button
          type="submit"
          disabled={submitting || success}
          className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 px-4 rounded-xl transition text-sm shadow-lg shadow-rose-600/30 disabled:opacity-50"
        >
          {submitting ? "Cifrando y subiendo a R2 Privado..." : "Enviar Validación de Identidad"}
        </button>
      </form>

      {cameraModalData && (
        <MediaCaptureModal
          onClose={() => setCameraModalData(null)}
          onCapture={handleCameraCapture}
          mode="photo"
          defaultFacingMode={cameraModalData.defaultFacingMode}
          title={cameraModalData.title}
        />
      )}
    </div>
  );
}
