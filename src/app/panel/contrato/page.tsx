import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { isVenezuelanUser, getCountryMeta } from "@/lib/countries";
import CreatorContractForm from "@/components/CreatorContractForm";
import { redirect } from "next/navigation";

export default async function ContratoPage() {
  await ensureKomestibleSchema();
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/panel/contrato");
  }

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  const isVenezuela = isVenezuelanUser(currentUser?.country);
  const countryMeta = getCountryMeta(currentUser?.country);

  return (
    <CreatorContractForm
      isVenezuela={isVenezuela}
      countryLabel={`${countryMeta.flag} ${countryMeta.name}`}
    />
  );
}
