import { handlers } from "@/auth";

/**
 * Route Handlers de NextAuth v5 (GET y POST)
 * Gestiona autenticación, tokens de sesión y llamadas de callback de proveedores
 */
export const { GET, POST } = handlers;
