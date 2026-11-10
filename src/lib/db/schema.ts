import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * ============================================================================
 * TABLA: users (Usuarios de KONTENIDO)
 * Roles: SUPER_ADMIN, CREATOR, CONSUMER, AGENCY
 * Estados: PENDING, ACTIVE, SUSPENDED
 * ============================================================================
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // Identificador único UUID
  username: text("username").notNull().unique(), // Slug de usuario para URL pública (/[username])
  email: text("email").notNull().unique(), // Correo electrónico del usuario
  passwordHash: text("password_hash"), // Hash bcrypt de la contraseña (nullable si ingresa con Google)
  role: text("role", { enum: ["SUPER_ADMIN", "CREATOR", "CONSUMER", "AGENCY"] })
    .notNull()
    .default("CONSUMER"), // Rol de acceso en el sistema
  status: text("status", { enum: ["PENDING", "ACTIVE", "SUSPENDED"] })
    .notNull()
    .default("ACTIVE"), // Estado de la cuenta
  kycStatus: text("kyc_status", { enum: ["NONE", "PENDING", "APPROVED", "REJECTED"] })
    .notNull()
    .default("NONE"), // Estado de validación de identidad (requerido para creadores)
  birthDate: text("birth_date"), // Fecha de nacimiento (YYYY-MM-DD) para verificar mayoría de edad
  level: integer("level").notNull().default(0), // Nivel del usuario del 0 al 100 calculado por inversión
  vipMembershipId: text("vip_membership_id"), // ID de membresía VIP opcional asignada (ej: Ultra, Pro)
  allowDownload: integer("allow_download").notNull().default(0), // 1 si el usuario VIP tiene permiso de descarga autorizado
  suspensionReason: text("suspension_reason"), // Motivo si el usuario fue suspendido (ej: intento de descarga no autorizada)
  image: text("image"), // Imagen externa opcional (ej: avatar de Google)
  createdAt: text("created_at").notNull(), // Fecha y hora de creación ISO
  updatedAt: text("updated_at").notNull(), // Fecha y hora de última actualización ISO
});

/**
 * ============================================================================
 * TABLA: profiles (Perfiles públicos y creadores)
 * ============================================================================
 */
export const profiles = sqliteTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }), // Relación 1:1 con users
  displayName: text("display_name").notNull(), // Nombre para mostrar públicamente
  bio: text("bio"), // Biografía o descripción del perfil
  avatarKey: text("avatar_key"), // Clave del archivo de avatar en Cloudflare R2
  bannerKey: text("banner_key"), // Clave del archivo de portada/banner en Cloudflare R2
  subscriptionPriceKoin: real("subscription_price_koin").notNull().default(10.0), // Precio mensual en KOIN
  likesCount: integer("likes_count").notNull().default(0), // Conteo de Me Gusta (Corazones) para algoritmo de posicionamiento
  isAiGenerated: integer("is_ai_generated").notNull().default(0), // 1 si el contenido del perfil es generado con Inteligencia Artificial
  isPublished: integer("is_published").notNull().default(0), // Si el perfil está visible públicamente (1) o borrador (0)
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: wallets (Billetera KOIN de cada usuario)
 * 1 KOIN ≈ 1 USDT
 * ============================================================================
 */
export const wallets = sqliteTable("wallets", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }), // Relación 1:1 con users
  balanceKoin: real("balance_koin").notNull().default(0.0), // Saldo actual disponible en KOIN
  totalSpentUsd: real("total_spent_usd").notNull().default(0.0), // Total histórico invertido en recargas (determina nivel 0-100)
  totalEarnedKoin: real("total_earned_koin").notNull().default(0.0), // Total acumulado generado (para creadoras)
  updatedAt: text("updated_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: user_levels (Configuración de Niveles de Usuario 0 a 100)
 * Administrable por SUPER_ADMIN según dinero invertido.
 * Ejemplo base: 1$-20$ (Lv1), 21$-50$ (Lv2), 51$-100$ (Lv3)...
 * ============================================================================
 */
export const userLevels = sqliteTable("user_levels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  levelNumber: integer("level_number").notNull().unique(), // Número de nivel (0 a 100)
  minSpentUsd: real("min_spent_usd").notNull(), // Inversión mínima acumulada en USD
  maxSpentUsd: real("max_spent_usd").notNull(), // Inversión máxima para este nivel
  title: text("title").notNull(), // Nombre del rango de nivel (ej: "Novato", "Explorador", "Titán")
  badgeFrame: text("badge_frame").notNull().default("default"), // Estilo del marco visual (marco 1, marco 2, etc.)
  badgeColor: text("badge_color").notNull().default("#3b82f6"), // Color HEX del marco/borde
  canDownload: integer("can_download").notNull().default(0), // Si este nivel tiene permiso para descargar
  createdAt: text("created_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: vip_memberships (Membresías VIP y Badges Especiales)
 * Administrable por SUPER_ADMIN con frases pequeñas: Ultra, Pro, Bronce, Silver, Golden, Platinum
 * ============================================================================
 */
export const vipMemberships = sqliteTable("vip_memberships", {
  id: text("id").primaryKey(), // UUID de la membresía
  name: text("name").notNull().unique(), // Nombre: "Ultra", "Pro", "Bronce", "Silver", "Golden", "Platinum"
  slug: text("slug").notNull().unique(), // Identificador slug
  badgeText: text("badge_text").notNull(), // Frase corta mostrada al lado del usuario (ej: "ULTRA")
  badgeColor: text("badge_color").notNull().default("from-amber-400 to-amber-600"), // Gradiente Tailwind
  priceKoin: real("price_koin").notNull().default(50.0), // Costo en KOIN para adquirirla
  durationDays: integer("duration_days").notNull().default(30), // Duración en días
  allowDownload: integer("allow_download").notNull().default(1), // Si otorga permiso de descarga legal dentro de la plataforma
  description: text("description"), // Beneficios detallados
  isActive: integer("is_active").notNull().default(1), // 1 activa, 0 deshabilitada
  createdAt: text("created_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: wallet_transactions (Transacciones y movimientos de billetera)
 * Recargas USDT, conversiones, compras, suscripciones y payouts
 * ============================================================================
 */
export const walletTransactions = sqliteTable("wallet_transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: [
      "TOPUP_USDT",
      "CONVERSION",
      "PURCHASE",
      "SUBSCRIPTION",
      "VIP_MEMBERSHIP",
      "CREATOR_PAYOUT",
      "REFUND",
      "ADJUSTMENT",
    ],
  }).notNull(),
  amountKoin: real("amount_koin").notNull(), // Monto en KOIN
  amountUsdt: real("amount_usdt"), // Monto en USDT (para recargas)
  reference: text("reference"), // TX Hash de Binance o identificador de pago
  proofKey: text("proof_key"), // Captura de comprobante en Cloudflare R2
  status: text("status", { enum: ["PENDING", "CONFIRMED", "REJECTED"] })
    .notNull()
    .default("PENDING"),
  notes: text("notes"), // Observaciones o motivo de rechazo
  validatedBy: text("validated_by").references(() => users.id), // SUPER_ADMIN que aprobó/rechazó
  createdAt: text("created_at").notNull(),
  confirmedAt: text("confirmed_at"),
});

/**
 * ============================================================================
 * TABLA: banks (Seed de los 30 Bancos de Venezuela)
 * ============================================================================
 */
export const banks = sqliteTable("banks", {
  id: integer("id").primaryKey(), // 1 al 30
  nombreBanco: text("nombre_banco").notNull().unique(), // Nombre oficial del banco
  codigo: text("codigo"), // Código bancario Sudeban (ej: 0102, 0105)
});

/**
 * ============================================================================
 * TABLA: payment_methods (Métodos de cobro configurados por Creadores)
 * Tres opciones exactas: Transferencia bancaria, PagoMóvil, Binance USDT
 * ============================================================================
 */
export const paymentMethods = sqliteTable("payment_methods", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["BANK_TRANSFER", "PAGOMOVIL", "BINANCE"] }).notNull(),
  bankId: integer("bank_id").references(() => banks.id), // Si es transferencia o pagomóvil
  accountNumber: text("account_number"), // Número de cuenta de 20 dígitos
  accountHolder: text("account_holder"), // Nombre completo del titular
  idDocument: text("id_document"), // Cédula de identidad (V-12345678)
  phone: text("phone"), // Teléfono para PagoMóvil (0414-...)
  binanceEmail: text("binance_email"), // Correo o Pay ID / Wallet USDT
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: posts (Contenido publicado por creadoras)
 * Regla: Al eliminar, se oculta en la plataforma pero se conserva respaldo de archivo
 * ============================================================================
 */
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  priceKoin: real("price_koin").notNull().default(0.0), // 0 si es exclusivo para suscriptores o de pago individual
  isPackageItem: integer("is_package_item").notNull().default(0), // Si forma parte de un paquete
  isPublicTeaser: integer("is_public_teaser").notNull().default(0), // 1 si es muestra gratuita visible sin suscripción
  status: text("status", { enum: ["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED"] })
    .notNull()
    .default("PENDING_REVIEW"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  isDeleted: integer("is_deleted").notNull().default(0), // Soft-delete para la plataforma
  deletedAt: text("deleted_at"), // Momento en que el creador lo eliminó
  backupArchiveKey: text("backup_archive_key"), // Clave del respaldo seguro que preserva la plataforma
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: media_assets (Archivos multimedia de fotos y videos)
 * Vinculados a R2 con original, preview con blur/watermark y copia de respaldo
 * ============================================================================
 */
export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  postId: text("post_id").references(() => posts.id, { onDelete: "cascade" }),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["IMAGE", "VIDEO"] }).notNull(),
  originalKey: text("original_key").notNull(), // Ruta R2 privada del archivo original
  previewKey: text("preview_key").notNull(), // Ruta R2 con marca de agua y blur
  backupKey: text("backup_key"), // Clave de respaldo de seguridad permanente
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  durationS: integer("duration_s"), // Duración en segundos (si es video)
  sortOrder: integer("sort_order").notNull().default(0),
  moderationStatus: text("moderation_status", { enum: ["PENDING", "OK", "BLOCKED"] })
    .notNull()
    .default("PENDING"),
  isDeleted: integer("is_deleted").notNull().default(0), // Soft-delete
  createdAt: text("created_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: packages (Paquetes de contenido multimedia)
 * ============================================================================
 */
export const packages = sqliteTable("packages", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  priceKoin: real("price_koin").notNull(),
  status: text("status", { enum: ["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED"] })
    .notNull()
    .default("PENDING_REVIEW"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: package_items (Elementos contenidos en cada paquete)
 * ============================================================================
 */
export const packageItems = sqliteTable("package_items", {
  id: text("id").primaryKey(),
  packageId: text("package_id")
    .notNull()
    .references(() => packages.id, { onDelete: "cascade" }),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
});

/**
 * ============================================================================
 * TABLA: purchases (Compras de posts, paquetes y membresías VIP)
 * ============================================================================
 */
export const purchases = sqliteTable("purchases", {
  id: text("id").primaryKey(),
  buyerId: text("buyer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  creatorId: text("creator_id").references(() => users.id),
  itemType: text("item_type", { enum: ["POST", "PACKAGE", "VIP_MEMBERSHIP"] }).notNull(),
  itemId: text("item_id").notNull(), // ID del post, package o vip_membership
  priceKoin: real("price_koin").notNull(),
  status: text("status", { enum: ["COMPLETED", "REFUNDED"] })
    .notNull()
    .default("COMPLETED"),
  createdAt: text("created_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: subscriptions (Suscripciones mensuales a creadores)
 * ============================================================================
 */
/**
 * ============================================================================
 * TABLA: creator_subscription_plans (Hasta 3 planes de suscripción configurables por creadora)
 * Permite precios y tiempos de duración diferentes (ej: 30 días, 90 días, 180 días)
 * ============================================================================
 */
export const creatorSubscriptionPlans = sqliteTable("creator_subscription_plans", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // ej: "Pase Mensual (30 días)", "Pase Trimestral (90 días)"
  durationDays: integer("duration_days").notNull().default(30), // Duración exacta en días tras la cual vence
  priceKoin: real("price_koin").notNull(), // Precio en KOIN
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(1), // 1, 2 o 3
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  subscriberId: text("subscriber_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  planId: text("plan_id").references(() => creatorSubscriptionPlans.id),
  durationDays: integer("duration_days").notNull().default(30),
  priceKoinSnapshot: real("price_koin_snapshot").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  autoRenew: integer("auto_renew").notNull().default(1),
  status: text("status", { enum: ["ACTIVE", "EXPIRED", "CANCELLED"] })
    .notNull()
    .default("ACTIVE"),
  createdAt: text("created_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: messages (Mensajería privada 1 a 1 estilo OnlyFans)
 * Permite texto, emojis, imágenes y mensajes de pago (PPV desbloqueable)
 * ============================================================================
 */
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  senderId: text("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  receiverId: text("receiver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mediaKey: text("media_key"), // Imagen o video adjunto en R2
  mediaType: text("media_type", { enum: ["IMAGE", "VIDEO"] }),
  priceKoin: real("price_koin").notNull().default(0.0), // 0 si es libre, >0 si es PPV bloqueado
  isUnlocked: integer("is_unlocked").notNull().default(1), // 1 libre o comprado, 0 bloqueado
  isRead: integer("is_read").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: payouts (Cortes semanales a creadores)
 * Liquidación periódica por el SUPER_ADMIN
 * ============================================================================
 */
export const payouts = sqliteTable("payouts", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  grossKoin: real("gross_koin").notNull(),
  feeKoin: real("fee_koin").notNull(), // Comisión descontada de la plataforma
  netKoin: real("net_koin").notNull(), // Monto neto en KOIN a transferir
  feePct: real("fee_pct").notNull().default(15.0), // Porcentaje de comisión aplicado (ej: 10%, 15%, 20%)
  usdRateVes: real("usd_rate_ves"), // Tasa oficial / paralelo de DolarApi al momento del cálculo
  amountVes: real("amount_ves"), // Monto neto final en Bolívares (VES) que recibirá en su banco
  paymentMethodId: text("payment_method_id").references(() => paymentMethods.id),
  status: text("status", { enum: ["PENDING", "PROCESSING", "PAID", "FAILED"] })
    .notNull()
    .default("PENDING"),
  paidBy: text("paid_by").references(() => users.id),
  paidAt: text("paid_at"),
  transactionRef: text("transaction_ref"), // Número de transferencia bancaria / referencia asignada por Super Admin
  proofKey: text("proof_key"), // Comprobante de transferencia en R2
  createdAt: text("created_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: kyc_documents (Documentación de identidad venezolana para creadoras)
 * ============================================================================
 */
export const kycDocuments = sqliteTable("kyc_documents", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull().default("CEDULA_VE"),
  frontKey: text("front_key").notNull(), // Foto frontal de cédula en R2 privado
  backKey: text("back_key").notNull(), // Foto posterior de cédula en R2 privado
  selfieKey: text("selfie_key").notNull(), // Selfie con cédula en R2 privado
  extractedCedula: text("extracted_cedula"), // Número extraído por OCR
  extractedFullName: text("extracted_full_name"), // Nombres y apellidos extraídos
  extractedBirthDate: text("extracted_birth_date"), // Fecha de nacimiento extraída
  ageVerified: integer("age_verified").notNull().default(0), // 1 si OCR calculó >= 18 años
  status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] })
    .notNull()
    .default("PENDING"),
  rejectionReason: text("rejection_reason"),
  reviewerId: text("reviewer_id").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: creator_contracts (Contrato virtual de prestación de servicios)
 * ============================================================================
 */
export const creatorContracts = sqliteTable("creator_contracts", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  acceptedAt: text("accepted_at").notNull(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  contractVersion: text("contract_version").notNull().default("v1.0"),
  fullName: text("full_name").notNull(),
  idDocument: text("id_document").notNull(),
  pdfKey: text("pdf_key"), // Comprobante PDF firmado en R2 privado
});

/**
 * ============================================================================
 * TABLA: download_infractions (Detección de intentos de descarga de consumidores)
 * Registro de alerta y suspensión automática/manual
 * ============================================================================
 */
export const downloadInfractions = sqliteTable("download_infractions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  postId: text("post_id").references(() => posts.id),
  mediaAssetId: text("media_asset_id").references(() => mediaAssets.id),
  detectedAction: text("detected_action").notNull(), // Acción: 'RIGHT_CLICK_INSPECT', 'DEVTOOLS_MEDIA_CAPTURE', 'BLOB_EXFILTRATION', 'SCREEN_RECORD_SHORTCUT'
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  isSuspended: integer("is_suspended").notNull().default(1), // 1 si causó suspensión inmediata
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: agencies y agency_creators (Módulo de agencias)
 * ============================================================================
 */
export const agencies = sqliteTable("agencies", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  logoKey: text("logo_key"),
  description: text("description"),
  commissionPct: real("commission_pct").notNull().default(10.0),
  status: text("status", { enum: ["PENDING", "ACTIVE", "SUSPENDED"] })
    .notNull()
    .default("PENDING"),
  createdAt: text("created_at").notNull(),
});

export const agencyCreators = sqliteTable("agency_creators", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["PENDING", "ACCEPTED", "REJECTED"] })
    .notNull()
    .default("PENDING"),
  joinedAt: text("joined_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: moderation_flags (Reportes de contenido)
 * ============================================================================
 */
export const moderationFlags = sqliteTable("moderation_flags", {
  id: text("id").primaryKey(),
  mediaAssetId: text("media_asset_id").references(() => mediaAssets.id),
  postId: text("post_id").references(() => posts.id),
  creatorId: text("creator_id").references(() => users.id),
  reason: text("reason", { enum: ["CSAM", "GORE", "VIOLENCE", "OTHER"] }).notNull(),
  notes: text("notes"),
  flaggedBy: text("flagged_by")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: ["OPEN", "RESOLVED"] })
    .notNull()
    .default("OPEN"),
  resolvedBy: text("resolved_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: audit_log (Trazabilidad y auditoría general)
 * ============================================================================
 */
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  meta: text("meta"), // JSON string con payload adicional
  ipAddress: text("ip_address"),
  createdAt: text("created_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: settings (Configuraciones globales del sistema)
 * ============================================================================
 */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: text("updated_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: profile_likes (Me Gusta / Corazones dados a los perfiles de creadoras)
 * Utilizado por el algoritmo para posicionar y clasificar a las creadoras
 * ============================================================================
 */
export const profileLikes = sqliteTable("profile_likes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
});

/**
 * ============================================================================
 * TABLA: profile_favorites (Perfiles guardados en Favoritos por Consumidores)
 * Permite a los consumidores tener su lista de creadoras deseadas para suscribirse
 * ============================================================================
 */
export const profileFavorites = sqliteTable("profile_favorites", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
});

/**
 * ============================================================================
 * RELACIONES DRIZZLE ORM
 * ============================================================================
 */
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  wallet: one(wallets, {
    fields: [users.id],
    references: [wallets.userId],
  }),
  posts: many(posts),
  paymentMethods: many(paymentMethods),
  payouts: many(payouts),
  subscriptionsGiven: many(subscriptions, { relationName: "subscriber" }),
  subscriptionsReceived: many(subscriptions, { relationName: "creator" }),
  purchases: many(purchases, { relationName: "buyer" }),
  sales: many(purchases, { relationName: "creator" }),
  transactions: many(walletTransactions),
  infractions: many(downloadInfractions),
  kycDocuments: many(kycDocuments),
  contracts: many(creatorContracts),
  agenciesOwned: many(agencies),
  agencyMemberships: many(agencyCreators),
  subscriptionPlans: many(creatorSubscriptionPlans),
  messagesSent: many(messages, { relationName: "sender" }),
  messagesReceived: many(messages, { relationName: "receiver" }),
  likesGiven: many(profileLikes, { relationName: "userLikes" }),
  likesReceived: many(profileLikes, { relationName: "creatorLikes" }),
  favoritesGiven: many(profileFavorites, { relationName: "userFavorites" }),
  favoritesReceived: many(profileFavorites, { relationName: "creatorFavorites" }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  creator: one(users, {
    fields: [posts.creatorId],
    references: [users.id],
  }),
  media: many(mediaAssets),
  infractions: many(downloadInfractions),
  packageItems: many(packageItems),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  post: one(posts, {
    fields: [mediaAssets.postId],
    references: [posts.id],
  }),
  creator: one(users, {
    fields: [mediaAssets.creatorId],
    references: [users.id],
  }),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  creator: one(users, {
    fields: [payouts.creatorId],
    references: [users.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [payouts.paymentMethodId],
    references: [paymentMethods.id],
  }),
  payer: one(users, {
    fields: [payouts.paidBy],
    references: [users.id],
  }),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  creator: one(users, {
    fields: [paymentMethods.creatorId],
    references: [users.id],
  }),
  bank: one(banks, {
    fields: [paymentMethods.bankId],
    references: [banks.id],
  }),
}));

export const banksRelations = relations(banks, ({ many }) => ({
  paymentMethods: many(paymentMethods),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  subscriber: one(users, {
    fields: [subscriptions.subscriberId],
    references: [users.id],
    relationName: "subscriber",
  }),
  creator: one(users, {
    fields: [subscriptions.creatorId],
    references: [users.id],
    relationName: "creator",
  }),
  plan: one(creatorSubscriptionPlans, {
    fields: [subscriptions.planId],
    references: [creatorSubscriptionPlans.id],
  }),
}));

export const creatorSubscriptionPlansRelations = relations(
  creatorSubscriptionPlans,
  ({ one, many }) => ({
    creator: one(users, {
      fields: [creatorSubscriptionPlans.creatorId],
      references: [users.id],
    }),
    subscriptions: many(subscriptions),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
}));

export const purchasesRelations = relations(purchases, ({ one }) => ({
  buyer: one(users, {
    fields: [purchases.buyerId],
    references: [users.id],
    relationName: "buyer",
  }),
  creator: one(users, {
    fields: [purchases.creatorId],
    references: [users.id],
    relationName: "creator",
  }),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  user: one(users, {
    fields: [walletTransactions.userId],
    references: [users.id],
  }),
}));

export const downloadInfractionsRelations = relations(downloadInfractions, ({ one }) => ({
  user: one(users, {
    fields: [downloadInfractions.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [downloadInfractions.postId],
    references: [posts.id],
  }),
  mediaAsset: one(mediaAssets, {
    fields: [downloadInfractions.mediaAssetId],
    references: [mediaAssets.id],
  }),
}));

export const kycDocumentsRelations = relations(kycDocuments, ({ one }) => ({
  user: one(users, {
    fields: [kycDocuments.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [kycDocuments.reviewerId],
    references: [users.id],
  }),
}));

export const creatorContractsRelations = relations(creatorContracts, ({ one }) => ({
  creator: one(users, {
    fields: [creatorContracts.creatorId],
    references: [users.id],
  }),
}));

export const packagesRelations = relations(packages, ({ one, many }) => ({
  creator: one(users, {
    fields: [packages.creatorId],
    references: [users.id],
  }),
  items: many(packageItems),
}));

export const packageItemsRelations = relations(packageItems, ({ one }) => ({
  package: one(packages, {
    fields: [packageItems.packageId],
    references: [packages.id],
  }),
  post: one(posts, {
    fields: [packageItems.postId],
    references: [posts.id],
  }),
}));

export const agenciesRelations = relations(agencies, ({ one, many }) => ({
  owner: one(users, {
    fields: [agencies.ownerUserId],
    references: [users.id],
  }),
  creators: many(agencyCreators),
}));

export const agencyCreatorsRelations = relations(agencyCreators, ({ one }) => ({
  agency: one(agencies, {
    fields: [agencyCreators.agencyId],
    references: [agencies.id],
  }),
  creator: one(users, {
    fields: [agencyCreators.creatorId],
    references: [users.id],
  }),
}));

export const moderationFlagsRelations = relations(moderationFlags, ({ one }) => ({
  post: one(posts, {
    fields: [moderationFlags.postId],
    references: [posts.id],
  }),
  mediaAsset: one(mediaAssets, {
    fields: [moderationFlags.mediaAssetId],
    references: [mediaAssets.id],
  }),
  flagger: one(users, {
    fields: [moderationFlags.flaggedBy],
    references: [users.id],
  }),
  resolver: one(users, {
    fields: [moderationFlags.resolvedBy],
    references: [users.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(users, {
    fields: [auditLog.actorId],
    references: [users.id],
  }),
}));

export const profileLikesRelations = relations(profileLikes, ({ one }) => ({
  user: one(users, {
    fields: [profileLikes.userId],
    references: [users.id],
    relationName: "userLikes",
  }),
  creator: one(users, {
    fields: [profileLikes.creatorId],
    references: [users.id],
    relationName: "creatorLikes",
  }),
}));

export const profileFavoritesRelations = relations(profileFavorites, ({ one }) => ({
  user: one(users, {
    fields: [profileFavorites.userId],
    references: [users.id],
    relationName: "userFavorites",
  }),
  creator: one(users, {
    fields: [profileFavorites.creatorId],
    references: [users.id],
    relationName: "creatorFavorites",
  }),
}));
