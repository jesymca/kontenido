"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Barra superior de progreso de navegación instantánea.
 * Responde en el mismo frame (< 16ms) al hacer clic en cualquier enlace interno,
 * eliminando la sensación de bloqueo mientras Next.js transmite la nueva sección.
 */
function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  // Completar la barra en cuanto cambia la ruta o los query params
  useEffect(() => {
    clearTimers();
    if (visible) {
      setProgress(100);
      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 180);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Escuchar clics en enlaces internos <a> para iniciar respuesta visual inmediata
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      try {
        const dest = new URL(anchor.href, window.location.href);
        if (dest.origin !== window.location.origin) return;
        const currentFull = `${window.location.pathname}${window.location.search}`;
        const destFull = `${dest.pathname}${dest.search}`;
        if (currentFull === destFull) return;

        clearTimers();
        setVisible(true);
        setProgress(24);

        timerRef.current = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 88) return prev;
            return prev + Math.max(2, (90 - prev) * 0.18);
          });
        }, 120);

        // Salvaguarda para no quedar fija si una navegación se cancela
        hideTimerRef.current = setTimeout(() => {
          clearTimers();
          setVisible(false);
          setProgress(0);
        }, 12000);
      } catch {
        // Ignorar URLs no válidas
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      clearTimers();
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[100] h-[3px] pointer-events-none bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 shadow-[0_0_10px_rgba(244,63,94,0.85)] transition-[width,opacity] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
