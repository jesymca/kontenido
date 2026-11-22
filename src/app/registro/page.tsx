"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  Eye,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Building2,
  Globe,
  Check,
  Info,
} from "lucide-react";
import {
  registerCreatorAction,
  registerConsumerAction,
  registerAgencyAction,
} from "@/actions/auth";
import { signIn } from "next-auth/react";
import PasswordInput from "@/components/PasswordInput";
import UsernameAvailabilityInput from "@/components/UsernameAvailabilityInput";
import { COUNTRIES, isVenezuelanUser } from "@/lib/countries";

type RoleSelection = "CREATOR" | "CONSUMER" | "AGENCY";

function parseRoleFromParam(raw: string | null): RoleSelection | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().trim();
  if (["creator", "creador", "creadora", "vender"].includes(normalized)) {
    return "CREATOR";
  }
  if (["consumer", "consumidor", "consumidora", "fan", "ver"].includes(normalized)) {
    return "CONSUMER";
  }
  if (["agency", "agencia"].includes(normalized)) {
    return "AGENCY";
  }
  return null;
}

/**
 * Pantalla de registro de KONTENIDO
 * - Paso 1 OBLIGATORIO: Siempre pregunta qué es la persona:
 *   1) CREADOR DE CONTENIDO
 *   2) CONSUMIDOR DE CONTENIDO
 *   3) AGENCIA
 * - Luego de crear la cuenta, redirige a completar la información básica del perfil
 *   (identidad HOMBRE / MUJER / PAREJA / TRANSGÉNERO e intereses para KOMESTIBLE).
 */
function RegistroContent() {
  const searchParams = useSearchParams();
  const initialParamRole = parseRoleFromParam(
    searchParams.get("rol") || searchParams.get("role") || searchParams.get("tipo")
  );

  // Nunca preseleccionar silenciosamente si el usuario llegó sin parámetro ?rol=
  const [selectedRole, setSelectedRole] = useState<RoleSelection | null>(
    initialParamRole
  );
  const [selectedCountry, setSelectedCountry] = useState<string>("VE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const paramRole = parseRoleFromParam(
      searchParams.get("rol") || searchParams.get("role") || searchParams.get("tipo")
    );
    if (paramRole) {
      setSelectedRole(paramRole);
    }
  }, [searchParams]);

  const isVzla = isVenezuelanUser(selectedCountry);

  const handleRoleChange = (role: RoleSelection) => {
    setSelectedRole(role);
    setError(null);
  };

  const handleGoogleSignUp = () => {
    if (!selectedRole) {
      setError(
        "Primero selecciona qué eres: Creador de Contenido, Consumidor de Contenido o Agencia."
      );
      return;
    }

    const isHttps =
      typeof window !== "undefined" && window.location.protocol === "https:";
    const cookieFlags = `path=/; max-age=1800; SameSite=Lax${isHttps ? "; Secure" : ""}`;
    document.cookie = `intended_role=${selectedRole}; ${cookieFlags}`;
    document.cookie = `intended_country=${selectedCountry}; ${cookieFlags}`;
    // Limpiar cookies previas para que el perfil básico le pregunte identidad e intereses
    document.cookie = `intended_gender=; path=/; max-age=0`;
    document.cookie = `intended_interested_in=; path=/; max-age=0`;

    const callbackUrl =
      selectedRole === "CREATOR"
        ? "/panel/perfil?completar=1"
        : selectedRole === "AGENCY"
        ? "/agencia?welcome=agency"
        : "/cuenta?completar=1";

    signIn("google", { callbackUrl });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedRole) {
      setError(
        "Por favor selecciona primero si eres Creador de Contenido, Consumidor de Contenido o una Agencia."
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    formData.set("country", selectedCountry);

    try {
      const res =
        selectedRole === "CREATOR"
          ? await registerCreatorAction(formData)
          : selectedRole === "AGENCY"
          ? await registerAgencyAction(formData)
          : await registerConsumerAction(formData);

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      const email = formData.get("email") as string;
      const password = formData.get("password") as string;

      setSuccess(
        selectedRole === "CREATOR"
          ? "¡Cuenta de Creador de Contenido creada! Llevándote a completar tu perfil básico..."
          : selectedRole === "AGENCY"
          ? "¡Agencia registrada con éxito! Entrando a tu Panel de Agencia..."
          : "¡Cuenta de Consumidor de Contenido creada! Llevándote a completar tu perfil básico..."
      );

      const loginRes = await signIn("credentials", {
        identifier: email,
        password,
        redirect: false,
      });

      if (!loginRes?.error) {
        window.location.href =
          selectedRole === "CREATOR"
            ? "/panel/perfil?completar=1"
            : selectedRole === "AGENCY"
            ? "/agencia"
            : "/cuenta?completar=1";
      } else {
        window.location.href = "/login";
      }
    } catch {
      setError("Ocurrió un error inesperado al procesar el registro.");
      setLoading(false);
    }
  };

  const googleButtonLabel =
    selectedRole === "CREATOR"
      ? "Continuar con Google como Creador de Contenido"
      : selectedRole === "AGENCY"
      ? "Continuar con Google como Agencia"
      : selectedRole === "CONSUMER"
      ? "Continuar con Google como Consumidor de Contenido"
      : "Elige primero tu tipo de cuenta arriba";

  const submitButtonLabel =
    selectedRole === "CREATOR"
      ? "Registrarme como Creador de Contenido"
      : selectedRole === "AGENCY"
      ? "Registrarme como Agencia"
      : selectedRole === "CONSUMER"
      ? "Registrarme como Consumidor de Contenido"
      : "Selecciona qué eres arriba para registrarte";

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-slate-950">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative">
        <div className="text-center mb-6">
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-black uppercase tracking-wider mb-3">
            Paso 1 de 2 • Obligatorio
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            ¿Qué eres en KONTENIDO?
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-lg mx-auto leading-relaxed">
            Indica primero si eres <strong className="text-rose-400">Creador de Contenido</strong>,{" "}
            <strong className="text-sky-400">Consumidor de Contenido</strong> o{" "}
            <strong className="text-indigo-400">una Agencia</strong>.{" "}
            <span className="text-slate-500">
              En el siguiente paso completarás tu información básica de perfil y preferencias para KOMESTIBLE.
            </span>
          </p>
        </div>

        {/* PASO 1 OBLIGATORIO: Selección inequívoca de tipo de cuenta */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <button
            type="button"
            onClick={() => handleRoleChange("CREATOR")}
            aria-pressed={selectedRole === "CREATOR"}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
              selectedRole === "CREATOR"
                ? "bg-gradient-to-br from-rose-950/80 to-slate-800 border-rose-500 shadow-lg shadow-rose-500/20 ring-2 ring-rose-500/50"
                : "bg-slate-950/70 border-slate-800 hover:border-rose-500/50"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              {selectedRole === "CREATOR" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                  <Check className="w-3 h-3" />
                  ELEGIDO
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[9px] font-bold">
                  VENDER
                </span>
              )}
            </div>
            <h3 className="text-sm font-black text-white">Creador de Contenido</h3>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              {isVzla
                ? "Sube fotos y videos exclusivos, crea suscripciones y retira en Bs. o USDT."
                : "Sube fotos y videos exclusivos, crea suscripciones y cobra directo en USDT."}
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleRoleChange("CONSUMER")}
            aria-pressed={selectedRole === "CONSUMER"}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
              selectedRole === "CONSUMER"
                ? "bg-gradient-to-br from-sky-950/80 to-slate-800 border-sky-500 shadow-lg shadow-sky-500/20 ring-2 ring-sky-500/50"
                : "bg-slate-950/70 border-slate-800 hover:border-sky-500/50"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              {selectedRole === "CONSUMER" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-600 text-white text-[10px] font-black">
                  <Check className="w-3 h-3" />
                  ELEGIDO
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 text-[9px] font-bold">
                  VER / FAN
                </span>
              )}
            </div>
            <h3 className="text-sm font-black text-white">Consumidor de Contenido</h3>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Explora perfiles, recarga KOIN, suscríbete y participa gratis en KOMESTIBLE.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleRoleChange("AGENCY")}
            aria-pressed={selectedRole === "AGENCY"}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
              selectedRole === "AGENCY"
                ? "bg-gradient-to-br from-indigo-950/80 to-slate-800 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/50"
                : "bg-slate-950/70 border-slate-800 hover:border-indigo-500/50"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              {selectedRole === "AGENCY" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black">
                  <Check className="w-3 h-3" />
                  ELEGIDO
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[9px] font-bold">
                  AGENCIA
                </span>
              )}
            </div>
            <h3 className="text-sm font-black text-white">Soy una Agencia</h3>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Crea y administra múltiples perfiles de creadores, tarifas, contenidos y chats.
            </p>
          </button>
        </div>

        {/* Aviso claro si aún no seleccionó qué es */}
        {!selectedRole ? (
          <div className="mb-6 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Selecciona una de las 3 opciones arriba</strong> (Creador de Contenido, Consumidor de Contenido o Agencia) para habilitar tu registro.
            </span>
          </div>
        ) : (
          <div
            className={`mb-5 px-4 py-3 rounded-2xl border flex items-center justify-between gap-2 text-xs ${
              selectedRole === "CREATOR"
                ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
                : selectedRole === "AGENCY"
                ? "bg-indigo-950/40 border-indigo-500/40 text-indigo-200"
                : "bg-sky-950/40 border-sky-500/40 text-sky-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {selectedRole === "CREATOR" ? (
                <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />
              ) : selectedRole === "AGENCY" ? (
                <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
              ) : (
                <Eye className="w-4 h-4 text-sky-400 shrink-0" />
              )}
              <span>
                Te registrarás como:{" "}
                <strong className="text-white">
                  {selectedRole === "CREATOR"
                    ? "CREADOR DE CONTENIDO"
                    : selectedRole === "AGENCY"
                    ? "AGENCIA"
                    : "CONSUMIDOR DE CONTENIDO"}
                </strong>
              </span>
            </div>
            <span className="text-[10px] opacity-80 hidden sm:inline">
              Puedes cambiar tocando otra tarjeta
            </span>
          </div>
        )}

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

        {/* PASO 2: Datos de acceso (activos una vez que el usuario indica qué es) */}
        <div className={!selectedRole ? "opacity-50 pointer-events-none select-none transition" : "transition"}>
          {/* Selector de País */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl mb-5">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-rose-400" />
              País de residencia
            </label>
            <select
              name="countrySelector"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:outline-hidden focus:border-rose-500 transition"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] mt-1.5 leading-snug text-slate-400">
              {isVzla ? (
                <span>
                  🇻🇪 <strong className="text-emerald-400">Ecosistema Venezuela:</strong> Pagos y retiros en Bolívares (PagoMóvil / 30 Bancos Nacionales) o Binance USDT.
                </span>
              ) : (
                <span>
                  🌐 <strong className="text-amber-400">Modo Internacional (USDT):</strong> Todos tus pagos, recargas y retiros funcionarán 100% directo en <strong>USDT</strong>.
                </span>
              )}
            </p>
          </div>

          {/* Botón de inicio rápido con Google */}
          <button
            type="button"
            disabled={!selectedRole}
            onClick={handleGoogleSignUp}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 hover:bg-slate-100 font-bold py-3 px-4 rounded-xl transition text-xs sm:text-sm mb-6 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            <span>{googleButtonLabel}</span>
          </button>

          <div className="relative flex items-center justify-center my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-4 text-xs font-semibold text-slate-500 tracking-wider">
                O con correo electrónico
              </span>
            </div>
          </div>

          {/* Formulario de registro */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {selectedRole === "AGENCY" && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nombre de la Agencia (Se mostrará en el badge de tus perfiles)
                </label>
                <input
                  name="agencyName"
                  type="text"
                  required
                  placeholder="ej: Velvet Agency VIP"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white placeholder-slate-600 text-sm focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
            )}

            <UsernameAvailabilityInput
              label={
                selectedRole === "AGENCY"
                  ? "Usuario de la Agencia"
                  : "Nombre de usuario (Enlace del perfil)"
              }
            />

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
                  {isVzla
                    ? "Validación de cédula requerida (con aprobación automática +18 al subir tu documento)."
                    : "Validación de documento oficial o pasaporte requerida (con aprobación automática +18)."}
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
              disabled={loading || !selectedRole}
              className={`w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-xl transition text-xs sm:text-sm shadow-lg disabled:opacity-50 mt-2 cursor-pointer ${
                selectedRole === "AGENCY"
                  ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
                  : selectedRole === "CONSUMER"
                  ? "bg-sky-600 hover:bg-sky-700 shadow-sky-600/20"
                  : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
              }`}
            >
              {loading ? "Creando cuenta..." : submitButtonLabel}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

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

export default function RegistroPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-slate-950 text-slate-400 text-sm">
          Cargando registro de KONTENIDO...
        </div>
      }
    >
      <RegistroContent />
    </Suspense>
  );
}
