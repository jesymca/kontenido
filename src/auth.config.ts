import type { NextAuthConfig } from "next-auth";

/**
 * Configuración base de NextAuth v5 compatible con el Edge Runtime
 * Desacoplada de Node.js (sin bcrypt ni conexiones nativas de base de datos)
 * para ser consumida de forma segura por el Middleware de Next.js.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    // Inyección de información extendida en el JWT (seguro para Edge)
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.status = user.status;
        token.kycStatus = user.kycStatus;
        token.level = user.level;
        token.vipMembershipId = user.vipMembershipId;
        token.allowDownload = user.allowDownload;
        token.suspensionReason = user.suspensionReason;
      }

      if (trigger === "update" && session) {
        token.role = session.role ?? token.role;
        token.status = session.status ?? token.status;
        token.kycStatus = session.kycStatus ?? token.kycStatus;
        token.level = session.level ?? token.level;
        token.vipMembershipId = session.vipMembershipId ?? token.vipMembershipId;
        token.allowDownload = session.allowDownload ?? token.allowDownload;
      }

      return token;
    },

    // Enriquecimiento de la sesión de usuario
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as any;
        session.user.status = token.status as any;
        session.user.kycStatus = token.kycStatus as any;
        session.user.level = (token.level as number) || 0;
        session.user.vipMembershipId = token.vipMembershipId as string | null;
        session.user.allowDownload = (token.allowDownload as number) || 0;
        session.user.suspensionReason = token.suspensionReason as string | null;
      }
      return session;
    },
  },
  providers: [], // Los proveedores con dependencias pesadas de Node (Credentials, Google) se añaden en auth.ts
} satisfies NextAuthConfig;
