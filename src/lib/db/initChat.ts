import { client } from "./index";

const globalForChatSchema = globalThis as unknown as {
  __kontenidoChatSchemaPromise?: Promise<void>;
  __kontenidoChatSchemaReady?: boolean;
};

/**
 * Garantiza que las tablas y columnas para:
 * - Tarifa y tiempo de chat en profiles (chat_price_koin, chat_duration_hours)
 * - Pases de acceso al chat (chat_passes)
 * - Múltiples archivos multimedia por mensaje (message_media)
 * existan en la base de datos sin importar el entorno, usando fast-path en 1 consulta.
 */
export async function ensureChatSchema() {
  if (globalForChatSchema.__kontenidoChatSchemaReady) return;
  if (globalForChatSchema.__kontenidoChatSchemaPromise) {
    return globalForChatSchema.__kontenidoChatSchemaPromise;
  }

  globalForChatSchema.__kontenidoChatSchemaPromise = (async () => {
    try {
      // Fast-path: verificar si tablas y columnas ya existen
      try {
        await Promise.all([
          client.execute(
            `SELECT chat_price_koin, chat_duration_hours, creator_category FROM profiles LIMIT 0`
          ),
          client.execute(`SELECT badge_text, badge_color, show_badge FROM agencies LIMIT 0`),
          client.execute(`SELECT id FROM message_media LIMIT 0`),
          client.execute(`SELECT id FROM chat_passes LIMIT 0`),
        ]);
        globalForChatSchema.__kontenidoChatSchemaReady = true;
        return;
      } catch {
        // Ejecutar migraciones idempotentes faltantes
      }

      const alters = [
        `ALTER TABLE profiles ADD COLUMN chat_price_koin REAL NOT NULL DEFAULT 5.0`,
        `ALTER TABLE profiles ADD COLUMN chat_duration_hours INTEGER NOT NULL DEFAULT 168`,
        `ALTER TABLE profiles ADD COLUMN creator_category TEXT NOT NULL DEFAULT 'MUJER'`,
        `ALTER TABLE agencies ADD COLUMN badge_text TEXT`,
        `ALTER TABLE agencies ADD COLUMN badge_color TEXT NOT NULL DEFAULT 'from-indigo-500 via-purple-500 to-rose-500'`,
        `ALTER TABLE agencies ADD COLUMN show_badge INTEGER NOT NULL DEFAULT 1`,
      ];

      await Promise.all(alters.map((stmt) => client.execute(stmt).catch(() => {})));

      await Promise.all([
        client.execute(`
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
        `),
        client.execute(`
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
        `),
      ]);

      await Promise.all([
        client
          .execute(
            `CREATE INDEX IF NOT EXISTS idx_chat_passes_buyer_creator ON chat_passes(buyer_id, creator_id, ends_at)`
          )
          .catch(() => {}),
        client
          .execute(
            `CREATE INDEX IF NOT EXISTS idx_message_media_message ON message_media(message_id)`
          )
          .catch(() => {}),
      ]);

      globalForChatSchema.__kontenidoChatSchemaReady = true;
    } catch (err) {
      console.warn("Aviso al inicializar esquema de chat:", err);
      globalForChatSchema.__kontenidoChatSchemaPromise = undefined;
    }
  })();

  return globalForChatSchema.__kontenidoChatSchemaPromise;
}
