import { db } from "@/lib/db";
import { posts, mediaAssets, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import AdminContentModeration from "@/components/AdminContentModeration";
import { ImageIcon } from "lucide-react";

/**
 * Vista de Moderación y CRUD de Contenido (/admin/contenido)
 */
export default async function AdminContenidoPage() {
  const allPosts = await db.query.posts.findMany({
    orderBy: [desc(posts.createdAt)],
    with: {
      media: true,
      creator: true,
    },
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-rose-500" />
          Moderación y CRUD de Contenido
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Supervisa fotos y videos publicados por creadoras, aprueba o bloquea material y garantiza el respaldo seguro permanente.
        </p>
      </div>

      <AdminContentModeration posts={allPosts} />
    </div>
  );
}
