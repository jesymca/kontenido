"use client";

import { useState, useRef, useEffect } from "react";
import {
  Camera,
  SwitchCamera,
  Video,
  X,
  Check,
  RotateCcw,
  Square,
  Sparkles,
  AlertCircle,
} from "lucide-react";

interface MediaCaptureModalProps {
  mode: "photo" | "video" | "both"; // Tipo de captura permitido
  defaultFacingMode?: "user" | "environment"; // "user" = frontal / selfie, "environment" = trasera
  title?: string;
  onCapture: (file: File) => void;
  onClose: () => void;
}

/**
 * Modal universal de Cámara WebRTC para Celular y Desktop
 * - Permite alternar con un botón entre Cámara Trasera (environment) y Cámara Frontal / Selfie (user).
 * - Soporta tomar Fotos o Grabar Videos con temporizador y vista previa.
 * - Compatible con navegadores móviles (iOS Safari, Android Chrome) y escritorio.
 */
export default function MediaCaptureModal({
  mode = "both",
  defaultFacingMode = "environment",
  title = "Captura de Cámara",
  onCapture,
  onClose,
}: MediaCaptureModalProps) {
  const [facingMode, setFacingMode] = useState<"user" | "environment">(defaultFacingMode);
  const [activeTab, setActiveTab] = useState<"photo" | "video">(
    mode === "video" ? "video" : "photo"
  );
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados de grabación de video
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Vista previa de captura temporal antes de confirmar
  const [capturedPreview, setCapturedPreview] = useState<{
    url: string;
    blob: Blob;
    type: "photo" | "video";
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Iniciar la cámara según el modo (facingMode)
  const startCamera = async (facing: "user" | "environment") => {
    setError(null);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: activeTab === "video",
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.error("Error abriendo cámara:", err);
      setError(
        "No se pudo acceder a la cámara seleccionada. Revisa los permisos del navegador en tu teléfono."
      );
    }
  };

  useEffect(() => {
    if (!capturedPreview) {
      startCamera(facingMode);
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [facingMode, activeTab, capturedPreview]);

  // Alternar entre cámara frontal y trasera
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
  };

  // Tomar fotografía
  const handleTakePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Si es cámara selfie, reflejar para que no quede invertida
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setCapturedPreview({
            url,
            blob,
            type: "photo",
          });
        }
      },
      "image/jpeg",
      0.92
    );
  };

  // Iniciar grabación de video
  const handleStartRecording = () => {
    if (!stream) return;
    recordedChunksRef.current = [];

    try {
      const mimeTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ];
      const selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || "";

      const recorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const videoBlob = new Blob(recordedChunksRef.current, {
          type: selectedMime || "video/webm",
        });
        const url = URL.createObjectURL(videoBlob);
        setCapturedPreview({
          url,
          blob: videoBlob,
          type: "video",
        });
        setIsRecording(false);
        setRecordingSeconds(0);
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Error al iniciar grabación:", err);
      setError("No se pudo iniciar la grabación de video en este navegador.");
    }
  };

  // Detener grabación de video
  const handleStopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  // Confirmar archivo capturado
  const handleConfirm = () => {
    if (!capturedPreview) return;

    const extension = capturedPreview.type === "photo" ? "jpg" : "mp4";
    const filename = `camera_${Date.now()}.${extension}`;
    const file = new File([capturedPreview.blob], filename, {
      type: capturedPreview.blob.type || (capturedPreview.type === "photo" ? "image/jpeg" : "video/mp4"),
    });

    onCapture(file);
    handleCloseModal();
  };

  // Cerrar y detener cámara
  const handleCloseModal = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    onClose();
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-rose-500" />
              {title}
            </h3>
            <span className="text-[11px] text-slate-400">
              Cámara activa:{" "}
              <strong className="text-white">
                {facingMode === "user" ? "Frontal / Selfie" : "Trasera"}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!capturedPreview && (
              <button
                type="button"
                onClick={handleToggleFacingMode}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
                title="Cambiar entre cámara trasera y selfie"
              >
                <SwitchCamera className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">
                  {facingMode === "user" ? "Usar Trasera" : "Usar Selfie"}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCloseModal}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Visor de Cámara o Preview */}
        <div className="py-4 flex-1 flex flex-col items-center justify-center min-h-[300px] overflow-hidden relative">
          {error && (
            <div className="p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="w-full relative aspect-[4/3] sm:aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center">
            {capturedPreview ? (
              capturedPreview.type === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={capturedPreview.url}
                  alt="Captura"
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={capturedPreview.url}
                  controls
                  autoPlay
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`w-full h-full object-cover ${
                  facingMode === "user" ? "scale-x-[-1]" : ""
                }`}
              />
            )}

            {/* Contador de grabación en vivo */}
            {isRecording && (
              <div className="absolute top-3 left-3 bg-red-600/90 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-white" />
                <span>REC {formatTimer(recordingSeconds)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Selector de modo si permite ambos */}
        {!capturedPreview && mode === "both" && (
          <div className="flex justify-center gap-2 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab("photo")}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "photo"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Foto
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("video")}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "video"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              Video
            </button>
          </div>
        )}

        {/* Barra de Controles Inferior */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
          {capturedPreview ? (
            <>
              <button
                type="button"
                onClick={() => setCapturedPreview(null)}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                Repetir Captura
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Usar esta {capturedPreview.type === "photo" ? "Foto" : "Grabación"}
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              {activeTab === "photo" ? (
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  className="w-16 h-16 rounded-full bg-white hover:bg-slate-200 p-1 flex items-center justify-center transition shadow-xl active:scale-95 group"
                  title="Capturar Fotografía"
                >
                  <div className="w-13 h-13 rounded-full border-2 border-slate-950 bg-rose-600 group-hover:bg-rose-500 transition flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </button>
              ) : isRecording ? (
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 p-1 flex items-center justify-center transition shadow-xl shadow-red-600/40 active:scale-95 animate-pulse"
                  title="Detener Grabación"
                >
                  <Square className="w-6 h-6 text-white fill-white" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="w-16 h-16 rounded-full bg-white hover:bg-slate-200 p-1 flex items-center justify-center transition shadow-xl active:scale-95 group"
                  title="Iniciar Grabación de Video"
                >
                  <div className="w-13 h-13 rounded-full bg-red-600 group-hover:bg-red-500 transition flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
