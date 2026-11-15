import { db } from "@/lib/db";
import { users, agencies, agencyCreators } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

interface SessionUser {
  id: string;
  username: string;
  role: string;
}

/**
 * Resuelve el ID y username de la creadora objetivo.
 * Permite que:
 * - Una CREATOR o SUPER_ADMIN opere sobre su propio perfil.
 * - Una AGENCY (o SUPER_ADMIN) opere sobre cualquier perfil de creadora afiliado a su agencia
 *   sin duplicar acciones ni lógica de negocio.
 */
export async function resolveCreatorTarget(
  sessionUser: SessionUser,
  managedCreatorId?: string | null
): Promise<
  | { ok: true; creatorId: string; username: string; isAgencyManaged: boolean }
  | { ok: false; error: string }
> {
  const targetId = managedCreatorId?.trim();

  // Caso 1: La creadora (o admin) opera sobre su propio perfil
  if (!targetId || targetId === sessionUser.id) {
    if (sessionUser.role !== "CREATOR" && sessionUser.role !== "SUPER_ADMIN") {
      return { ok: false, error: "No autorizado" };
    }
    return {
      ok: true,
      creatorId: sessionUser.id,
      username: sessionUser.username,
      isAgencyManaged: false,
    };
  }

  // Caso 2: SUPER_ADMIN gestionando cualquier creadora
  if (sessionUser.role === "SUPER_ADMIN") {
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetId),
    });
    if (!targetUser) return { ok: false, error: "Perfil de creadora no encontrado." };
    return {
      ok: true,
      creatorId: targetUser.id,
      username: targetUser.username,
      isAgencyManaged: true,
    };
  }

  // Caso 3: AGENCY gestionando un perfil afiliado a su agencia
  if (sessionUser.role === "AGENCY") {
    const agency = await db.query.agencies.findFirst({
      where: eq(agencies.ownerUserId, sessionUser.id),
    });
    if (!agency) {
      return { ok: false, error: "No se encontró una agencia asociada a tu cuenta." };
    }

    const link = await db.query.agencyCreators.findFirst({
      where: and(
        eq(agencyCreators.agencyId, agency.id),
        eq(agencyCreators.creatorId, targetId),
        eq(agencyCreators.status, "ACCEPTED")
      ),
    });

    if (!link) {
      return { ok: false, error: "Este perfil no pertenece a tu agencia." };
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetId),
    });
    if (!targetUser) {
      return { ok: false, error: "Perfil de creadora no encontrado." };
    }

    return {
      ok: true,
      creatorId: targetUser.id,
      username: targetUser.username,
      isAgencyManaged: true,
    };
  }

  return { ok: false, error: "No autorizado para gestionar este perfil." };
}
