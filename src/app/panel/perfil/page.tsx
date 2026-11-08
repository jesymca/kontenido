import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import ProfileForm from "@/components/ProfileForm";
import { Settings, Eye } from "lucide-react";
import Link from "next/link";

/**
 * Pantalla de Configuración de Perfil (/panel/perfil)
 */
export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user) return null;

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-rose-500" />
            Configuración de Perfil
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Personaliza cómo ven tu perfil los fanáticos en kontenido.com/{session.user.username}.
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

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <ProfileForm profile={profile} username={session.user.username} />
      </div>
    </div>
  );
}
