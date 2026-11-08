"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, AlertTriangle } from "lucide-react";

interface AntiDownloadProtectionProps {
  isConsumer: boolean;
  canDownload: boolean; // True si es VIP o Super Admin
}

/**
 * Componente de Protección Anti-Descarga para Consumidores
 * Requerimiento:
 * "CONSUMIDOR podra ver el contenido dentro de la plataforma sin la posibilidad de DESCARGAR
 * de forma nativa de la plataforma con la posibilidad de suspenderle el usuario si se detecta
 * ese tipo de comportamiento y debe aplicarse ALERTA DEL COMPORTAMIENTO DETECTADO y SUSPENSION"
 */
export default function AntiDownloadProtection({
  isConsumer,
  canDownload,
}: AntiDownloadProtectionProps) {
  const router = useRouter();
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    // Si no es consumidor o si tiene permiso VIP de descarga, no se activa el bloqueo
    if (!isConsumer || canDownload) return;

    let warningCount = 0;

    const reportAndSuspend = async (action: string) => {
      try {
        const res = await fetch("/api/security/infraction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (data.suspended) {
          router.push("/suspendido");
        }
      } catch (e) {
        console.error("Error reportando infracción:", e);
      }
    };

    // 1. Bloquear clic derecho (Guardar imagen como, Inspeccionar elemento)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      warningCount++;
      if (warningCount >= 2) {
        setAlertMessage("🚨 Comportamiento indebido detectado: Intento reiterado de descarga. Suspendiendo cuenta...");
        reportAndSuspend("CLICK_DERECHO_GUARDAR_IMAGEN");
      } else {
        setAlertMessage("⚠️ ALERTA: La descarga y extracción de contenido está estrictamente prohibida en KONTENIDO. Tu cuenta será suspendida si continúas.");
        setTimeout(() => setAlertMessage(null), 4000);
      }
    };

    // 2. Interceptar atajos de teclado de captura o guardado (Ctrl+S, F12, Ctrl+Shift+I, etc.)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isSaveShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      const isDevToolsShortcut =
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "i");
      const isPrintScreen = e.key === "PrintScreen";

      if (isSaveShortcut || isDevToolsShortcut || isPrintScreen) {
        e.preventDefault();
        setAlertMessage("🚨 ALERTA DE COMPORTAMIENTO INDEBIDO: Atajo de captura o descarga interceptado. Aplicando suspensión de cuenta.");
        reportAndSuspend(
          isSaveShortcut
            ? "ATAJO_GUARDAR_ARCHIVO_CTRL_S"
            : isDevToolsShortcut
            ? "INSPECCION_DEVTOOLS_NO_AUTORIZADA"
            : "CAPTURA_PRINT_SCREEN"
        );
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isConsumer, canDownload, router]);

  if (!alertMessage) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[90%] p-4 bg-red-950/95 border-2 border-red-500 rounded-xl shadow-2xl backdrop-blur-md animate-bounce">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-7 h-7 text-red-400 shrink-0 mt-0.5 animate-pulse" />
        <div>
          <h4 className="text-white font-bold text-sm flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            CONTROL DE SEGURIDAD KONTENIDO
          </h4>
          <p className="text-red-200 text-xs mt-1 leading-relaxed">{alertMessage}</p>
        </div>
      </div>
    </div>
  );
}
