import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import CreatorPanelNav from "@/components/CreatorPanelNav";
import CedulaOcrScanner from "@/components/CedulaOcrScanner";
import { ShieldCheck } from "lucide-react";

/**
 * Pantalla de Validación de Identidad (KYC) y Mayoría de Edad para Creadoras
 * Integra el motor OCR de jesymca/reconocimiento_cedula para extracción automática.
 */
export default async function KycPage() {
  const session = await auth();
  const currentUser = session?.user
    ? await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      })
    : null;

  return (
    <div>
      <CreatorPanelNav
        username={session?.user?.username}
        kycStatus={currentUser?.kycStatus || "NONE"}
      />

      <div className="container mx-auto px-4 pb-12 max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Validación de Identidad y Mayoría de Edad
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                Requisito obligatorio para creadoras venezolanas en KONTENIDO.
              </p>
            </div>
          </div>
        </div>

        <CedulaOcrScanner />
      </div>
    </div>
  );
}
