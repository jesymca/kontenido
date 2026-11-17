import { client } from "./index";

let isKomestibleInitialized = false;

/**
 * Garantiza que las tablas, columnas e índices para:
 * - País y Género en users (soporte internacional USDT + límite KOMESTIBLE para HOMBRES)
 * - Red USDT en payment_methods (USDT_WALLET)
 * - Sección KOMESTIBLE (fotos gratuitas, swipes, valoraciones)
 * - Espacio KOINCIDEN (matches mutuos y chat gratuito)
 * - Configuraciones iniciales de KOMESTIBLE en settings
 * existan en Turso / SQLite de forma idempotente.
 */
export async function ensureKomestibleSchema() {
  if (isKomestibleInitialized) return;

  try {
    // 1. Columnas internacionales y de KOMESTIBLE en users
    const userAlters = [
      `ALTER TABLE users ADD COLUMN country TEXT NOT NULL DEFAULT 'VE'`,
      `ALTER TABLE users ADD COLUMN gender TEXT`,
      `ALTER TABLE users ADD COLUMN komestible_bonus_likes INTEGER NOT NULL DEFAULT 0`,
    ];
    for (const stmt of userAlters) {
      try {
        await client.execute(stmt);
      } catch {
        // Ignorar si ya existe
      }
    }

    // 2. Red USDT en payment_methods
    try {
      await client.execute(`ALTER TABLE payment_methods ADD COLUMN usdt_network TEXT`);
    } catch {
      // Ignorar si ya existe
    }

    // 3. Fotos de KOMESTIBLE
    await client.execute(`
      CREATE TABLE IF NOT EXISTS komestible_photos (
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
      )
    `);

    // 4. Swipes (Like / Pass)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS komestible_swipes (
        id TEXT PRIMARY KEY,
        swiper_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        photo_id TEXT,
        action TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // 5. Valoraciones 1-5 de fotos
    await client.execute(`
      CREATE TABLE IF NOT EXISTS komestible_photo_ratings (
        id TEXT PRIMARY KEY,
        rater_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        photo_id TEXT NOT NULL REFERENCES komestible_photos(id) ON DELETE CASCADE,
        target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // 6. Matches mutuos en KOINCIDEN
    await client.execute(`
      CREATE TABLE IF NOT EXISTS komestible_matches (
        id TEXT PRIMARY KEY,
        user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        matched_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL
      )
    `);

    // 7. Mensajes gratuitos del espacio KOINCIDEN
    await client.execute(`
      CREATE TABLE IF NOT EXISTS koinciden_messages (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL REFERENCES komestible_matches(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `);

    // 8. Índices de rendimiento y unicidad
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_komestible_photos_user ON komestible_photos(user_id, status, is_active)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_komestible_swipes_unique ON komestible_swipes(swiper_id, target_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_komestible_swipes_swiper_date ON komestible_swipes(swiper_id, action, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_komestible_swipes_target ON komestible_swipes(target_user_id, action)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_komestible_ratings_unique ON komestible_photo_ratings(rater_id, photo_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_komestible_matches_pair ON komestible_matches(user_a_id, user_b_id)`,
      `CREATE INDEX IF NOT EXISTS idx_koinciden_messages_match ON koinciden_messages(match_id, created_at)`,
    ];
    for (const idx of indexes) {
      try {
        await client.execute(idx);
      } catch {
        // Ignorar si ya existe
      }
    }

    // 9. Configuraciones iniciales de KOMESTIBLE por defecto (solo si no existen)
    const now = new Date().toISOString();
    const defaultKomestibleSettings: Array<[string, string, string]> = [
      ["komestible_enabled", "1", "Habilita (1) o deshabilita (0) la sección gratuita KOMESTIBLE"],
      ["komestible_male_likes_limit", "10", "Cantidad de Likes permitidos para usuarios registrados como HOMBRE"],
      ["komestible_male_limit_period", "DAILY", "Período del límite de Likes para HOMBRES: DAILY, WEEKLY o TOTAL"],
      ["komestible_other_likes_limit", "0", "Límite de Likes para otros géneros (0 = ilimitado)"],
      ["komestible_max_photos_per_user", "6", "Máximo de fotos que cada usuario puede subir en KOMESTIBLE"],
      ["komestible_require_moderation", "0", "1 si las fotos de KOMESTIBLE requieren aprobación de SUPER_ADMIN antes de mostrarse"],
      ["komestible_vip_unlimited", "0", "1 si los usuarios HOMBRE con membresía VIP tienen Likes ilimitados en KOMESTIBLE"],
    ];

    for (const [key, value, description] of defaultKomestibleSettings) {
      try {
        await client.execute({
          sql: `INSERT OR IGNORE INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)`,
          args: [key, value, description, now],
        });
      } catch {
        // Ignorar
      }
    }

    isKomestibleInitialized = true;
  } catch (err) {
    console.warn("Aviso al inicializar esquema de KOMESTIBLE/KOINCIDEN:", err);
  }
}
