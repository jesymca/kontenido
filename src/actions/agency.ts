"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  agencies,
  agencyCreators,
  users,
  profiles,
  wallets,
} from "@/lib/db/schema";
import { ensureChatSchema } from "@/lib/db/initChat";
import { validateNoExternalContact } from "@/lib/contentFilter";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { normalizeGenderValue } from "@/lib/countries";

const RESERVED_USERNAMES = new Set([
  "admin",
  "panel",
  "cuenta",
  "agencia",
  "api",
  "login",
  "registro",
  "suspendido",
  "mensajes",
  "komestible",
  "koinciden",
]);

/**
 * Inicializar registro de agencia para un usuario AGENCY existente que aún no tenga registro en `agencies`
 */
export async function createAgencyForUserAction(formData: FormData) {
  await ensureChatSchema();
  const session = await auth();
  if (!session?.user) {
    return { error: "Debes iniciar sesión para activar una agencia." };
  }

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  if (!name || name.length < 2) {
    return { error: "El nombre de la agencia es obligatorio (mínimo 2 caracteres)." };
  }

  const existing = await db.query.agencies.findFirst({
    where: eq(agencies.ownerUserId, session.user.id),
  });
  if (existing) {
    return { error: "Ya tienes una agencia registrada." };
  }

  const now = new Date().toISOString();

  // Si el usuario no era AGENCY ni SUPER_ADMIN, actualizar su rol a AGENCY
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "AGENCY") {
    await db
      .update(users)
      .set({ role: "AGENCY", updatedAt: now })
      .where(eq(users.id, session.user.id));
  }

  const agencyId = crypto.randomUUID();
  await db.insert(agencies).values({
    id: agencyId,
    ownerUserId: session.user.id,
    name,
    description: description || `Agencia oficial de talentos ${name} en KONTENIDO.`,
    badgeText: name,
    badgeColor: "from-indigo-500 via-purple-500 to-rose-500",
    showBadge: 1,
    commissionPct: 10.0,
    status: "ACTIVE",
    createdAt: now,
  });

  revalidatePath("/agencia");
  revalidatePath("/", "layout");
  return { success: true, agencyId };
}

/**
 * Actualizar datos de la Agencia y configuración del Badge llamativo mostrado en sus perfiles
 */
export async function updateAgencySettingsAction(formData: FormData) {
  await ensureChatSchema();
  const session = await auth();
  if (!session?.user || (session.user.role !== "AGENCY" && session.user.role !== "SUPER_ADMIN")) {
    return { error: "No autorizado" };
  }

  const targetAgencyId = (formData.get("agencyId") as string)?.trim();
  const agency =
    session.user.role === "SUPER_ADMIN" && targetAgencyId
      ? await db.query.agencies.findFirst({ where: eq(agencies.id, targetAgencyId) })
      : await db.query.agencies.findFirst({ where: eq(agencies.ownerUserId, session.user.id) });

  if (!agency) {
    return { error: "Agencia no encontrada." };
  }

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const badgeText = (formData.get("badgeText") as string)?.trim();
  const badgeColor =
    (formData.get("badgeColor") as string)?.trim() ||
    "from-indigo-500 via-purple-500 to-rose-500";
  const showBadge =
    formData.get("showBadge") === "on" || formData.get("showBadge") === "1" ? 1 : 0;

  if (!name || name.length < 2) {
    return { error: "El nombre de la agencia es obligatorio." };
  }

  const nameCheck = validateNoExternalContact(name, "El nombre de la agencia");
  if (!nameCheck.valid) return { error: nameCheck.error };
  if (badgeText) {
    const badgeCheck = validateNoExternalContact(badgeText, "El texto del badge");
    if (!badgeCheck.valid) return { error: badgeCheck.error };
  }

  await db
    .update(agencies)
    .set({
      name,
      description: description || null,
      badgeText: badgeText || name,
      badgeColor,
      showBadge,
    })
    .where(eq(agencies.id, agency.id));

  revalidatePath("/agencia");
  revalidatePath("/", "layout");

  return { success: true };
}

/**
 * Crear un nuevo perfil de Creadora de contenido perteneciente a la Agencia.
 * Aplica las mismas condiciones que una creadora individual y queda vinculada en `agency_creators`.
 */
export async function createAgencyCreatorAction(formData: FormData) {
  await ensureChatSchema();
  const session = await auth();
  if (!session?.user || (session.user.role !== "AGENCY" && session.user.role !== "SUPER_ADMIN")) {
    return { error: "No autorizado" };
  }

  const targetAgencyId = (formData.get("agencyId") as string)?.trim();
  const agency =
    session.user.role === "SUPER_ADMIN" && targetAgencyId
      ? await db.query.agencies.findFirst({ where: eq(agencies.id, targetAgencyId) })
      : await db.query.agencies.findFirst({ where: eq(agencies.ownerUserId, session.user.id) });

  if (!agency) {
    return { error: "No se encontró tu agencia." };
  }

  const displayName = (formData.get("displayName") as string)?.trim();
  const rawUsername = (formData.get("username") as string)
    ?.toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  const bio = (formData.get("bio") as string)?.trim();
  const rawCategory = (formData.get("creatorCategory") as string) || "MUJER";
  const creatorCategory = normalizeGenderValue(rawCategory) || "MUJER";
  const subscriptionPriceKoin = parseFloat(
    (formData.get("subscriptionPriceKoin") as string) || "10"
  ) || 10.0;
  const chatPriceKoin = parseFloat(
    (formData.get("chatPriceKoin") as string) || "5"
  ) || 5.0;
  const chatDurationHours = Math.max(
    1,
    parseInt((formData.get("chatDurationHours") as string) || "168", 10) || 168
  );

  if (!displayName) {
    return { error: "El nombre artístico del perfil es obligatorio." };
  }
  if (!rawUsername || rawUsername.length < 3 || rawUsername.length > 30 || !/^[a-z0-9_]+$/.test(rawUsername)) {
    return {
      error: "El nombre de usuario debe tener entre 3 y 30 caracteres (solo minúsculas, números y _).",
    };
  }
  if (RESERVED_USERNAMES.has(rawUsername)) {
    return { error: "Ese nombre de usuario está reservado." };
  }

  const nameCheck = validateNoExternalContact(displayName, "El nombre artístico");
  if (!nameCheck.valid) return { error: nameCheck.error };
  if (bio) {
    const bioCheck = validateNoExternalContact(bio, "La biografía");
    if (!bioCheck.valid) return { error: bioCheck.error };
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.username, rawUsername),
    columns: { id: true },
  });
  if (existingUser) {
    return { error: "Ese nombre de usuario ya está en uso. Elige otro." };
  }

  const creatorId = crypto.randomUUID();
  const now = new Date().toISOString();
  const internalEmail = `${rawUsername}.${creatorId.slice(0, 6)}@agency.kontenido.local`;

  await db.insert(users).values({
    id: creatorId,
    username: rawUsername,
    email: internalEmail,
    passwordHash: null,
    role: "CREATOR",
    status: agency.status === "ACTIVE" ? "ACTIVE" : "PENDING",
    kycStatus: agency.status === "ACTIVE" ? "APPROVED" : "PENDING",
    country: session.user.country || "VE",
    gender: creatorCategory,
    level: 0,
    allowDownload: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(profiles).values({
    userId: creatorId,
    displayName,
    bio: bio || `Perfil exclusivo representado por ${agency.name}.`,
    subscriptionPriceKoin,
    chatPriceKoin,
    chatDurationHours,
    creatorCategory,
    isPublished: 1,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(wallets).values({
    userId: creatorId,
    balanceKoin: 0.0,
    totalSpentUsd: 0.0,
    totalEarnedKoin: 0.0,
    updatedAt: now,
  });

  await db.insert(agencyCreators).values({
    id: crypto.randomUUID(),
    agencyId: agency.id,
    creatorId,
    status: "ACCEPTED",
    joinedAt: now,
  });

  revalidatePath("/agencia");
  revalidatePath("/");

  return { success: true, creatorId, username: rawUsername };
}
