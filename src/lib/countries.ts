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

export type UserGenderValue = "MUJER" | "HOMBRE" | "PAREJA" | "TRANSEXUAL" | "OTRO";

export const USER_GENDERS: Array<{
  value: UserGenderValue;
  label: string;
  plural: string;
  badgeClass: string;
}> = [
  {
    value: "MUJER",
    label: "Mujer",
    plural: "Mujeres",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
  {
    value: "HOMBRE",
    label: "Hombre",
    plural: "Hombres",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  {
    value: "PAREJA",
    label: "Pareja",
    plural: "Parejas",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  {
    value: "TRANSEXUAL",
    label: "Transexual",
    plural: "Transexuales",
    badgeClass: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  },
  {
    value: "OTRO",
    label: "Otro",
    plural: "Otros",
    badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  },
];

export function getUserGenderMeta(value?: string | null) {
  return USER_GENDERS.find((g) => g.value === value) || USER_GENDERS[4];
}

export const USDT_NETWORKS = [
  { value: "TRC20", label: "USDT TRC20 (Red Tron)" },
  { value: "BEP20", label: "USDT BEP20 (BNB Smart Chain)" },
  { value: "ERC20", label: "USDT ERC20 (Ethereum)" },
  { value: "POLYGON", label: "USDT Polygon (POS)" },
  { value: "SOLANA", label: "USDT Solana" },
];
