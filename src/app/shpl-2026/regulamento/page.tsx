import { SHPLRegulationPage } from "@/components/shpl-regulation-page";
import { getCurrentUserAccess, isAdmin } from "@/lib/auth/access";
import { getShplRegulationDocument } from "@/lib/data/shpl-regulation-store";

export default async function SHPLRegulationRoute() {
  const [access, document] = await Promise.all([
    getCurrentUserAccess(),
    getShplRegulationDocument(),
  ]);

  return <SHPLRegulationPage canEdit={isAdmin(access)} document={document} />;
}
