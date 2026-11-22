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

interface CedulaOcrScannerProps {
  isVenezuela?: boolean;
  countryName?: string;
}

export default function CedulaOcrScanner({
  isVenezuela = true,
  countryName = "Venezuela",
}: CedulaOcrScannerProps) {
  const router = useRouter();
  const [documentType, setDocumentType] = useState<"CEDULA_VE" | "NATIONAL_ID" | "PASSPORT">(
    isVenezuela ? "CEDULA_VE" : "NATIONAL_ID"
  );

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
  const [ocrMeta, setOcrMeta] = useState<{
    birthDateIso: string;
    idNumber: string;
    confidence: number;
    markersCount: number;
    mrzValid: boolean;
    birthDateSource: string;
  } | null>(null);

  // Formulario editable
  const [idNumber, setIdNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);

  // Estados de envío
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    autoApproved: boolean;
    summary?: string;
  } | null>(null);

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

  // Preprocesa la imagen en canvas (escala de grises + mejora de contraste) para segundo intento OCR
  const createEnhancedImageBlob = (file: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          URL.revokeObjectURL(url);
          const maxSide = 1600;
          const minSide = 900;
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (!w || !h) return resolve(null);

          const scale =
            Math.max(w, h) > maxSide
              ? maxSide / Math.max(w, h)
              : Math.max(w, h) < minSide
              ? minSide / Math.max(w, h)
              : 1;
          w = Math.round(w * scale);
          h = Math.round(h * scale);

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);

          ctx.drawImage(img, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;
          const contrast = 1.45;
          const intercept = 128 * (1 - contrast);

          for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const boosted = Math.max(0, Math.min(255, gray * contrast + intercept));
            data[i] = boosted;
            data[i + 1] = boosted;
            data[i + 2] = boosted;
          }
          ctx.putImageData(imgData, 0, 0);
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  };

  // Motor OCR Client-side nativo (Tesseract.js + parser Cédula VE / ID / MRZ ICAO)
  const runClientOcr = async (file: File) => {
    setOcrLoading(true);
    setOcrProgress(10);
    setOcrStatusText("Preparando motor OCR nativo...");
    setOcrMeta(null);

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
            setOcrStatusText(`Reconociendo texto y verificando edad: ${p}%`);
          }
        },
      });

      setOcrStatusText("Extrayendo campos (Documento, Nombres, Fecha de Nacimiento)...");
      const firstPass = await worker.recognize(file);
      let bestText = firstPass.data?.text || "";
      let bestConfidence = Number(firstPass.data?.confidence || 0);
      let parsed = parseVenezuelanId(bestText, documentType);

      // Si el primer intento no detectó fecha de nacimiento o número de documento, intentar con imagen mejorada en alto contraste
      if (!parsed.birthDateIso || !parsed.cedula) {
        setOcrStatusText("Optimizando contraste para mejorar lectura...");
        const enhancedBlob = await createEnhancedImageBlob(file);
        if (enhancedBlob) {
          const secondPass = await worker.recognize(enhancedBlob);
          const secondText = secondPass.data?.text || "";
          const secondConf = Number(secondPass.data?.confidence || 0);
          const secondParsed = parseVenezuelanId(secondText, documentType);

          const firstScore =
            (parsed.mrzValid ? 100 : 0) +
            (parsed.birthDateIso ? 40 : 0) +
            (parsed.cedula ? 30 : 0) +
            (parsed.documentMarkersFound || 0) * 5;
          const secondScore =
            (secondParsed.mrzValid ? 100 : 0) +
            (secondParsed.birthDateIso ? 40 : 0) +
            (secondParsed.cedula ? 30 : 0) +
            (secondParsed.documentMarkersFound || 0) * 5;

          if (secondScore > firstScore) {
            parsed = secondParsed;
            bestConfidence = Math.max(bestConfidence, secondConf);
          } else {
            // Combinar campos faltantes si el segundo intento aportó algo que faltaba
            if (!parsed.birthDateIso && secondParsed.birthDateIso) {
              parsed.birthDateIso = secondParsed.birthDateIso;
              parsed.fechaNacimiento = secondParsed.fechaNacimiento;
              parsed.age = secondParsed.age;
              parsed.isAdult = secondParsed.isAdult;
              parsed.birthDateSource = secondParsed.birthDateSource;
              parsed.mrzValid = parsed.mrzValid || secondParsed.mrzValid;
            }
            if (!parsed.cedula && secondParsed.cedula) {
              parsed.cedula = secondParsed.cedula;
              parsed.rawCedula = secondParsed.rawCedula;
            }
            if (!parsed.fullName && secondParsed.fullName) {
              parsed.fullName = secondParsed.fullName;
            }
            parsed.documentMarkersFound = Math.max(
              parsed.documentMarkersFound || 0,
              secondParsed.documentMarkersFound || 0
            );
            bestConfidence = Math.max(bestConfidence, secondConf);
          }
        }
      }

      await worker.terminate();

      setExtractedData(parsed);
      setOcrMeta({
        birthDateIso: parsed.birthDateIso || "",
        idNumber: parsed.cedula || "",
        confidence: Math.round(bestConfidence * 10) / 10,
        markersCount: parsed.documentMarkersFound || 0,
        mrzValid: Boolean(parsed.mrzValid),
        birthDateSource: parsed.birthDateSource || "NONE",
      });

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
      if (parsed.birthDateIso && parsed.isAdult && parsed.cedula) {
        setOcrStatusText(
          `✓ Mayoría de edad detectada automáticamente (${parsed.age} años). Elegible para aprobación instantánea.`
        );
      } else if (parsed.birthDateIso && !parsed.isAdult) {
        setOcrStatusText(
          `⚠️ El documento indica ${parsed.age} años (menor de 18 años). No elegible.`
        );
      } else {
        setOcrStatusText("Lectura completada. Revisa o completa los campos antes de enviar.");
      }
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
      setError("Debes subir las 3 fotografías requeridas: Frente del Documento, Reverso y Selfie con Documento.");
      setSubmitting(false);
      return;
    }

    if (!idNumber.trim() || !fullName.trim() || !birthDate) {
      setError("Por favor completa el número de documento, nombre completo y fecha de nacimiento.");
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

      // 3. Registrar documento en la base de datos y evaluar aprobación automática (+18)
      const formData = new FormData();
      formData.set("docId", urlsRes.docId);
      formData.set("documentType", documentType);
      formData.set("frontKey", urlsRes.frontKey);
      formData.set("backKey", urlsRes.backKey);
      formData.set("selfieKey", urlsRes.selfieKey);
      formData.set("idNumber", idNumber.trim());
      formData.set("fullName", fullName.trim());
      formData.set("birthDate", birthDate);

      if (ocrMeta) {
        formData.set("ocrBirthDate", ocrMeta.birthDateIso);
        formData.set("ocrIdNumber", ocrMeta.idNumber);
        formData.set("ocrConfidence", String(ocrMeta.confidence));
        formData.set("ocrMarkersCount", String(ocrMeta.markersCount));
        formData.set("ocrMrzValid", ocrMeta.mrzValid ? "1" : "0");
        formData.set("ocrBirthDateSource", ocrMeta.birthDateSource);
      }

      const submitRes = await submitKycAction(formData);
      if (submitRes.error) {
        throw new Error(submitRes.error);
      }

      setSuccessInfo({
        autoApproved: Boolean(submitRes.autoApproved),
        summary: submitRes.summary,
      });
      setTimeout(() => {
        router.push("/panel/contrato");
        router.refresh();
      }, 2200);
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
            Documento estrictamente privado y confidencial ({countryName})
          </strong>
          Tus fotos de identidad y selfie se guardan en almacenamiento cifrado de alta seguridad.{" "}
          <span className="text-emerald-400 font-semibold">
            Nunca serán públicas ni visibles para tus suscriptores.
          </span>{" "}
          Solo se utilizarán para validar que eres mayor de edad (≥ 18 años) y activar tu perfil de creadora.
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {successInfo && (
        <div
          className={`mb-6 p-4 rounded-xl text-xs flex items-start gap-2.5 border ${
            successInfo.autoApproved
              ? "bg-emerald-950/70 border-emerald-500/50 text-emerald-200"
              : "bg-amber-950/60 border-amber-500/40 text-amber-200"
          }`}
        >
          <CheckCircle2
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              successInfo.autoApproved ? "text-emerald-400" : "text-amber-400"
            }`}
          />
          <div>
            {successInfo.autoApproved ? (
              <>
                <strong className="text-emerald-300 block font-bold mb-0.5">
                  ¡Identidad y Mayoría de Edad APROBADAS automáticamente! ✓
                </strong>
                <span>
                  El sistema validó directamente tu documento (+18 años) y activó tu estatus a{" "}
                  <strong className="text-white">APROBADO</strong> al instante. Redirigiendo a firma de contrato...
                </span>
              </>
            ) : (
              <>
                <strong className="text-amber-300 block font-bold mb-0.5">
                  Documentación enviada para revisión manual
                </strong>
                <span>
                  No pudimos confirmar automáticamente todos los campos de la foto, por lo que tu solicitud quedó en{" "}
                  <strong className="text-white">EN REVISIÓN por Super Admin</strong>. Redirigiendo a firma de contrato...
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de documento */}
        <div>
          <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
            Tipo de Documento Oficial
          </label>
          <div className={`grid gap-2 ${isVenezuela ? "grid-cols-3" : "grid-cols-2"}`}>
            {isVenezuela && (
              <button
                type="button"
                onClick={() => setDocumentType("CEDULA_VE")}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                  documentType === "CEDULA_VE"
                    ? "bg-rose-600 text-white border-rose-500"
                    : "bg-slate-950 text-slate-300 border-slate-800"
                }`}
              >
                Cédula Venezolana
              </button>
            )}
            <button
              type="button"
              onClick={() => setDocumentType("NATIONAL_ID")}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                documentType === "NATIONAL_ID"
                  ? "bg-rose-600 text-white border-rose-500"
                  : "bg-slate-950 text-slate-300 border-slate-800"
              }`}
            >
              Documento / ID Nacional
            </button>
            <button
              type="button"
              onClick={() => setDocumentType("PASSPORT")}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                documentType === "PASSPORT"
                  ? "bg-rose-600 text-white border-rose-500"
                  : "bg-slate-950 text-slate-300 border-slate-800"
              }`}
            >
              Pasaporte Internacional
            </button>
          </div>
        </div>

        {/* PASO 1: Subir Frente del documento con OCR */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Scan className="w-4 h-4 text-rose-500" />
              1. {documentType === "PASSPORT" ? "Página Principal del Pasaporte" : documentType === "CEDULA_VE" ? "Cédula Frente (Con Escáner Inteligente)" : "Documento de Identidad Frente"}
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
            {!ocrLoading && ocrStatusText && (
              <div
                className={`mt-3 px-3 py-2 rounded-xl text-[11px] font-semibold border ${
                  ocrMeta?.birthDateIso && calculatedAge !== null && calculatedAge >= 18 && ocrMeta.idNumber
                    ? "bg-emerald-950/50 border-emerald-500/30 text-emerald-300"
                    : "bg-slate-900 border-slate-800 text-slate-300"
                }`}
              >
                {ocrStatusText}
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
                {documentType === "CEDULA_VE"
                  ? "Número de Cédula de Identidad"
                  : documentType === "PASSPORT"
                  ? "Número de Pasaporte"
                  : "Número de Documento Nacional"}
              </label>
              <input
                type="text"
                required
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder={documentType === "CEDULA_VE" ? "ej: V-18452921" : "ej: AB1234567"}
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
          disabled={submitting || Boolean(successInfo)}
          className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 px-4 rounded-xl transition text-sm shadow-lg shadow-rose-600/30 disabled:opacity-50"
        >
          {submitting
            ? "Verificando mayoría de edad y subiendo..."
            : "Enviar y Validar Mayoría de Edad"}
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
