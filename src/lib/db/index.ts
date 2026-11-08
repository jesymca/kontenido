import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Cliente de conexión a Turso (LibSQL)
 * Next.js carga las variables de entorno de forma nativa.
 */
const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

if (process.env.NODE_ENV === "production" && !process.env.TURSO_DATABASE_URL) {
  console.warn(
    "⚠️ ALERTA KONTENIDO: TURSO_DATABASE_URL no está definida en las variables de entorno de Vercel. Asegúrate de configurarla en Vercel -> Project Settings -> Environment Variables."
  );
}

export const client = createClient({
  url,
  authToken,
});

export const db = drizzle(client, { schema });


