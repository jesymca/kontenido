"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { kycDocuments, users, creatorContracts, auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { BUCKETS, getPresignedUploadUrl } from "@/lib/r2";

/**
 * Genera URLs prefirmadas para que la creadora suba los 3 documentos de KYC
 * directamente a Cloudflare R2 privado:
 * 1. Cédula frontal
 * 2. Cédula reverso
 * 3. Selfie con cédula en mano
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

/**
 * Enviar solicitud de KYC tras subir los documentos a R2
 * Simula/ejecuta la extracción de datos y validación de mayoría de edad (>= 18 años)
 */
export async function submitKycAction(formData: FormData) {
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
  const birthDate = formData.get("birthDate") as string;

  if (!frontKey || !backKey || !selfieKey || !idNumber || !fullName || !birthDate) {
    return { error: "Todos los campos y fotos de la cédula son obligatorios." };
  }

  // Validar mayoría de edad
  const birth = new Date(birthDate);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  const actualAge = m < 0 || (m === 0 && today.getDate() < birth.getDate()) ? age - 1 : age;

  if (actualAge < 18) {
    return { error: "Rechazado automáticamente: Debes tener 18 años o más para ser creador." };
  }

  const now = new Date().toISOString();

  // Guardar registro de KYC en estado PENDING para revisión por SUPER_ADMIN
  await db.insert(kycDocuments).values({
    id: docId,
    userId,
    documentType: "CEDULA_VE",
    frontKey,
    backKey,
    selfieKey,
    extractedCedula: idNumber,
    extractedFullName: fullName,
    extractedBirthDate: birthDate,
    ageVerified: 1,
    status: "PENDING",
    createdAt: now,
  });

  // Actualizar estado del usuario a KYC PENDING
  await db
    .update(users)
    .set({
      kycStatus: "PENDING",
      birthDate,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  return { success: true };
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
    return { error: "Debes aceptar los términos del contrato e ingresar tu nombre y cédula." };
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
