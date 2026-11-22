import { client } from "./index";

const globalForEmailSchema = globalThis as unknown as {
  __kontenidoEmailSchemaPromise?: Promise<void>;
  __kontenidoEmailSchemaReady?: boolean;
};

/**
 * Garantiza que la tabla email_logs e índices existan en Turso / SQLite
 * con fast-path en 1 sola consulta ligera.
 */
export async function ensureEmailSchema() {
  if (globalForEmailSchema.__kontenidoEmailSchemaReady) return;
  if (globalForEmailSchema.__kontenidoEmailSchemaPromise) {
    return globalForEmailSchema.__kontenidoEmailSchemaPromise;
  }

  globalForEmailSchema.__kontenidoEmailSchemaPromise = (async () => {
    try {
      try {
        await client.execute(`SELECT id, provider_id FROM email_logs LIMIT 0`);
        globalForEmailSchema.__kontenidoEmailSchemaReady = true;
        return;
      } catch {
        // Crear tabla si aún no existe
      }

      await client.execute(`
        CREATE TABLE IF NOT EXISTS email_logs (
          id TEXT PRIMARY KEY,
          to_email TEXT NOT NULL,
          template_key TEXT NOT NULL,
          subject TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'SENT',
          provider_id TEXT,
          error_message TEXT,
          meta TEXT,
          created_at TEXT NOT NULL
        )
      `);

      await client
        .execute(
          `CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC)`
        )
        .catch(() => {});

      globalForEmailSchema.__kontenidoEmailSchemaReady = true;
    } catch (err) {
      console.warn("Aviso al inicializar esquema de correos:", err);
      globalForEmailSchema.__kontenidoEmailSchemaPromise = undefined;
    }
  })();

  return globalForEmailSchema.__kontenidoEmailSchemaPromise;
}
