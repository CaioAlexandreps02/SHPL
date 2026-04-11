import { SHPLDashboard } from "@/components/shpl-dashboard";
import { getLeagueSnapshot } from "@/lib/data/repository";

export default async function SHPLDashboardPage() {
  const snapshot = await getLeagueSnapshot();

  return <SHPLDashboard snapshot={snapshot} />;
}
