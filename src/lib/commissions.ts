/**
 * Módulo de Cálculo y Gestión CRUD de Comisiones Escalonadas por Nivel para Creadoras
 *
 * Permite al SUPER_ADMIN configurar mediante CRUD completo los tramos de nivel (0 a 100)
 * y el porcentaje de comisión correspondiente a cada rango:
 * - Ejemplo por defecto:
 *   1. Nivel 0 a Nivel 30  -> 20% de comisión
 *   2. Nivel 31 a Nivel 60 -> 15% de comisión
 *   3. Nivel 61 a Nivel 100 -> 10% de comisión
 */

export interface CreatorCommissionRule {
  id: string;
  minLevel: number;
  maxLevel: number;
  feePct: number;
  name: string;
  description: string;
}

export interface CommissionTierInfo {
  tierNumber: number;
  name: string;
  description: string;
  feePct: number;
  minLevel: number;
  maxLevel: number;
  currentLevel: number;
  nextLevelTarget?: number | null;
  nextFeePct?: number | null;
  levelsToNextTier?: number;
  minVolume: number;
  maxVolume: number;
  progressToNextPct?: number;
  koinToNextTier?: number;
  badgeStyle: string;
  allRules: CreatorCommissionRule[];
}

export interface PayoutCalculation {
  grossKoin: number;
  feePct: number;
  feeKoin: number;
  netKoin: number;
  tasaParalelo: number;
  netVes: number;
  tierInfo: CommissionTierInfo;
}

export const DEFAULT_COMMISSION_RULES: CreatorCommissionRule[] = [
  {
    id: "tier-1",
    minLevel: 0,
    maxLevel: 30,
    feePct: 20,
    name: "Tramo Inicial (Nivel 0 al 30)",
    description: "Comisión estándar del 20% para creadoras ubicadas entre el Nivel 0 y el Nivel 30.",
  },
  {
    id: "tier-2",
    minLevel: 31,
    maxLevel: 60,
    feePct: 15,
    name: "Tramo Intermedio (Nivel 31 al 60)",
    description: "Comisión preferencial del 15% al superar el Nivel 30 (desde Nivel 31 hasta Nivel 60).",
  },
  {
    id: "tier-3",
    minLevel: 61,
    maxLevel: 100,
    feePct: 10,
    name: "Tramo Top VIP (Nivel 61 al 100)",
    description: "Comisión mínima exclusiva del 10% para creadoras consolidadas de Nivel 61 a 100.",
  },
];

/**
 * Extrae las reglas de comisión por nivel configuradas por SUPER_ADMIN en settings
 */
export function parseCreatorCommissionRules(
  settingsMap?: Record<string, string> | Map<string, string>
): CreatorCommissionRule[] {
  const getRaw = (key: string): string | undefined => {
    if (!settingsMap) return undefined;
    return settingsMap instanceof Map ? settingsMap.get(key) : settingsMap[key];
  };

  const jsonRaw = getRaw("creator_commission_rules_json");
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map((r: any, idx: number) => ({
            id: String(r.id || `rule-${idx + 1}`),
            minLevel: Number(r.minLevel ?? 0),
            maxLevel: Number(r.maxLevel ?? 100),
            feePct: Number(r.feePct ?? 20),
            name: String(r.name || `Tramo ${idx + 1}`),
            description: String(r.description || ""),
          }))
          .sort((a, b) => a.minLevel - b.minLevel);
      }
    } catch {
      // Fallback a reglas por defecto si el JSON es inválido
    }
  }

  const t1Pct = parseFloat(getRaw("fee_tier1_pct") || "20") || 20;
  const t2Pct = parseFloat(getRaw("fee_tier2_pct") || "15") || 15;
  const t3Pct = parseFloat(getRaw("fee_tier3_pct") || "10") || 10;

  return [
    {
      ...DEFAULT_COMMISSION_RULES[0],
      feePct: t1Pct,
      description: `Comisión del ${t1Pct}% aplicable desde el Nivel 0 hasta el Nivel 30.`,
    },
    {
      ...DEFAULT_COMMISSION_RULES[1],
      feePct: t2Pct,
      description: `Comisión reducida del ${t2Pct}% aplicable desde el Nivel 31 hasta el Nivel 60.`,
    },
    {
      ...DEFAULT_COMMISSION_RULES[2],
      feePct: t3Pct,
      description: `Comisión mínima del ${t3Pct}% aplicable desde el Nivel 61 hasta el Nivel 100.`,
    },
  ];
}

/**
 * Obtiene el tramo de comisión aplicable a una creadora según su nivel (0-100)
 * y devuelve el desglose completo de todos los tramos configurados por SUPER_ADMIN.
 */
export function getCreatorCommissionTier(
  totalEarnedKoin: number,
  settingsMap?: Record<string, string> | Map<string, string>,
  creatorLevel?: number
): CommissionTierInfo {
  const rules = parseCreatorCommissionRules(settingsMap);

  // Si la creadora tiene un nivel asignado se usa; también sube 1 nivel por cada 25 KOIN generados si su nivel base es menor
  const earnedLevel = Math.min(100, Math.floor(Math.max(0, totalEarnedKoin || 0) / 25));
  const currentLevel = Math.min(100, Math.max(creatorLevel ?? 0, earnedLevel));

  let matchedIdx = rules.findIndex(
    (r) => currentLevel >= r.minLevel && currentLevel <= r.maxLevel
  );

  if (matchedIdx === -1) {
    // Si está por encima del último rango o en un hueco, buscar el tramo más cercano
    if (currentLevel > rules[rules.length - 1].maxLevel) {
      matchedIdx = rules.length - 1;
    } else {
      matchedIdx = 0;
    }
  }

  const currentRule = rules[matchedIdx];
  const nextRule = matchedIdx + 1 < rules.length ? rules[matchedIdx + 1] : null;

  const span = Math.max(1, currentRule.maxLevel - currentRule.minLevel + 1);
  const progressInRule = ((currentLevel - currentRule.minLevel) / span) * 100;

  const badgeStyles = [
    "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  ];

  return {
    tierNumber: matchedIdx + 1,
    name: currentRule.name,
    description: currentRule.description,
    feePct: currentRule.feePct,
    minLevel: currentRule.minLevel,
    maxLevel: currentRule.maxLevel,
    currentLevel,
    nextLevelTarget: nextRule ? nextRule.minLevel : null,
    nextFeePct: nextRule ? nextRule.feePct : null,
    levelsToNextTier: nextRule ? Math.max(1, nextRule.minLevel - currentLevel) : 0,
    minVolume: currentRule.minLevel * 25,
    maxVolume: currentRule.maxLevel * 25,
    progressToNextPct: nextRule ? Math.min(100, Math.max(5, progressInRule)) : 100,
    koinToNextTier: nextRule ? Math.max(0, nextRule.minLevel * 25 - (totalEarnedKoin || 0)) : 0,
    badgeStyle: badgeStyles[matchedIdx % badgeStyles.length],
    allRules: rules,
  };
}

/**
 * Calcula el desglose exacto de un retiro de creadora:
 * Monto bruto en KOIN -> Descuento de comisión (%) -> Neto en KOIN -> Monto final en Bolívares (VES)
 */
export function calculateCreatorPayout(
  amountKoin: number,
  totalEarnedKoin: number,
  tasaParalelo: number,
  settingsMap?: Record<string, string> | Map<string, string>,
  creatorLevel?: number
): PayoutCalculation {
  const grossKoin = Math.max(0, Number(amountKoin) || 0);
  const tierInfo = getCreatorCommissionTier(totalEarnedKoin, settingsMap, creatorLevel);
  const feePct = tierInfo.feePct;
  const feeKoin = Number(((grossKoin * feePct) / 100).toFixed(2));
  const netKoin = Number(Math.max(0, grossKoin - feeKoin).toFixed(2));
  const netVes = Number((netKoin * tasaParalelo).toFixed(2));

  return {
    grossKoin,
    feePct,
    feeKoin,
    netKoin,
    tasaParalelo,
    netVes,
    tierInfo,
  };
}
