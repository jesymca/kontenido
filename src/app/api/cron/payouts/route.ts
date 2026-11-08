import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, payouts, wallets, settings, auditLog } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDolarRates } from "@/lib/dolarapi";
import { getCreatorCommissionTier } from "@/lib/commissions";

/**
 * Cron de Vercel para generar cortes semanales a creadoras
 * Se ejecuta automáticamente cada lunes a las 00:00 UTC.
 * Calcula las comisiones escalonadas (10%, 15%, 20%) y el monto exacto en Bolívares (VES)
 * según el Valor Paralelo de ve.dolarapi.com.
 */
export async function GET(req: Request) {
  try {
    // Validar autorización de Vercel Cron
    const authHeader = req.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const now = new Date();
    const periodEnd = now.toISOString();
    const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Obtener configuraciones globales y comisiones escalonadas
    const allSettings = await db.query.settings.findMany();
    const settingsMap = new Map(allSettings.map((s) => [s.key, s.value]));
    const fallbackRate = parseFloat(settingsMap.get("fallback_usd_ves_rate") || "1030.88");

    // Consultar tasa de Dólar Paralelo en tiempo real
    const dolarInfo = await getDolarRates(fallbackRate);
    const tasaParalelo = dolarInfo.paralelo;

    // Obtener todas las creadoras con saldo generado en el período
    const creators = await db.query.users.findMany({
      where: and(eq(users.role, "CREATOR"), eq(users.status, "ACTIVE")),
      with: {
        wallet: true,
      },
    });

    let payoutsCreated = 0;

    for (const c of creators) {
      const grossKoin = c.wallet?.totalEarnedKoin || 0;
      if (grossKoin > 0) {
        // Calcular porcentaje según su status / volumen general
        const tierInfo = getCreatorCommissionTier(grossKoin, settingsMap);
        const feeKoin = Number(((grossKoin * tierInfo.feePct) / 100).toFixed(2));
        const netKoin = Number((grossKoin - feeKoin).toFixed(2));
        const amountVes = Number((netKoin * tasaParalelo).toFixed(2));

        // Crear payout en estado PENDING ("EN ESPERA")
        await db.insert(payouts).values({
          id: crypto.randomUUID(),
          creatorId: c.id,
          periodStart,
          periodEnd,
          grossKoin,
          feeKoin,
          netKoin,
          feePct: tierInfo.feePct,
          usdRateVes: tasaParalelo,
          amountVes,
          status: "PENDING",
          createdAt: periodEnd,
        });

        // Resetear acumulador de ganancias del período
        await db
          .update(wallets)
          .set({ totalEarnedKoin: 0.0, updatedAt: periodEnd })
          .where(eq(wallets.userId, c.id));

        payoutsCreated++;
      }
    }

    // Registrar en auditoría
    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      action: "WEEKLY_PAYOUTS_GENERATED",
      entity: "payouts",
      entityId: "cron_weekly",
      meta: JSON.stringify({ payoutsCreated, tasaParalelo, periodStart, periodEnd }),
      ipAddress: "127.0.0.1",
      createdAt: periodEnd,
    });

    return NextResponse.json({
      success: true,
      message: `Cortes semanales generados con éxito: ${payoutsCreated} creadoras procesadas en Bolívares a tasa Bs. ${tasaParalelo.toFixed(2)}.`,
    });
  } catch (err: any) {
    console.error("Error en cron de cortes semanales:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
