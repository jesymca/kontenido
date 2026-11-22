import { client } from "./index";

const globalForSchema = globalThis as unknown as {
  __kontenidoKomestibleSchemaPromise?: Promise<void>;
  __kontenidoKomestibleSchemaReady?: boolean;
};

/**
 * Garantiza que las tablas, columnas e índices para:
 * - País, Género e Intereses (interested_in) en users (soporte internacional USDT + KOMESTIBLE)
 * - Auto-verificación KYC en kyc_documents (verification_mode, auto_check_summary, ocr_confidence)
 * - Red USDT en payment_methods (USDT_WALLET)
 * - Sección KOMESTIBLE (fotos gratuitas, swipes, valoraciones)
 * - Espacio KOINCIDEN (matches mutuos y chat gratuito)
 * - Configuraciones iniciales de KOMESTIBLE y KYC automático en settings
 * existan en Turso / SQLite de forma idempotente y ultra-rápida.
 */
export async function ensureKomestibleSchema() {
  if (globalForSchema.__kontenidoKomestibleSchemaReady) return;
  if (globalForSchema.__kontenidoKomestibleSchemaPromise) {
    return globalForSchema.__kontenidoKomestibleSchemaPromise;
  }

  globalForSchema.__kontenidoKomestibleSchemaPromise = (async () => {
    try {
      // Fast-path: verificar en 1 sola consulta ligera si el esquema más reciente ya existe
      try {
        await Promise.all([
          client.execute(
            `SELECT country, gender, interested_in, komestible_bonus_likes FROM users LIMIT 0`
          ),
          client.execute(
            `SELECT verification_mode, auto_check_summary, ocr_confidence FROM kyc_documents LIMIT 0`
          ),
          client.execute(`SELECT id FROM koinciden_messages LIMIT 0`),
        ]);
        globalForSchema.__kontenidoKomestibleSchemaReady = true;
        return;
      } catch {
        // Falta alguna tabla o columna -> ejecutar migraciones idempotentes
      }

      // 1. Columnas nuevas en users, payment_methods y kyc_documents (en paralelo seguro)
      const alterStmts = [
        `ALTER TABLE users ADD COLUMN country TEXT NOT NULL DEFAULT 'VE'`,
        `ALTER TABLE users ADD COLUMN gender TEXT`,
        `ALTER TABLE users ADD COLUMN interested_in TEXT`,
        `ALTER TABLE users ADD COLUMN komestible_bonus_likes INTEGER NOT NULL DEFAULT 0`,
        `ALTER TABLE payment_methods ADD COLUMN usdt_network TEXT`,
        `ALTER TABLE kyc_documents ADD COLUMN verification_mode TEXT`,
        `ALTER TABLE kyc_documents ADD COLUMN auto_check_summary TEXT`,
        `ALTER TABLE kyc_documents ADD COLUMN ocr_confidence REAL`,
      ];

      await Promise.all(
        alterStmts.map((stmt) =>
          client.execute(stmt).catch(() => {
            // Ignorar si ya existe
          })
        )
      );

      // 2. Tablas de KOMESTIBLE y KOINCIDEN en un solo batch atómico/paralelo
      const tableStmts = [
        `CREATE TABLE IF NOT EXISTS komestible_photos (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          media_key TEXT NOT NULL,
          caption TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          likes_received INTEGER NOT NULL DEFAULT 0,
          rating_sum INTEGER NOT NULL DEFAULT 0,
          rating_count INTEGER NOT NULL DEFAULT 0,
          avg_rating REAL NOT NULL DEFAULT 0,
          views_count INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'APPROVED',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS komestible_swipes (
          id TEXT PRIMARY KEY,
          swiper_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          photo_id TEXT,
          action TEXT NOT NULL,
          created_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS komestible_photo_ratings (
          id TEXT PRIMARY KEY,
          rater_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          photo_id TEXT NOT NULL REFERENCES komestible_photos(id) ON DELETE CASCADE,
          target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          score INTEGER NOT NULL,
          created_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS komestible_matches (
          id TEXT PRIMARY KEY,
          user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          matched_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS koinciden_messages (
          id TEXT PRIMARY KEY,
          match_id TEXT NOT NULL REFERENCES komestible_matches(id) ON DELETE CASCADE,
          sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          is_read INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )`,
      ];

      await Promise.all(tableStmts.map((stmt) => client.execute(stmt)));

      // 3. Índices de rendimiento y unicidad en paralelo
      const indexes = [
        `CREATE INDEX IF NOT EXISTS idx_komestible_photos_user ON komestible_photos(user_id, status, is_active)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_komestible_swipes_unique ON komestible_swipes(swiper_id, target_user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_komestible_swipes_swiper_date ON komestible_swipes(swiper_id, action, created_at)`,
        `CREATE INDEX IF NOT EXISTS idx_komestible_swipes_target ON komestible_swipes(target_user_id, action)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_komestible_ratings_unique ON komestible_photo_ratings(rater_id, photo_id)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_komestible_matches_pair ON komestible_matches(user_a_id, user_b_id)`,
        `CREATE INDEX IF NOT EXISTS idx_koinciden_messages_match ON koinciden_messages(match_id, created_at)`,
      ];

      const now = new Date().toISOString();
      const defaultSettings: Array<[string, string, string]> = [
        ["komestible_enabled", "1", "Habilita (1) o deshabilita (0) la sección gratuita KOMESTIBLE"],
        ["komestible_male_likes_limit", "10", "Cantidad de Likes permitidos para usuarios registrados como HOMBRE"],
        ["komestible_male_limit_period", "DAILY", "Período del límite de Likes para HOMBRES: DAILY, WEEKLY o TOTAL"],
        ["komestible_other_likes_limit", "0", "Límite de Likes para otros géneros (0 = ilimitado)"],
        ["komestible_max_photos_per_user", "6", "Máximo de fotos que cada usuario puede subir en KOMESTIBLE"],
        ["komestible_require_moderation", "0", "1 si las fotos de KOMESTIBLE requieren aprobación de SUPER_ADMIN antes de mostrarse"],
        ["komestible_vip_unlimited", "0", "1 si los usuarios HOMBRE con membresía VIP tienen Likes ilimitados en KOMESTIBLE"],
        ["kyc_auto_approve_enabled", "1", "Habilita (1) o deshabilita (0) la aprobación automática de mayoría de edad (+18) al subir archivos KYC"],
      ];

      await Promise.all([
        ...indexes.map((idx) => client.execute(idx).catch(() => {})),
        ...defaultSettings.map(([key, value, description]) =>
          client
            .execute({
              sql: `INSERT OR IGNORE INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)`,
              args: [key, value, description, now],
            })
            .catch(() => {})
        ),
      ]);

      globalForSchema.__kontenidoKomestibleSchemaReady = true;
    } catch (err) {
      console.warn("Aviso al inicializar esquema de KOMESTIBLE/KOINCIDEN:", err);
      globalForSchema.__kontenidoKomestibleSchemaPromise = undefined;
    }
  })();

  return globalForSchema.__kontenidoKomestibleSchemaPromise;
}
