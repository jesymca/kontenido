import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Función utilitaria para combinar clases de TailwindCSS de forma segura y condicional.
 * Utiliza `clsx` y `tailwind-merge` para resolver colisiones de estilos.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatear montos en KOIN o USD
 */
export function formatKoin(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (num === null || num === undefined || isNaN(num)) return "0.00";
  return num.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Calcular el nivel de usuario (0 al 100) en base a su inversión total en USD/KOIN.
 * Escala solicitada:
 * 0: 0$
 * 1: 1$ a 20$
 * 2: 21$ a 50$
 * 3: 51$ a 100$
 * 4: 101$ a 150$
 * 5: 151$ a 200$
 * ... progresión hasta nivel 100
 */
export function calculateUserLevel(totalSpentUsd: number): number {
  if (totalSpentUsd <= 0) return 0;
  if (totalSpentUsd <= 20) return 1;
  if (totalSpentUsd <= 50) return 2;
  if (totalSpentUsd <= 100) return 3;
  if (totalSpentUsd <= 150) return 4;
  if (totalSpentUsd <= 200) return 5;
  
  // A partir de nivel 5 ($200), cada $50 adicionales suman un nivel hasta el máximo de 100
  const extra = Math.floor((totalSpentUsd - 200) / 50);
  const calculated = 5 + extra;
  return Math.min(100, calculated);
}

/**
 * Retorna la clase de estilo CSS espectacular para el badge VIP
 * según el texto o slug (ULTRA, PRO, PLATINUM, GOLDEN, SILVER, BRONCE).
 * Aplica gradientes multicapa, biseles reflectivos, halos luminosos y destello.
 */
export function getVipBadgeClass(badgeText?: string | null, customClass?: string | null): string {
  // Si customClass ya es una clase directa vip-badge-*
  if (customClass && customClass.startsWith("vip-badge-")) {
    return customClass;
  }

  const textKey = (badgeText || "").toLowerCase().trim();
  const colorKey = (customClass || "").toLowerCase().trim();

  if (textKey.includes("ultra") || colorKey.includes("ultra")) return "vip-badge-ultra";
  if (textKey.includes("pro") || colorKey.includes("pro")) return "vip-badge-pro";
  if (textKey.includes("platinum") || textKey.includes("platino") || colorKey.includes("platinum") || colorKey.includes("cyan")) return "vip-badge-platinum";
  if (textKey.includes("gold") || textKey.includes("dorado") || colorKey.includes("gold") || colorKey.includes("yellow")) return "vip-badge-golden";
  if (textKey.includes("silver") || textKey.includes("plata") || colorKey.includes("silver") || colorKey.includes("slate-300") || colorKey.includes("slate-400")) return "vip-badge-silver";
  if (textKey.includes("bronce") || textKey.includes("bronze") || colorKey.includes("bronce") || colorKey.includes("amber-800") || colorKey.includes("orange")) return "vip-badge-bronce";

  // Si tiene clase personalizada provista por el admin
  if (customClass && customClass.includes("from-")) {
    return cn("bg-gradient-to-r text-white border border-white/20 shadow-md", customClass);
  }

  return "vip-badge-golden";
}
