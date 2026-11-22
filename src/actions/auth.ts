"use server";

import { db } from "@/lib/db";
import { users, profiles, wallets, agencies } from "@/lib/db/schema";
import { ensureChatSchema } from "@/lib/db/initChat";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

const RESERVED_REGISTER_USERNAMES = new Set([
  "admin",
  "panel",
  "cuenta",
  "login",
  "registro",
  "agencia",
  "suspendido",
  "api",
  "img",
  "mensajes",
  "settings",
  "soporte",
  "kontenido",
  "root",
  "support",
  "komestible",
  "koinciden",
]);

import { normalizeGenderValue } from "@/lib/countries";

const validGenderEnum = z.enum(["HOMBRE", "MUJER", "PAREJA", "TRANSGENERO", "TRANSEXUAL", "OTRO"]);

/**
 * Esquema de validación para registro de CREADOR
 * Requiere ser mayor de 18 años según fecha de nacimiento
 */
const registerCreatorSchema = z.object({
  username: z
    .string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .max(30, "Máximo 30 caracteres")
    .regex(/^[a-z0-9_]+$/, "Solo letras minúsculas, números y guiones bajos"),
  email: z.string().email("Ingresa un correo electrónico válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  country: z.string().min(2).max(10).default("VE"),
  gender: validGenderEnum.nullable().optional(),
  birthDate: z.string().refine((val) => {
    const birth = new Date(val);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    const actualAge = m < 0 || (m === 0 && today.getDate() < birth.getDate()) ? age - 1 : age;
    return actualAge >= 18;
  }, "Debes ser mayor de 18 años para registrarte como creador"),
});

/**
 * Esquema de validación para registro de CONSUMIDOR
 */
const registerConsumerSchema = z.object({
  username: z
    .string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .max(30, "Máximo 30 caracteres")
    .regex(/^[a-z0-9_]+$/, "Solo letras minúsculas, números y guiones bajos"),
  email: z.string().email("Ingresa un correo electrónico válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  country: z.string().min(2).max(10).default("VE"),
  gender: validGenderEnum.nullable().optional(),
  birthDate: z.string().optional(),
});

/**
 * Registrar una nueva cuenta de CREADOR
 */
export async function registerCreatorAction(formData: FormData) {
  await Promise.all([ensureChatSchema(), ensureKomestibleSchema()]);

  const rawGender = normalizeGenderValue(formData.get("gender") as string | null);
  const raw = {
    username: (formData.get("username") as string)?.toLowerCase().trim(),
    email: (formData.get("email") as string)?.toLowerCase().trim(),
    password: formData.get("password") as string,
    country: ((formData.get("country") as string) || "VE").toUpperCase().trim(),
    gender: rawGender,
    birthDate: formData.get("birthDate") as string,
  };

  const validated = registerCreatorSchema.safeParse(raw);
  if (!validated.success) {
    return { error: validated.error.errors[0]?.message || "Datos inválidos" };
  }

  const { username, email, password, country, gender, birthDate } = validated.data;

  if (RESERVED_REGISTER_USERNAMES.has(username)) {
    return { error: "Este nombre de usuario está reservado por la plataforma." };
  }

  // Verificar si ya existe usuario o correo
  const existing = await db.query.users.findFirst({
    where: or(eq(users.username, username), eq(users.email, email)),
  });

  if (existing) {
    if (existing.email === email) return { error: "Este correo electrónico ya está registrado." };
    if (existing.username === username) return { error: "Este nombre de usuario ya está en uso." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Crear usuario con rol CREATOR y estado PENDING (la identidad e intereses se completan en perfil básico)
  await db.insert(users).values({
    id: userId,
    username,
    email,
    passwordHash,
    role: "CREATOR",
    status: "PENDING",
    kycStatus: "NONE",
    birthDate,
    country,
    gender: gender ?? null,
    interestedIn: null,
    level: 0,
    allowDownload: 0,
    createdAt: now,
    updatedAt: now,
  });

  const creatorCat = normalizeGenderValue(gender) || "MUJER";

  await db.insert(profiles).values({
    userId,
    displayName: username,
    bio: "Creadora de contenido en KONTENIDO.",
    subscriptionPriceKoin: 10.0,
    creatorCategory: creatorCat,
    isPublished: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(wallets).values({
    userId,
    balanceKoin: 0.0,
    totalSpentUsd: 0.0,
    totalEarnedKoin: 0.0,
    updatedAt: now,
  });

  return { success: true };
}

/**
 * Registrar una nueva cuenta de CONSUMIDOR
 */
export async function registerConsumerAction(formData: FormData) {
  await Promise.all([ensureChatSchema(), ensureKomestibleSchema()]);

  const rawGender = normalizeGenderValue(formData.get("gender") as string | null);
  const raw = {
    username: (formData.get("username") as string)?.toLowerCase().trim(),
    email: (formData.get("email") as string)?.toLowerCase().trim(),
    password: formData.get("password") as string,
    country: ((formData.get("country") as string) || "VE").toUpperCase().trim(),
    gender: rawGender,
    birthDate: (formData.get("birthDate") as string) || undefined,
  };

  const validated = registerConsumerSchema.safeParse(raw);
  if (!validated.success) {
    return { error: validated.error.errors[0]?.message || "Datos inválidos" };
  }

  const { username, email, password, country, gender, birthDate } = validated.data;

  if (RESERVED_REGISTER_USERNAMES.has(username)) {
    return { error: "Este nombre de usuario está reservado por la plataforma." };
  }

  const existing = await db.query.users.findFirst({
    where: or(eq(users.username, username), eq(users.email, email)),
  });

  if (existing) {
    if (existing.email === email) return { error: "Este correo electrónico ya está registrado." };
    if (existing.username === username) return { error: "Este nombre de usuario ya está en uso." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Crear usuario con rol CONSUMER y estado ACTIVE (la identidad e intereses se completan en perfil básico)
  await db.insert(users).values({
    id: userId,
    username,
    email,
    passwordHash,
    role: "CONSUMER",
    status: "ACTIVE",
    kycStatus: "NONE",
    birthDate: birthDate || null,
    country,
    gender: gender ?? null,
    interestedIn: null,
    level: 0,
    allowDownload: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(profiles).values({
    userId,
    displayName: username,
    bio: "Usuario en KONTENIDO.",
    subscriptionPriceKoin: 0.0,
    isPublished: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(wallets).values({
    userId,
    balanceKoin: 0.0,
    totalSpentUsd: 0.0,
    totalEarnedKoin: 0.0,
    updatedAt: now,
  });

  return { success: true };
}

const registerAgencySchema = z.object({
  agencyName: z
    .string()
    .min(2, "El nombre de la agencia debe tener al menos 2 caracteres")
    .max(60, "Máximo 60 caracteres"),
  username: z
    .string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .max(30, "Máximo 30 caracteres")
    .regex(/^[a-z0-9_]+$/, "Solo letras minúsculas, números y guiones bajos"),
  email: z.string().email("Ingresa un correo electrónico válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  country: z.string().min(2).max(10).default("VE"),
  description: z.string().max(300).optional(),
});

/**
 * Registrar una nueva cuenta de AGENCIA
 */
export async function registerAgencyAction(formData: FormData) {
  await ensureChatSchema();
  await ensureKomestibleSchema();

  const raw = {
    agencyName: (formData.get("agencyName") as string)?.trim(),
    username: (formData.get("username") as string)?.toLowerCase().trim(),
    email: (formData.get("email") as string)?.toLowerCase().trim(),
    password: formData.get("password") as string,
    country: ((formData.get("country") as string) || "VE").toUpperCase().trim(),
    description: (formData.get("description") as string)?.trim(),
  };

  const validated = registerAgencySchema.safeParse(raw);
  if (!validated.success) {
    return { error: validated.error.errors[0]?.message || "Datos inválidos" };
  }

  const { agencyName, username, email, password, country, description } = validated.data;

  if (RESERVED_REGISTER_USERNAMES.has(username)) {
    return { error: "Este nombre de usuario está reservado por la plataforma." };
  }

  const existing = await db.query.users.findFirst({
    where: or(eq(users.username, username), eq(users.email, email)),
  });

  if (existing) {
    if (existing.email === email) return { error: "Este correo electrónico ya está registrado." };
    if (existing.username === username) return { error: "Este nombre de usuario ya está en uso." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = crypto.randomUUID();
  const agencyId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(users).values({
    id: userId,
    username,
    email,
    passwordHash,
    role: "AGENCY",
    status: "ACTIVE",
    kycStatus: "NONE",
    country,
    level: 0,
    allowDownload: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(wallets).values({
    userId,
    balanceKoin: 0.0,
    totalSpentUsd: 0.0,
    totalEarnedKoin: 0.0,
    updatedAt: now,
  });

  await db.insert(agencies).values({
    id: agencyId,
    ownerUserId: userId,
    name: agencyName,
    description: description || `Agencia oficial de talentos ${agencyName} en KONTENIDO.`,
    badgeText: agencyName,
    badgeColor: "from-indigo-500 via-purple-500 to-rose-500",
    showBadge: 1,
    commissionPct: 10.0,
    status: "ACTIVE",
    createdAt: now,
  });

  return { success: true };
}

/**
 * Iniciar sesión mediante credenciales
 */
export async function loginAction(formData: FormData) {
  const identifier = formData.get("identifier") as string;
  const password = formData.get("password") as string;
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

  try {
    await signIn("credentials", {
      identifier,
      password,
      redirectTo: callbackUrl,
    });
    return { success: true };
  } catch (err) {
    if (err instanceof AuthError) {
      switch (err.type) {
        case "CredentialsSignin":
          return { error: "Credenciales inválidas. Verifica tu correo/usuario y contraseña." };
        default:
          return { error: "Ocurrió un error al iniciar sesión. Inténtalo de nuevo." };
      }
    }
    throw err;
  }
}
