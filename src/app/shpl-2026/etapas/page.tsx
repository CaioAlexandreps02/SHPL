import { SHPLStagesPage } from "@/components/shpl-stages-page";
import { getLeagueSnapshot } from "@/lib/data/repository";

export default async function EtapasPage() {
  const snapshot = await getLeagueSnapshot();

  return <SHPLStagesPage snapshot={snapshot} />;
}
