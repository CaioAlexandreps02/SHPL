"use client";

import { useMemo, useState } from "react";

import { SHPLAnnualClassification } from "@/components/shpl-annual-classification";
import { PlayerAvatar } from "@/components/player-avatar";
import type { LeagueSnapshot } from "@/lib/domain/types";

export function SHPLRankingPage({
  snapshot,
  initialStageId,
}: {
  snapshot: LeagueSnapshot;
  initialStageId?: string | null;
}) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(initialStageId ?? null);

  const selectedStageMatches = useMemo(
    () =>
      snapshot.stageMatchPoints.find((stage) => stage.stageId === selectedStageId) ?? null,
    [selectedStageId, snapshot.stageMatchPoints]
  );

  const stageRanking = useMemo(() => {
    if (!selectedStageMatches) {
      return [];
    }

    return snapshot.annualRanking
      .map((entry) => {
        const totalPoints = selectedStageMatches.matches.reduce(
          (total, match) => total + (match.pointsByPlayer[entry.playerId] ?? 0),
          0
        );

        return {
          playerId: entry.playerId,
          playerName: entry.playerName,
          photoDataUrl: entry.photoDataUrl,
          matchPoints: selectedStageMatches.matches.map(
            (match) => match.pointsByPlayer[entry.playerId] ?? 0
          ),
          totalPoints,
        };
      })
      .sort((left, right) => {
        if (right.totalPoints !== left.totalPoints) {
          return right.totalPoints - left.totalPoints;
        }

        return left.playerName.localeCompare(right.playerName, "pt-BR");
      })
      .map((entry, index) => ({
        ...entry,
        position: index + 1,
      }));
  }, [selectedStageMatches, snapshot.annualRanking]);

  return (
    <div className="grid gap-5">
      <SHPLAnnualClassification
        description="Acompanhe o ranking anual por etapa e a soma total acumulada da temporada."
        snapshot={snapshot}
        title="Ranking Anual"
      />

      <section className="rounded-[1.8rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.28)] md:p-6">
        <div className="border-b border-[rgba(255,208,101,0.1)] pb-5">
          <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[rgba(236,225,196,0.68)]">
            Ranking por etapa
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[rgba(255,244,214,0.96)]">
            Etapas finalizadas
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-[rgba(236,225,196,0.74)]">
            Toque em uma etapa para abrir o ranking daquele dia em formato detalhado por partidas.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.stageMatchPoints.map((stage, index) => (
            <button
              key={stage.stageId}
              className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-left transition hover:border-[rgba(255,208,101,0.2)] hover:bg-[rgba(255,255,255,0.05)]"
              onClick={() => setSelectedStageId(stage.stageId)}
              type="button"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[rgba(236,225,196,0.5)]">
                {buildStageOrdinalLabel(index + 1)}
              </p>
              <p className="mt-2 text-lg font-semibold text-[rgba(255,244,214,0.96)]">
                {stage.stageDateShortLabel}
              </p>
              <p className="mt-1 text-sm text-[rgba(236,225,196,0.68)]">{stage.stageDateLabel}</p>
            </button>
          ))}
        </div>
      </section>

      {selectedStageMatches ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Fechar ranking da etapa"
            className="absolute inset-0 bg-[rgba(2,10,7,0.72)] backdrop-blur-[3px]"
            onClick={() => setSelectedStageId(null)}
            type="button"
          />

          <div className="relative z-10 max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[1.55rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] shadow-[0_28px_60px_rgba(0,0,0,0.42)]">
            <div className="flex items-start justify-between gap-4 border-b border-[rgba(255,208,101,0.1)] px-5 py-5 md:px-6">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
                  {selectedStageMatches.stageDateShortLabel}
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-[rgba(255,244,214,0.96)] md:text-3xl">
                  Ranking da etapa
                </h3>
                <p className="mt-2 text-sm text-[rgba(236,225,196,0.7)]">
                  {selectedStageMatches.stageDateLabel}
                </p>
              </div>

              <button
                className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] text-lg font-semibold text-[rgba(255,244,214,0.8)] transition hover:bg-[rgba(255,255,255,0.05)]"
                onClick={() => setSelectedStageId(null)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="overflow-x-auto px-5 py-5 md:px-6 md:py-6">
              <table className="min-w-full border-collapse overflow-hidden rounded-[1.25rem] border border-[rgba(255,208,101,0.12)]">
                <thead>
                  <tr className="bg-[rgba(6,17,12,0.92)]">
                    <th className="border-b border-r border-[rgba(255,208,101,0.12)] px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(255,236,184,0.92)]">
                      Jogador
                    </th>
                    {selectedStageMatches.matches.map((match) => (
                      <th
                        key={match.matchNumber}
                        className="min-w-[140px] border-b border-r border-[rgba(255,208,101,0.12)] px-4 py-4 text-center"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-lg font-semibold text-[rgba(255,244,214,0.96)]">
                            {match.matchNumber}a
                          </span>
                          <span className="text-[0.72rem] uppercase tracking-[0.22em] text-[rgba(236,225,196,0.62)]">
                            {match.label}
                          </span>
                        </div>
                      </th>
                    ))}
                    <th className="min-w-[130px] border-b border-[rgba(255,208,101,0.12)] px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(255,236,184,0.92)]">
                      Total do dia
                    </th>
                  </tr>
                  <tr className="bg-[rgba(255,183,32,0.08)]">
                    <th className="border-b border-r border-[rgba(255,208,101,0.1)] px-4 py-3 text-left text-sm font-semibold text-[rgba(255,244,214,0.92)]">
                      Nome
                    </th>
                    {selectedStageMatches.matches.map((match) => (
                      <th
                        key={`${match.matchNumber}-points`}
                        className="border-b border-r border-[rgba(255,208,101,0.1)] px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.18em] text-[rgba(255,236,184,0.82)]"
                      >
                        Pontos
                      </th>
                    ))}
                    <th className="border-b border-[rgba(255,208,101,0.1)] px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.18em] text-[rgba(255,236,184,0.82)]">
                      Soma
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stageRanking.map((entry, index) => (
                    <tr
                      key={entry.playerId}
                      className={
                        index % 2 === 0
                          ? "bg-[rgba(11,37,27,0.82)]"
                          : "bg-[rgba(8,28,20,0.96)]"
                      }
                    >
                      <td className="border-b border-r border-[rgba(255,208,101,0.1)] px-4 py-3 text-left text-base font-medium text-[rgba(255,244,214,0.96)]">
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
                      {entry.matchPoints.map((points, matchIndex) => (
                        <td
                          key={`${entry.playerId}-${matchIndex}`}
                          className="border-b border-r border-[rgba(255,208,101,0.1)] px-4 py-3 text-center text-base text-[rgba(236,225,196,0.9)]"
                        >
                          {points}
                        </td>
                      ))}
                      <td className="border-b border-[rgba(255,208,101,0.1)] px-4 py-3 text-center text-lg font-semibold text-[rgba(255,236,184,0.96)]">
                        {entry.totalPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
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
