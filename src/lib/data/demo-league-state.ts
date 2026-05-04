import { readFile } from "node:fs/promises";
import path from "node:path";

import { getDemoUserPhotoMap } from "@/lib/auth/demo-users";
import { getStoredPlayers, getStoredStages, saveStoredStage } from "@/lib/data/demo-admin-store";
import { createMockSnapshot } from "@/lib/data/mock";
import {
  readServerJsonDocument,
  writeServerJsonDocument,
} from "@/lib/data/server-json-store";
import { calculateMatchPoints, formatCurrency } from "@/lib/domain/rules";
import type {
  AnnualStagePoints,
  HistoryStageSummary,
  LeagueSnapshot,
  RankingEntry,
  Stage,
  StageHistoryDetail,
  StageHistoryFinalRankingEntry,
  StageHistoryMatchDetail,
  StageMatchPoints,
} from "@/lib/domain/types";

type StoredAnnualRankingStats = {
  playerId: string;
  points: number;
  wins: number;
  secondPlaces: number;
  thirdPlaces: number;
};

type DemoLeagueStateData = {
  annualRankingStats: StoredAnnualRankingStats[];
  annualStagePoints: AnnualStagePoints[];
  stageMatchPoints: StageMatchPoints[];
  history: HistoryStageSummary[];
  stageHistoryDetails: StageHistoryDetail[];
  annualPotCents: number;
};

export type FinalizeStagePlayerPayload = {
  playerId: string;
  playerName: string;
  annualPaid: boolean;
  dailyPaid: boolean;
  leftStage: boolean;
  matchPoints: number[];
};

export type FinalizeStageInput = {
  stageId: string;
  actualStageStartedAt: string | null;
  closedAt: string;
  completedMatchDurations: number[];
  players: FinalizeStagePlayerPayload[];
  buyInAnnual: number;
  buyInDaily: number;
};

export type UpdateStageMatchPlacementsInput = {
  stageId: string;
  matchNumber: number;
  placementsByPlayerId: Record<string, number | null>;
};

const stateDocumentName = "demo-league-state.json";

function buildDefaultState(): DemoLeagueStateData {
  const snapshot = createMockSnapshot();

  return {
    annualRankingStats: snapshot.annualRanking.map((entry) => ({
      playerId: entry.playerId,
      points: entry.points,
      wins: entry.wins,
      secondPlaces: entry.secondPlaces,
      thirdPlaces: entry.thirdPlaces,
    })),
    annualStagePoints: snapshot.annualStagePoints,
    stageMatchPoints: snapshot.stageMatchPoints,
    history: snapshot.history,
    stageHistoryDetails: snapshot.stageHistoryDetails,
    annualPotCents: parseCurrencyToCents(snapshot.financialSummary.annualPot),
  };
}

async function readState() {
  const parsed = await readServerJsonDocument(stateDocumentName, buildDefaultState);
  const bundledSeed = await readBundledLeagueStateSeed();
  const mergedState = mergeLeagueStates(parsed, bundledSeed);

  if (JSON.stringify(mergedState) !== JSON.stringify(parsed)) {
    await writeServerJsonDocument(stateDocumentName, mergedState);
  }

  return mergedState;
}

async function writeState(data: DemoLeagueStateData) {
  await writeServerJsonDocument(stateDocumentName, data);
}

export async function getDemoLeagueSnapshot(): Promise<LeagueSnapshot> {
  const baseSnapshot = createMockSnapshot();
  const [state, storedPlayers, storedStages] = await Promise.all([
    readState(),
    getStoredPlayers(),
    getStoredStages(),
  ]);
  const photoByPlayerId = await buildPlayerPhotoMap(storedPlayers);

  const playerIds = storedPlayers.map((player) => player.id);
  const annualRanking = buildAnnualRanking(
    storedPlayers.map((player) => ({
      id: player.id,
      name: player.nickname || player.fullName,
      photoDataUrl: photoByPlayerId.get(player.id) ?? "",
    })),
    state.annualRankingStats
  );
  const annualStagePoints = sortAnnualStagePointsByDate(
    state.annualStagePoints.map((stage) => withAllPlayersAnnualPoints(stage, playerIds)),
    storedStages
  );
  const stageMatchPoints = sortStageMatchPointsByDate(
    state.stageMatchPoints.map((stage) => withAllPlayersMatchPoints(stage, playerIds)),
    storedStages
  );
  const finishedStageIds = new Set(state.history.map((stage) => stage.id));
  const remainingStages = storedStages
    .filter((stage) => !finishedStageIds.has(stage.id))
    .sort((left, right) => left.stageDate.localeCompare(right.stageDate));
  const currentStageSource = remainingStages[0] ?? storedStages[storedStages.length - 1] ?? null;
  const currentStage =
    currentStageSource !== null
      ? toSnapshotStage(currentStageSource, {
          eligiblePlayers: storedPlayers.filter((player) => player.active).length,
          matchesPlayed:
            stageMatchPoints.find((stage) => stage.stageId === currentStageSource.id)?.matches.length ??
            0,
        })
      : baseSnapshot.currentStage;
  const upcomingStages = remainingStages.slice(1).map((stage) =>
    toSnapshotStage(stage, {
      eligiblePlayers: storedPlayers.filter((player) => player.active).length,
      matchesPlayed: stageMatchPoints.find((entry) => entry.stageId === stage.id)?.matches.length ?? 0,
    })
  );

  const neutralRanking = annualRanking.map((entry, index) => ({
    ...entry,
    position: index + 1,
    points: 0,
    wins: 0,
    secondPlaces: 0,
    thirdPlaces: 0,
    tiebreakSummary: "Sem partidas",
  }));

  return {
    ...baseSnapshot,
    currentStage,
    upcomingStages,
    annualRanking,
    annualStagePoints,
    stageMatchPoints,
    history: sortHistoryByDate(state.history, storedStages),
    stageHistoryDetails: enrichStageHistoryDetailsWithPhotos(
      sortStageHistoryByDate(state.stageHistoryDetails, storedStages),
      photoByPlayerId
    ),
    stagePlayers: annualRanking.map((entry) => ({
      playerId: entry.playerId,
      playerName: entry.playerName,
      photoDataUrl: entry.photoDataUrl,
      paidAnnual: false,
      paidDaily: false,
      dayPoints: 0,
      inCurrentMatch: false,
      visualStatus: "neutral",
      statusLabel: "Aguardando confirmacao de buy-in",
      availableActions: ["Buy-in anual", "Buy-in geral"],
    })),
    dayRanking: neutralRanking,
    financialSummary: {
      dailyPrizePool: formatCurrency(0),
      annualPot: formatCurrency(state.annualPotCents / 100),
      dailyPaidPlayers: 0,
      annualPaidPlayers: 0,
    },
    liveMatch: {
      id: `${currentStage.id}-match-1`,
      stageId: currentStage.id,
      matchNumber: 1,
      status: "pending",
      participantIds: [],
      results: [],
    },
  };
}

export async function finalizeStage(input: FinalizeStageInput) {
  const [state, storedPlayers, storedStages] = await Promise.all([
    readState(),
    getStoredPlayers(),
    getStoredStages(),
  ]);
  const stage = storedStages.find((entry) => entry.id === input.stageId);

  if (!stage) {
    throw new Error("Etapa nao encontrada para encerramento.");
  }

  if (state.history.some((entry) => entry.id === input.stageId)) {
    throw new Error("Essa etapa ja foi encerrada anteriormente.");
  }

  const players = storedPlayers.map((player) => ({
    id: player.id,
    name: player.nickname || player.fullName,
  }));
  const playerNameById = new Map(players.map((player) => [player.id, player.name]));
  const matchCount = Math.max(
    input.completedMatchDurations.length,
    ...input.players.map((player) => player.matchPoints.length),
    0
  );

  if (matchCount <= 0) {
    throw new Error("Nao existem partidas concluidas para encerrar a etapa.");
  }

  const stageMatchRecord: StageMatchPoints = {
    stageId: stage.id,
    stageTitle: stage.title,
    stageDateLabel: formatStageDateLabel(stage.stageDate),
    stageDateShortLabel: formatStageShortLabel(stage.stageDate),
    matches: Array.from({ length: matchCount }, (_, index) => ({
      matchNumber: index + 1,
      label: buildMatchLabel(index + 1),
      pointsByPlayer: Object.fromEntries(
        players.map((player) => {
          const stagePlayer = input.players.find((entry) => entry.playerId === player.id);
          return [player.id, stagePlayer?.matchPoints[index] ?? 0];
        })
      ),
    })),
  };

  const finalRanking = buildFinalRanking(input.players, playerNameById);
  const annualStageRecord: AnnualStagePoints = {
    stageId: stage.id,
    stageTitle: stage.title,
    stageDateLabel: formatStageDateLabel(stage.stageDate),
    stageDateShortLabel: formatStageShortLabel(stage.stageDate),
    pointsByPlayer: Object.fromEntries(
      players.map((player) => {
        const stagePlayer = input.players.find((entry) => entry.playerId === player.id);
        const rankingEntry = finalRanking.find((entry) => entry.playerId === player.id);

        if (!stagePlayer?.dailyPaid || !rankingEntry) {
          return [player.id, 0];
        }

        return [player.id, calculateAnnualPoints(rankingEntry.position, stagePlayer.leftStage)];
      })
    ),
  };

  const statsMap = new Map(state.annualRankingStats.map((entry) => [entry.playerId, entry]));
  const nextStats = players.map((player) => {
    const currentStats = statsMap.get(player.id);
    const stagePlayer = input.players.find((entry) => entry.playerId === player.id);
    const rankingEntry = finalRanking.find((entry) => entry.playerId === player.id);

    return {
      playerId: player.id,
      points: (currentStats?.points ?? 0) + (annualStageRecord.pointsByPlayer[player.id] ?? 0),
      wins:
        (currentStats?.wins ?? 0) +
        (rankingEntry?.position === 1 && stagePlayer?.dailyPaid && !stagePlayer.leftStage ? 1 : 0),
      secondPlaces:
        (currentStats?.secondPlaces ?? 0) +
        (rankingEntry?.position === 2 && stagePlayer?.dailyPaid && !stagePlayer.leftStage ? 1 : 0),
      thirdPlaces:
        (currentStats?.thirdPlaces ?? 0) +
        (rankingEntry?.position === 3 && stagePlayer?.dailyPaid && !stagePlayer.leftStage ? 1 : 0),
    };
  });

  const annualContributionCents =
    Math.max(input.buyInAnnual, 0) *
    input.players.filter((player) => player.annualPaid).length *
    100;
  const dailyPrizeCents =
    Math.max(input.buyInDaily, 0) *
    input.players.filter((player) => player.dailyPaid).length *
    100;
  const effectiveAnnualContributionCents = stage.isTest ? 0 : annualContributionCents;
  const actualEnd = new Date(input.closedAt);
  const actualStart =
    input.actualStageStartedAt !== null ? new Date(input.actualStageStartedAt) : null;
  const totalDurationSeconds = actualStart
    ? Math.max(Math.round((actualEnd.getTime() - actualStart.getTime()) / 1000), 0)
    : input.completedMatchDurations.reduce((total, value) => total + value, 0);
  const historyDetail = buildStageHistoryDetail({
    stage,
    actualStart,
    actualEnd,
    completedMatchDurations: input.completedMatchDurations,
    stageMatchRecord,
    finalRanking,
    totalDurationSeconds,
    playerNameById,
    dailyPrizeCents,
    annualContributionCents: effectiveAnnualContributionCents,
  });
  const historySummary: HistoryStageSummary = {
    id: stage.id,
    title: stage.title,
    stageDateLabel: formatStageDateLabel(stage.stageDate),
    winnerName: finalRanking[0]?.playerName ?? "-",
    matchesPlayed: stageMatchRecord.matches.length,
    dailyPrize: formatCurrency(dailyPrizeCents / 100),
    annualPotContribution: formatCurrency(effectiveAnnualContributionCents / 100),
    isTest: stage.isTest ?? false,
  };
  const historyDetailWithStageType: StageHistoryDetail = {
    ...historyDetail,
    isTest: stage.isTest ?? false,
  };

  if (stage.isTest) {
    await writeState({
      annualRankingStats: state.annualRankingStats,
      annualStagePoints: state.annualStagePoints,
      stageMatchPoints: state.stageMatchPoints,
      history: sortHistoryByDate([...state.history, historySummary], storedStages),
      stageHistoryDetails: sortStageHistoryByDate(
        [...state.stageHistoryDetails, historyDetailWithStageType],
        storedStages
      ),
      annualPotCents: state.annualPotCents,
    });

    await saveStoredStage({
      id: stage.id,
      title: stage.title,
      stageDate: stage.stageDate,
      status: "finished",
      scheduledStartTime: stage.scheduledStartTime,
      isTest: true,
    });

    return {
      historySummary,
      historyDetail: historyDetailWithStageType,
      isTestStage: true,
    };
  }

  await writeState({
    annualRankingStats: nextStats,
    annualStagePoints: sortAnnualStagePointsByDate(
      [...state.annualStagePoints, annualStageRecord],
      storedStages
    ),
    stageMatchPoints: sortStageMatchPointsByDate(
      [...state.stageMatchPoints, stageMatchRecord],
      storedStages
    ),
    history: sortHistoryByDate([...state.history, historySummary], storedStages),
    stageHistoryDetails: sortStageHistoryByDate(
      [...state.stageHistoryDetails, historyDetailWithStageType],
      storedStages
    ),
    annualPotCents: state.annualPotCents + annualContributionCents,
  });

  await saveStoredStage({
    id: stage.id,
    title: stage.title,
    stageDate: stage.stageDate,
    status: "finished",
    scheduledStartTime: stage.scheduledStartTime,
    isTest: stage.isTest ?? false,
  });

  return {
    historySummary,
    historyDetail: historyDetailWithStageType,
    isTestStage: false,
  };
}

export async function updateStageMatchPlacements(input: UpdateStageMatchPlacementsInput) {
  const [state, storedPlayers, storedStages] = await Promise.all([
    readState(),
    getStoredPlayers(),
    getStoredStages(),
  ]);
  const stageRecord = state.stageMatchPoints.find((stage) => stage.stageId === input.stageId);
  const stageHistoryDetail = state.stageHistoryDetails.find((stage) => stage.stageId === input.stageId);
  const historySummary = state.history.find((stage) => stage.id === input.stageId);
  const storedStage = storedStages.find((stage) => stage.id === input.stageId);

  if (!stageRecord || !stageHistoryDetail || !historySummary || !storedStage) {
    throw new Error("Nao foi possivel localizar a etapa finalizada para ajuste manual.");
  }

  const targetMatch = stageRecord.matches.find((match) => match.matchNumber === input.matchNumber);

  if (!targetMatch) {
    throw new Error("A partida informada nao existe nessa etapa.");
  }

  const normalizedPlacements = Object.entries(input.placementsByPlayerId)
    .filter(([, placement]) => typeof placement === "number" && Number.isFinite(placement) && (placement ?? 0) > 0)
    .map(([playerId, placement]) => ({
      playerId,
      placement: Number(placement),
    }));

  if (normalizedPlacements.length === 0) {
    throw new Error("Informe pelo menos uma colocacao para aplicar o ajuste manual.");
  }

  const usedPlacements = new Set<number>();

  for (const selection of normalizedPlacements) {
    if (usedPlacements.has(selection.placement)) {
      throw new Error("As colocacoes da partida nao podem se repetir.");
    }

    usedPlacements.add(selection.placement);
  }

  const orderedPlacements = [...usedPlacements].sort((left, right) => left - right);

  if (orderedPlacements.some((placement, index) => placement !== index + 1)) {
    throw new Error(
      "As colocacoes precisam ser continuas, comecando no 1o lugar e seguindo sem pular posicoes."
    );
  }

  const playerIds = Array.from(
    new Set([
      ...storedPlayers.map((player) => player.id),
      ...Object.keys(targetMatch.pointsByPlayer),
      ...Object.keys(input.placementsByPlayerId),
    ])
  );
  const placementsByPlayerId = new Map(normalizedPlacements.map((entry) => [entry.playerId, entry.placement]));
  const updatedStageMatchRecord: StageMatchPoints = {
    ...stageRecord,
    matches: stageRecord.matches.map((match) => {
      if (match.matchNumber !== input.matchNumber) {
        return match;
      }

      return {
        ...match,
        pointsByPlayer: Object.fromEntries(
          playerIds.map((playerId) => {
            const placement = placementsByPlayerId.get(playerId);
            return [playerId, placement ? calculateMatchPoints(placement) : 0];
          })
        ),
      };
    }),
  };
  const playerNameById = new Map(
    storedPlayers.map((player) => [player.id, player.nickname || player.fullName])
  );
  const updatedFinalRanking = buildFinalRankingFromStageMatchRecord(updatedStageMatchRecord, playerNameById);
  const updatedStageHistoryDetail: StageHistoryDetail = {
    ...stageHistoryDetail,
    winnerName: updatedFinalRanking[0]?.playerName ?? "-",
    matchesPlayed: updatedStageMatchRecord.matches.length,
    finalRanking: updatedFinalRanking,
    matches: stageHistoryDetail.matches.map((match) => {
      const updatedMatch = updatedStageMatchRecord.matches.find(
        (entry) => entry.matchNumber === match.matchNumber
      );

      if (!updatedMatch) {
        return match;
      }

      return {
        ...match,
        ranking: buildMatchRanking(updatedMatch.pointsByPlayer, playerNameById),
      };
    }),
  };
  const updatedHistorySummary: HistoryStageSummary = {
    ...historySummary,
    winnerName: updatedFinalRanking[0]?.playerName ?? "-",
    matchesPlayed: updatedStageMatchRecord.matches.length,
  };
  const updatedAnnualStagePoints = storedStage.isTest
    ? state.annualStagePoints
    : state.annualStagePoints.map((stage) => {
        if (stage.stageId !== input.stageId) {
          return stage;
        }

        const previousPointsByPlayer = stage.pointsByPlayer;
        return {
          ...stage,
          pointsByPlayer: Object.fromEntries(
            playerIds.map((playerId) => {
              const previousPoints = previousPointsByPlayer[playerId] ?? 0;
              const rankingEntry = updatedFinalRanking.find((entry) => entry.playerId === playerId);

              if (!rankingEntry) {
                return [playerId, 0];
              }

              if (previousPoints === 1) {
                return [playerId, 1];
              }

              return [playerId, calculateAnnualPoints(rankingEntry.position, false)];
            })
          ),
        };
      });
  const updatedStageHistoryDetails = sortStageHistoryByDate(
    state.stageHistoryDetails.map((stage) =>
      stage.stageId === input.stageId ? updatedStageHistoryDetail : stage
    ),
    storedStages
  );
  const updatedHistory = sortHistoryByDate(
    state.history.map((stage) => (stage.id === input.stageId ? updatedHistorySummary : stage)),
    storedStages
  );
  const updatedStageMatchPoints = sortStageMatchPointsByDate(
    state.stageMatchPoints.map((stage) =>
      stage.stageId === input.stageId ? updatedStageMatchRecord : stage
    ),
    storedStages
  );
  const updatedAnnualRankingStats = storedStage.isTest
    ? state.annualRankingStats
    : rebuildAnnualRankingStats(storedPlayers, updatedAnnualStagePoints, updatedStageHistoryDetails);

  await writeState({
    annualRankingStats: updatedAnnualRankingStats,
    annualStagePoints: updatedAnnualStagePoints,
    stageMatchPoints: updatedStageMatchPoints,
    history: updatedHistory,
    stageHistoryDetails: updatedStageHistoryDetails,
    annualPotCents: state.annualPotCents,
  });

  return {
    stageHistoryDetail: updatedStageHistoryDetail,
    stageMatchRecord: updatedStageMatchRecord,
  };
}

function buildAnnualRanking(
  players: Array<{ id: string; name: string; photoDataUrl?: string }>,
  annualStats: StoredAnnualRankingStats[]
) {
  const statsMap = new Map(annualStats.map((entry) => [entry.playerId, entry]));

  return players
    .map((player) => {
      const stats = statsMap.get(player.id);

        return {
          playerId: player.id,
          playerName: player.name,
          photoDataUrl: player.photoDataUrl ?? "",
          position: 0,
          points: stats?.points ?? 0,
        wins: stats?.wins ?? 0,
        secondPlaces: stats?.secondPlaces ?? 0,
        thirdPlaces: stats?.thirdPlaces ?? 0,
        tiebreakSummary: `${stats?.wins ?? 0} vitorias • ${stats?.secondPlaces ?? 0} segundos • ${stats?.thirdPlaces ?? 0} terceiros`,
      };
    })
    .sort(compareRankingEntries)
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
}

async function buildPlayerPhotoMap(
  storedPlayers: Awaited<ReturnType<typeof getStoredPlayers>>
) {
  const photoByEmail = await getDemoUserPhotoMap();

  return new Map(
    storedPlayers.map((player) => [
      player.id,
      player.email ? (photoByEmail.get(player.email.trim().toLowerCase()) ?? "") : "",
    ])
  );
}

function enrichStageHistoryDetailsWithPhotos(
  stageHistoryDetails: StageHistoryDetail[],
  photoByPlayerId: Map<string, string>
) {
  return stageHistoryDetails.map((stage) => ({
    ...stage,
    finalRanking: stage.finalRanking.map((entry) => ({
      ...entry,
      photoDataUrl: photoByPlayerId.get(entry.playerId) ?? "",
    })),
    matches: stage.matches.map((match) => ({
      ...match,
      ranking: match.ranking.map((entry) => ({
        ...entry,
        photoDataUrl: photoByPlayerId.get(entry.playerId) ?? "",
      })),
    })),
  }));
}

function withAllPlayersAnnualPoints(stage: AnnualStagePoints, playerIds: string[]) {
  return {
    ...stage,
    pointsByPlayer: Object.fromEntries(
      playerIds.map((playerId) => [playerId, stage.pointsByPlayer[playerId] ?? 0])
    ),
  };
}

function withAllPlayersMatchPoints(stage: StageMatchPoints, playerIds: string[]) {
  return {
    ...stage,
    matches: stage.matches.map((match) => ({
      ...match,
      pointsByPlayer: Object.fromEntries(
        playerIds.map((playerId) => [playerId, match.pointsByPlayer[playerId] ?? 0])
      ),
    })),
  };
}

function toSnapshotStage(
  stage: {
    id: string;
    title: string;
    stageDate: string;
    status: Stage["status"];
    scheduledStartTime?: string;
    isTest?: boolean;
  },
  meta: { eligiblePlayers: number; matchesPlayed: number }
): Stage {
  return {
    id: stage.id,
    championshipId: "championship-2026",
    title: stage.title,
    stageDate: stage.stageDate,
    stageDateLabel: formatStageDateLabel(stage.stageDate),
    scheduledStartTime: stage.scheduledStartTime ?? "20:00",
    blindStructureId: "blind-default",
    status: stage.status,
    isTest: stage.isTest ?? false,
    matchesPlayed: meta.matchesPlayed,
    eligiblePlayers: meta.eligiblePlayers,
  };
}

function compareRankingEntries(left: RankingEntry, right: RankingEntry) {
  return (
    right.wins - left.wins ||
    right.points - left.points ||
    right.secondPlaces - left.secondPlaces ||
    right.thirdPlaces - left.thirdPlaces ||
    left.playerName.localeCompare(right.playerName, "pt-BR")
  );
}

function calculateAnnualPoints(position: number, leftStage: boolean) {
  if (leftStage) {
    return 1;
  }

  if (position === 1) {
    return 10;
  }

  if (position === 2) {
    return 8;
  }

  if (position === 3) {
    return 6;
  }

  if (position === 4) {
    return 4;
  }

  return 2;
}

function buildFinalRanking(
  players: FinalizeStagePlayerPayload[],
  playerNameById: Map<string, string>
) {
  return [...players]
    .map((player) => ({
      playerId: player.playerId,
      playerName: playerNameById.get(player.playerId) ?? player.playerName,
      totalPoints: player.matchPoints.reduce((total, value) => total + value, 0),
      wins: player.matchPoints.filter((value) => value === 10).length,
      secondPlaces: player.matchPoints.filter((value) => value === 8).length,
      thirdPlaces: player.matchPoints.filter((value) => value === 6).length,
    }))
    .sort((left, right) => {
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      if (right.secondPlaces !== left.secondPlaces) {
        return right.secondPlaces - left.secondPlaces;
      }

      if (right.thirdPlaces !== left.thirdPlaces) {
        return right.thirdPlaces - left.thirdPlaces;
      }

      return left.playerName.localeCompare(right.playerName, "pt-BR");
    })
    .map((player, index) => ({
      ...player,
      position: index + 1,
    }));
}

function buildFinalRankingFromStageMatchRecord(
  stageMatchRecord: StageMatchPoints,
  playerNameById: Map<string, string>
) {
  return Array.from(
    new Set(stageMatchRecord.matches.flatMap((match) => Object.keys(match.pointsByPlayer)))
  )
    .map((playerId) => {
      const matchPoints = stageMatchRecord.matches.map((match) => match.pointsByPlayer[playerId] ?? 0);
      return {
        playerId,
        playerName: playerNameById.get(playerId) ?? "Jogador",
        totalPoints: matchPoints.reduce((total, value) => total + value, 0),
        wins: matchPoints.filter((value) => value === 10).length,
        secondPlaces: matchPoints.filter((value) => value === 8).length,
        thirdPlaces: matchPoints.filter((value) => value === 6).length,
      };
    })
    .sort((left, right) => {
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      if (right.secondPlaces !== left.secondPlaces) {
        return right.secondPlaces - left.secondPlaces;
      }

      if (right.thirdPlaces !== left.thirdPlaces) {
        return right.thirdPlaces - left.thirdPlaces;
      }

      return left.playerName.localeCompare(right.playerName, "pt-BR");
    })
    .map((player, index) => ({
      ...player,
      position: index + 1,
    }));
}

function buildStageHistoryDetail(input: {
  stage: { id: string; title: string; stageDate: string };
  actualStart: Date | null;
  actualEnd: Date;
  completedMatchDurations: number[];
  stageMatchRecord: StageMatchPoints;
  finalRanking: StageHistoryFinalRankingEntry[];
  totalDurationSeconds: number;
  playerNameById: Map<string, string>;
  dailyPrizeCents: number;
  annualContributionCents: number;
}) {
  const scheduledStart = new Date(`${input.stage.stageDate}T20:00:00`);
  let currentCursor = input.actualStart ?? scheduledStart;

  const matches: StageHistoryMatchDetail[] = input.stageMatchRecord.matches.map((match, index) => {
    const durationSeconds = input.completedMatchDurations[index] ?? 0;
    const actualStart = new Date(currentCursor);
    const actualEnd = new Date(actualStart.getTime() + durationSeconds * 1000);

    currentCursor = actualEnd;

    return {
      matchNumber: match.matchNumber,
      label: match.label,
      scheduledStartLabel: formatDateTimeLabel(index === 0 ? scheduledStart : actualStart),
      actualStartLabel: formatDateTimeLabel(actualStart),
      actualEndLabel: formatDateTimeLabel(actualEnd),
      durationSeconds,
      ranking: buildMatchRanking(match.pointsByPlayer, input.playerNameById),
    };
  });

  return {
    stageId: input.stage.id,
    title: input.stage.title,
    stageDateLabel: formatStageDateLabel(input.stage.stageDate),
    scheduledStartLabel: formatDateTimeLabel(scheduledStart),
    actualStartLabel: formatDateTimeLabel(input.actualStart ?? scheduledStart),
    actualEndLabel: formatDateTimeLabel(input.actualEnd),
    totalDurationSeconds: input.totalDurationSeconds,
    winnerName: input.finalRanking[0]?.playerName ?? "-",
    dailyPrize: formatCurrency(input.dailyPrizeCents / 100),
    annualPotContribution: formatCurrency(input.annualContributionCents / 100),
    matchesPlayed: input.stageMatchRecord.matches.length,
    finalRanking: input.finalRanking,
    matches,
  };
}

function buildMatchRanking(
  pointsByPlayer: Record<string, number>,
  playerNameById: Map<string, string>
) {
  return Object.entries(pointsByPlayer)
    .map(([playerId, points]) => ({
      playerId,
      playerName: playerNameById.get(playerId) ?? "Jogador",
      points,
      position: 0,
    }))
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }

      return left.playerName.localeCompare(right.playerName, "pt-BR");
    })
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
}

function rebuildAnnualRankingStats(
  storedPlayers: Awaited<ReturnType<typeof getStoredPlayers>>,
  annualStagePoints: AnnualStagePoints[],
  stageHistoryDetails: StageHistoryDetail[]
) {
  return storedPlayers.map((player) => {
    const nonTestDetails = stageHistoryDetails.filter((stage) => !stage.isTest);
    const points = annualStagePoints.reduce(
      (total, stage) => total + (stage.pointsByPlayer[player.id] ?? 0),
      0
    );

    return {
      playerId: player.id,
      points,
      wins: nonTestDetails.filter((stage) =>
        stage.finalRanking.some((entry) => entry.playerId === player.id && entry.position === 1)
      ).length,
      secondPlaces: nonTestDetails.filter((stage) =>
        stage.finalRanking.some((entry) => entry.playerId === player.id && entry.position === 2)
      ).length,
      thirdPlaces: nonTestDetails.filter((stage) =>
        stage.finalRanking.some((entry) => entry.playerId === player.id && entry.position === 3)
      ).length,
    };
  });
}

function formatStageDateLabel(isoDate: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${isoDate}T12:00:00`));
}

function formatStageShortLabel(isoDate: string) {
  const [, month = "00", day = "00"] = isoDate.split("-");
  return `${day}/${month}`;
}

function formatDateTimeLabel(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function buildMatchLabel(matchNumber: number) {
  const labels: Record<number, string> = {
    1: "Primeira partida",
    2: "Segunda partida",
    3: "Terceira partida",
    4: "Quarta partida",
    5: "Quinta partida",
    6: "Sexta partida",
    7: "Setima partida",
    8: "Oitava partida",
  };

  return labels[matchNumber] ?? `${matchNumber}a partida`;
}

function parseCurrencyToCents(value: string) {
  const normalized = value.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
  return Math.round((Number.parseFloat(normalized) || 0) * 100);
}

function sortHistoryByDate(
  history: HistoryStageSummary[],
  stages: Array<{ id: string; stageDate: string }>
) {
  const dateMap = new Map(stages.map((stage) => [stage.id, stage.stageDate]));
  return [...history].sort((left, right) =>
    (dateMap.get(left.id) ?? "").localeCompare(dateMap.get(right.id) ?? "")
  );
}

function sortAnnualStagePointsByDate(
  annualStagePoints: AnnualStagePoints[],
  stages: Array<{ id: string; stageDate: string }>
) {
  const dateMap = new Map(stages.map((stage) => [stage.id, stage.stageDate]));
  return [...annualStagePoints].sort((left, right) =>
    (dateMap.get(left.stageId) ?? "").localeCompare(dateMap.get(right.stageId) ?? "")
  );
}

function sortStageMatchPointsByDate(
  stageMatchPoints: StageMatchPoints[],
  stages: Array<{ id: string; stageDate: string }>
) {
  const dateMap = new Map(stages.map((stage) => [stage.id, stage.stageDate]));
  return [...stageMatchPoints].sort((left, right) =>
    (dateMap.get(left.stageId) ?? "").localeCompare(dateMap.get(right.stageId) ?? "")
  );
}

function sortStageHistoryByDate(
  stageHistoryDetails: StageHistoryDetail[],
  stages: Array<{ id: string; stageDate: string }>
) {
  const dateMap = new Map(stages.map((stage) => [stage.id, stage.stageDate]));
  return [...stageHistoryDetails].sort((left, right) =>
    (dateMap.get(left.stageId) ?? "").localeCompare(dateMap.get(right.stageId) ?? "")
  );
}

async function readBundledLeagueStateSeed(): Promise<DemoLeagueStateData> {
  const bundledPath = path.join(process.cwd(), "data", stateDocumentName);

  try {
    const raw = await readFile(bundledPath, "utf8");
    return JSON.parse(raw) as DemoLeagueStateData;
  } catch {
    return buildDefaultState();
  }
}

function mergeLeagueStates(
  current: DemoLeagueStateData,
  bundled: DemoLeagueStateData,
): DemoLeagueStateData {
  return {
    annualRankingStats: mergeByKey(current.annualRankingStats, bundled.annualRankingStats, (entry) => entry.playerId),
    annualStagePoints: mergeByKey(current.annualStagePoints, bundled.annualStagePoints, (entry) => entry.stageId),
    stageMatchPoints: mergeByKey(current.stageMatchPoints, bundled.stageMatchPoints, (entry) => entry.stageId),
    history: mergeByKey(current.history, bundled.history, (entry) => entry.id),
    stageHistoryDetails: mergeByKey(
      current.stageHistoryDetails,
      bundled.stageHistoryDetails,
      (entry) => entry.stageId,
    ),
    annualPotCents: bundled.annualPotCents || current.annualPotCents,
  };
}

function mergeByKey<T>(
  current: T[],
  bundled: T[],
  getKey: (entry: T) => string,
) {
  const map = new Map(current.map((entry) => [getKey(entry), entry]));

  for (const bundledEntry of bundled) {
    map.set(getKey(bundledEntry), bundledEntry);
  }

  return Array.from(map.values());
}
