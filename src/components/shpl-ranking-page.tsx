"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { SHPLAnnualClassification } from "@/components/shpl-annual-classification";
import { PlayerAvatar } from "@/components/player-avatar";
import { buildStagePointsSummary, compareStageRanking } from "@/lib/domain/rules";
import type { LeagueSnapshot } from "@/lib/domain/types";

export function SHPLRankingPage({
  canEditStageRanking,
  snapshot,
  initialStageId,
}: {
  canEditStageRanking: boolean;
  snapshot: LeagueSnapshot;
  initialStageId?: string | null;
}) {
  const router = useRouter();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(initialStageId ?? null);
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [manualMatchNumber, setManualMatchNumber] = useState(1);
  const [manualPlacementDraft, setManualPlacementDraft] = useState<Record<string, string>>({});
  const [rankingNotice, setRankingNotice] = useState<string | null>(null);
  const [isSavingManualAdjustment, setIsSavingManualAdjustment] = useState(false);

  const selectedStageMatches = useMemo(
    () =>
      snapshot.stageMatchPoints.find((stage) => stage.stageId === selectedStageId) ?? null,
    [selectedStageId, snapshot.stageMatchPoints]
  );
  const selectedStageHistoryDetail = useMemo(
    () =>
      snapshot.stageHistoryDetails.find((stage) => stage.stageId === selectedStageId) ?? null,
    [selectedStageId, snapshot.stageHistoryDetails]
  );

  useEffect(() => {
    setShowManualEditor(false);
    setRankingNotice(null);
    setManualMatchNumber(selectedStageMatches?.matches[0]?.matchNumber ?? 1);
  }, [selectedStageId, selectedStageMatches]);

  useEffect(() => {
    if (!selectedStageMatches) {
      setManualPlacementDraft({});
      return;
    }

    setManualPlacementDraft(buildManualDraftForMatch(selectedStageMatches, manualMatchNumber));
  }, [manualMatchNumber, selectedStageMatches]);

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
          wins: selectedStageMatches.matches.filter(
            (match) => (match.pointsByPlayer[entry.playerId] ?? 0) === 10
          ).length,
          secondPlaces: selectedStageMatches.matches.filter(
            (match) => (match.pointsByPlayer[entry.playerId] ?? 0) === 8
          ).length,
          thirdPlaces: selectedStageMatches.matches.filter(
            (match) => (match.pointsByPlayer[entry.playerId] ?? 0) === 6
          ).length,
          totalPoints,
        };
      })
      .sort((left, right) =>
        compareStageRanking(
          {
            playerId: left.playerId,
            playerName: left.playerName,
            position: 0,
            points: left.totalPoints,
            wins: left.wins,
            secondPlaces: left.secondPlaces,
            thirdPlaces: left.thirdPlaces,
            tiebreakSummary: "",
          },
          {
            playerId: right.playerId,
            playerName: right.playerName,
            position: 0,
            points: right.totalPoints,
            wins: right.wins,
            secondPlaces: right.secondPlaces,
            thirdPlaces: right.thirdPlaces,
            tiebreakSummary: "",
          }
        )
      )
      .map((entry, index) => ({
        ...entry,
        position: index + 1,
      }));
  }, [selectedStageMatches, snapshot.annualRanking]);

  function handleManualPlacementChange(playerId: string, nextValue: string) {
    setManualPlacementDraft((currentDraft) => ({
      ...currentDraft,
      [playerId]: nextValue,
    }));
  }

  async function handleSaveManualAdjustment() {
    if (!selectedStageMatches) {
      return;
    }

    const rankedSelections = stageRanking
      .map((player) => ({
        playerId: player.playerId,
        playerName: player.playerName,
        rawValue: manualPlacementDraft[player.playerId] ?? "",
      }))
      .filter((player) => player.rawValue !== "");

    if (rankedSelections.length === 0) {
      setRankingNotice("Defina pelo menos uma colocacao para salvar o ajuste manual.");
      return;
    }

    const usedPlacements = new Set<number>();

    for (const selection of rankedSelections) {
      const parsedPlacement = Number.parseInt(selection.rawValue, 10);

      if (!Number.isFinite(parsedPlacement) || parsedPlacement <= 0) {
        setRankingNotice(`A colocacao informada para ${selection.playerName} nao e valida.`);
        return;
      }

      if (usedPlacements.has(parsedPlacement)) {
        setRankingNotice("As colocacoes da partida nao podem se repetir.");
        return;
      }

      usedPlacements.add(parsedPlacement);
    }

    const orderedPlacements = [...usedPlacements].sort((left, right) => left - right);

    if (orderedPlacements.some((placement, index) => placement !== index + 1)) {
      setRankingNotice(
        "As colocacoes precisam ser continuas, comecando em 1o lugar e seguindo sem pular posicoes."
      );
      return;
    }

    setIsSavingManualAdjustment(true);

    try {
      const response = await fetch("/api/shpl-admin/stage-ranking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stageId: selectedStageMatches.stageId,
          matchNumber: manualMatchNumber,
          placementsByPlayerId: Object.fromEntries(
            stageRanking.map((player) => [
              player.playerId,
              manualPlacementDraft[player.playerId]
                ? Number.parseInt(manualPlacementDraft[player.playerId], 10)
                : null,
            ])
          ),
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel salvar o ajuste manual.");
      }

      setRankingNotice("Ajuste manual salvo com sucesso.");
      router.refresh();
    } catch (error) {
      setRankingNotice(
        error instanceof Error ? error.message : "Nao foi possivel salvar o ajuste manual."
      );
    } finally {
      setIsSavingManualAdjustment(false);
    }
  }

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
                {selectedStageHistoryDetail?.isTest ? (
                  <span className="mt-3 inline-flex rounded-full border border-[rgba(129,211,120,0.24)] bg-[rgba(129,211,120,0.12)] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[rgba(214,255,206,0.92)]">
                    Etapa de teste
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                {canEditStageRanking ? (
                  <button
                    className="rounded-[0.95rem] border border-[rgba(129,196,255,0.22)] bg-[rgba(129,196,255,0.12)] px-4 py-2 text-sm font-semibold text-[rgba(220,239,255,0.96)] transition hover:bg-[rgba(129,196,255,0.18)]"
                    onClick={() => setShowManualEditor((currentValue) => !currentValue)}
                    type="button"
                  >
                    {showManualEditor ? "Fechar ajuste manual" : "Ajustar manualmente"}
                  </button>
                ) : null}

                <button
                  className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] text-lg font-semibold text-[rgba(255,244,214,0.8)] transition hover:bg-[rgba(255,255,255,0.05)]"
                  onClick={() => setSelectedStageId(null)}
                  type="button"
                >
                  x
                </button>
              </div>
            </div>

            {showManualEditor && canEditStageRanking ? (
              <div className="border-b border-[rgba(129,196,255,0.12)] bg-[rgba(129,196,255,0.06)] px-5 py-5 md:px-6">
                <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="grid gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[rgba(202,230,255,0.56)]">
                        Correcao administrativa
                      </p>
                      <h4 className="mt-2 text-lg font-semibold text-[rgba(232,244,255,0.96)]">
                        Ajustar classificacao da partida
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-[rgba(202,230,255,0.76)]">
                        Se o sistema registrar uma colocacao errada, voce pode corrigir manualmente a partida sem mexer no resto da etapa.
                      </p>
                    </div>

                    <label className="grid gap-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-[rgba(202,230,255,0.56)]">
                        Partida
                      </span>
                      <select
                        className="h-11 rounded-[0.95rem] border border-[rgba(129,196,255,0.16)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(232,244,255,0.96)] outline-none"
                        onChange={(event) =>
                          setManualMatchNumber(Number.parseInt(event.target.value, 10) || 1)
                        }
                        value={String(manualMatchNumber)}
                      >
                        {selectedStageMatches.matches.map((match) => (
                          <option key={`manual-stage-match-${match.matchNumber}`} value={match.matchNumber}>
                            {match.matchNumber}a partida
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      className="h-11 rounded-[0.95rem] border border-[rgba(129,196,255,0.22)] bg-[rgba(129,196,255,0.12)] px-4 text-sm font-semibold text-[rgba(232,244,255,0.96)] transition hover:bg-[rgba(129,196,255,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isSavingManualAdjustment}
                      onClick={handleSaveManualAdjustment}
                      type="button"
                    >
                      {isSavingManualAdjustment ? "Salvando ajuste..." : "Salvar ajuste manual"}
                    </button>

                    {rankingNotice ? (
                      <div className="rounded-[0.95rem] border border-[rgba(129,196,255,0.14)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgba(232,244,255,0.92)]">
                        {rankingNotice}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {stageRanking.map((player) => (
                      <label
                        key={`manual-ranking-${player.playerId}`}
                        className="grid gap-2 rounded-[0.95rem] border border-[rgba(129,196,255,0.12)] bg-[rgba(255,255,255,0.02)] px-3 py-3"
                      >
                        <span className="text-sm font-semibold text-[rgba(232,244,255,0.96)]">
                          {player.playerName}
                        </span>
                        <select
                          className="h-11 rounded-[0.9rem] border border-[rgba(129,196,255,0.16)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(232,244,255,0.96)] outline-none"
                          onChange={(event) =>
                            handleManualPlacementChange(player.playerId, event.target.value)
                          }
                          value={manualPlacementDraft[player.playerId] ?? ""}
                        >
                          <option value="">Nao participou</option>
                          {stageRanking.map((_, placementIndex) => {
                            const placement = placementIndex + 1;
                            return (
                              <option
                                key={`${player.playerId}-ranking-placement-${placement}`}
                                value={placement}
                              >
                                {buildPlacementLabel(placement)}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

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
                      Vitorias / Pontos
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
                      <td className="border-b border-[rgba(255,208,101,0.1)] px-4 py-3 text-center text-base font-semibold text-[rgba(255,236,184,0.96)]">
                        {buildStagePointsSummary(entry.wins, entry.totalPoints)}
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

function buildManualDraftForMatch(
  stageMatches: LeagueSnapshot["stageMatchPoints"][number],
  matchNumber: number
) {
  const selectedMatch = stageMatches.matches.find((match) => match.matchNumber === matchNumber);

  if (!selectedMatch) {
    return {};
  }

  const draft = Object.fromEntries(
    Object.keys(selectedMatch.pointsByPlayer).map((playerId) => [playerId, ""])
  );
  const rankedEntries = Object.entries(selectedMatch.pointsByPlayer)
    .filter(([, points]) => points > 0)
    .sort((left, right) => right[1] - left[1]);

  rankedEntries.forEach(([playerId], index) => {
    draft[playerId] = String(index + 1);
  });

  return draft;
}

function buildPlacementLabel(placement: number) {
  return `${placement}o lugar`;
}
