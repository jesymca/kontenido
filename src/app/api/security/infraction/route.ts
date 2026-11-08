import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { downloadInfractions, users, auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Endpoint de seguridad para reportar intentos indebidos de descarga o captura
 * Aplicable a consumidores sin permiso VIP.
 * Acciones:
 * 1. Registra la infracción en `download_infractions`.
 * 2. Suspende inmediatamente la cuenta del usuario en `users`.
 * 3. Registra en `audit_log`.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();

    // Solo se aplica a usuarios autenticados
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "No autenticado" }, { status: 401 });
    }

    // Los usuarios VIP con allowDownload === 1 o SUPER_ADMIN tienen permiso
    if (session.user.allowDownload === 1 || session.user.role === "SUPER_ADMIN") {
      return NextResponse.json({ success: true, exempted: true });
    }

    const body = await req.json().catch(() => ({}));
    const detectedAction = body.action || "INTENTO_DESCARGA_NO_AUTORIZADA";
    const postId = body.postId || null;
    const mediaAssetId = body.mediaAssetId || null;

    const ipAddress = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "Desconocido";
    const now = new Date().toISOString();

    const infractionId = crypto.randomUUID();

    // 1. Guardar infracción en BD
    await db.insert(downloadInfractions).values({
      id: infractionId,
      userId: session.user.id,
      postId,
      mediaAssetId,
      detectedAction,
      ipAddress,
      userAgent,
      isSuspended: 1,
      notes: "Suspensión automática por intento indebido de descarga o captura de pantalla",
      createdAt: now,
    });

    // 2. Suspender cuenta de usuario
    await db
      .update(users)
      .set({
        status: "SUSPENDED",
        suspensionReason: `Cuenta suspendida automáticamente por: ${detectedAction}. Queda prohibida la extracción no autorizada de contenido.`,
        updatedAt: now,
      })
      .where(eq(users.id, session.user.id));

    // 3. Registrar auditoría
    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: session.user.id,
      action: "ACCOUNT_SUSPENDED_ANTI_DOWNLOAD",
      entity: "users",
      entityId: session.user.id,
      meta: JSON.stringify({ detectedAction, ipAddress, userAgent, infractionId }),
      ipAddress,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      suspended: true,
      reason: "Tu cuenta ha sido suspendida por intentar descargar o capturar contenido sin autorización.",
    });
  } catch (err: any) {
    console.error("Error en endpoint de infracción:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
