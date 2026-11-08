import { db } from "@/lib/db";
import { kycDocuments, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import AdminKycReview from "@/components/AdminKycReview";
import { FileCheck } from "lucide-react";
import { getPresignedDownloadUrl, BUCKETS } from "@/lib/r2";

/**
 * Vista de Revisión y Validación de Cédulas KYC (/admin/kyc)
 */
export default async function AdminKycPage() {
  const pendingDocs = await db.query.kycDocuments.findMany({
    orderBy: [desc(kycDocuments.createdAt)],
  });

  const allUsers = await db.query.users.findMany();
  const userMap = new Map(allUsers.map((u) => [u.id, u.username]));

  // Firmar URLs de las imágenes para el admin
  const enrichedDocs = await Promise.all(
    pendingDocs.map(async (doc) => {
      let frontUrl = "";
      let backUrl = "";
      let selfieUrl = "";
      try {
        frontUrl = await getPresignedDownloadUrl(BUCKETS.PRIVATE, doc.frontKey, 900);
        backUrl = await getPresignedDownloadUrl(BUCKETS.PRIVATE, doc.backKey, 900);
        selfieUrl = await getPresignedDownloadUrl(BUCKETS.PRIVATE, doc.selfieKey, 900);
      } catch (e) {
        console.error("Error firmando KYC:", e);
      }

      return {
        ...doc,
        username: userMap.get(doc.userId) || "Desconocido",
        urls: { frontUrl, backUrl, selfieUrl },
      };
    })
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <FileCheck className="w-6 h-6 text-emerald-400" />
          Validación de Identidad y Mayoría de Edad (KYC)
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Compara visualmente la cédula venezolana (frente/reverso) y la selfie de la creadora para aprobar su activación.
        </p>
      </div>

      <AdminKycReview documents={enrichedDocs} />
    </div>
  );
}
