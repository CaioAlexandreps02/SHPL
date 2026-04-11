import { AppShell } from "@/components/app-shell";
import { HistoryTimeline } from "@/components/history-timeline";
import { RankingTable } from "@/components/ranking-table";
import { getLeagueSnapshot } from "@/lib/data/repository";

export default async function HistoryPage() {
  const snapshot = await getLeagueSnapshot();

  return (
    <AppShell
      championship={snapshot.championship}
      currentStage={snapshot.currentStage}
      annualRanking={snapshot.annualRanking}
      dayRanking={snapshot.dayRanking}
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <HistoryTimeline history={snapshot.history} annualAwards={snapshot.annualAwards} />
        <RankingTable
          title="Ranking anual consolidado"
          subtitle="Pronto para histórico, ajustes manuais e futura expansão de desempates"
          entries={snapshot.annualRanking}
        />
      </div>
    </AppShell>
  );
}
