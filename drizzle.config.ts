import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Cargar variables de entorno locales
dotenv.config();

// Configuración de Drizzle ORM para Turso (LibSQL)
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || "",
    authToken: process.env.TURSO_AUTH_TOKEN || "",
  },
});
