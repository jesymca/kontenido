import React from "react";
import { cn, getVipBadgeClass } from "@/lib/utils";

interface UserLevelBadgeProps {
  level: number;
  username: string;
  vipBadgeText?: string | null;
  vipBadgeColor?: string | null;
  role?: string;
  kycStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  className?: string;
  showRoleBadge?: boolean;
}

/**
 * Obtiene la clase CSS del marco según el nivel (0 al 100)
 */
export function getLevelFrameClass(level: number): string {
  if (level <= 0) return "frame-iron";
  if (level === 1) return "frame-bronze";
  if (level === 2) return "frame-bronze-shimmer";
  if (level === 3) return "frame-silver";
  if (level === 4) return "frame-silver-glow";
  if (level <= 10) return "frame-gold";
  if (level <= 20) return "frame-gold-glow";
  if (level <= 40) return "frame-platinum";
  if (level <= 65) return "frame-diamond";
  if (level <= 85) return "frame-master";
  return "frame-legend";
}

/**
 * Componente que renderiza el identificador de usuario con su nivel enmarcado [Lv. X]
 * y su badge de membresía VIP (ej: ULTRA, PRO, PLATINUM, GOLDEN, SILVER, BRONCE)
 * antes o al lado del nombre con efectos 3D de bisel y halo luminoso.
 * Aplica para Creadoras y Consumidores según los requerimientos del proyecto.
 */
export default function UserLevelBadge({
  level,
  username,
  vipBadgeText,
  vipBadgeColor,
  role,
  kycStatus,
  className,
  showRoleBadge = false,
}: UserLevelBadgeProps) {
  const frameClass = getLevelFrameClass(level);

  return (
    <div className={cn("inline-flex items-center gap-1.5 flex-wrap", className)}>
      {/* Marco con el número de nivel antes del nombre */}
      <span
        title={`Nivel de Inversión / Actividad: ${level}`}
        className={cn(
          "px-1.5 py-0.5 rounded text-xs font-bold tracking-tight shadow-sm select-none transition-transform hover:scale-105",
          frameClass
        )}
      >
        Lv.{level}
      </span>

      {/* Nombre de usuario */}
      <span className="font-semibold text-white tracking-tight">@{username}</span>

      {/* Frase pequeña de membresía VIP pagada con efecto 3D metálico y halo de luz */}
      {vipBadgeText && (
        <span
          className={cn(
            "vip-badge-base text-[10px] px-2 py-0.5 tracking-wider",
            getVipBadgeClass(vipBadgeText, vipBadgeColor)
          )}
        >
          {vipBadgeText}
        </span>
      )}

      {/* Indicador de rol opcional (para Super Admin o Creadora) */}
      {showRoleBadge && role === "SUPER_ADMIN" && (
        <span className="text-[10px] bg-red-600/90 text-white font-bold px-1.5 py-0.2 rounded uppercase">
          ADMIN
        </span>
      )}
      {showRoleBadge && role === "CREATOR" && (
        <>
          <span className="text-[10px] bg-pink-600/90 text-white font-bold px-1.5 py-0.2 rounded uppercase">
            CREADORA
          </span>
          {kycStatus === "APPROVED" ? (
            <span
              title="Cuenta con identidad verificada"
              className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5"
            >
              ✓ Verificada
            </span>
          ) : kycStatus === "PENDING" ? (
            <span
              title="Identidad en revisión por administración"
              className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold px-1.5 py-0.2 rounded flex items-center gap-0.5"
            >
              ⏳ En Revisión
            </span>
          ) : (
            <span
              title="Esta creadora aún no ha completado la validación de su cédula"
              className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 font-medium px-1.5 py-0.2 rounded flex items-center gap-0.5"
            >
              ⚠️ Falta Verificar
            </span>
          )}
        </>
      )}
    </div>
  );
}
