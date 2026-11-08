/**
 * Servicio de Integración con DolarAPI (Venezuela)
 * API Oficial: https://ve.dolarapi.com/v1/dolares/
 * Obtiene el VALOR PARALELO en tiempo real para calcular los retiros
 * y pagos de creadoras en Bolívares (VES).
 */

export interface DolarItem {
  moneda: string;
  fuente: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
}

export interface DolarParaleloInfo {
  paralelo: number; // Tasa promedio en Bolívares por Dólar (ej: 1030.88)
  oficial?: number; // Tasa BCV oficial si está disponible
  fechaActualizacion: string;
  fuente: string;
  isFallback?: boolean;
}

const DEFAULT_PARALELO_FALLBACK = 1030.88;

/**
 * Consulta la API pública de ve.dolarapi.com y retorna la tasa paralela activa.
 * Utiliza caché de 3 minutos para optimizar llamadas sin saturar el servicio.
 */
export async function getDolarRates(fallbackRate = DEFAULT_PARALELO_FALLBACK): Promise<DolarParaleloInfo> {
  try {
    const res = await fetch("https://ve.dolarapi.com/v1/dolares/", {
      next: { revalidate: 180 }, // Revalida cada 3 minutos
      headers: {
        Accept: "application/json",
      },
    });

    if (res.ok) {
      const data = (await res.json()) as DolarItem[];
      const paraleloItem = data.find((d) => d.fuente === "paralelo" || d.nombre.toLowerCase().includes("paralelo"));
      const oficialItem = data.find((d) => d.fuente === "oficial" || d.nombre.toLowerCase().includes("dólar"));

      if (paraleloItem && typeof paraleloItem.promedio === "number" && paraleloItem.promedio > 0) {
        return {
          paralelo: paraleloItem.promedio,
          oficial: oficialItem?.promedio || undefined,
          fechaActualizacion: paraleloItem.fechaActualizacion || new Date().toISOString(),
          fuente: "ve.dolarapi.com/v1/dolares/ (Paralelo)",
          isFallback: false,
        };
      }
    }
  } catch (error) {
    // Si falla el endpoint general, intentar con endpoint directo /paralelo
    try {
      const directRes = await fetch("https://ve.dolarapi.com/v1/dolares/paralelo", {
        next: { revalidate: 180 },
      });
      if (directRes.ok) {
        const item = (await directRes.json()) as DolarItem;
        if (item && typeof item.promedio === "number" && item.promedio > 0) {
          return {
            paralelo: item.promedio,
            fechaActualizacion: item.fechaActualizacion || new Date().toISOString(),
            fuente: "ve.dolarapi.com/v1/dolares/paralelo",
            isFallback: false,
          };
        }
      }
    } catch {
      // Ignorar y pasar al fallback seguro
    }
  }

  // Tasa de contingencia en caso de que la API externa no esté disponible
  return {
    paralelo: fallbackRate > 0 ? fallbackRate : DEFAULT_PARALELO_FALLBACK,
    fechaActualizacion: new Date().toISOString(),
    fuente: "Respaldo del Sistema",
    isFallback: true,
  };
}

/**
 * Formatea un monto en Bolívares (VES / Bs.) con separadores locales venezolanos
 */
export function formatBs(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (num === null || num === undefined || isNaN(num)) return "Bs. 0,00";
  return `Bs. ${num.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
