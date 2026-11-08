/**
 * Módulo de Cálculo de Comisiones Escalonadas para Creadoras de Contenido
 *
 * Regla de negocio solicitada por el usuario:
 * - 3 niveles de comisiones según el volumen general acumulado / status de la creadora:
 *   1. Nivel 1 (Inicial): e.g. 20% de comisión (volumen hasta $500 KOIN)
 *   2. Nivel 2 (Intermedio): e.g. 15% de comisión (volumen de $501 a $2,000 KOIN)
 *   3. Nivel 3 (Top Creadora): e.g. 10% de comisión (volumen superior a $2,000 KOIN)
 * - Los montos límites y porcentajes son 100% configurables por el SUPER_ADMIN mediante CRUD.
 */

export interface CommissionTierInfo {
  tierNumber: 1 | 2 | 3;
  name: string;
  description: string;
  feePct: number;
  minVolume: number;
  maxVolume: number;
  progressToNextPct?: number;
  koinToNextTier?: number;
  badgeStyle: string;
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

/**
 * Obtiene el tier de comisión aplicable a una creadora en base a su volumen general acumulado
 * y a los parámetros configurados por el SUPER_ADMIN en la base de datos.
 */
export function getCreatorCommissionTier(
  totalEarnedKoin: number,
  settingsMap?: Record<string, string> | Map<string, string>
): CommissionTierInfo {
  const getVal = (key: string, def: number): number => {
    if (!settingsMap) return def;
    const v = settingsMap instanceof Map ? settingsMap.get(key) : settingsMap[key];
    const parsed = v ? parseFloat(v) : NaN;
    return isNaN(parsed) ? def : parsed;
  };

  const tier1Max = getVal("fee_tier1_max", 500.0);
  const tier1Pct = getVal("fee_tier1_pct", 20.0);
  const tier2Max = getVal("fee_tier2_max", 2000.0);
  const tier2Pct = getVal("fee_tier2_pct", 15.0);
  const tier3Pct = getVal("fee_tier3_pct", 10.0);

  const earned = Math.max(0, totalEarnedKoin || 0);

  if (earned <= tier1Max) {
    const koinToNext = tier1Max - earned;
    const progress = (earned / tier1Max) * 100;
    return {
      tierNumber: 1,
      name: "Nivel 1 — Inicial",
      description: `Comisión del ${tier1Pct}%. Genera más para desbloquear comisiones reducidas.`,
      feePct: tier1Pct,
      minVolume: 0,
      maxVolume: tier1Max,
      progressToNextPct: Math.min(100, Math.max(0, progress)),
      koinToNextTier: Math.max(0, koinToNext),
      badgeStyle: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    };
  }

  if (earned <= tier2Max) {
    const koinToNext = tier2Max - earned;
    const progress = ((earned - tier1Max) / (tier2Max - tier1Max)) * 100;
    return {
      tierNumber: 2,
      name: "Nivel 2 — Creadora Avanzada",
      description: `Comisión preferencial del ${tier2Pct}%. ¡Estás cerca de alcanzar el nivel Top!`,
      feePct: tier2Pct,
      minVolume: tier1Max,
      maxVolume: tier2Max,
      progressToNextPct: Math.min(100, Math.max(0, progress)),
      koinToNextTier: Math.max(0, koinToNext),
      badgeStyle: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    };
  }

  return {
    tierNumber: 3,
    name: "Nivel 3 — Top Creadora VIP",
    description: `Comisión mínima exclusiva del ${tier3Pct}%. Mayor ganancia neta garantizada.`,
    feePct: tier3Pct,
    minVolume: tier2Max,
    maxVolume: Infinity,
    progressToNextPct: 100,
    koinToNextTier: 0,
    badgeStyle: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  };
}

/**
 * Realiza el cálculo transparente de liquidación / retiro:
 * Descuenta la comisión porcentual sobre el monto en KOIN y calcula el equivalente exacto en Bolívares (VES)
 * utilizando el valor paralelo de la API.
 */
export function calculatePayoutAmounts(
  grossKoin: number,
  feePct: number,
  tasaParalelo: number,
  tierInfo: CommissionTierInfo
): PayoutCalculation {
  const gross = Math.max(0, grossKoin);
  const feeKoin = Number(((gross * feePct) / 100).toFixed(2));
  const netKoin = Number((gross - feeKoin).toFixed(2));
  const netVes = Number((netKoin * tasaParalelo).toFixed(2));

  return {
    grossKoin: gross,
    feePct,
    feeKoin,
    netKoin,
    tasaParalelo,
    netVes,
    tierInfo,
  };
}
