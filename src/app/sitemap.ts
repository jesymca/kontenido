import { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { users, profiles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || "https://kontenido.online";
  const now = new Date();

  // Rutas estáticas públicas principales
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/registro`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Rutas dinámicas de creadores activos y publicados
  let creatorRoutes: MetadataRoute.Sitemap = [];
  try {
    const publishedCreators = await db
      .select({
        username: users.username,
        updatedAt: profiles.updatedAt,
      })
      .from(users)
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(and(eq(users.role, "CREATOR"), eq(users.status, "ACTIVE")));

    creatorRoutes = publishedCreators.map((creator) => ({
      url: `${baseUrl}/${creator.username}`,
      lastModified: creator.updatedAt ? new Date(creator.updatedAt) : now,
      changeFrequency: "daily",
      priority: 0.9,
    }));
  } catch (e) {
    console.error("Aviso al generar sitemap de creadores:", e);
  }

  return [...staticRoutes, ...creatorRoutes];
}
