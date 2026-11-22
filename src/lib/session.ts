import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { eq, or } from "drizzle-orm";

/**
 * Obtiene el usuario actual desde Turso DB deduplicado por petición (React.cache).
 * Evita que Navbar, PanelLayout y la página destino ejecuten 3-4 consultas duplicadas
 * a la tabla users durante la misma navegación.
 */
export const getCurrentDbUser = cache(async () => {
  const session = await auth();
  if (!session?.user) return null;

  await ensureKomestibleSchema();
  const emailLookup = session.user.email?.toLowerCase().trim();
  const idLookup = session.user.id;

  const dbUser = emailLookup
    ? await db.query.users.findFirst({
        where: idLookup
          ? or(eq(users.id, idLookup), eq(users.email, emailLookup))
          : eq(users.email, emailLookup),
      })
    : idLookup
    ? await db.query.users.findFirst({
        where: eq(users.id, idLookup),
      })
    : null;

  return dbUser || null;
});
