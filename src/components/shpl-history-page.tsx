"use client";

import { useMemo, useState } from "react";

import type { LeagueSnapshot } from "@/lib/domain/types";

export function SHPLHistoryPage({
  initialStageId,
  snapshot,
}: {
  initialStageId?: string;
  snapshot: LeagueSnapshot;
}) {
  const [selectedStageId, setSelectedStageId] = useState<string>(
    snapshot.stageHistoryDetails.some((stage) => stage.stageId === initialStageId)
      ? initialStageId ?? ""
      : snapshot.stageHistoryDetails[0]?.stageId ?? ""
  );

  const selectedStage = useMemo(
    () =>
      snapshot.stageHistoryDetails.find((stage) => stage.stageId === selectedStageId) ??
      snapshot.stageHistoryDetails[0] ??
      null,
    [selectedStageId, snapshot.stageHistoryDetails]
  );

  if (!selectedStage) {
    return (
      <section className="rounded-[1.8rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-6 shadow-[0_20px_45px_rgba(0,0,0,0.28)] md:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[rgba(255,244,214,0.96)]">
          Historico
        </h1>
        <p className="mt-4 text-sm leading-7 text-[rgba(236,225,196,0.74)]">
          Ainda nao existem etapas encerradas para exibir no historico.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[1.8rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.28)] md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[rgba(236,225,196,0.68)]">
          SHPL 2026
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[rgba(255,244,214,0.96)] md:text-4xl">
          Historico da etapa
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[rgba(236,225,196,0.74)]">
          Consulte as etapas encerradas e veja horarios, duracao total, duracao de cada partida e a classificacao completa de cada dia.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.stageHistoryDetails.map((stage, index) => {
            const isSelected = stage.stageId === selectedStage.stageId;

            return (
              <button
                key={stage.stageId}
                className={`rounded-[1.2rem] border px-4 py-4 text-left transition ${
                  isSelected
                    ? "border-[rgba(255,208,101,0.28)] bg-[rgba(255,183,32,0.1)]"
                    : "border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,208,101,0.18)] hover:bg-[rgba(255,255,255,0.05)]"
                }`}
                onClick={() => setSelectedStageId(stage.stageId)}
                type="button"
              >
                <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
                  {buildOrdinalLabel(index + 1)}
                </p>
                <p className="mt-2 text-lg font-semibold text-[rgba(255,244,214,0.96)]">
                  {stage.title}
                </p>
                <p className="mt-1 text-sm text-[rgba(236,225,196,0.68)]">{stage.stageDateLabel}</p>
                {stage.isTest ? (
                  <span className="mt-3 inline-flex rounded-full border border-[rgba(129,211,120,0.24)] bg-[rgba(129,211,120,0.12)] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[rgba(214,255,206,0.92)]">
                    Etapa de teste
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.28)] md:p-6">
        <div className="flex flex-col gap-4 border-b border-[rgba(255,208,101,0.1)] pb-5">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[rgba(236,225,196,0.68)]">
              {selectedStage.stageDateLabel}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[rgba(255,244,214,0.96)]">
              {selectedStage.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.74)]">
              Campeao do dia: {selectedStage.winnerName}
            </p>
            {selectedStage.isTest ? (
              <span className="mt-3 inline-flex rounded-full border border-[rgba(129,211,120,0.24)] bg-[rgba(129,211,120,0.12)] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[rgba(214,255,206,0.92)]">
                Etapa de teste salva so para consulta
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HistoryInfoCard label="Inicio programado" value={selectedStage.scheduledStartLabel} />
            <HistoryInfoCard label="Inicio real" value={selectedStage.actualStartLabel} />
            <HistoryInfoCard label="Fim real" value={selectedStage.actualEndLabel} />
            <HistoryInfoCard
              label="Duracao total"
              value={formatDuration(selectedStage.totalDurationSeconds)}
            />
            <HistoryInfoCard label="Premio do dia" value={selectedStage.dailyPrize} />
            <HistoryInfoCard
              label={selectedStage.isTest ? "Pote anual" : "Pote anual gerado"}
              value={selectedStage.isTest ? "Nao contabilizado" : selectedStage.annualPotContribution}
            />
            <HistoryInfoCard
              label="Partidas jogadas"
              value={String(selectedStage.matchesPlayed)}
            />
            <HistoryInfoCard
              label="Campeao da etapa"
              value={selectedStage.winnerName}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1.35rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4 md:p-5">
            <h3 className="text-2xl font-semibold text-[rgba(255,220,143,0.98)]">
              Classificacao final da etapa
            </h3>

            <div className="mt-4 overflow-x-auto rounded-[1.1rem] border border-[rgba(255,208,101,0.1)]">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-[rgba(6,17,12,0.92)]">
                    <th className="border-b border-r border-[rgba(255,208,101,0.1)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(255,236,184,0.92)]">
                      Posicao
                    </th>
                    <th className="border-b border-r border-[rgba(255,208,101,0.1)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(255,236,184,0.92)]">
                      Jogador
                    </th>
                    <th className="border-b border-[rgba(255,208,101,0.1)] px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(255,236,184,0.92)]">
                      Total do dia
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStage.finalRanking.map((entry, index) => (
                    <tr
                      key={entry.playerId}
                      className={
                        index % 2 === 0
                          ? "bg-[rgba(11,37,27,0.82)]"
                          : "bg-[rgba(8,28,20,0.96)]"
                      }
                    >
                      <td className="border-b border-r border-[rgba(255,208,101,0.1)] px-4 py-3 text-base font-semibold text-[rgba(255,236,184,0.96)]">
                        {entry.position}o
                      </td>
                      <td className="border-b border-r border-[rgba(255,208,101,0.1)] px-4 py-3 text-base text-[rgba(255,244,214,0.96)]">
                        {entry.playerName}
                      </td>
                      <td className="border-b border-[rgba(255,208,101,0.1)] px-4 py-3 text-center text-base font-semibold text-[rgba(255,236,184,0.96)]">
                        {entry.totalPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4 md:p-5">
            <h3 className="text-2xl font-semibold text-[rgba(255,220,143,0.98)]">
              Partidas da etapa
            </h3>

            <div className="mt-4 grid gap-3">
              {selectedStage.matches.map((match) => (
                <div
                  key={match.matchNumber}
                  className="rounded-[1.1rem] border border-[rgba(255,208,101,0.1)] bg-[rgba(7,24,18,0.56)] p-4"
                >
                  <div className="flex flex-col gap-2 border-b border-[rgba(255,208,101,0.08)] pb-3">
                    <p className="text-lg font-semibold text-[rgba(255,244,214,0.96)]">
                      {match.label}
                    </p>
                    <div className="grid gap-2 text-sm text-[rgba(236,225,196,0.7)]">
                      <span>Duracao: {formatDuration(match.durationSeconds)}</span>
                    </div>
                  </div>

                  <div className="mt-3 overflow-x-auto rounded-[1rem] border border-[rgba(255,208,101,0.08)]">
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr className="bg-[rgba(5,17,12,0.92)]">
                          <th className="border-b border-r border-[rgba(255,208,101,0.08)] px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(255,236,184,0.92)]">
                            Posicao
                          </th>
                          <th className="border-b border-r border-[rgba(255,208,101,0.08)] px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(255,236,184,0.92)]">
                            Jogador
                          </th>
                          <th className="border-b border-[rgba(255,208,101,0.08)] px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(255,236,184,0.92)]">
                            Pontos
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {match.ranking.map((entry, index) => (
                          <tr
                            key={`${match.matchNumber}-${entry.playerId}`}
                            className={
                              index % 2 === 0
                                ? "bg-[rgba(11,37,27,0.78)]"
                                : "bg-[rgba(8,28,20,0.92)]"
                            }
                          >
                            <td className="border-b border-r border-[rgba(255,208,101,0.08)] px-3 py-3 text-sm font-semibold text-[rgba(255,236,184,0.96)]">
                              {entry.position}o
                            </td>
                            <td className="border-b border-r border-[rgba(255,208,101,0.08)] px-3 py-3 text-sm text-[rgba(255,244,214,0.96)]">
                              {entry.playerName}
                            </td>
                            <td className="border-b border-[rgba(255,208,101,0.08)] px-3 py-3 text-center text-sm font-semibold text-[rgba(255,236,184,0.96)]">
                              {entry.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function HistoryInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-[rgba(255,244,214,0.96)]">{value}</p>
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function buildOrdinalLabel(index: number) {
  const labels: Record<number, string> = {
    1: "Primeira etapa",
    2: "Segunda etapa",
    3: "Terceira etapa",
    4: "Quarta etapa",
    5: "Quinta etapa",
    6: "Sexta etapa",
    7: "Setima etapa",
    8: "Oitava etapa",
  };

  return labels[index] ?? `${index}a etapa`;
}
