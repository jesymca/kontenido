"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

/**
 * Componente de entrada de contraseña con "ojito" interactivo
 * para alternar entre mostrar y ocultar la contraseña.
 */
export default function PasswordInput({
  label,
  error,
  className,
  containerClassName,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={cn("w-full", containerClassName)}>
      {label && (
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          {...props}
          type={showPassword ? "text" : "password"}
          className={cn(
            "w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-3.5 pr-11 text-white placeholder-slate-600 text-sm focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500",
            className
          )}
        />

        {/* Botón de "ojito" para ver u ocultar contraseña */}
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800 focus:outline-hidden"
          title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
          aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4 text-rose-400" />
          ) : (
            <Eye className="w-4 h-4 text-slate-400 hover:text-white" />
          )}
        </button>
      </div>

      {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
    </div>
  );
}
