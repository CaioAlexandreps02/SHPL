import type { LeagueSnapshot } from "@/lib/domain/types";
import { PlayerAvatar } from "@/components/player-avatar";

export function SHPLAnnualClassification({
  snapshot,
  title = "Classificacao Anual",
  description = "Acompanhe a pontuacao de cada jogador por etapa e a soma total acumulada da temporada.",
}: {
  snapshot: LeagueSnapshot;
  title?: string;
  description?: string;
}) {
  const nameColumnWidth = 250;
  const stageColumnWidth = 190;
  const totalColumnWidth = 160;
  const visibleStageColumns = 3;
  const visibleWindowWidth =
    nameColumnWidth + totalColumnWidth + visibleStageColumns * stageColumnWidth;
  const tableMinWidth =
    nameColumnWidth + totalColumnWidth + snapshot.annualStagePoints.length * stageColumnWidth;

  return (
    <section className="rounded-[1.8rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.28)] md:p-6">
      <div className="flex flex-col gap-4 border-b border-[rgba(255,208,101,0.1)] pb-5">
        <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[rgba(236,225,196,0.68)]">
          SHPL 2026
        </p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[rgba(255,244,214,0.96)] md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-[rgba(236,225,196,0.74)]">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Lider atual"
          value={snapshot.annualRanking[0]?.playerName ?? "-"}
          helper={`${snapshot.annualRanking[0]?.points ?? 0} pontos`}
        />
        <SummaryCard
          label="Etapas computadas"
          value={String(snapshot.annualStagePoints.length)}
          helper="classificacao anual"
        />
        <SummaryCard
          label="Jogadores no ranking"
          value={String(snapshot.annualRanking.length)}
          helper="temporada ativa"
        />
      </div>

      <div
        className="mt-5 max-w-full overflow-x-auto rounded-[1.35rem] border border-[rgba(255,208,101,0.12)]"
        style={{ width: "100%", maxWidth: `${visibleWindowWidth}px` }}
      >
        <table className="border-collapse" style={{ minWidth: `${tableMinWidth}px` }}>
          <thead>
            <tr className="bg-[rgba(6,17,12,0.92)]">
              <th
                className="sticky left-0 z-20 border-b border-r border-[rgba(255,208,101,0.12)] bg-[rgba(6,17,12,0.98)] px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(255,236,184,0.92)]"
                style={{ minWidth: `${nameColumnWidth}px`, width: `${nameColumnWidth}px` }}
              >
                Jogador
              </th>
              {snapshot.annualStagePoints.map((stage, index) => (
                <th
                  key={stage.stageId}
                  className="border-b border-r border-[rgba(255,208,101,0.12)] px-4 py-4 text-center"
                  style={{ minWidth: `${stageColumnWidth}px`, width: `${stageColumnWidth}px` }}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-lg font-semibold text-[rgba(255,244,214,0.96)]">
                      {stage.stageDateShortLabel}
                    </span>
                    <span className="text-[0.72rem] uppercase tracking-[0.22em] text-[rgba(236,225,196,0.62)]">
                      {buildStageOrdinalLabel(index + 1)}
                    </span>
                  </div>
                </th>
              ))}
              <th
                className="sticky right-0 z-20 border-b border-l border-[rgba(255,208,101,0.12)] bg-[rgba(6,17,12,0.98)] px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(255,236,184,0.92)]"
                style={{ minWidth: `${totalColumnWidth}px`, width: `${totalColumnWidth}px` }}
              >
                Total anual
              </th>
            </tr>
            <tr className="bg-[rgba(255,183,32,0.08)]">
              <th className="sticky left-0 z-20 border-b border-r border-[rgba(255,208,101,0.1)] bg-[rgba(31,48,29,0.98)] px-4 py-3 text-left text-sm font-semibold text-[rgba(255,244,214,0.92)]">
                Nome
              </th>
              {snapshot.annualStagePoints.map((stage) => (
                <th
                  key={`${stage.stageId}-points`}
                  className="border-b border-r border-[rgba(255,208,101,0.1)] px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.18em] text-[rgba(255,236,184,0.82)]"
                >
                  Pontos
                </th>
              ))}
              <th className="sticky right-0 z-20 border-b border-l border-[rgba(255,208,101,0.1)] bg-[rgba(31,48,29,0.98)] px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.18em] text-[rgba(255,236,184,0.82)]">
                Soma
              </th>
            </tr>
          </thead>
          <tbody>
            {snapshot.annualRanking.map((entry, index) => (
              <tr
                key={entry.playerId}
                className={
                  index % 2 === 0
                    ? "bg-[rgba(11,37,27,0.82)]"
                    : "bg-[rgba(8,28,20,0.96)]"
                }
              >
                <td className={`sticky left-0 z-10 border-b border-r border-[rgba(255,208,101,0.1)] px-4 py-3 text-left text-base font-medium text-[rgba(255,244,214,0.96)] ${
                  index % 2 === 0
                    ? "bg-[rgba(11,37,27,0.98)]"
                    : "bg-[rgba(8,28,20,0.99)]"
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(255,208,101,0.18)] bg-[rgba(255,183,32,0.12)] text-[0.68rem] font-semibold text-[rgba(255,236,184,0.96)]">
                      {entry.position}
                    </span>
                    <PlayerAvatar
                      name={entry.playerName}
                      photoDataUrl={entry.photoDataUrl}
                      size="sm"
                    />
                    <span>{entry.playerName}</span>
                  </div>
                </td>
                {snapshot.annualStagePoints.map((stage) => (
                  <td
                    key={`${entry.playerId}-${stage.stageId}`}
                    className="border-b border-r border-[rgba(255,208,101,0.1)] px-4 py-3 text-center text-base text-[rgba(236,225,196,0.9)]"
                  >
                    {stage.pointsByPlayer[entry.playerId] ?? 0}
                  </td>
                ))}
                <td className={`sticky right-0 z-10 border-b border-l border-[rgba(255,208,101,0.1)] px-4 py-3 text-center text-lg font-semibold text-[rgba(255,236,184,0.96)] ${
                  index % 2 === 0
                    ? "bg-[rgba(11,37,27,0.98)]"
                    : "bg-[rgba(8,28,20,0.99)]"
                }`}>
                  {entry.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function buildStageOrdinalLabel(stageNumber: number) {
  const ordinalMap: Record<number, string> = {
    1: "Primeira etapa",
    2: "Segunda etapa",
    3: "Terceira etapa",
    4: "Quarta etapa",
    5: "Quinta etapa",
    6: "Sexta etapa",
    7: "Setima etapa",
    8: "Oitava etapa",
    9: "Nona etapa",
    10: "Decima etapa",
  };

  return ordinalMap[stageNumber] ?? `${stageNumber}a etapa`;
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">{value}</p>
      <p className="mt-1 text-sm text-[rgba(236,225,196,0.68)]">{helper}</p>
    </article>
  );
}
