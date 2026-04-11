import {
  buildDayRanking,
  deriveStagePlayers,
  formatCurrency,
} from "@/lib/domain/rules";
import type {
  AnnualStagePoints,
  BlindLevel,
  Championship,
  ChipSetItem,
  HistoryStageSummary,
  LeagueSnapshot,
  Match,
  Player,
  Stage,
  StageHistoryDetail,
  StageMatchPoints,
  StagePlayerStatus,
} from "@/lib/domain/types";

const championship: Championship = {
  id: "championship-2026",
  name: "SHPL",
  seasonYear: 2026,
};

const players: Player[] = [
  { id: "p1", name: "Caio", active: true },
  { id: "p2", name: "Alisson", active: true },
  { id: "p3", name: "Thomas", active: true },
  { id: "p4", name: "Tuba", active: true },
  { id: "p5", name: "Thiago", active: true },
  { id: "p6", name: "Davi", active: true },
  { id: "p7", name: "Juan", active: true },
];

const blindStructure: BlindLevel[] = [
  { levelNumber: 1, smallBlind: 25, bigBlind: 50, durationMinutes: 15, ante: 0 },
  { levelNumber: 2, smallBlind: 50, bigBlind: 100, durationMinutes: 15, ante: 0 },
  { levelNumber: 3, smallBlind: 75, bigBlind: 150, durationMinutes: 15, ante: 0 },
  { levelNumber: 4, smallBlind: 100, bigBlind: 200, durationMinutes: 15, ante: 0 },
  { levelNumber: 5, smallBlind: 150, bigBlind: 300, durationMinutes: 15, ante: 0 },
];

const currentStage: Stage = {
  id: "stage-04",
  championshipId: championship.id,
  title: "Etapa 04",
  stageDate: "2026-07-15",
  stageDateLabel: "15 de julho de 2026",
  status: "scheduled",
  blindStructureId: "blind-default",
  matchesPlayed: 0,
  eligiblePlayers: 7,
};

const upcomingStages: Stage[] = [
  {
    id: "stage-05",
    championshipId: championship.id,
    title: "Etapa 05",
    stageDate: "2026-08-19",
    stageDateLabel: "19 de agosto de 2026",
    status: "scheduled",
    blindStructureId: "blind-default",
    matchesPlayed: 0,
    eligiblePlayers: 0,
  },
  {
    id: "stage-06",
    championshipId: championship.id,
    title: "Etapa 06",
    stageDate: "2026-09-16",
    stageDateLabel: "16 de setembro de 2026",
    status: "scheduled",
    blindStructureId: "blind-default",
    matchesPlayed: 0,
    eligiblePlayers: 0,
  },
];

const stagePlayerStatuses: StagePlayerStatus[] = [
  { playerId: "p1", stageId: currentStage.id, paidAnnual: true, paidDaily: false, leftStageEarly: false, activeForStage: false },
  { playerId: "p2", stageId: currentStage.id, paidAnnual: true, paidDaily: false, leftStageEarly: false, activeForStage: false },
  { playerId: "p3", stageId: currentStage.id, paidAnnual: true, paidDaily: false, leftStageEarly: false, activeForStage: false },
  { playerId: "p4", stageId: currentStage.id, paidAnnual: true, paidDaily: false, leftStageEarly: false, activeForStage: false },
  { playerId: "p5", stageId: currentStage.id, paidAnnual: true, paidDaily: false, leftStageEarly: false, activeForStage: false },
  { playerId: "p6", stageId: currentStage.id, paidAnnual: true, paidDaily: false, leftStageEarly: false, activeForStage: false },
  { playerId: "p7", stageId: currentStage.id, paidAnnual: true, paidDaily: false, leftStageEarly: false, activeForStage: false },
];

const matches: Match[] = [
  {
    id: "m1",
    stageId: currentStage.id,
    matchNumber: 1,
    status: "pending",
    participantIds: [],
    results: [],
  },
];

const history: HistoryStageSummary[] = [
  {
    id: "stage-01",
    title: "Etapa 01",
    stageDateLabel: "07 de janeiro de 2026",
    winnerName: "Alisson",
    matchesPlayed: 4,
    dailyPrize: formatCurrency(70),
    annualPotContribution: formatCurrency(80),
  },
  {
    id: "stage-02",
    title: "Etapa 02",
    stageDateLabel: "04 de fevereiro de 2026",
    winnerName: "Caio",
    matchesPlayed: 5,
    dailyPrize: formatCurrency(80),
    annualPotContribution: formatCurrency(70),
  },
  {
    id: "stage-03",
    title: "Etapa 03",
    stageDateLabel: "10 de marco de 2026",
    winnerName: "Thomas",
    matchesPlayed: 4,
    dailyPrize: formatCurrency(60),
    annualPotContribution: formatCurrency(60),
  },
];

const chipSet: ChipSetItem[] = [
  { value: 25, color: "#F1C40F", quantity: 50 },
  { value: 100, color: "#2ECC71", quantity: 80 },
  { value: 500, color: "#3498DB", quantity: 40 },
  { value: 1000, color: "#E74C3C", quantity: 30 },
];

const annualRankingSeed = [
  { playerId: "p2", playerName: "Alisson", points: 27, wins: 2, secondPlaces: 1, thirdPlaces: 0 },
  { playerId: "p1", playerName: "Caio", points: 20, wins: 1, secondPlaces: 2, thirdPlaces: 0 },
  { playerId: "p3", playerName: "Thomas", points: 17, wins: 1, secondPlaces: 1, thirdPlaces: 1 },
  { playerId: "p4", playerName: "Tuba", points: 10, wins: 0, secondPlaces: 1, thirdPlaces: 1 },
  { playerId: "p5", playerName: "Thiago", points: 3, wins: 0, secondPlaces: 0, thirdPlaces: 0 },
  { playerId: "p6", playerName: "Davi", points: 3, wins: 0, secondPlaces: 0, thirdPlaces: 0 },
  { playerId: "p7", playerName: "Juan", points: 1, wins: 0, secondPlaces: 0, thirdPlaces: 0 },
] as const;

const annualStagePoints: AnnualStagePoints[] = [
  {
    stageId: "stage-01",
    stageTitle: "Etapa 01",
    stageDateLabel: "07 de janeiro de 2026",
    stageDateShortLabel: "07/01",
    pointsByPlayer: {
      p2: 10,
      p1: 3,
      p3: 7,
      p4: 0,
      p5: 0,
      p6: 3,
      p7: 1,
    },
  },
  {
    stageId: "stage-02",
    stageTitle: "Etapa 02",
    stageDateLabel: "04 de fevereiro de 2026",
    stageDateShortLabel: "04/02",
    pointsByPlayer: {
      p2: 7,
      p1: 10,
      p3: 5,
      p4: 7,
      p5: 0,
      p6: 0,
      p7: 0,
    },
  },
  {
    stageId: "stage-03",
    stageTitle: "Etapa 03",
    stageDateLabel: "10 de marco de 2026",
    stageDateShortLabel: "10/03",
    pointsByPlayer: {
      p2: 10,
      p1: 7,
      p3: 5,
      p4: 3,
      p5: 3,
      p6: 0,
      p7: 0,
    },
  },
];

const stageMatchPoints: StageMatchPoints[] = [
  {
    stageId: "stage-01",
    stageTitle: "Etapa 01",
    stageDateLabel: "07 de janeiro de 2026",
    stageDateShortLabel: "07/01",
    matches: [
      {
        matchNumber: 1,
        label: "Primeira partida",
        pointsByPlayer: { p2: 10, p3: 7, p1: 5, p4: 3, p5: 0, p6: 3, p7: 3 },
      },
      {
        matchNumber: 2,
        label: "Segunda partida",
        pointsByPlayer: { p1: 10, p2: 7, p3: 5, p4: 3, p5: 0, p6: 3, p7: 3 },
      },
      {
        matchNumber: 3,
        label: "Terceira partida",
        pointsByPlayer: { p2: 10, p1: 7, p3: 5, p4: 3, p5: 0, p6: 3, p7: 3 },
      },
      {
        matchNumber: 4,
        label: "Quarta partida",
        pointsByPlayer: { p2: 10, p3: 7, p1: 5, p4: 3, p5: 0, p6: 3, p7: 3 },
      },
    ],
  },
  {
    stageId: "stage-02",
    stageTitle: "Etapa 02",
    stageDateLabel: "04 de fevereiro de 2026",
    stageDateShortLabel: "04/02",
    matches: [
      {
        matchNumber: 1,
        label: "Primeira partida",
        pointsByPlayer: { p1: 10, p2: 7, p3: 5, p4: 3, p5: 0, p6: 3, p7: 0 },
      },
      {
        matchNumber: 2,
        label: "Segunda partida",
        pointsByPlayer: { p4: 10, p1: 7, p2: 5, p3: 3, p5: 0, p6: 3, p7: 0 },
      },
      {
        matchNumber: 3,
        label: "Terceira partida",
        pointsByPlayer: { p1: 10, p3: 7, p2: 5, p4: 3, p5: 0, p6: 3, p7: 0 },
      },
      {
        matchNumber: 4,
        label: "Quarta partida",
        pointsByPlayer: { p1: 10, p2: 7, p4: 5, p3: 3, p5: 0, p6: 3, p7: 0 },
      },
      {
        matchNumber: 5,
        label: "Quinta partida",
        pointsByPlayer: { p2: 10, p1: 7, p3: 5, p4: 3, p5: 0, p6: 3, p7: 0 },
      },
    ],
  },
  {
    stageId: "stage-03",
    stageTitle: "Etapa 03",
    stageDateLabel: "10 de marco de 2026",
    stageDateShortLabel: "10/03",
    matches: [
      {
        matchNumber: 1,
        label: "Primeira partida",
        pointsByPlayer: { p3: 10, p2: 7, p1: 5, p4: 3, p5: 3, p6: 0, p7: 0 },
      },
      {
        matchNumber: 2,
        label: "Segunda partida",
        pointsByPlayer: { p3: 10, p1: 7, p2: 5, p4: 3, p5: 3, p6: 0, p7: 0 },
      },
      {
        matchNumber: 3,
        label: "Terceira partida",
        pointsByPlayer: { p1: 10, p3: 7, p2: 5, p4: 3, p5: 3, p6: 0, p7: 0 },
      },
      {
        matchNumber: 4,
        label: "Quarta partida",
        pointsByPlayer: { p3: 10, p2: 7, p1: 5, p4: 3, p5: 3, p6: 0, p7: 0 },
      },
    ],
  },
];

const stageHistoryDetails: StageHistoryDetail[] = buildStageHistoryDetails();

export function createMockSnapshot(): LeagueSnapshot {
  const dayRanking = buildDayRanking(players, matches);
  const annualRanking = annualRankingSeed.map((entry, index) => ({
    playerId: entry.playerId,
    playerName: entry.playerName,
    position: index + 1,
    points: entry.points,
    wins: entry.wins,
    secondPlaces: entry.secondPlaces,
    thirdPlaces: entry.thirdPlaces,
    tiebreakSummary: "Classificacao apos 3 etapas",
  }));
  const stagePlayers = deriveStagePlayers(
    players,
    dayRanking,
    stagePlayerStatuses,
    matches.find((match) => match.status === "active")
  );
  const dailyPaidPlayers = stagePlayerStatuses.filter((status) => status.paidDaily).length;
  const annualPaidPlayers = stagePlayerStatuses.filter((status) => status.paidAnnual).length;

  return {
    championship,
    currentStage,
    upcomingStages,
    stagePlayers,
    dayRanking,
    annualRanking,
    history,
    blindStructure,
    chipSet,
    financialSummary: {
      dailyPrizePool: formatCurrency(dailyPaidPlayers * 10),
      annualPot: formatCurrency(210),
      dailyPaidPlayers,
      annualPaidPlayers,
    },
    annualAwards: [
      { position: 1, percentage: 40 },
      { position: 2, percentage: 25 },
      { position: 3, percentage: 15 },
      { position: 4, percentage: 10 },
    ],
    annualStagePoints,
    stageMatchPoints,
    stageHistoryDetails,
    liveMatch: matches.find((match) => match.status === "active") ?? matches[matches.length - 1],
    liveControls: {
      currentLevel: blindStructure[2],
      nextLevel: blindStructure[3],
      actionClockOptions: [15, 20, 30, 45],
      quickActions: [
        {
          title: "Iniciar proxima partida",
          description:
            "Monta rapidamente a mesa usando apenas jogadores aptos e nao marcados como saida antecipada.",
        },
        {
          title: "Eliminar da partida",
          description:
            "Registra a ordem de eliminacao sem remover o jogador da etapa inteira.",
        },
        {
          title: "Saiu da etapa",
          description:
            "Impede participacao futura e garante apenas 1 ponto anual no fechamento.",
        },
        {
          title: "Encerrar etapa",
          description:
            "Fecha ranking do dia, converte para ranking anual e atualiza premiacoes.",
        },
      ],
    },
  };
}

function buildStageHistoryDetails(): StageHistoryDetail[] {
  return history.map((stageSummary, stageIndex) => {
    const stageMatches = stageMatchPoints.find((stage) => stage.stageId === stageSummary.id);
    const scheduledHour = 20;
    const actualStartHour = 20 + (stageIndex % 2);
    const baseDateIso = buildIsoDateFromHistoryLabel(stageSummary.stageDateLabel);

    const matchesDetailed =
      stageMatches?.matches.map((match, matchIndex) => {
        const actualStartMinutes = matchIndex === 0 ? 0 : matchIndex * 48;
        const durationSeconds = 38 * 60 + matchIndex * 7 * 60;

        return {
          matchNumber: match.matchNumber,
          label: match.label,
          scheduledStartLabel: formatDateTimeLabel(baseDateIso, scheduledHour, actualStartMinutes),
          actualStartLabel: formatDateTimeLabel(baseDateIso, actualStartHour, actualStartMinutes),
          actualEndLabel: formatDateTimeLabel(
            baseDateIso,
            actualStartHour,
            actualStartMinutes + Math.floor(durationSeconds / 60)
          ),
          durationSeconds,
          ranking: buildMatchRanking(match.pointsByPlayer),
        };
      }) ?? [];

    const totalDurationSeconds = matchesDetailed.reduce(
      (total, match) => total + match.durationSeconds,
      0
    );
    const finalRanking = stageMatches
      ? buildFinalStageRankingFromMatches(stageMatches.matches)
      : [];

    return {
      stageId: stageSummary.id,
      title: stageSummary.title,
      stageDateLabel: stageSummary.stageDateLabel,
      scheduledStartLabel: formatDateTimeLabel(baseDateIso, scheduledHour, 0),
      actualStartLabel: formatDateTimeLabel(baseDateIso, actualStartHour, 0),
      actualEndLabel: formatDateTimeLabel(
        baseDateIso,
        actualStartHour,
        Math.floor(totalDurationSeconds / 60)
      ),
      totalDurationSeconds,
      winnerName: stageSummary.winnerName,
      dailyPrize: stageSummary.dailyPrize,
      annualPotContribution: stageSummary.annualPotContribution,
      matchesPlayed: stageSummary.matchesPlayed,
      finalRanking,
      matches: matchesDetailed,
    };
  });
}

function buildMatchRanking(pointsByPlayer: Record<string, number>) {
  return players
    .map((player) => ({
      playerId: player.id,
      playerName: player.name,
      points: pointsByPlayer[player.id] ?? 0,
    }))
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }

      return left.playerName.localeCompare(right.playerName, "pt-BR");
    })
    .map((player, index) => ({
      ...player,
      position: index + 1,
    }));
}

function buildFinalStageRankingFromMatches(
  matches: StageMatchPoints["matches"]
) {
  const totalsByPlayer = matches.reduce<Record<string, number>>(
    (totals: Record<string, number>, match: StageMatchPoints["matches"][number]) => {
    for (const player of players) {
      totals[player.id] = (totals[player.id] ?? 0) + (match.pointsByPlayer[player.id] ?? 0);
    }

    return totals;
    },
    {}
  );

  return players
    .map((player) => ({
      playerId: player.id,
      playerName: player.name,
      totalPoints: totalsByPlayer[player.id] ?? 0,
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

function buildIsoDateFromHistoryLabel(label: string) {
  const monthMap: Record<string, string> = {
    janeiro: "01",
    fevereiro: "02",
    marco: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12",
  };

  const match = label.match(/(\d{2}) de ([a-z]+) de (\d{4})/i);
  if (!match) {
    return "2026-01-01";
  }

  const [, day, monthName, year] = match;
  return `${year}-${monthMap[monthName.toLowerCase()] ?? "01"}-${day}`;
}

function formatDateTimeLabel(isoDate: string, hour: number, minute: number) {
  const baseDate = new Date(`${isoDate}T00:00:00`);
  baseDate.setHours(hour);
  baseDate.setMinutes(minute);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(baseDate);
}
