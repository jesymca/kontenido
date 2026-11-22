import { normalizeGenderValue } from "@/lib/countries";

export type CreatorCategoryValue =
  | "HOMBRE"
  | "MUJER"
  | "PAREJA"
  | "TRANSGENERO"
  | "TRANSEXUAL";

export const CREATOR_CATEGORIES: Array<{
  value: "HOMBRE" | "MUJER" | "PAREJA" | "TRANSGENERO";
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
    value: "TRANSGENERO",
    label: "Transgénero",
    plural: "Transgéneros",
    badgeClass: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  },
];

export function getCreatorCategoryMeta(value?: string | null) {
  const normalized = normalizeGenderValue(value);
  return (
    CREATOR_CATEGORIES.find((c) => c.value === normalized) || CREATOR_CATEGORIES[0]
  );
}

export const AGENCY_BADGE_GRADIENTS: Array<{
  id: string;
  label: string;
  gradient: string;
  cssGradient: string;
}> = [
  {
    id: "indigo-rose",
    label: "Índigo & Rosa (VIP)",
    gradient: "from-indigo-500 via-purple-500 to-rose-500",
    cssGradient: "linear-gradient(to right, #6366f1, #a855f7, #f43f5e)",
  },
  {
    id: "gold-amber",
    label: "Dorado Elite",
    gradient: "from-amber-400 via-yellow-500 to-orange-500",
    cssGradient: "linear-gradient(to right, #fbbf24, #eab308, #f97316)",
  },
  {
    id: "emerald-cyan",
    label: "Esmeralda & Cian",
    gradient: "from-emerald-400 via-teal-500 to-cyan-500",
    cssGradient: "linear-gradient(to right, #34d399, #14b8a6, #06b6d4)",
  },
  {
    id: "fuchsia-orange",
    label: "Fucsia Neón",
    gradient: "from-fuchsia-500 via-rose-500 to-amber-500",
    cssGradient: "linear-gradient(to right, #d946ef, #f43f5e, #f59e0b)",
  },
  {
    id: "slate-violet",
    label: "Obsidiana & Violeta",
    gradient: "from-slate-700 via-violet-600 to-indigo-600",
    cssGradient: "linear-gradient(to right, #334155, #7c3aed, #4f46e5)",
  },
];

export function getAgencyBadgeStyle(badgeColor?: string | null): {
  backgroundImage: string;
} {
  const matched =
    AGENCY_BADGE_GRADIENTS.find((g) => g.gradient === badgeColor || g.id === badgeColor) ||
    AGENCY_BADGE_GRADIENTS[0];
  return { backgroundImage: matched.cssGradient };
}
