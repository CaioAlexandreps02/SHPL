import { SHPLStagesPage } from "@/components/shpl-stages-page";
import { getCurrentUserAccess, isAdmin } from "@/lib/auth/access";
import { getLeagueSnapshot } from "@/lib/data/repository";

export default async function EtapasPage() {
  const [snapshot, access] = await Promise.all([getLeagueSnapshot(), getCurrentUserAccess()]);

  return <SHPLStagesPage canEditStageRanking={isAdmin(access)} snapshot={snapshot} />;
}
