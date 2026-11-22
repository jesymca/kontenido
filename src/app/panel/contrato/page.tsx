import { auth } from "@/auth";
import { ensureKomestibleSchema } from "@/lib/db/initKomestible";
import { getCurrentDbUser } from "@/lib/session";
import { isVenezuelanUser, getCountryMeta } from "@/lib/countries";
import CreatorContractForm from "@/components/CreatorContractForm";
import { redirect } from "next/navigation";

export default async function ContratoPage() {
  await ensureKomestibleSchema();
  const [session, currentUser] = await Promise.all([auth(), getCurrentDbUser()]);
  if (!session?.user) {
    redirect("/login?callbackUrl=/panel/contrato");
  }

  const isVenezuela = isVenezuelanUser(currentUser?.country);
  const countryMeta = getCountryMeta(currentUser?.country);

  return (
    <CreatorContractForm
      isVenezuela={isVenezuela}
      countryLabel={`${countryMeta.flag} ${countryMeta.name}`}
    />
  );
}
