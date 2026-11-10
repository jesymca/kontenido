import { client } from "./index";

let isInitialized = false;

/**
 * Garantiza que las tablas y columnas para:
 * - Me Gusta (profile_likes) y likes_count en profiles
 * - Favoritos (profile_favorites)
 * - Muestra gratuita (is_public_teaser en posts)
 * existan en la base de datos sin importar el entorno.
 */
export async function ensureInteractionsSchema() {
  if (isInitialized) return;

  try {
    // 1. Tabla de Me Gusta (Likes)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS profile_likes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
      )
    `);

    // 2. Tabla de Favoritos
    await client.execute(`
      CREATE TABLE IF NOT EXISTS profile_favorites (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
      )
    `);

    // 3. Columna likes_count en profiles
    try {
      await client.execute(`ALTER TABLE profiles ADD COLUMN likes_count INTEGER NOT NULL DEFAULT 0`);
    } catch {
      // Ignorar si la columna ya existe
    }

    // 4. Columna is_public_teaser en posts
    try {
      await client.execute(`ALTER TABLE posts ADD COLUMN is_public_teaser INTEGER NOT NULL DEFAULT 0`);
    } catch {
      // Ignorar si la columna ya existe
    }

    // 5. Columna is_ai_generated en profiles
    try {
      await client.execute(`ALTER TABLE profiles ADD COLUMN is_ai_generated INTEGER NOT NULL DEFAULT 0`);
    } catch {
      // Ignorar si la columna ya existe
    }

    // 6. Índices de aceleración para el algoritmo de posicionamiento
    try {
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_profile_likes_creator ON profile_likes(creator_id)`);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_profile_likes_user_creator ON profile_likes(user_id, creator_id)`);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_profile_favorites_user ON profile_favorites(user_id)`);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_profile_favorites_user_creator ON profile_favorites(user_id, creator_id)`);
    } catch {
      // Ignorar si no se pueden crear
    }

    isInitialized = true;
  } catch (err) {
    console.warn("Aviso al inicializar esquema de interacciones:", err);
  }
}
