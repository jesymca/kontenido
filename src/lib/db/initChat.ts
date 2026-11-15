import { client } from "./index";

let isChatInitialized = false;

/**
 * Garantiza que las tablas y columnas para:
 * - Tarifa y tiempo de chat en profiles (chat_price_koin, chat_duration_hours)
 * - Pases de acceso al chat (chat_passes)
 * - Múltiples archivos multimedia por mensaje (message_media)
 * existan en la base de datos sin importar el entorno.
 */
export async function ensureChatSchema() {
  if (isChatInitialized) return;

  try {
    // 1. Columnas de configuración de chat en profiles
    try {
      await client.execute(
        `ALTER TABLE profiles ADD COLUMN chat_price_koin REAL NOT NULL DEFAULT 5.0`
      );
    } catch {
      // Ignorar si ya existe
    }

    try {
      await client.execute(
        `ALTER TABLE profiles ADD COLUMN chat_duration_hours INTEGER NOT NULL DEFAULT 168`
      );
    } catch {
      // Ignorar si ya existe
    }

    try {
      await client.execute(
        `ALTER TABLE profiles ADD COLUMN creator_category TEXT NOT NULL DEFAULT 'MUJER'`
      );
    } catch {
      // Ignorar si ya existe
    }

    try {
      await client.execute(`ALTER TABLE agencies ADD COLUMN badge_text TEXT`);
    } catch {
      // Ignorar si ya existe
    }

    try {
      await client.execute(
        `ALTER TABLE agencies ADD COLUMN badge_color TEXT NOT NULL DEFAULT 'from-indigo-500 via-purple-500 to-rose-500'`
      );
    } catch {
      // Ignorar si ya existe
    }

    try {
      await client.execute(
        `ALTER TABLE agencies ADD COLUMN show_badge INTEGER NOT NULL DEFAULT 1`
      );
    } catch {
      // Ignorar si ya existe
    }

    // 2. Tabla de pases de chat pagados por compradores
    await client.execute(`
      CREATE TABLE IF NOT EXISTS chat_passes (
        id TEXT PRIMARY KEY,
        buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        price_koin_snapshot REAL NOT NULL,
        duration_hours INTEGER NOT NULL,
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL
      )
    `);

    // 3. Tabla de multimedia múltiple por mensaje (1 o más fotos/videos)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS message_media (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        media_key TEXT NOT NULL,
        media_type TEXT NOT NULL,
        mime_type TEXT,
        size_bytes INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `);

    // 4. Índices de rendimiento
    try {
      await client.execute(
        `CREATE INDEX IF NOT EXISTS idx_chat_passes_buyer_creator ON chat_passes(buyer_id, creator_id, ends_at)`
      );
      await client.execute(
        `CREATE INDEX IF NOT EXISTS idx_message_media_message ON message_media(message_id)`
      );
    } catch {
      // Ignorar si ya existen
    }

    isChatInitialized = true;
  } catch (err) {
    console.warn("Aviso al inicializar esquema de chat:", err);
  }
}
