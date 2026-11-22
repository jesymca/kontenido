import { cache } from "react";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { users, profiles, wallets, agencies } from "@/lib/db/schema";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { normalizeGenderValue, serializeInterestedIn } from "@/lib/countries";
import { sendWelcomeEmail } from "@/lib/email";
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

// Intervalo mínimo entre resincronizaciones JWT -> Turso DB para evitar viajes de red repetitivos al navegar
const JWT_DB_SYNC_TTL_MS = 15_000;

/**
 * Instancia completa de NextAuth para el entorno Node.js
 * Combina la configuración base de Edge con los proveedores que requieren base de datos y bcrypt.
 */
const nextAuthResult = NextAuth({
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
        await ensureKomestibleSchema();
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
          country: user.country || "VE",
          gender: user.gender || null,
          interestedIn: user.interestedIn || null,
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
      await ensureKomestibleSchema();
      if (account?.provider === "google" && user.email) {
        const email = user.email.toLowerCase().trim();
        const existing = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        const cookieStore = await cookies();
        const intendedRoleCookie = cookieStore.get("intended_role")?.value;
        const intendedCountryCookie = cookieStore.get("intended_country")?.value;
        const intendedGenderCookie = cookieStore.get("intended_gender")?.value;
        const intendedInterestedCookie = cookieStore.get("intended_interested_in")?.value;
        const callbackUrlCookie =
          cookieStore.get("__Secure-authjs.callback-url")?.value ||
          cookieStore.get("authjs.callback-url")?.value ||
          cookieStore.get("__Secure-next-auth.callback-url")?.value ||
          cookieStore.get("next-auth.callback-url")?.value ||
          "";

        const wantsAgency =
          intendedRoleCookie === "AGENCY" || callbackUrlCookie.includes("/agencia");
        const wantsCreator =
          !wantsAgency &&
          (intendedRoleCookie === "CREATOR" || callbackUrlCookie.includes("/panel"));
        const assignedRole = wantsAgency
          ? "AGENCY"
          : wantsCreator
          ? "CREATOR"
          : "CONSUMER";
        const assignedCountry =
          intendedCountryCookie && /^[A-Z]{2,5}$/i.test(intendedCountryCookie)
            ? intendedCountryCookie.toUpperCase()
            : "VE";
        const assignedGender = normalizeGenderValue(intendedGenderCookie);
        const assignedInterestedIn = intendedInterestedCookie
          ? serializeInterestedIn(decodeURIComponent(intendedInterestedCookie).split(","))
          : null;

        const now = new Date().toISOString();

        if (!existing) {
          const baseName = (user.name || email.split("@")[0])
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "")
            .slice(0, 15);
          const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
          const generatedUsername = `${baseName}_${uniqueSuffix}`;
          const newUserId = crypto.randomUUID();

          // Registrar usuario automáticamente con el rol seleccionado (CREATOR, AGENCY o CONSUMER)
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
            country: assignedCountry,
            gender: assignedRole === "AGENCY" ? null : assignedGender,
            interestedIn: assignedRole === "AGENCY" ? null : assignedInterestedIn,
            createdAt: now,
            updatedAt: now,
          });

          const creatorCat = assignedGender || "MUJER";

          if (assignedRole === "AGENCY") {
            const agencyDisplay = (user.name || generatedUsername).slice(0, 50);
            await db.insert(agencies).values({
              id: crypto.randomUUID(),
              ownerUserId: newUserId,
              name: agencyDisplay,
              description: `Agencia oficial de talentos ${agencyDisplay} en KONTENIDO.`,
              badgeText: agencyDisplay,
              badgeColor: "from-indigo-500 via-purple-500 to-rose-500",
              showBadge: 1,
              commissionPct: 10.0,
              status: "ACTIVE",
              createdAt: now,
            });
          } else {
            await db.insert(profiles).values({
              userId: newUserId,
              displayName: user.name || generatedUsername,
              bio: assignedRole === "CREATOR" ? "Creadora de contenido en KONTENIDO." : "¡Hola! Estoy usando KONTENIDO.",
              subscriptionPriceKoin: assignedRole === "CREATOR" ? 10.0 : 0.0,
              creatorCategory: creatorCat,
              isPublished: 0,
              createdAt: now,
              updatedAt: now,
            });
          }

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
          user.country = assignedCountry;
          user.gender = assignedRole === "AGENCY" ? null : assignedGender;
          user.interestedIn = assignedRole === "AGENCY" ? null : assignedInterestedIn;

          // Enviar correo de bienvenida al registrarse por primera vez con Google
          await sendWelcomeEmail({
            to: email,
            username: generatedUsername,
            role: assignedRole,
          }).catch((err) => console.error("Aviso correo bienvenida Google:", err));
        } else {
          // Si ya existía como CONSUMER pero eligió registrarse como CREATOR, actualizar rol y perfil
          let currentRole = existing.role;
          let currentStatus = existing.status;
          if (wantsCreator && existing.role === "CONSUMER") {
            currentRole = "CREATOR";
            currentStatus = existing.kycStatus === "APPROVED" ? "ACTIVE" : "PENDING";
            await db
              .update(users)
              .set({ role: "CREATOR", status: currentStatus, updatedAt: now })
              .where(eq(users.id, existing.id));

            const existingProfile = await db.query.profiles.findFirst({
              where: eq(profiles.userId, existing.id),
            });
            if (existingProfile) {
              if (existingProfile.subscriptionPriceKoin <= 0) {
                await db
                  .update(profiles)
                  .set({
                    subscriptionPriceKoin: 10.0,
                    bio: "Creadora de contenido en KONTENIDO.",
                    updatedAt: now,
                  })
                  .where(eq(profiles.userId, existing.id));
              }
            }
          }

          user.id = existing.id;
          user.username = existing.username;
          user.role = currentRole;
          user.status = currentStatus;
          user.kycStatus = existing.kycStatus;
          user.level = existing.level;
          user.vipMembershipId = existing.vipMembershipId;
          user.allowDownload = existing.allowDownload;
          user.suspensionReason = existing.suspensionReason;
          user.country = existing.country || "VE";
          user.gender = existing.gender || null;
          user.interestedIn = existing.interestedIn || null;
        }
      }
      return true;
    },

    // Sincronización optimizada del JWT con la base de datos Turso (evita consultas redundantes en cada clic)
    async jwt({ token, user, trigger, session }) {
      const nowMs = Date.now();

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
        token.country = user.country;
        token.gender = user.gender;
        token.interestedIn = user.interestedIn;
        token.syncedAt = nowMs;
        return token;
      }

      if (trigger === "update" && session) {
        token.role = session.role ?? token.role;
        token.status = session.status ?? token.status;
        token.kycStatus = session.kycStatus ?? token.kycStatus;
        token.level = session.level ?? token.level;
        token.vipMembershipId = session.vipMembershipId ?? token.vipMembershipId;
        token.allowDownload = session.allowDownload ?? token.allowDownload;
        token.country = session.country ?? token.country;
        token.gender = session.gender ?? token.gender;
        token.interestedIn = session.interestedIn ?? token.interestedIn;
      }

      const lastSynced = typeof token.syncedAt === "number" ? token.syncedAt : 0;
      const shouldSyncDb = trigger === "update" || nowMs - lastSynced > JWT_DB_SYNC_TTL_MS;

      if (shouldSyncDb) {
        try {
          await ensureKomestibleSchema();
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
            token.country = dbUser.country || "VE";
            token.gender = dbUser.gender || null;
            token.interestedIn = dbUser.interestedIn || null;
            token.syncedAt = nowMs;
          }
        } catch (err) {
          console.error("Error sincronizando sesión con Turso DB en jwt callback:", err);
        }
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
        session.user.country = (token.country as string) || "VE";
        session.user.gender = (token.gender as string | null) ?? null;
        session.user.interestedIn = (token.interestedIn as string | null) ?? null;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
});

export const { handlers, signIn, signOut } = nextAuthResult;

/**
 * Sesión deduplicada por petición con React.cache():
 * Permite invocar auth() en RootLayout, Navbar, PanelLayout y cada Page sin repetir decodificaciones ni consultas a Turso.
 */
export const auth = cache(async () => nextAuthResult.auth());
