"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  profiles,
  paymentMethods,
  posts,
  mediaAssets,
  packages,
  packageItems,
  auditLog,
  payouts,
  wallets,
  walletTransactions,
  settings,
  creatorSubscriptionPlans,
  messages,
  users,
} from "@/lib/db/schema";
import { eq, and, ne, inArray } from "drizzle-orm";
import { copyObjectInR2, BUCKETS } from "@/lib/r2";
import { revalidatePath } from "next/cache";
import { getDolarRates } from "@/lib/dolarapi";
import { getCreatorCommissionTier } from "@/lib/commissions";
import { validateNoExternalContact } from "@/lib/contentFilter";
import { resolveCreatorTarget } from "@/lib/creatorTarget";
import { ensureChatSchema } from "@/lib/db/initChat";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { isVenezuelanUser, normalizeGenderValue, serializeInterestedIn } from "@/lib/countries";
import { createPostForCreator } from "@/lib/posts";
import { sendPayoutRequestedEmail, formatPaymentMethodLabel } from "@/lib/email";

const RESERVED_USERNAMES = new Set([
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

/**
 * Valida en tiempo real si un nombre de usuario (enlace de perfil) está disponible
 * y, en caso de estar ocupado, sugiere nombres alternativos disponibles basados en la propuesta.
 */
export async function checkUsernameAvailabilityAction(
  rawProposed: string,
  currentUsername?: string,
  displayNameHint?: string
) {
  const clean = (rawProposed || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);

  if (clean.length < 3) {
    return {
      available: false,
      isCurrent: false,
      cleanUsername: clean,
      reason: "Debe tener al menos 3 caracteres (letras, números o guion bajo).",
      suggestions: [] as string[],
    };
  }

  if (currentUsername && clean === currentUsername.toLowerCase().trim()) {
    return {
      available: true,
      isCurrent: true,
      cleanUsername: clean,
      reason: "Es tu nombre de usuario actual.",
      suggestions: [] as string[],
    };
  }

  let isTaken = RESERVED_USERNAMES.has(clean);

  if (!isTaken) {
    const existing = await db.query.users.findFirst({
      where: eq(users.username, clean),
      columns: { id: true },
    });
    if (existing) {
      isTaken = true;
    }
  }

  if (!isTaken) {
    return {
      available: true,
      isCurrent: false,
      cleanUsername: clean,
      reason: "Perfil Disponible",
      suggestions: [] as string[],
    };
  }

  // Generar candidatos inteligentes basados en el nombre propuesto y el nombre para mostrar
  const base = clean.replace(/_+$/, "").slice(0, 20) || "creadora";
  const hintClean = (displayNameHint || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 22);

  const rand1 = Math.floor(10 + Math.random() * 89);
  const rand2 = Math.floor(100 + Math.random() * 899);

  const rawCandidates = [
    `${base}_ve`,
    `${base}_vip`,
    `${base}_oficial`,
    `soy_${base}`,
    `${base}_vzla`,
    `${base}_exclusive`,
    ...(hintClean && hintClean.length >= 3 && hintClean !== base
      ? [hintClean, `${hintClean}_ve`, `${hintClean}_vip`]
      : []),
    `${base}_${rand1}`,
    `${base}_ve${rand1}`,
    `${base}_${rand2}`,
  ]
    .map((c) => c.slice(0, 30))
    .filter((c) => c.length >= 3 && !RESERVED_USERNAMES.has(c));

  const uniqueCandidates = Array.from(new Set(rawCandidates));

  const takenRows =
    uniqueCandidates.length > 0
      ? await db
          .select({ username: users.username })
          .from(users)
          .where(inArray(users.username, uniqueCandidates))
      : [];

  const takenSet = new Set(takenRows.map((r) => r.username));
  const availableSuggestions = uniqueCandidates.filter((c) => !takenSet.has(c)).slice(0, 5);

  return {
    available: false,
    isCurrent: false,
    cleanUsername: clean,
    reason: "Este enlace de perfil ya está ocupado. Elige una sugerencia disponible:",
    suggestions: availableSuggestions,
  };
}

/**
 * Actualizar perfil público de la Creadora (incluyendo edición del enlace / username)
 */
export async function updateProfileAction(formData: FormData) {
  await Promise.all([ensureChatSchema(), ensureKomestibleSchema()]);
  const session = await auth();
  if (!session?.user) {
    return { error: "No autorizado" };
  }

  const target = await resolveCreatorTarget(
    session.user,
    formData.get("managedCreatorId") as string | null
  );
  if (!target.ok) {
    return { error: target.error };
  }

  const userId = target.creatorId;
  const targetCurrentUsername = target.username;
  const displayName = (formData.get("displayName") as string)?.trim();
  const rawUsername = (formData.get("username") as string)
    ?.toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  const bio = (formData.get("bio") as string)?.trim();
  const priceRaw = formData.get("subscriptionPriceKoin") as string;
  const subscriptionPriceKoin = parseFloat(priceRaw) || 10.0;
  const rawCategory = (formData.get("creatorCategory") as string) || "";
  const normalizedIdentity = normalizeGenderValue(rawCategory);
  if (!normalizedIdentity) {
    return {
      error: "Debes indicar si eres Hombre, Mujer, Pareja o Transgénero.",
    };
  }
  const creatorCategory = normalizedIdentity;

  const rawInterestedValues = formData.getAll("interestedIn").map(String);
  const serializedInterestedIn = serializeInterestedIn(rawInterestedValues);
  if (!target.isAgencyManaged && !serializedInterestedIn) {
    return {
      error:
        "Debes seleccionar al menos una opción de a quién estás interesado/a en conocer (Hombre, Mujer, Pareja o Transgénero) para KOMESTIBLE.",
    };
  }

  const isPublished = formData.get("isPublished") === "on" || formData.get("isPublished") === "1" ? 1 : 0;
  const isAiGenerated = formData.get("isAiGenerated") === "on" || formData.get("isAiGenerated") === "1" ? 1 : 0;
  const avatarKey = (formData.get("avatarKey") as string) || undefined;
  const bannerKey = (formData.get("bannerKey") as string) || undefined;
  const countryRaw = (formData.get("country") as string)?.trim().toUpperCase();
  const country = countryRaw && /^[A-Z]{2,5}$/.test(countryRaw) ? countryRaw : undefined;

  if (!displayName) {
    return { error: "El nombre para mostrar es obligatorio." };
  }

  // Bloquear números de teléfono, correos o intentos de contacto externo
  const nameFilter = validateNoExternalContact(displayName, "El nombre para mostrar");
  if (!nameFilter.valid) {
    return { error: nameFilter.error };
  }
  const bioFilter = validateNoExternalContact(bio, "La biografía / texto de bienvenida");
  if (!bioFilter.valid) {
    return { error: bioFilter.error };
  }

  const now = new Date().toISOString();
  let finalUsername = targetCurrentUsername;

  // Si el usuario editó su nombre de usuario (enlace del perfil), validar disponibilidad y actualizar
  if (rawUsername && rawUsername !== targetCurrentUsername) {
    if (rawUsername.length < 3 || rawUsername.length > 30 || !/^[a-z0-9_]+$/.test(rawUsername)) {
      return {
        error: "El nombre de usuario debe tener entre 3 y 30 caracteres (solo letras minúsculas, números y guion bajo).",
      };
    }

    if (RESERVED_USERNAMES.has(rawUsername)) {
      return { error: "Ese nombre de usuario está reservado por el sistema. Elige otro." };
    }

    const existingUser = await db.query.users.findFirst({
      where: and(eq(users.username, rawUsername), ne(users.id, userId)),
      columns: { id: true },
    });

    if (existingUser) {
      return {
        error: "Ese nombre de usuario ya está ocupado. Selecciona una de las sugerencias disponibles.",
      };
    }

    await db
      .update(users)
      .set({
        username: rawUsername,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    finalUsername = rawUsername;
  }

  await db
    .update(profiles)
    .set({
      displayName,
      bio,
      subscriptionPriceKoin,
      creatorCategory,
      isPublished,
      isAiGenerated,
      ...(avatarKey ? { avatarKey } : {}),
      ...(bannerKey ? { bannerKey } : {}),
      updatedAt: now,
    })
    .where(eq(profiles.userId, userId));

  if (country || !target.isAgencyManaged) {
    await db
      .update(users)
      .set({
        ...(country ? { country } : {}),
        gender: creatorCategory,
        ...(serializedInterestedIn ? { interestedIn: serializedInterestedIn } : {}),
        updatedAt: now,
      })
      .where(eq(users.id, userId));
  }

  revalidatePath("/", "layout");
  revalidatePath(`/${targetCurrentUsername}`);
  revalidatePath(`/${finalUsername}`);
  revalidatePath("/panel");
  revalidatePath("/panel/perfil");
  revalidatePath("/komestible");
  revalidatePath("/agencia");
  revalidatePath(`/agencia/creadoras/${userId}`);

  return { success: true, username: finalUsername };
}

/**
 * Guardar o actualizar un método de pago del creador
 * - Venezuela: Transferencia bancaria, PagoMóvil, Binance USDT o Wallet USDT
 * - Internacional: Binance USDT o Wallet USDT (sin Bolívares)
 */
export async function savePaymentMethodAction(formData: FormData) {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) {
    return { error: "No autorizado" };
  }

  const userId = session.user.id;
  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  const isVenezuela = isVenezuelanUser(currentUser?.country);

  const type = formData.get("type") as "BANK_TRANSFER" | "PAGOMOVIL" | "BINANCE" | "USDT_WALLET";

  if (!["BANK_TRANSFER", "PAGOMOVIL", "BINANCE", "USDT_WALLET"].includes(type)) {
    return { error: "Tipo de método de pago no admitido." };
  }

  if (!isVenezuela && (type === "BANK_TRANSFER" || type === "PAGOMOVIL")) {
    return { error: "Los usuarios fuera de Venezuela solo pueden configurar métodos de cobro en USDT." };
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  if (type === "BANK_TRANSFER") {
    const bankId = parseInt(formData.get("bankId") as string);
    const accountNumber = (formData.get("accountNumber") as string)?.trim();
    const accountHolder = (formData.get("accountHolder") as string)?.trim();
    const idDocument = (formData.get("idDocument") as string)?.trim();

    if (!bankId || !accountNumber || !accountHolder || !idDocument) {
      return { error: "Todos los campos de la cuenta bancaria son requeridos." };
    }

    await db.insert(paymentMethods).values({
      id,
      creatorId: userId,
      type,
      bankId,
      accountNumber,
      accountHolder,
      idDocument,
      isActive: 1,
      createdAt: now,
    });
  } else if (type === "PAGOMOVIL") {
    const bankId = parseInt(formData.get("bankId") as string);
    const phone = (formData.get("phone") as string)?.trim();
    const idDocument = (formData.get("idDocument") as string)?.trim();

    if (!bankId || !phone || !idDocument) {
      return { error: "Todos los datos de PagoMóvil son requeridos." };
    }

    await db.insert(paymentMethods).values({
      id,
      creatorId: userId,
      type,
      bankId,
      phone,
      idDocument,
      isActive: 1,
      createdAt: now,
    });
  } else if (type === "BINANCE") {
    const binanceEmail = (formData.get("binanceEmail") as string)?.trim();
    if (!binanceEmail) {
      return { error: "Ingresa el correo, Pay ID o billetera USDT de Binance." };
    }

    await db.insert(paymentMethods).values({
      id,
      creatorId: userId,
      type,
      binanceEmail,
      isActive: 1,
      createdAt: now,
    });
  } else if (type === "USDT_WALLET") {
    const walletAddress = (formData.get("binanceEmail") as string)?.trim();
    const usdtNetwork = (formData.get("usdtNetwork") as string)?.trim() || "TRC20";
    if (!walletAddress || walletAddress.length < 10) {
      return { error: "Ingresa una dirección de wallet USDT válida." };
    }

    await db.insert(paymentMethods).values({
      id,
      creatorId: userId,
      type,
      binanceEmail: walletAddress,
      usdtNetwork,
      isActive: 1,
      createdAt: now,
    });
  }

  revalidatePath("/panel/pagos");
  return { success: true };
}

/**
 * Eliminar un método de pago
 */
export async function deletePaymentMethodAction(paymentMethodId: string) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  await db
    .delete(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, paymentMethodId),
        eq(paymentMethods.creatorId, session.user.id)
      )
    );

  revalidatePath("/panel/pagos");
  return { success: true };
}

/**
 * Publicar un nuevo post de contenido multimedia
 */
export async function createPostAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    return { error: "No autorizado" };
  }

  return createPostForCreator(session.user, {
    title: (formData.get("title") as string) || "",
    description: (formData.get("description") as string) || "",
    priceKoin: (formData.get("priceKoin") as string) || "0",
    isPublicTeaser: (formData.get("isPublicTeaser") as string) || "0",
    mediaItems: (formData.get("mediaKeys") as string) || "",
    managedCreatorId: (formData.get("managedCreatorId") as string | null) || null,
  });
}

/**
 * Eliminar contenido por parte del Creador:
 * REGLA INQUEBRANTABLE DEL CLIENTE:
 * "CREADOR Podra hacer crud subir y bajar contenido a la plataforma, siempre que va
 * a eliminar un contenido se le debe notificar que no quedara registro en la plataforma
 * pero siempre debe quedar respaldo de dichos archivos"
 */
export async function deletePostWithBackupAction(postId: string) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  // Obtener el post
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!post) {
    return { error: "Contenido no encontrado." };
  }

  const target = await resolveCreatorTarget(session.user, post.creatorId);
  if (!target.ok) {
    return { error: "Contenido no encontrado o no autorizado." };
  }

  const userId = target.creatorId;

  const now = new Date().toISOString();
  const backupArchiveKey = `backups/${userId}/posts/${postId}_deleted_${Date.now()}`;

  // Obtener todos los media assets asociados y respaldarlos
  const assets = await db.query.mediaAssets.findMany({
    where: eq(mediaAssets.postId, postId),
  });

  for (const asset of assets) {
    const targetKey = `backups/${userId}/media/${asset.id}_${Date.now()}`;
    try {
      // Copiar a la carpeta permanente de respaldo en R2
      await copyObjectInR2(BUCKETS.MEDIA, asset.originalKey, BUCKETS.PRIVATE, targetKey);
    } catch (err) {
      console.warn("No se pudo copiar en R2 (puede que no exista el archivo real):", err);
    }

    // Marcar como eliminado en mediaAssets (soft delete)
    await db
      .update(mediaAssets)
      .set({ isDeleted: 1, backupKey: targetKey })
      .where(eq(mediaAssets.id, asset.id));
  }

  // Soft delete en la tabla posts para que desaparezca de la plataforma
  await db
    .update(posts)
    .set({
      isDeleted: 1,
      deletedAt: now,
      backupArchiveKey,
      updatedAt: now,
    })
    .where(eq(posts.id, postId));

  // Registrar en bitácora de auditoría
  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorId: userId,
    action: "POST_DELETED_WITH_BACKUP",
    entity: "posts",
    entityId: postId,
    meta: JSON.stringify({
      postId,
      title: post.title,
      backupArchiveKey,
      mediaCount: assets.length,
    }),
    ipAddress: "127.0.0.1",
    createdAt: now,
  });

  revalidatePath(`/${target.username}`);
  revalidatePath("/panel");
  revalidatePath("/admin/contenido");
  revalidatePath("/");

  return {
    success: true,
    message: "El contenido ha sido retirado de la plataforma. Se ha guardado un respaldo seguro permanente.",
  };
}

/**
 * Solicitar retiro de fondos en Bolívares (VES)
 * Calcula la comisión escalonada según el status/monto general de la creadora (10%, 15%, 20%),
 * consulta el valor paralelo en tiempo real de la API https://ve.dolarapi.com/v1/dolares/,
 * congela la tasa y el monto en Bolívares que debe esperar en su cuenta bancaria,
 * y coloca el retiro en estado "PENDING" ("EN ESPERA") hasta aprobación por SUPER_ADMIN.
 */
export async function requestPayoutAction(formData: FormData) {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user || (session.user.role !== "CREATOR" && session.user.role !== "SUPER_ADMIN")) {
    return { error: "No autorizado. Solo creadoras de contenido pueden solicitar retiros." };
  }

  const userId = session.user.id;
  const amountKoin = parseFloat(formData.get("amountKoin") as string);
  const paymentMethodId = (formData.get("paymentMethodId") as string)?.trim();

  if (isNaN(amountKoin) || amountKoin <= 0) {
    return { error: "Por favor ingresa un monto válido a retirar." };
  }

  if (amountKoin < 5) {
    return { error: "El monto mínimo para solicitar retiro es de 5.00 KOIN." };
  }

  if (!paymentMethodId) {
    return { error: "Debes seleccionar un método de cobro configurado." };
  }

  // 1. Verificar billetera y saldo disponible
  const wallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, userId),
  });

  if (!wallet || wallet.balanceKoin < amountKoin) {
    return {
      error: `Saldo insuficiente. Tu saldo disponible para retirar es de ${wallet?.balanceKoin?.toFixed(2) || "0.00"} KOIN.`,
    };
  }

  // 2. Verificar que el método de pago pertenezca a la creadora y esté activo
  const method = await db.query.paymentMethods.findFirst({
    where: and(eq(paymentMethods.id, paymentMethodId), eq(paymentMethods.creatorId, userId)),
    with: { bank: true },
  });

  if (!method || method.isActive !== 1) {
    return { error: "El método de cobro seleccionado no es válido o está inactivo." };
  }

  // 3. Consultar configuraciones y país del usuario
  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  const isVenezuela = isVenezuelanUser(currentUser?.country);
  const isCryptoMethod = method.type === "BINANCE" || method.type === "USDT_WALLET";

  if (!isVenezuela && !isCryptoMethod) {
    return {
      error: "Para cuentas internacionales fuera de Venezuela, el retiro debe realizarse mediante Binance o Wallet USDT.",
    };
  }

  const allSettings = await db.query.settings.findMany();
  const settingsMap = new Map(allSettings.map((s) => [s.key, s.value]));
  const fallbackRate = parseFloat(settingsMap.get("fallback_usd_ves_rate") || "1030.88");

  const tierInfo = getCreatorCommissionTier(wallet.totalEarnedKoin || 0, settingsMap, currentUser?.level);

  // 4. Calcular desglose en KOIN y (si es Venezuela en Bs.) consultar DolarApi
  const feeKoin = Number(((amountKoin * tierInfo.feePct) / 100).toFixed(2));
  const netKoin = Number((amountKoin - feeKoin).toFixed(2));

  let tasaParalelo: number | null = null;
  let amountVes: number | null = null;

  if (isVenezuela && !isCryptoMethod) {
    const dolarInfo = await getDolarRates(fallbackRate);
    tasaParalelo = dolarInfo.paralelo;
    amountVes = Number((netKoin * tasaParalelo).toFixed(2));
  } else if (isVenezuela && method.type === "BINANCE") {
    // Mantiene compatibilidad de referencia Bs. si la creadora venezolana usa Binance,
    // mientras las cuentas internacionales operan 100% directo en USDT sin tasa VES.
    const dolarInfo = await getDolarRates(fallbackRate);
    tasaParalelo = dolarInfo.paralelo;
    amountVes = Number((netKoin * tasaParalelo).toFixed(2));
  }

  const now = new Date().toISOString();
  const payoutId = crypto.randomUUID();

  // 6. Descontar saldo de la billetera de la creadora de inmediato para evitar doble gasto
  await db
    .update(wallets)
    .set({
      balanceKoin: Number((wallet.balanceKoin - amountKoin).toFixed(2)),
      updatedAt: now,
    })
    .where(eq(wallets.userId, userId));

  // 7. Crear el registro en payouts en estado "PENDING" ("EN ESPERA")
  await db.insert(payouts).values({
    id: payoutId,
    creatorId: userId,
    periodStart: now,
    periodEnd: now,
    grossKoin: amountKoin,
    feeKoin,
    netKoin,
    feePct: tierInfo.feePct,
    usdRateVes: tasaParalelo,
    amountVes,
    paymentMethodId,
    status: "PENDING",
    createdAt: now,
  });

  // 8. Registrar movimiento en la billetera
  const txNotes =
    amountVes && tasaParalelo
      ? `Retiro en Bolívares en espera. Tasa Paralelo: Bs. ${tasaParalelo.toFixed(2)} / USD. Esperado en banco: Bs. ${amountVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`
      : `Retiro directo en USDT en espera. Neto a recibir: $${netKoin.toFixed(2)} USDT (${method.type === "USDT_WALLET" ? method.usdtNetwork || "USDT" : "Binance"})`;

  await db.insert(walletTransactions).values({
    id: crypto.randomUUID(),
    userId,
    type: "CREATOR_PAYOUT",
    amountKoin: -amountKoin,
    amountUsdt: netKoin,
    reference: `RETIRO-${payoutId.slice(0, 8).toUpperCase()}`,
    status: "PENDING",
    notes: txNotes,
    createdAt: now,
  });

  // 9. Notificar por correo a la creadora que su solicitud de retiro fue recibida
  if (currentUser?.email) {
    await sendPayoutRequestedEmail({
      to: currentUser.email,
      username: currentUser.username,
      payoutId,
      grossKoin: amountKoin,
      feeKoin,
      feePct: tierInfo.feePct,
      netKoin,
      amountVes,
      usdRateVes: tasaParalelo,
      paymentMethodLabel: formatPaymentMethodLabel(method),
    }).catch((err) => console.error("Aviso correo solicitud de retiro:", err));
  }

  revalidatePath("/panel/pagos");
  revalidatePath("/cuenta");
  revalidatePath("/admin/payouts");

  return {
    success: true,
    message:
      amountVes !== null
        ? `Solicitud de retiro enviada exitosamente. Tu solicitud está EN ESPERA de liquidación por el Administrador. Recibirás aproximadamente Bs. ${amountVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })} en tu cuenta bancaria.`
        : `Solicitud de retiro en USDT enviada exitosamente. Tu solicitud está EN ESPERA de liquidación por el Administrador. Recibirás $${netKoin.toFixed(2)} USDT en tu cuenta configurada.`,
    payoutId,
    amountVes,
    netKoin,
    tasaParalelo,
  };
}

/**
 * Guardar o actualizar un Plan de Suscripción de la Creadora (Hasta 3 planes)
 * Permite configurar precio y duración en días (ej: 30 días, 90 días, 180 días)
 */
export async function saveSubscriptionPlanAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    return { error: "No autorizado" };
  }

  const target = await resolveCreatorTarget(
    session.user,
    formData.get("managedCreatorId") as string | null
  );
  if (!target.ok) {
    return { error: target.error };
  }

  const userId = target.creatorId;
  const planId = (formData.get("planId") as string) || crypto.randomUUID();
  const name = (formData.get("name") as string)?.trim();
  const priceRaw = formData.get("priceKoin") as string;
  const priceKoin = parseFloat(priceRaw);
  const durationRaw = formData.get("durationDays") as string;
  const durationDays = parseInt(durationRaw) || 30;
  const description = (formData.get("description") as string)?.trim();
  const orderIndex = parseInt((formData.get("orderIndex") as string) || "1");

  if (!name || isNaN(priceKoin) || priceKoin <= 0) {
    return { error: "El nombre y un precio válido en KOIN son requeridos." };
  }

  const planNameFilter = validateNoExternalContact(name, "El nombre del plan");
  if (!planNameFilter.valid) {
    return { error: planNameFilter.error };
  }
  const planDescFilter = validateNoExternalContact(description, "La descripción del plan");
  if (!planDescFilter.valid) {
    return { error: planDescFilter.error };
  }

  if (durationDays < 1) {
    return { error: "La duración debe ser de al menos 1 día." };
  }

  const now = new Date().toISOString();

  await db
    .insert(creatorSubscriptionPlans)
    .values({
      id: planId,
      creatorId: userId,
      name,
      durationDays,
      priceKoin,
      description: description || null,
      orderIndex: Math.min(3, Math.max(1, orderIndex)),
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: creatorSubscriptionPlans.id,
      set: {
        name,
        durationDays,
        priceKoin,
        description: description || null,
        orderIndex: Math.min(3, Math.max(1, orderIndex)),
        updatedAt: now,
      },
    });

  revalidatePath("/panel/suscripciones");
  revalidatePath("/panel/perfil");
  revalidatePath(`/${target.username}`);
  revalidatePath(`/agencia/creadoras/${userId}`);

  return { success: true };
}

/**
 * Eliminar un Plan de Suscripción
 */
export async function deleteSubscriptionPlanAction(planId: string) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const plan = await db.query.creatorSubscriptionPlans.findFirst({
    where: eq(creatorSubscriptionPlans.id, planId),
  });
  if (!plan) return { error: "Plan no encontrado" };

  const target = await resolveCreatorTarget(session.user, plan.creatorId);
  if (!target.ok) return { error: target.error };

  await db
    .delete(creatorSubscriptionPlans)
    .where(
      and(
        eq(creatorSubscriptionPlans.id, planId),
        eq(creatorSubscriptionPlans.creatorId, target.creatorId)
      )
    );

  revalidatePath("/panel/suscripciones");
  revalidatePath("/panel/perfil");
  revalidatePath(`/${target.username}`);
  revalidatePath(`/agencia/creadoras/${target.creatorId}`);

  return { success: true };
}

/**
 * Enviar mensaje 1 a 1 estilo OnlyFans (delega a sendChatMessageAction para validar pases de chat y multimedia)
 */
export async function sendMessageAction(formData: FormData) {
  const { sendChatMessageAction } = await import("@/actions/chat");
  const receiverId = (formData.get("receiverId") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const priceRaw = formData.get("priceKoin") as string;
  const priceKoin = parseFloat(priceRaw) || 0.0;
  const mediaKey = (formData.get("mediaKey") as string) || null;
  const mediaType = (formData.get("mediaType") as "IMAGE" | "VIDEO") || null;

  return sendChatMessageAction({
    receiverId,
    content,
    priceKoin,
    mediaItems: mediaKey && mediaType ? [{ mediaKey, mediaType }] : [],
  });
}
