import { db } from "@/lib/db";
import { posts, mediaAssets } from "@/lib/db/schema";
import { revalidatePath } from "next/cache";
import { validateNoExternalContact } from "@/lib/contentFilter";
import { resolveCreatorTarget } from "@/lib/creatorTarget";

export interface PostMediaInput {
  originalKey: string;
  previewKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  type?: "IMAGE" | "VIDEO";
}

export interface CreatePostInput {
  title: string;
  description?: string;
  priceKoin?: number | string;
  isPublicTeaser?: boolean | number | string;
  mediaItems?: PostMediaInput[] | string;
  managedCreatorId?: string | null;
}

interface SessionUser {
  id: string;
  username: string;
  role: string;
}

/**
 * Crea una publicación con sus archivos multimedia asociados en Turso DB.
 * Compartida entre la Server Action (createPostAction) y el endpoint fallback (/api/posts).
 */
export async function createPostForCreator(
  sessionUser: SessionUser,
  input: CreatePostInput
): Promise<{ success: true; postId: string } | { error: string }> {
  const target = await resolveCreatorTarget(sessionUser, input.managedCreatorId);
  if (!target.ok) {
    return { error: target.error };
  }

  const userId = target.creatorId;
  const title = (input.title || "").trim();
  const description = (input.description || "").trim();
  const priceKoin =
    typeof input.priceKoin === "number"
      ? input.priceKoin
      : parseFloat(input.priceKoin || "0") || 0.0;
  const isPublicTeaser =
    input.isPublicTeaser === true ||
    input.isPublicTeaser === 1 ||
    input.isPublicTeaser === "1"
      ? 1
      : 0;

  if (!title) {
    return { error: "El título de la publicación es obligatorio." };
  }

  // Bloquear números de teléfono, correos o intentos de contacto fuera de la plataforma
  const titleFilter = validateNoExternalContact(title, "El título de la publicación");
  if (!titleFilter.valid) {
    return { error: titleFilter.error || "Contenido no permitido en el título." };
  }
  const descFilter = validateNoExternalContact(description, "La descripción de la publicación");
  if (!descFilter.valid) {
    return { error: descFilter.error || "Contenido no permitido en la descripción." };
  }

  let items: PostMediaInput[] = [];
  if (typeof input.mediaItems === "string" && input.mediaItems.trim()) {
    try {
      const parsed = JSON.parse(input.mediaItems);
      if (Array.isArray(parsed)) {
        items = parsed;
      }
    } catch {
      return { error: "Formato inválido de archivos multimedia." };
    }
  } else if (Array.isArray(input.mediaItems)) {
    items = input.mediaItems;
  }

  const now = new Date().toISOString();
  const postId = crypto.randomUUID();

  await db.insert(posts).values({
    id: postId,
    creatorId: userId,
    title,
    description,
    priceKoin,
    isPackageItem: 0,
    isPublicTeaser,
    status: "APPROVED",
    isDeleted: 0,
    createdAt: now,
    updatedAt: now,
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item?.originalKey) continue;
    await db.insert(mediaAssets).values({
      id: crypto.randomUUID(),
      postId,
      creatorId: userId,
      type: item.type === "VIDEO" ? "VIDEO" : "IMAGE",
      originalKey: item.originalKey,
      previewKey: item.previewKey || item.originalKey,
      backupKey: `backups/${userId}/${item.originalKey.replace(/\//g, "_")}`,
      mimeType: item.mimeType || (item.type === "VIDEO" ? "video/mp4" : "image/jpeg"),
      sizeBytes: item.sizeBytes || 0,
      sortOrder: i,
      moderationStatus: "OK",
      isDeleted: 0,
      createdAt: now,
    });
  }

  revalidatePath(`/${target.username}`);
  revalidatePath("/panel");
  revalidatePath("/agencia");
  revalidatePath(`/agencia/creadoras/${userId}`);

  return { success: true, postId };
}
