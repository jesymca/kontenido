"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UserCheck,
  Heart,
  Flame,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Save,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  COUNTRIES,
  IDENTITY_GENDERS,
  getUserGenderMeta,
  normalizeGenderValue,
  parseInterestedIn,
  type IdentityGenderValue,
} from "@/lib/countries";
import { updateBasicProfileAction } from "@/actions/komestible";

interface BasicProfileCardProps {
  username: string;
  initialDisplayName: string;
  initialBio: string;
  initialCountry: string;
  initialGender: string | null;
  initialInterestedIn: string | null;
  forceOpen?: boolean;
}

/**
 * Tarjeta de Información Básica del Perfil y Preferencias KOMESTIBLE (para Consumidores y Creadores en /cuenta).
 * Pregunta obligatoriamente:
 * 1) Soy: HOMBRE, MUJER, PAREJA, TRANSGÉNERO
 * 2) Estoy interesado/a en conocer: HOMBRE, MUJER, PAREJA, TRANSGÉNERO (usado en KOMESTIBLE estilo Badoo)
 */
export default function BasicProfileCard({
  username,
  initialDisplayName,
  initialBio,
  initialCountry,
  initialGender,
  initialInterestedIn,
  forceOpen = false,
}: BasicProfileCardProps) {
  const router = useRouter();
  const initialGenderNorm = normalizeGenderValue(initialGender);
  const initialInterestsArr = parseInterestedIn(initialInterestedIn);
  const isIncomplete = !initialGenderNorm || initialInterestsArr.length === 0;

  const [editing, setEditing] = useState(forceOpen || isIncomplete);
  const [displayName, setDisplayName] = useState(initialDisplayName || username);
  const [bio, setBio] = useState(initialBio || "");
  const [country, setCountry] = useState(initialCountry || "VE");
  const [gender, setGender] = useState<IdentityGenderValue | "">(initialGenderNorm || "");
  const [interestedIn, setInterestedIn] = useState<IdentityGenderValue[]>(initialInterestsArr);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const toggleInterest = (val: IdentityGenderValue) => {
    setInterestedIn((prev) =>
      prev.includes(val) ? prev.filter((item) => item !== val) : [...prev, val]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!gender) {
      setError("Por favor indica qué eres: Hombre, Mujer, Pareja o Transgénero.");
      return;
    }
    if (interestedIn.length === 0) {
      setError(
        "Por favor selecciona al menos una opción en '¿A quién estás interesado/a en conocer?'."
      );
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("displayName", displayName.trim());
      fd.set("bio", bio.trim());
      fd.set("country", country);
      fd.set("gender", gender);
      for (const item of interestedIn) {
        fd.append("interestedIn", item);
      }

      const res = await updateBasicProfileAction(fd);
      if (res.error) {
        setError(res.error);
        setSaving(false);
        return;
      }

      setSuccess("¡Información básica y preferencias de KOMESTIBLE guardadas correctamente!");
      setEditing(false);
      router.refresh();
    } catch {
      setError("Error al guardar la información básica del perfil.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing && !isIncomplete) {
    const genderMeta = getUserGenderMeta(gender);
    return (
      <div className="mb-8 p-5 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Perfil Básico Completo
            </span>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${genderMeta.badgeClass}`}>
              Soy: {genderMeta.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300 pt-0.5">
            <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
            <span className="text-slate-400">Interesado/a en conocer (KOMESTIBLE):</span>
            {interestedIn.map((item) => {
              const meta = getUserGenderMeta(item);
              return (
                <span
                  key={item}
                  className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-200 border border-rose-500/30 text-[11px] font-bold"
                >
                  {meta.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
              setEditing(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-rose-400" />
            Editar Perfil Básico
          </button>
          <Link
            href="/komestible"
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-600/20"
          >
            <Flame className="w-3.5 h-3.5 fill-white" />
            Ir a KOMESTIBLE
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 p-6 bg-gradient-to-br from-rose-950/35 via-slate-900 to-amber-950/20 border border-rose-500/40 rounded-3xl shadow-2xl space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-300">
              <Sparkles className="w-3 h-3" />
              {isIncomplete ? "Paso 2 de 2 • Completa tu Perfil Básico" : "Editar Información Básica del Perfil"}
            </span>
            <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
              Información Básica y Preferencias para KOMESTIBLE
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Indica quién eres y a quién estás interesado/a en conocer para personalizar tus coincidencias en <strong className="text-rose-300">KOMESTIBLE</strong> (estilo Badoo).
            </p>
          </div>
        </div>

        {!isIncomplete && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-slate-400 hover:text-white underline self-start sm:self-center cursor-pointer"
          >
            Cancelar
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Nombre para mostrar
          </label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Tu nombre o apodo"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white focus:border-rose-500 focus:outline-hidden"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            País de residencia
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white focus:border-rose-500 focus:outline-hidden"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pregunta 1: ¿Qué eres? */}
      <div>
        <label className="block text-xs font-bold text-white mb-2">
          1. ¿Qué eres? <span className="text-rose-400">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {IDENTITY_GENDERS.map((g) => {
            const active = gender === g.value;
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => setGender(g.value)}
                aria-pressed={active}
                className={`py-2.5 px-3 rounded-xl text-xs font-black border transition cursor-pointer ${
                  active
                    ? "bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/30"
                    : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pregunta 2: ¿A quién estás interesado/a en conocer? */}
      <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-white flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-rose-500 fill-rose-500" />
            2. ¿A quién estás interesado/a en conocer? <span className="text-rose-400">*</span>
          </label>
          <button
            type="button"
            onClick={() =>
              setInterestedIn(
                interestedIn.length === IDENTITY_GENDERS.length
                  ? []
                  : IDENTITY_GENDERS.map((g) => g.value)
              )
            }
            className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
          >
            {interestedIn.length === IDENTITY_GENDERS.length ? "Limpiar" : "Todos"}
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Elige una o varias opciones. KOMESTIBLE te mostrará únicamente personas compatibles con tu búsqueda.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {IDENTITY_GENDERS.map((g) => {
            const active = interestedIn.includes(g.value);
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => toggleInterest(g.value)}
                aria-pressed={active}
                className={`py-2.5 px-3 rounded-xl text-xs font-black border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  active
                    ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white border-rose-400 shadow-md shadow-rose-600/25"
                    : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${active ? "fill-white" : ""}`} />
                <span>{g.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          Sobre ti (Opcional — visible en tu tarjeta de KOMESTIBLE)
        </label>
        <input
          type="text"
          maxLength={180}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Cuéntanos un poco sobre tus gustos o qué buscas en KONTENIDO..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white focus:border-rose-500 focus:outline-hidden"
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-black transition shadow-lg shadow-rose-600/30 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Guardando..." : "Guardar Perfil Básico y Preferencias"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
