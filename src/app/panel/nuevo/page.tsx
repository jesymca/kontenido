import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import CreatorPanelNav from "@/components/CreatorPanelNav";
import SocialPostComposer from "@/components/SocialPostComposer";
import { PlusCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * Pantalla para subir nuevo contenido estilo Red Social (/panel/nuevo)
 */
export default async function NuevoPostPage() {
  const session = await auth();
  if (!session?.user) return null;

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  return (
    <div>
      <CreatorPanelNav
        username={session.user.username}
        kycStatus={currentUser?.kycStatus || "NONE"}
      />

      <div className="container mx-auto px-4 pb-12 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/panel"
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <PlusCircle className="w-6 h-6 text-rose-500" />
              Subir Nueva Publicación
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Publica fotos o videos acompañados de texto, emojis y menciones para tus fanáticos.
            </p>
          </div>
        </div>

        <SocialPostComposer
          isKycApproved={currentUser?.kycStatus === "APPROVED"}
          username={session.user.username}
        />
      </div>
    </div>
  );
}
