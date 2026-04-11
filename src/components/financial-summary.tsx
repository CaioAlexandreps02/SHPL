import type { FinancialSummaryData } from "@/lib/domain/types";

export function FinancialSummary({
  summary,
}: {
  summary: FinancialSummaryData;
}) {
  const cards = [
    { label: "Arrecadação do dia", value: summary.dailyPrizePool },
    { label: "Pote anual", value: summary.annualPot },
    { label: "Buy-ins do dia", value: `${summary.dailyPaidPlayers} pagantes` },
    { label: "Pagamentos anuais", value: `${summary.annualPaidPlayers} quites` },
  ];

  return (
    <section className="glass-card rounded-[2rem] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-muted text-xs uppercase tracking-[0.25em]">Financeiro</p>
          <h2 className="mt-2 text-2xl font-semibold">Premiação e pote</h2>
        </div>
        <span className="status-pill status-success">Atualizado</span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
          >
            <p className="text-muted text-sm">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
