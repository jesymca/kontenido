import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { users, profiles, wallets } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

/**
 * Esquema de validación para inicio de sesión con credenciales
 */
const loginSchema = z.object({
  identifier: z.string().min(3, "Ingresa tu correo o nombre de usuario"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

/**
 * Instancia completa de NextAuth para el entorno Node.js
 * Combina la configuración base de Edge con los proveedores que requieren base de datos y bcrypt.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // 1. Proveedor de credenciales tradicional (Node runtime)
    Credentials({
      name: "Credenciales",
      credentials: {
        identifier: { label: "Correo o Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }

        const { identifier, password } = parsed.data;

        // Buscar usuario por correo electrónico o por nombre de usuario
        const user = await db.query.users.findFirst({
          where: or(
            eq(users.email, identifier.toLowerCase().trim()),
            eq(users.username, identifier.toLowerCase().trim())
          ),
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          return null;
        }

        return {
          id: user.id,
          name: user.username,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
          kycStatus: user.kycStatus,
          level: user.level,
          vipMembershipId: user.vipMembershipId,
          allowDownload: user.allowDownload,
          suspensionReason: user.suspensionReason,
        };
      },
    }),

    // 2. Proveedor de Google OAuth (Inicio de sesión con 1 clic)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,

    // Manejo de registro automático al iniciar con Google
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const email = user.email.toLowerCase().trim();
        const existing = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        const cookieStore = await cookies();
        const intendedRoleCookie = cookieStore.get("intended_role")?.value;
        const callbackUrlCookie =
          cookieStore.get("__Secure-authjs.callback-url")?.value ||
          cookieStore.get("authjs.callback-url")?.value ||
          cookieStore.get("__Secure-next-auth.callback-url")?.value ||
          cookieStore.get("next-auth.callback-url")?.value ||
          "";

        const wantsCreator =
          intendedRoleCookie === "CREATOR" || callbackUrlCookie.includes("/panel");
        const assignedRole = wantsCreator ? "CREATOR" : "CONSUMER";

        const now = new Date().toISOString();

        if (!existing) {
          const baseName = (user.name || email.split("@")[0])
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "")
            .slice(0, 15);
          const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
          const generatedUsername = `${baseName}_${uniqueSuffix}`;
          const newUserId = crypto.randomUUID();

          // Registrar usuario automáticamente con el rol seleccionado (CREATOR o CONSUMER)
          await db.insert(users).values({
            id: newUserId,
            username: generatedUsername,
            email,
            role: assignedRole,
            status: assignedRole === "CREATOR" ? "PENDING" : "ACTIVE",
            kycStatus: "NONE",
            level: 0,
            allowDownload: 0,
            image: user.image || null,
            createdAt: now,
            updatedAt: now,
          });

          await db.insert(profiles).values({
            userId: newUserId,
            displayName: user.name || generatedUsername,
            bio: assignedRole === "CREATOR" ? "Creadora de contenido en KONTENIDO." : "¡Hola! Estoy usando KONTENIDO.",
            subscriptionPriceKoin: assignedRole === "CREATOR" ? 10.0 : 0.0,
            isPublished: 0,
            createdAt: now,
            updatedAt: now,
          });

          await db.insert(wallets).values({
            userId: newUserId,
            balanceKoin: 0.0,
            totalSpentUsd: 0.0,
            totalEarnedKoin: 0.0,
            updatedAt: now,
          });

          user.id = newUserId;
          user.username = generatedUsername;
          user.role = assignedRole;
          user.status = assignedRole === "CREATOR" ? "PENDING" : "ACTIVE";
          user.kycStatus = "NONE";
          user.level = 0;
          user.allowDownload = 0;
        } else {
          // Si ya existía como CONSUMER pero eligió registrarse como CREATOR, actualizar rol a CREATOR
          let currentRole = existing.role;
          if (wantsCreator && existing.role === "CONSUMER") {
            currentRole = "CREATOR";
            await db
              .update(users)
              .set({ role: "CREATOR", updatedAt: now })
              .where(eq(users.id, existing.id));
          }

          user.id = existing.id;
          user.username = existing.username;
          user.role = currentRole;
          user.status = existing.status;
          user.kycStatus = existing.kycStatus;
          user.level = existing.level;
          user.vipMembershipId = existing.vipMembershipId;
          user.allowDownload = existing.allowDownload;
          user.suspensionReason = existing.suspensionReason;
        }
      }
      return true;
    },

    // Sincronización en tiempo real del JWT con la base de datos Turso
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

      // Consultar datos frescos del usuario desde Turso DB por email o id para mantener rol y KYC al día
      try {
        const emailLookup = typeof token.email === "string" ? token.email.toLowerCase().trim() : null;
        const idLookup = typeof token.id === "string" ? token.id : null;

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

        if (dbUser) {
          token.id = dbUser.id;
          token.username = dbUser.username;
          token.role = dbUser.role;
          token.status = dbUser.status;
          token.kycStatus = dbUser.kycStatus;
          token.level = dbUser.level;
          token.vipMembershipId = dbUser.vipMembershipId;
          token.allowDownload = dbUser.allowDownload;
          token.suspensionReason = dbUser.suspensionReason;
        }
      } catch (err) {
        console.error("Error sincronizando sesión con Turso DB en jwt callback:", err);
      }

      return token;
    },

    // Enriquecimiento de la sesión de usuario con los valores sincronizados
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
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
});
