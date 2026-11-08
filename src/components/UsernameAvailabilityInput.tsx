"use client";

import { useState, useEffect, useRef } from "react";
import { checkUsernameAvailabilityAction } from "@/actions/creator";
import { CheckCircle2, XCircle, Loader2, Sparkles, RefreshCw } from "lucide-react";

interface Props {
  initialUsername?: string;
  currentUsername?: string;
  displayNameHint?: string;
  label?: string;
  required?: boolean;
  onValidityChange?: (isValid: boolean, username: string) => void;
}

/**
 * Campo interactivo para Nombre de Usuario (Enlace del perfil: kontenido.online/tu_usuario)
 * - Valida disponibilidad en tiempo real contra Turso DB
 * - Muestra indicador verde "Perfil Disponible" cuando está libre
 * - Habilita herramienta de sugerencias inteligentes clicables cuando no está disponible o a petición
 */
export default function UsernameAvailabilityInput({
  initialUsername = "",
  currentUsername,
  displayNameHint,
  label = "Nombre de Usuario (Enlace del perfil)",
  required = true,
  onValidityChange,
}: Props) {
  const [value, setValue] = useState(initialUsername);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<{
    available: boolean;
    isCurrent: boolean;
    reason: string;
    suggestions: string[];
  } | null>(
    initialUsername
      ? {
          available: true,
          isCurrent: initialUsername === currentUsername,
          reason:
            initialUsername === currentUsername
              ? "Enlace actual activo"
              : "Perfil Disponible",
          suggestions: [],
        }
      : null
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runCheck = async (targetVal: string) => {
    const clean = targetVal
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    if (!clean) {
      setStatus(null);
      setChecking(false);
      onValidityChange?.(false, "");
      return;
    }

    if (clean.length < 3) {
      setStatus({
        available: false,
        isCurrent: false,
        reason: "Mínimo 3 caracteres (letras, números o guion bajo _)",
        suggestions: [],
      });
      setChecking(false);
      onValidityChange?.(false, clean);
      return;
    }

    setChecking(true);
    try {
      const res = await checkUsernameAvailabilityAction(
        clean,
        currentUsername,
        displayNameHint
      );
      setStatus({
        available: res.available,
        isCurrent: res.isCurrent,
        reason: res.reason,
        suggestions: res.suggestions || [],
      });
      onValidityChange?.(res.available, res.cleanUsername);
    } catch {
      setChecking(false);
    } finally {
      setChecking(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = e.target.value
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 30);

    setValue(formatted);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      runCheck(formatted);
    }, 280);
  };

  // Herramienta para generar sugerencias basadas en lo escrito o en el nombre para mostrar
  const handleGenerateSuggestions = async () => {
    const seed = value.trim() || displayNameHint || "creadora";
    setChecking(true);
    try {
      // Pasamos currentUsername como undefined y forzamos búsqueda de variantes
      const res = await checkUsernameAvailabilityAction(
        seed,
        "__force_suggestions__",
        displayNameHint
      );
      // Si el seed base no tenía sugerencias porque estaba libre, pedimos variantes del nombre
      if (res.suggestions && res.suggestions.length > 0) {
        setStatus((prev) => ({
          available: prev?.available ?? true,
          isCurrent: prev?.isCurrent ?? false,
          reason: prev?.reason || "Perfil Disponible",
          suggestions: res.suggestions,
        }));
      } else {
        const cleanSeed = seed
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 18) || "creadora";
        const rand = Math.floor(10 + Math.random() * 89);
        const fallbackSuggestions = [
          `${cleanSeed}_ve`,
          `${cleanSeed}_vip`,
          `soy_${cleanSeed}`,
          `${cleanSeed}_oficial`,
          `${cleanSeed}_${rand}`,
        ];
        setStatus((prev) => ({
          available: prev?.available ?? true,
          isCurrent: prev?.isCurrent ?? false,
          reason: prev?.reason || "Perfil Disponible",
          suggestions: fallbackSuggestions,
        }));
      }
    } finally {
      setChecking(false);
    }
  };

  const handleSelectSuggestion = (suggested: string) => {
    setValue(suggested);
    setStatus({
      available: true,
      isCurrent: false,
      reason: "Perfil Disponible",
      suggestions: [],
    });
    onValidityChange?.(true, suggested);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const isAvailableGreen = status?.available && !checking && value.length >= 3;
  const isTakenRed = status && !status.available && !checking;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-slate-300">
          {label}
        </label>
        <button
          type="button"
          onClick={handleGenerateSuggestions}
          className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition cursor-pointer"
          title="Sugerir ideas de nombres disponibles"
        >
          <Sparkles className="w-3 h-3" />
          Sugerir nombres
        </button>
      </div>

      <div className="relative">
        <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm select-none">
          @
        </span>
        <input
          name="username"
          type="text"
          required={required}
          value={value}
          onChange={handleChange}
          placeholder="ej: vanessa_ve"
          autoComplete="off"
          className={`w-full bg-slate-950 rounded-xl py-2.5 pl-8 pr-36 text-white placeholder-slate-600 text-sm transition focus:outline-hidden ${
            isAvailableGreen
              ? "border-2 border-emerald-500 ring-2 ring-emerald-500/20"
              : isTakenRed
              ? "border-2 border-red-500 ring-2 ring-red-500/20"
              : "border border-slate-800 focus:border-rose-500"
          }`}
        />

        {/* Indicador en vivo dentro del campo */}
        <div className="absolute right-2.5 top-2 flex items-center">
          {checking ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
              Verificando...
            </span>
          ) : isAvailableGreen ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[11px] font-black shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {status?.isCurrent ? "Enlace Actual" : "Perfil Disponible"}
            </span>
          ) : isTakenRed ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-[11px] font-black">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              No disponible
            </span>
          ) : null}
        </div>
      </div>

      {/* Vista previa del enlace público y estado en verde o alerta */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-400">
          Tu enlace será:{" "}
          <strong
            className={
              isAvailableGreen
                ? "text-emerald-400 font-bold"
                : isTakenRed
                ? "text-red-400 line-through"
                : "text-slate-200"
            }
          >
            kontenido.online/{value || "tu_usuario"}
          </strong>
        </span>

        {isAvailableGreen && !status?.isCurrent && (
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            ✓ ¡Disponible para usar!
          </span>
        )}
      </div>

      {/* Mensaje de error y Herramienta de Sugerencias Inteligentes cuando no está disponible (o cuando pide ideas) */}
      {isTakenRed && (
        <p className="text-xs text-red-400 font-medium flex items-center gap-1.5">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{status?.reason}</span>
        </p>
      )}

      {status?.suggestions && status.suggestions.length > 0 && (
        <div className="p-3.5 bg-slate-900/90 border border-emerald-500/30 rounded-2xl space-y-2.5 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Nombres disponibles sugeridos para ti (haz clic para elegir):
            </span>
            <button
              type="button"
              onClick={handleGenerateSuggestions}
              className="text-[10px] font-semibold text-slate-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Otras ideas
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {status.suggestions.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => handleSelectSuggestion(sug)}
                className="px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400 group-hover:text-white" />
                @{sug}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
