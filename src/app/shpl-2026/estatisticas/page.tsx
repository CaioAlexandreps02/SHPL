import { SHPLPlaceholderPage } from "@/components/shpl-placeholder-page";
import { SHPLStatisticsPage } from "@/components/shpl-statistics-page";
import { getCurrentUserAccess, isAdmin } from "@/lib/auth/access";
import { getLeagueSnapshot } from "@/lib/data/repository";

export default async function EstatisticasPage() {
  const access = await getCurrentUserAccess();
  if (!access) {
    return (
      <SHPLPlaceholderPage
        description="Entre com sua conta para visualizar as estatisticas da SHPL."
        section="Estatisticas"
      />
    );
  }

  const snapshot = await getLeagueSnapshot();

  return <SHPLStatisticsPage canViewSimulation={isAdmin(access)} snapshot={snapshot} />;
}
