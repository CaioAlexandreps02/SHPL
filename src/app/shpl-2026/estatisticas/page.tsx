import { SHPLPlaceholderPage } from "@/components/shpl-placeholder-page";
import { SHPLStatisticsPage } from "@/components/shpl-statistics-page";
import { getCurrentUserAccess, isAdmin } from "@/lib/auth/access";
import { getLeagueSnapshot } from "@/lib/data/repository";

export default async function EstatisticasPage() {
  const access = await getCurrentUserAccess();

  if (!isAdmin(access)) {
    return (
      <SHPLPlaceholderPage
        description="Ainda estamos desenvolvendo esta tela. Futuramente aqui vao aparecer novas informacoes, indicadores avancados e analises completas da SHPL."
        section="Estatisticas"
      />
    );
  }

  const snapshot = await getLeagueSnapshot();

  return <SHPLStatisticsPage snapshot={snapshot} />;
}
