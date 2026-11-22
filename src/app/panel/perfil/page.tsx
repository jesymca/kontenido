import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import ProfileForm from "@/components/ProfileForm";
import CreatorPanelNav from "@/components/CreatorPanelNav";
import AccountModeCard from "@/components/AccountModeCard";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { getCurrentDbUser } from "@/lib/session";
import { isVenezuelanUser, parseInterestedIn } from "@/lib/countries";
import { Settings, Eye, Sparkles } from "lucide-react";
import Link from "next/link";

interface PerfilPageProps {
  searchParams?: Promise<{ completar?: string }>;
}

/**
 * Pantalla de Configuración de Perfil Básico de Creadora (/panel/perfil)
 * Permite configurar Foto de Perfil, Foto de Banner, Nombre de Usuario,
 * Identidad (Hombre/Mujer/Pareja/Transgénero), Intereses para KOMESTIBLE,
 * Texto de Bienvenida, País, Precio y Estado de Identidad (KYC).
 */
export default async function PerfilPage({ searchParams }: PerfilPageProps) {
  await ensureKomestibleSchema();
  const [session, resolvedParams] = await Promise.all([
    auth(),
    searchParams ? searchParams : Promise.resolve({} as { completar?: string }),
  ]);
  if (!session?.user) return null;

  const [profile, user] = await Promise.all([
    db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    }),
    getCurrentDbUser(),
  ]);

  const parsedInterests = parseInterestedIn(user?.interestedIn);
  const needsBasicSetup =
    resolvedParams?.completar === "1" || !user?.gender || parsedInterests.length === 0;

  return (
    <div>
      <CreatorPanelNav
        username={session.user.username}
        kycStatus={user?.kycStatus || "NONE"}
      />

      <div className="container mx-auto px-4 pt-6 sm:pt-8 pb-12 max-w-3xl">
        {needsBasicSetup && (
          <div className="mb-6 p-5 bg-gradient-to-r from-rose-950/70 via-slate-900 to-amber-950/40 border border-rose-500/40 rounded-3xl shadow-xl flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                Paso 2 de 2 • Información Básica del Perfil
              </span>
              <h2 className="text-base font-black text-white mt-0.5">
                Completa tu identidad y a quién te interesa conocer
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Selecciona si eres <strong>Hombre, Mujer, Pareja o Transgénero</strong> y a quién estás interesado/a en conocer. Estos datos se toman en cuenta en tu perfil y en la sección gratuita <strong className="text-rose-300">KOMESTIBLE</strong>.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Settings className="w-6 h-6 text-rose-500" />
              Información Básica y Configuración de Perfil
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Personaliza cómo ven tu perfil los fanáticos en kontenido.online/{session.user.username}.
            </p>
          </div>

          <Link
            href={`/${session.user.username}`}
            target="_blank"
            className="text-xs text-rose-400 font-bold hover:underline flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            Ver perfil
          </Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <ProfileForm
            profile={profile}
            username={session.user.username}
            kycStatus={user?.kycStatus || "NONE"}
            initialCountry={user?.country || "VE"}
            initialGender={user?.gender || null}
            initialInterestedIn={user?.interestedIn || null}
          />
        </div>

        <AccountModeCard
          currentRole={user?.role || session.user.role}
          username={session.user.username}
          isVenezuela={isVenezuelanUser(user?.country)}
          variant="panel-perfil"
        />
      </div>
    </div>
  );
}
