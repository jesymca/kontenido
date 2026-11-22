import { db } from "@/lib/db";
import { kycDocuments, users, settings } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import AdminKycReview from "@/components/AdminKycReview";
import { FileCheck } from "lucide-react";
import { getPresignedDownloadUrl, BUCKETS } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * Vista de Revisión y Validación de Cédulas KYC (/admin/kyc)
 * Soporta evaluación y aprobación automática de mayoría de edad (+18) al subir archivos
 * y revisión manual para los casos que requieran verificación adicional.
 */
export default async function AdminKycPage() {
  await ensureKomestibleSchema();

  const [allDocs, autoSettingRow] = await Promise.all([
    db.query.kycDocuments.findMany({
      orderBy: [desc(kycDocuments.createdAt)],
    }),
    db.query.settings.findFirst({
      where: eq(settings.key, "kyc_auto_approve_enabled"),
    }),
  ]);

  const autoApproveEnabled = autoSettingRow ? autoSettingRow.value !== "0" : true;
  const uniqueUserIds = Array.from(new Set(allDocs.map((d) => d.userId)));

  const [relatedUsers, signedUrlsList] = await Promise.all([
    uniqueUserIds.length > 0
      ? db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(inArray(users.id, uniqueUserIds))
      : Promise.resolve([]),
    Promise.all(
      allDocs.map(async (doc) => {
        if (doc.frontKey === "admin_direct_verification") {
          return { frontUrl: "", backUrl: "", selfieUrl: "" };
        }
        try {
          const [frontUrl, backUrl, selfieUrl] = await Promise.all([
            getPresignedDownloadUrl(BUCKETS.PRIVATE, doc.frontKey, 900),
            getPresignedDownloadUrl(BUCKETS.PRIVATE, doc.backKey, 900),
            getPresignedDownloadUrl(BUCKETS.PRIVATE, doc.selfieKey, 900),
          ]);
          return { frontUrl, backUrl, selfieUrl };
        } catch (e) {
          console.error("Error firmando KYC:", e);
          return { frontUrl: "", backUrl: "", selfieUrl: "" };
        }
      })
    ),
  ]);

  const userMap = new Map(relatedUsers.map((u) => [u.id, u.username]));

  const enrichedDocs = allDocs.map((doc, idx) => ({
    ...doc,
    username: userMap.get(doc.userId) || "Desconocido",
    urls: signedUrlsList[idx] || { frontUrl: "", backUrl: "", selfieUrl: "" },
  }));

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <FileCheck className="w-6 h-6 text-emerald-400" />
          Validación de Identidad y Mayoría de Edad (KYC)
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          El sistema evalúa automáticamente el documento y la mayoría de edad (+18) al momento de la carga y aprueba de inmediato cuando los datos son legibles. Aquí puedes supervisar los auto-aprobados y revisar manualmente los pendientes.
        </p>
      </div>

      <AdminKycReview
        documents={enrichedDocs}
        initialAutoApproveEnabled={autoApproveEnabled}
      />
    </div>
  );
}
