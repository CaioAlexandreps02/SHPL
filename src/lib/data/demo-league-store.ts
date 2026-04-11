import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getStoredPlayers, getStoredStages, saveStoredStage } from "@/lib/data/demo-admin-store";
import { createMockSnapshot } from "@/lib/data/mock";
import { formatCurrency } from "@/lib/domain/rules";
import type {
  AnnualStagePoints,
  HistoryStageSummary,
  LeagueSnapshot,
  RankingEntry,
  Stage,
  StageHistoryDetail,
  StageHistoryFinalRankingEntry,
  StageHistoryMatchDetail,
  StageHistoryMatchRankingEntry,
  StageMatchPoints,
} from "@/lib/domain/types";

type StoredAnnualRankingStats = {
  playerId: string;
  points: number;
  wins: number;
  secondPlaces: number;
  thirdPlaces: number;
};

type DemoLeagueStoreData = {
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

export type FinalizeStoredStageInput = {
  stageId: string;
  actualStageStartedAt: string | null;
  closedAt: string;
  completedMatchDurations: number[];
  players: FinalizeStagePlayerPayload[];
  buyInAnnual: number;
  buyInDaily: number;
};

const dataDirectory = path.join(process.cwd(), "data");
const leagueStoreFile = path.join(dataDirectory, "demo-league-store.json");

async function ensureLeagueStore() {
  await mkdir(dataDirectory, { recursive: true });

  try {
    await readFile(leagueStoreFile, "utf8");
  } catch {
    await writeFile(
      leagueStoreFile,
      JSON.stringify(buildDefaultLeagueStore(), null, 2),
      "utf8"
    );
  }
}

function buildDefaultLeagueStore(): DemoLeagueStoreData {
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

async function readStore() {
  await ensureLeagueStore();
  const raw = await readFile(leagueStoreFile, "utf8");
  return JSON.parse(raw) as DemoLeagueStoreData;
}

async function writeStore(data: DemoLeagueStoreData) {
  await writeFile(leagueStoreFile, JSON.stringify(data, null, 2), "utf8");
}

export async function getDemoLeagueSnapshot(): Promise<LeagueSnapshot> {
  const baseSnapshot = createMockSnapshot();
  const [store, storedPlayers, storedStages] = await Promise.all([
    readStore(),
    getStoredPlayers(),
    getStoredStages(),
  ]);

  const playerNameById = new Map(storedPlayers.map((player) => [player.id, player.name]));
  const annualRanking = buildAnnualRankingFromStore(store.annualRankingStats, playerNameById);
  const annualStagePoints = store.annualStagePoints.map((stage) =>
    injectZeroPointsForPlayers(stage, storedPlayers.map((player) => player.id))
  );
  const stageMatchPoints = store.stageMatchPoints.map((stage) =>
    injectZeroMatchPointsForPlayers(stage, storedPlayers.map((player) => player.id))
  );
  const finishedStageIds = new Set(store.history.map((stage) => stage.id));
  const unfinishedStages = storedStages
    .filter((stage) => !finishedStageIds.has(stage.id))
    .sort((left, right) => left.stageDate.localeCompare(right.stageDate));
  const currentStageSource = unfinishedStages[0] ?? storedStages[storedStages.length - 1] ?? null;
  const upcomingStageSources = unfinishedStages.slice(1);

  const currentStage =
    currentStageSource !== null
      ? buildSnapshotStage(currentStageSource, {
          eligiblePlayers: storedPlayers.filter((player) => player.active).length,
          matchesPlayed:
            stageMatchPoints.find((stage) => stage.stageId === currentStageSource.id)?.matches.length ?? 0,
        })
      : baseSnapshot.currentStage;

  const upcomingStages = upcomingStageSources.map((stage) =>
    buildSnapshotStage(stage, {
      eligiblePlayers: storedPlayers.filter((player) => player.active).length,
      matchesPlayed: stageMatchPoints.find((entry) => entry.stageId === stage.id)?.matches.length ?? 0,
    })
  );

  const stagePlayers = annualRanking.map((entry) => ({
    playerId: entry.playerId,
    playerName: entry.playerName,
    paidAnnual: false,
    paidDaily: false,
    dayPoints: 0,
    inCurrentMatch: false,
    visualStatus: "neutral" as const,
    statusLabel: "Aguardando confirmacao de buy-in",
    availableActions: ["Buy-in anual", "Buy-in geral"],
  }));

  const dayRanking = annualRanking.map((entry, index) => ({
    ...entry,
    position: index + 1,
    points: 0,
    wins: 0,
    secondPlaces: 0,
    thirdPlaces: 0,
    tiebreakSummary: "Sem partidas",
  }));

  const liveMatch = {
    id: `${currentStage.id}-match-1`,
    stageId: currentStage.id,
    matchNumber: 1,
    status: "pending" as const,
    participantIds: [],
    results: [],
  };

  return {
    ...baseSnapshot,
    currentStage,
    upcomingStages,
    stagePlayers,
    dayRanking,
    annualRanking,
    history: sortHistoryByStageDate(store.history, storedStages),
    annualStagePoints: sortAnnualStagePointsByDate(annualStagePoints, storedStages),
    stageMatchPoints: sortStageMatchPointsByDate(stageMatchPoints, storedStages),
    stageHistoryDetails: sortStageHistoryByDate(store.stageHistoryDetails, storedStages),
    financialSummary: {
      dailyPrizePool: formatCurrency(0),
      annualPot: formatCurrency(store.annualPotCents / 100),
      dailyPaidPlayers: 0,
      annualPaidPlayers: 0,
    },
    liveMatch,
  };
}

export async function finalizeStoredStage(input: FinalizeStoredStageInput) {
  const [store, storedPlayers, storedStages] = await Promise.all([
    readStore(),
    getStoredPlayers(),
    getStoredStages(),
  ]);
  const stage = storedStages.find((entry) => entry.id === input.stageId);

  if (!stage) {
    throw new Error("Etapa nao encontrada para encerramento.");
  }

  if (store.history.some((entry) => entry.id === input.stageId)) {
    throw new Error("Essa etapa ja foi encerrada anteriormente.");
  }

  const playerNameById = new Map(storedPlayers.map((player) => [player.id, player.name]));
  const knownPlayerIds = storedPlayers.map((player) => player.id);
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
        knownPlayerIds.map((playerId) => {
          const player = input.players.find((entry) => entry.playerId === playerId);
          return [playerId, player?.matchPoints[index] ?? 0];
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
      knownPlayerIds.map((playerId) => {
        const player = input.players.find((entry) => entry.playerId === playerId);
        const rankingEntry = finalRanking.find((entry) => entry.playerId === playerId);

        if (!player?.dailyPaid || !rankingEntry) {
          return [playerId, 0];
        }

        return [playerId, calculateAnnualPoints(rankingEntry.position, player.leftStage)];
      })
    ),
  };

  const currentStatsMap = new Map(store.annualRankingStats.map((entry) => [entry.playerId, entry]));
  const nextStats = knownPlayerIds.map((playerId) => {
    const currentStats = currentStatsMap.get(playerId);
    const player = input.players.find((entry) => entry.playerId === playerId);
    const rankingEntry = finalRanking.find((entry) => entry.playerId === playerId);
    const stagePoints = annualStageRecord.pointsByPlayer[playerId] ?? 0;

    return {
      playerId,
      points: (currentStats?.points ?? 0) + stagePoints,
      wins:
        (currentStats?.wins ?? 0) +
        (rankingEntry?.position === 1 && player?.dailyPaid && !player.leftStage ? 1 : 0),
      secondPlaces:
        (currentStats?.secondPlaces ?? 0) +
        (rankingEntry?.position === 2 && player?.dailyPaid && !player.leftStage ? 1 : 0),
      thirdPlaces:
        (currentStats?.thirdPlaces ?? 0) +
        (rankingEntry?.position === 3 && player?.dailyPaid && !player.leftStage ? 1 : 0),
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
    finalRanking,
    stageMatchRecord,
    totalDurationSeconds,
    dailyPrizeCents,
    annualContributionCents,
  });
  const historySummary: HistoryStageSummary = {
    id: stage.id,
    title: stage.title,
    stageDateLabel: formatStageDateLabel(stage.stageDate),
    winnerName: finalRanking[0]?.playerName ?? "-",
    matchesPlayed: stageMatchRecord.matches.length,
    dailyPrize: formatCurrency(dailyPrizeCents / 100),
    annualPotContribution: formatCurrency(annualContributionCents / 100),
  };

  const nextStore: DemoLeagueStoreData = {
    annualRankingStats: nextStats,
    annualStagePoints: sortAnnualStagePointsByDate(
      [...store.annualStagePoints, annualStageRecord],
      storedStages
    ),
    stageMatchPoints: sortStageMatchPointsByDate(
      [...store.stageMatchPoints, stageMatchRecord],
      storedStages
    ),
    history: sortHistoryByStageDate([...store.history, historySummary], storedStages),
    stageHistoryDetails: sortStageHistoryByDate(
      [...store.stageHistoryDetails, historyDetail],
      storedStages
    ),
    annualPotCents: store.annualPotCents + annualContributionCents,
  };

  await writeStore(nextStore);
  await saveStoredStage({
    id: stage.id,
    title: stage.title,
    stageDate: stage.stageDate,
    status: "finished",
  });

  return {
    historySummary,
    historyDetail,
  };
}

function buildAnnualRankingFromStore(
  rankingStats: StoredAnnualRankingStats[],
  playerNameById: Map<string, string>
) {
  return rankingStats
    .map((entry) => ({
      playerId: entry.playerId,
      playerName: playerNameById.get(entry.playerId) ?? "Jogador",
      position: 0,
      points: entry.points,
      wins: entry.wins,
      secondPlaces: entry.secondPlaces,
      thirdPlaces: entry.thirdPlaces,
      tiebreakSummary: buildTiebreakSummary(entry),
    }))
    .sort(compareRankingEntries)
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
}

function injectZeroPointsForPlayers(
  stage: AnnualStagePoints,
  playerIds: string[]
) {
  return {
    ...stage,
    pointsByPlayer: Object.fromEntries(
      playerIds.map((playerId) => [playerId, stage.pointsByPlayer[playerId] ?? 0])
    ),
  };
}

function injectZeroMatchPointsForPlayers(
  stage: StageMatchPoints,
  playerIds: string[]
) {
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

function buildSnapshotStage(
  stage: { id: string; title: string; stageDate: string; status: Stage["status"] },
  meta: { eligiblePlayers: number; matchesPlayed: number }
): Stage {
  return {
    id: stage.id,
    championshipId: "championship-2026",
    title: stage.title,
    stageDate: stage.stageDate,
    stageDateLabel: formatStageDateLabel(stage.stageDate),
    status: stage.status,
    blindStructureId: "blind-default",
    matchesPlayed: meta.matchesPlayed,
    eligiblePlayers: meta.eligiblePlayers,
  };
}

function compareRankingEntries(left: RankingEntry, right: RankingEntry) {
  return (
    right.points - left.points ||
    right.wins - left.wins ||
    right.secondPlaces - left.secondPlaces ||
    right.thirdPlaces - left.thirdPlaces ||
    left.playerName.localeCompare(right.playerName, "pt-BR")
  );
}

function buildTiebreakSummary(entry: StoredAnnualRankingStats) {
  return `${entry.wins} vitorias • ${entry.secondPlaces} segundos • ${entry.thirdPlaces} terceiros`;
}

function calculateAnnualPoints(position: number, leftStage: boolean) {
  if (leftStage) {
    return 1;
  }

  if (position === 1) {
    return 10;
  }

  if (position === 2) {
    return 7;
  }

  if (position === 3) {
    return 5;
  }

  return 3;
}

function buildFinalRanking(
  players: FinalizeStagePlayerPayload[],
  playerNameById: Map<string, string>
): StageHistoryFinalRankingEntry[] {
  return [...players]
    .map((player) => ({
      playerId: player.playerId,
      playerName: playerNameById.get(player.playerId) ?? player.playerName,
      totalPoints: player.matchPoints.reduce((total, value) => total + value, 0),
    }))
    .sort((left, right) => {
      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
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
  finalRanking: StageHistoryFinalRankingEntry[];
  stageMatchRecord: StageMatchPoints;
  totalDurationSeconds: number;
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
      ranking: buildMatchRanking(match.pointsByPlayer),
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

function buildMatchRanking(pointsByPlayer: Record<string, number>): StageHistoryMatchRankingEntry[] {
  return Object.entries(pointsByPlayer)
    .map(([playerId, points]) => ({
      playerId,
      playerName: "",
      points,
      position: 0,
    }))
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }

      return left.playerId.localeCompare(right.playerId, "pt-BR");
    })
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
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

function sortHistoryByStageDate(history: HistoryStageSummary[], stages: Array<{ id: string; stageDate: string }>) {
  const stageDateMap = new Map(stages.map((stage) => [stage.id, stage.stageDate]));
  return [...history].sort((left, right) =>
    (stageDateMap.get(left.id) ?? "").localeCompare(stageDateMap.get(right.id) ?? "")
  );
}

function sortAnnualStagePointsByDate(
  stagesPoints: AnnualStagePoints[],
  stages: Array<{ id: string; stageDate: string }>
) {
  const stageDateMap = new Map(stages.map((stage) => [stage.id, stage.stageDate]));
  return [...stagesPoints].sort((left, right) =>
    (stageDateMap.get(left.stageId) ?? "").localeCompare(stageDateMap.get(right.stageId) ?? "")
  );
}

function sortStageMatchPointsByDate(
  stagesPoints: StageMatchPoints[],
  stages: Array<{ id: string; stageDate: string }>
) {
  const stageDateMap = new Map(stages.map((stage) => [stage.id, stage.stageDate]));
  return [...stagesPoints].sort((left, right) =>
    (stageDateMap.get(left.stageId) ?? "").localeCompare(stageDateMap.get(right.stageId) ?? "")
  );
}

function sortStageHistoryByDate(
  stageHistory: StageHistoryDetail[],
  stages: Array<{ id: string; stageDate: string }>
) {
  const stageDateMap = new Map(stages.map((stage) => [stage.id, stage.stageDate]));
  return [...stageHistory].sort((left, right) =>
    (stageDateMap.get(left.stageId) ?? "").localeCompare(stageDateMap.get(right.stageId) ?? "")
  );
}
