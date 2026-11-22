export interface CountryOption {
  code: string;
  name: string;
  flag: string;
  isVenezuela?: boolean;
}

export const COUNTRIES: CountryOption[] = [
  { code: "VE", name: "Venezuela", flag: "🇻🇪", isVenezuela: true },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "MX", name: "México", flag: "🇲🇽" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "PE", name: "Perú", flag: "🇵🇪" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "ES", name: "España", flag: "🇪🇸" },
  { code: "US", name: "Estados Unidos", flag: "🇺🇸" },
  { code: "DO", name: "República Dominicana", flag: "🇩🇴" },
  { code: "PA", name: "Panamá", flag: "🇵🇦" },
  { code: "BR", name: "Brasil", flag: "🇧🇷" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹" },
  { code: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "CA", name: "Canadá", flag: "🇨🇦" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "IT", name: "Italia", flag: "🇮🇹" },
  { code: "OTHER", name: "Otro País (Internacional)", flag: "🌐" },
];

export function isVenezuelanUser(country?: string | null): boolean {
  if (!country) return true; // Retrocompatibilidad con cuentas creadas antes de soporte multi-país
  return country.trim().toUpperCase() === "VE";
}

export function getCountryMeta(code?: string | null): CountryOption {
  const normalized = (code || "VE").trim().toUpperCase();
  return (
    COUNTRIES.find((c) => c.code === normalized) || {
      code: normalized,
      name: normalized === "OTHER" ? "Internacional" : normalized,
      flag: "🌐",
    }
  );
}

/**
 * Identidades principales para perfil básico y emparejamiento KOMESTIBLE (estilo Badoo):
 * HOMBRE, MUJER, PAREJA, TRANSGENERO
 * (Se mantiene retrocompatibilidad automática con valores históricos como TRANSEXUAL)
 */
export type IdentityGenderValue = "HOMBRE" | "MUJER" | "PAREJA" | "TRANSGENERO";
export type UserGenderValue = IdentityGenderValue | "TRANSEXUAL" | "OTRO";

export const IDENTITY_GENDERS: Array<{
  value: IdentityGenderValue;
  label: string;
  plural: string;
  badgeClass: string;
}> = [
  {
    value: "HOMBRE",
    label: "Hombre",
    plural: "Hombres",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  {
    value: "MUJER",
    label: "Mujer",
    plural: "Mujeres",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
  {
    value: "PAREJA",
    label: "Pareja",
    plural: "Parejas",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  {
    value: "TRANSGENERO",
    label: "Transgénero",
    plural: "Transgéneros",
    badgeClass: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  },
];

// Alias exportado para compatibilidad con componentes existentes
export const USER_GENDERS = IDENTITY_GENDERS;

/**
 * Normaliza un valor de género/identidad proveniente de BD o formularios,
 * mapeando valores legacy como TRANSEXUAL -> TRANSGENERO.
 */
export function normalizeGenderValue(value?: string | null): IdentityGenderValue | null {
  if (!value) return null;
  const upper = value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (upper === "HOMBRE") return "HOMBRE";
  if (upper === "MUJER") return "MUJER";
  if (upper === "PAREJA") return "PAREJA";
  if (upper === "TRANSGENERO" || upper === "TRANSEXUAL" || upper === "TRANS") {
    return "TRANSGENERO";
  }
  return null;
}

export function getUserGenderMeta(value?: string | null) {
  const normalized = normalizeGenderValue(value);
  if (normalized) {
    const found = IDENTITY_GENDERS.find((g) => g.value === normalized);
    if (found) return found;
  }
  return {
    value: "OTRO" as UserGenderValue,
    label: "Sin definir",
    plural: "Sin definir",
    badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  };
}

/**
 * Parsea la columna users.interested_in (JSON array o texto separado por comas)
 * devolviendo una lista deduplicada y normalizada de identidades de interés.
 */
export function parseInterestedIn(raw?: string | string[] | null): IdentityGenderValue[] {
  if (!raw) return [];
  let items: string[] = [];

  if (Array.isArray(raw)) {
    items = raw;
  } else {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          items = parsed.map(String);
        }
      } catch {
        items = trimmed.split(",");
      }
    } else {
      items = trimmed.split(",");
    }
  }

  const out: IdentityGenderValue[] = [];
  for (const item of items) {
    const norm = normalizeGenderValue(item);
    if (norm && !out.includes(norm)) {
      out.push(norm);
    }
  }
  return out;
}

/**
 * Serializa una lista de preferencias de interés a JSON limpio para guardar en BD.
 */
export function serializeInterestedIn(rawList: string[]): string | null {
  const normalized = parseInterestedIn(rawList);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

/**
 * Comprueba si el género de un candidato coincide con una lista de intereses permitidos.
 */
export function matchesGenderPreference(
  candidateGender: string | null | undefined,
  allowedList: IdentityGenderValue[]
): boolean {
  if (allowedList.length === 0) return true;
  const norm = normalizeGenderValue(candidateGender);
  if (!norm) return false;
  return allowedList.includes(norm);
}

export const USDT_NETWORKS = [
  { value: "TRC20", label: "USDT TRC20 (Red Tron)" },
  { value: "BEP20", label: "USDT BEP20 (BNB Smart Chain)" },
  { value: "ERC20", label: "USDT ERC20 (Ethereum)" },
  { value: "POLYGON", label: "USDT Polygon (POS)" },
  { value: "SOLANA", label: "USDT Solana" },
];
