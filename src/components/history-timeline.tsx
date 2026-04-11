import type { AnnualAward, HistoryStageSummary } from "@/lib/domain/types";

export function HistoryTimeline({
  history,
  annualAwards,
}: {
  history: HistoryStageSummary[];
  annualAwards: AnnualAward[];
}) {
  return (
    <section className="glass-card rounded-[2rem] p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-muted text-xs uppercase tracking-[0.25em]">Histórico</p>
          <h2 className="mt-2 text-2xl font-semibold">Etapas encerradas</h2>
        </div>
        <span className="status-pill status-neutral">{history.length} etapas registradas</span>
      </div>

      <div className="mt-6 grid gap-4">
        {history.map((stage) => (
          <article
            key={stage.id}
            className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold">{stage.title}</p>
                <p className="text-muted text-sm">{stage.stageDateLabel}</p>
              </div>
              <span className="status-pill status-success">Campeão: {stage.winnerName}</span>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-[var(--muted)] md:grid-cols-3">
              <p>{stage.matchesPlayed} partidas encerradas</p>
              <p>{stage.dailyPrize} para o campeão do dia</p>
              <p>{stage.annualPotContribution} adicionados ao pote anual</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/15 p-5">
        <p className="text-muted text-xs uppercase tracking-[0.25em]">Premiação anual preparada</p>
        <div className="mt-4 grid gap-3">
          {annualAwards.map((award) => (
            <div key={award.position} className="flex items-center justify-between text-sm">
              <span>{award.position}º lugar</span>
              <span className="font-semibold">{award.percentage}% do pote</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
