import { client } from "./index";

const globalForInteractionsSchema = globalThis as unknown as {
  __kontenidoInteractionsSchemaPromise?: Promise<void>;
  __kontenidoInteractionsSchemaReady?: boolean;
};

/**
 * Garantiza que las tablas y columnas para:
 * - Me Gusta (profile_likes) y likes_count en profiles
 * - Favoritos (profile_favorites)
 * - Muestra gratuita (is_public_teaser en posts)
 * existan en la base de datos sin importar el entorno, usando fast-path en 1 consulta.
 */
export async function ensureInteractionsSchema() {
  if (globalForInteractionsSchema.__kontenidoInteractionsSchemaReady) return;
  if (globalForInteractionsSchema.__kontenidoInteractionsSchemaPromise) {
    return globalForInteractionsSchema.__kontenidoInteractionsSchemaPromise;
  }

  globalForInteractionsSchema.__kontenidoInteractionsSchemaPromise = (async () => {
    try {
      // Fast-path: verificar si tablas y columnas ya existen
      try {
        await Promise.all([
          client.execute(`SELECT likes_count, is_ai_generated FROM profiles LIMIT 0`),
          client.execute(`SELECT is_public_teaser FROM posts LIMIT 0`),
          client.execute(`SELECT id FROM profile_likes LIMIT 0`),
          client.execute(`SELECT id FROM profile_favorites LIMIT 0`),
        ]);
        globalForInteractionsSchema.__kontenidoInteractionsSchemaReady = true;
        return;
      } catch {
        // Ejecutar migraciones idempotentes faltantes
      }

      await Promise.all([
        client.execute(`
          CREATE TABLE IF NOT EXISTS profile_likes (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL
          )
        `),
        client.execute(`
          CREATE TABLE IF NOT EXISTS profile_favorites (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL
          )
        `),
        client
          .execute(`ALTER TABLE profiles ADD COLUMN likes_count INTEGER NOT NULL DEFAULT 0`)
          .catch(() => {}),
        client
          .execute(`ALTER TABLE posts ADD COLUMN is_public_teaser INTEGER NOT NULL DEFAULT 0`)
          .catch(() => {}),
        client
          .execute(`ALTER TABLE profiles ADD COLUMN is_ai_generated INTEGER NOT NULL DEFAULT 0`)
          .catch(() => {}),
      ]);

      await Promise.all([
        client
          .execute(`CREATE INDEX IF NOT EXISTS idx_profile_likes_creator ON profile_likes(creator_id)`)
          .catch(() => {}),
        client
          .execute(
            `CREATE INDEX IF NOT EXISTS idx_profile_likes_user_creator ON profile_likes(user_id, creator_id)`
          )
          .catch(() => {}),
        client
          .execute(
            `CREATE INDEX IF NOT EXISTS idx_profile_favorites_user ON profile_favorites(user_id)`
          )
          .catch(() => {}),
        client
          .execute(
            `CREATE INDEX IF NOT EXISTS idx_profile_favorites_user_creator ON profile_favorites(user_id, creator_id)`
          )
          .catch(() => {}),
      ]);

      globalForInteractionsSchema.__kontenidoInteractionsSchemaReady = true;
    } catch (err) {
      console.warn("Aviso al inicializar esquema de interacciones:", err);
      globalForInteractionsSchema.__kontenidoInteractionsSchemaPromise = undefined;
    }
  })();

  return globalForInteractionsSchema.__kontenidoInteractionsSchemaPromise;
}
