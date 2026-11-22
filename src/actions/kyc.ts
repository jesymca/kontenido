"use server";

import crypto from "crypto";
import sharp from "sharp";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { kycDocuments, users, creatorContracts, auditLog, settings } from "@/lib/db/schema";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { calculateExactAge } from "@/lib/cedulaParser";
import { eq, and, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { BUCKETS, getPresignedUploadUrl, getBufferFromR2, isR2Configured } from "@/lib/r2";

/**
 * Genera URLs prefirmadas para que la creadora suba los 3 documentos de KYC
 * directamente a Cloudflare R2 privado:
 * 1. Cédula / Documento frontal
 * 2. Cédula / Documento reverso
 * 3. Selfie con documento en mano
 */
export async function getKycUploadUrlsAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "No autorizado" };
  }

  const userId = session.user.id;
  const docId = crypto.randomUUID();

  const frontKey = `creators/${userId}/kyc/${docId}/front.jpg`;
  const backKey = `creators/${userId}/kyc/${docId}/back.jpg`;
  const selfieKey = `creators/${userId}/kyc/${docId}/selfie.jpg`;

  const [frontUrl, backUrl, selfieUrl] = await Promise.all([
    getPresignedUploadUrl(BUCKETS.PRIVATE, frontKey, "image/jpeg", 900),
    getPresignedUploadUrl(BUCKETS.PRIVATE, backKey, "image/jpeg", 900),
    getPresignedUploadUrl(BUCKETS.PRIVATE, selfieKey, "image/jpeg", 900),
  ]);

  return {
    docId,
    frontKey,
    backKey,
    selfieKey,
    urls: {
      front: frontUrl,
      back: backUrl,
      selfie: selfieUrl,
    },
  };
}

interface ImageIntegrityResult {
  passed: boolean;
  reasons: string[];
}

/**
 * Verifica directamente en el servidor con Sharp que las 3 imágenes subidas a R2:
 * - Sean imágenes reales decodificables (JPEG/PNG/WebP)
 * - Tengan resolución mínima legible (>= 240x180)
 * - No sean imágenes vacías/monocromáticas (desviación estándar de color > 10)
 * - Sean 3 archivos distintos (SHA-256 único para frente, reverso y selfie)
 */
async function verifyKycImagesIntegrity(
  frontKey: string,
  backKey: string,
  selfieKey: string
): Promise<ImageIntegrityResult> {
  if (!isR2Configured()) {
    return {
      passed: false,
      reasons: ["Almacenamiento R2 no configurado para verificación de integridad de imagen"],
    };
  }

  try {
    const [frontBuf, backBuf, selfieBuf] = await Promise.all([
      getBufferFromR2(BUCKETS.PRIVATE, frontKey),
      getBufferFromR2(BUCKETS.PRIVATE, backKey),
      getBufferFromR2(BUCKETS.PRIVATE, selfieKey),
    ]);

    const buffers: Array<{ label: string; buf: Buffer }> = [
      { label: "Frente del documento", buf: frontBuf },
      { label: "Reverso del documento", buf: backBuf },
      { label: "Selfie con documento", buf: selfieBuf },
    ];

    const reasons: string[] = [];
    const hashes = new Set<string>();

    for (const item of buffers) {
      if (!item.buf || item.buf.length < 3_000) {
        reasons.push(`${item.label}: archivo demasiado pequeño o vacío`);
        continue;
      }

      const sha = crypto.createHash("sha256").update(item.buf).digest("hex");
      hashes.add(sha);

      try {
        const img = sharp(item.buf);
        const [meta, stats] = await Promise.all([img.metadata(), img.stats()]);
        const w = meta.width || 0;
        const h = meta.height || 0;
        const allowedFormats = new Set(["jpeg", "png", "webp", "heif", "avif"]);

        if (!meta.format || !allowedFormats.has(meta.format)) {
          reasons.push(`${item.label}: formato de imagen no soportado`);
        } else if (Math.min(w, h) < 180 || Math.max(w, h) < 260) {
          reasons.push(`${item.label}: resolución insuficiente (${w}x${h}px)`);
        }

        const avgStdev =
          stats.channels.length > 0
            ? stats.channels.reduce((acc, c) => acc + c.stdev, 0) / stats.channels.length
            : 0;
        if (avgStdev < 10) {
          reasons.push(`${item.label}: imagen sin contraste o en blanco`);
        }
      } catch {
        reasons.push(`${item.label}: archivo de imagen corrupto o ilegible`);
      }
    }

    if (hashes.size < 3) {
      reasons.push("Las 3 fotografías deben ser distintas (se detectaron archivos repetidos)");
    }

    return {
      passed: reasons.length === 0,
      reasons,
    };
  } catch (err) {
    console.warn("Aviso al verificar integridad de imágenes KYC en R2:", err);
    return {
      passed: false,
      reasons: ["No se pudieron inspeccionar las imágenes en R2 para auto-aprobación"],
    };
  }
}

/**
 * Enviar solicitud de KYC tras subir los documentos a R2.
 * Evalúa automáticamente directamente desde la plataforma si la persona es MAYOR de edad (>= 18):
 * - Si los archivos pasan la verificación de integridad, el OCR nativo extrae la fecha de nacimiento
 *   y el documento sin alteración manual y la edad es >= 18 años -> APROBADO automáticamente.
 * - Si la persona es menor de 18 años -> RECHAZADO automáticamente.
 * - Si la imagen es borrosa, los datos fueron editados manualmente respecto al OCR o no se pudo
 *   confirmar con suficiente confianza -> queda en PENDING para revisión manual en /admin/kyc.
 */
export async function submitKycAction(formData: FormData) {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) {
    return { error: "No autorizado" };
  }

  const userId = session.user.id;
  const docId = (formData.get("docId") as string) || crypto.randomUUID();
  const frontKey = formData.get("frontKey") as string;
  const backKey = formData.get("backKey") as string;
  const selfieKey = formData.get("selfieKey") as string;
  const idNumber = (formData.get("idNumber") as string)?.trim();
  const fullName = (formData.get("fullName") as string)?.trim();
  const birthDate = (formData.get("birthDate") as string)?.trim();
  const rawDocType = (formData.get("documentType") as string)?.trim().toUpperCase();
  const documentType =
    rawDocType === "PASSPORT" || rawDocType === "NATIONAL_ID" || rawDocType === "CEDULA_VE"
      ? rawDocType
      : "CEDULA_VE";

  // Señales extraídas automáticamente por el motor OCR nativo al subir la foto
  const ocrBirthDate = (formData.get("ocrBirthDate") as string)?.trim() || "";
  const ocrIdNumber = (formData.get("ocrIdNumber") as string)?.trim() || "";
  const ocrConfidenceRaw = parseFloat((formData.get("ocrConfidence") as string) || "0");
  const ocrConfidence = Number.isFinite(ocrConfidenceRaw)
    ? Math.max(0, Math.min(100, Math.round(ocrConfidenceRaw * 10) / 10))
    : 0;
  const ocrMarkersCount = Math.max(
    0,
    parseInt((formData.get("ocrMarkersCount") as string) || "0", 10) || 0
  );
  const ocrMrzValid = formData.get("ocrMrzValid") === "1";
  const ocrBirthDateSource = (formData.get("ocrBirthDateSource") as string)?.trim() || "NONE";

  if (!frontKey || !backKey || !selfieKey || !idNumber || !fullName || !birthDate) {
    return { error: "Todos los campos y fotografías del documento de identidad son obligatorios." };
  }

  // Validar que las claves pertenezcan al usuario autenticado
  const expectedPrefix = `creators/${userId}/kyc/`;
  if (
    !frontKey.startsWith(expectedPrefix) ||
    !backKey.startsWith(expectedPrefix) ||
    !selfieKey.startsWith(expectedPrefix)
  ) {
    return { error: "Claves de archivos KYC inválidas." };
  }

  // Validar mayoría de edad estricta sobre la fecha declarada
  const actualAge = calculateExactAge(birthDate);
  if (actualAge === null || actualAge > 110) {
    return { error: "La fecha de nacimiento ingresada no es válida." };
  }
  if (actualAge < 18) {
    return { error: "Rechazado automáticamente: Debes tener 18 años o más para verificar tu identidad." };
  }

  // Si el OCR detectó directamente una fecha de nacimiento en la foto y es menor de 18 -> bloquear inmediatamente
  if (ocrBirthDate) {
    const ocrAge = calculateExactAge(ocrBirthDate);
    if (ocrAge !== null && ocrAge < 18) {
      return {
        error: `Rechazado automáticamente: El documento escaneado indica ${ocrAge} años (menor de edad).`,
      };
    }
  }

  // Consultar configuración global de auto-aprobación + verificar integridad de las 3 fotos + verificar duplicado suspendido en paralelo
  const normalizedIdDigits = idNumber.replace(/[^A-Z0-9]/gi, "").toUpperCase();

  const [autoSettingRow, imageIntegrity, matchingOtherDocs] = await Promise.all([
    db.query.settings.findFirst({
      where: eq(settings.key, "kyc_auto_approve_enabled"),
    }),
    verifyKycImagesIntegrity(frontKey, backKey, selfieKey),
    db.query.kycDocuments.findMany({
      where: and(
        eq(kycDocuments.extractedCedula, idNumber),
        ne(kycDocuments.userId, userId)
      ),
      with: {
        user: true,
      },
    }),
  ]);

  const autoApproveEnabled = autoSettingRow ? autoSettingRow.value !== "0" : true;
  const manualReasons: string[] = [];

  if (!autoApproveEnabled) {
    manualReasons.push("Auto-aprobación desactivada por el administrador");
  }

  if (!imageIntegrity.passed) {
    manualReasons.push(...imageIntegrity.reasons);
  }

  const linkedToSuspendedAccount = matchingOtherDocs.some(
    (d) => d.user?.status === "SUSPENDED"
  );
  if (linkedToSuspendedAccount) {
    manualReasons.push("Número de documento vinculado previamente a una cuenta suspendida");
  }

  // Verificar que el OCR leyó la fecha de nacimiento directamente de la foto y coincide con la enviada
  const ocrAgeVerified = ocrBirthDate ? calculateExactAge(ocrBirthDate) : null;
  if (!ocrBirthDate || ocrAgeVerified === null) {
    manualReasons.push("El OCR no pudo leer automáticamente la fecha de nacimiento en la foto");
  } else if (ocrBirthDate !== birthDate) {
    manualReasons.push(
      `La fecha enviada (${birthDate}) fue editada manualmente respecto a la leída por OCR (${ocrBirthDate})`
    );
  } else if (ocrAgeVerified < 18 || ocrAgeVerified > 100) {
    manualReasons.push("Edad detectada fuera de rango elegible para auto-aprobación");
  }

  // Verificar que el OCR también haya reconocido estructura documental o MRZ ICAO válido
  const ocrIdClean = ocrIdNumber.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const hasDocumentIdRead = ocrIdClean.length >= 5;
  const hasTrustworthyDocumentSignal =
    ocrMrzValid ||
    (ocrConfidence >= 45 &&
      (ocrMarkersCount >= 1 || ocrBirthDateSource === "LABEL_MATCH") &&
      hasDocumentIdRead);

  if (!hasTrustworthyDocumentSignal) {
    const detail = ocrMrzValid
      ? ""
      : `confianza OCR ${ocrConfidence}%, marcadores ${ocrMarkersCount}, ID leído: ${
          hasDocumentIdRead ? "sí" : "no"
        }`;
    manualReasons.push(`Señal documental insuficiente para aprobación automática (${detail})`);
  }

  if (normalizedIdDigits.length < 5) {
    manualReasons.push("Número de documento demasiado corto");
  }

  const canAutoApprove = manualReasons.length === 0;
  const now = new Date().toISOString();
  const finalStatus: "APPROVED" | "PENDING" = canAutoApprove ? "APPROVED" : "PENDING";
  const verificationMode: "AUTO" | "MANUAL" = canAutoApprove ? "AUTO" : "MANUAL";
  const autoCheckSummary = canAutoApprove
    ? `Auto-aprobado por el sistema: mayoría de edad verificada (${actualAge} años ≥ 18), ${
        ocrMrzValid ? "MRZ ICAO verificado" : `confianza OCR ${ocrConfidence}%`
      }, 3 fotografías íntegras y distintas.`
    : `Enviado a revisión manual: ${manualReasons.join(" • ")}.`;

  // Guardar registro de KYC en la BD
  await db.insert(kycDocuments).values({
    id: docId,
    userId,
    documentType,
    frontKey,
    backKey,
    selfieKey,
    extractedCedula: idNumber,
    extractedFullName: fullName,
    extractedBirthDate: birthDate,
    ageVerified: 1,
    status: finalStatus,
    verificationMode,
    autoCheckSummary,
    ocrConfidence: ocrConfidence || null,
    reviewedAt: canAutoApprove ? now : null,
    createdAt: now,
  });

  // Actualizar estado del usuario: si fue auto-aprobado pasa inmediatamente a APPROVED + ACTIVE
  await db
    .update(users)
    .set({
      kycStatus: finalStatus,
      ...(canAutoApprove ? { status: "ACTIVE" as const } : {}),
      birthDate,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  // Registrar en bitácora de auditoría
  const reqHeaders = await headers();
  const ipAddress = reqHeaders.get("x-forwarded-for") || "127.0.0.1";
  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorId: userId,
    action: canAutoApprove ? "KYC_AUTO_APPROVED" : "KYC_SUBMITTED_PENDING",
    entity: "kyc_documents",
    entityId: docId,
    meta: JSON.stringify({
      documentType,
      actualAge,
      ocrConfidence,
      ocrMrzValid,
      ocrMarkersCount,
      ocrBirthDateSource,
      autoApproved: canAutoApprove,
      summary: autoCheckSummary,
    }),
    ipAddress,
    createdAt: now,
  });

  revalidatePath("/", "layout");
  revalidatePath("/panel");
  revalidatePath("/panel/perfil");
  revalidatePath("/panel/kyc");
  revalidatePath("/admin/kyc");
  revalidatePath("/admin/usuarios");

  return {
    success: true,
    autoApproved: canAutoApprove,
    status: finalStatus,
    age: actualAge,
    summary: autoCheckSummary,
  };
}

/**
 * Firma digital del Contrato Virtual de Creador KONTENIDO
 * Registra fecha, IP, User-Agent, datos de identidad y versión
 */
export async function signContractAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    return { error: "No autorizado" };
  }

  const userId = session.user.id;
  const fullName = (formData.get("fullName") as string)?.trim();
  const idDocument = (formData.get("idDocument") as string)?.trim();
  const accepted = formData.get("accepted") === "on";

  if (!accepted || !fullName || !idDocument) {
    return { error: "Debes aceptar los términos del contrato e ingresar tu nombre y documento de identidad." };
  }

  const reqHeaders = await headers();
  const ipAddress = reqHeaders.get("x-forwarded-for") || "127.0.0.1";
  const userAgent = reqHeaders.get("user-agent") || "Navegador Web";
  const now = new Date().toISOString();
  const contractId = crypto.randomUUID();

  // Registrar contrato en BD
  await db.insert(creatorContracts).values({
    id: contractId,
    creatorId: userId,
    acceptedAt: now,
    ipAddress,
    userAgent,
    contractVersion: "v1.0",
    fullName,
    idDocument,
    pdfKey: `creators/${userId}/contracts/v1.0.pdf`,
  });

  // Registrar en bitácora de auditoría
  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorId: userId,
    action: "CREATOR_CONTRACT_SIGNED",
    entity: "creator_contracts",
    entityId: contractId,
    meta: JSON.stringify({ fullName, idDocument, ipAddress, userAgent }),
    ipAddress,
    createdAt: now,
  });

  return { success: true };
}
