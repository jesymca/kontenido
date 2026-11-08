"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sparkles, Eye, ShieldCheck, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { registerCreatorAction, registerConsumerAction } from "@/actions/auth";
import { signIn } from "next-auth/react";
import PasswordInput from "@/components/PasswordInput";

/**
 * Pantalla de registro de KONTENIDO
 * Diseñada de acuerdo con 03_ROLES_Y_FLUJOS.md:
 * - Selección intuitiva con DOS tarjetas grandes: Creador vs Consumidor
 * - Integración de Google OAuth
 * - Comentarios en español
 */
export default function RegistroPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"CREATOR" | "CONSUMER">("CONSUMER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);

    try {
      const res =
        selectedRole === "CREATOR"
          ? await registerCreatorAction(formData)
          : await registerConsumerAction(formData);

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      setSuccess(
        selectedRole === "CREATOR"
          ? "¡Cuenta de creadora creada! Redirigiendo a verificación de identidad (KYC)..."
          : "¡Bienvenido a KONTENIDO! Redirigiendo a tu cuenta..."
      );

      setTimeout(() => {
        router.push(selectedRole === "CREATOR" ? "/panel/kyc" : "/login");
      }, 1500);
    } catch (err: any) {
      setError("Ocurrió un error inesperado al procesar el registro.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-slate-950">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative">
        <div className="text-center mb-8">
          {/* Logo oficial KONTENIDO */}
          <div className="flex justify-center mb-4">
            <Image
              src="/img/logo.png"
              alt="KONTENIDO"
              width={220}
              height={38}
              priority
              className="h-10 w-auto object-contain"
            />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Únete a KONTENIDO</h1>
          <p className="text-slate-400 text-sm mt-2">
            La plataforma más intuitiva para monetizar y descubrir creaciones exclusivas.
          </p>
        </div>

        {/* 1. Selección de tipo de cuenta con dos botones grandes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <button
            type="button"
            onClick={() => {
              setSelectedRole("CONSUMER");
              setError(null);
            }}
            className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden ${
              selectedRole === "CONSUMER"
                ? "bg-slate-800 border-rose-500 shadow-lg shadow-rose-500/10 ring-2 ring-rose-500/40"
                : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
              <Eye className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Quiero ver contenido</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Explora fotos y videos, suscríbete a tus creadoras favoritas y sube de nivel con KOIN.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedRole("CREATOR");
              setError(null);
            }}
            className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden ${
              selectedRole === "CREATOR"
                ? "bg-slate-800 border-rose-500 shadow-lg shadow-rose-500/10 ring-2 ring-rose-500/40"
                : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Quiero crear contenido</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Monetiza en 1 solo clic, recibe pagos semanales en PagoMóvil, Banco o Binance USDT.
            </p>
          </button>
        </div>

        {/* 2. Botón de inicio rápido con Google */}
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 hover:bg-slate-100 font-semibold py-3 px-4 rounded-xl transition text-sm mb-6 shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.41 7.34 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.59 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          Registrarse con Google
        </button>

        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-slate-900 px-3 text-xs text-slate-500 uppercase tracking-wider">
            O con correo electrónico
          </span>
        </div>

        {/* Mensajes de error o éxito */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}

        {/* Formulario de registro */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nombre de usuario (Tu enlace será: kontenido.com/tu_usuario)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-slate-500 text-sm">@</span>
              <input
                name="username"
                type="text"
                required
                placeholder="ej: vanessa_ve"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-8 pr-4 text-white placeholder-slate-600 text-sm focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Correo electrónico
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="tu@correo.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white placeholder-slate-600 text-sm focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
            />
          </div>

          <div>
            <PasswordInput
              name="password"
              label="Contraseña"
              required
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {/* Fecha de nacimiento para creadora (mayoría de edad requerida) */}
          {selectedRole === "CREATOR" ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Fecha de nacimiento (Debes ser mayor de 18 años)
              </label>
              <input
                name="birthDate"
                type="date"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
              />
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Validación de cédula requerida antes de publicar contenido.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                required
                id="ageCheck"
                className="mt-0.5 rounded border-slate-700 bg-slate-950 text-rose-600 focus:ring-rose-500"
              />
              <label htmlFor="ageCheck" className="text-xs text-slate-400 leading-snug">
                Declaro bajo fe de juramento que tengo 18 años o más y acepto los términos de uso de KONTENIDO.
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl transition text-sm shadow-lg shadow-rose-600/20 disabled:opacity-50 mt-2"
          >
            {loading ? "Creando cuenta..." : "Crear mi cuenta"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center mt-6 text-xs text-slate-400">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-rose-400 font-semibold hover:underline">
            Inicia sesión aquí
          </Link>
        </div>
      </div>
    </div>
  );
}
