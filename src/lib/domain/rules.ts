import type {
  Match,
  MatchResult,
  Player,
  RankingEntry,
  StagePlayerSnapshot,
  StagePlayerStatus,
} from "@/lib/domain/types";

export function calculateMatchPoints(position: number) {
  if (position === 1) return 10;
  if (position === 2) return 8;
  if (position === 3) return 6;
  if (position === 4) return 4;
  return 2;
}

export function calculateAnnualStagePoints(position: number, leftEarly: boolean) {
  if (leftEarly) return 1;
  if (position === 1) return 10;
  if (position === 2) return 7;
  if (position === 3) return 5;
  return 3;
}

export function buildDayRanking(players: Player[], matches: Match[]): RankingEntry[] {
  const statsMap = new Map<string, RankingEntry>();

  for (const player of players) {
    statsMap.set(player.id, {
      playerId: player.id,
      playerName: player.name,
      position: 0,
      points: 0,
      wins: 0,
      secondPlaces: 0,
      thirdPlaces: 0,
      tiebreakSummary: "Sem partidas",
    });
  }

  const finishedMatches = matches.filter((match) => match.status !== "pending");

  for (const match of finishedMatches) {
    for (const result of match.results) {
      const current = statsMap.get(result.playerId);
      if (!current) continue;

      current.points += calculateMatchPoints(result.finalPosition);
      current.wins += result.finalPosition === 1 ? 1 : 0;
      current.secondPlaces += result.finalPosition === 2 ? 1 : 0;
      current.thirdPlaces += result.finalPosition === 3 ? 1 : 0;
      current.tiebreakSummary = buildTiebreakSummary(current);
    }
  }

  return [...statsMap.values()]
    .filter((entry) => entry.points > 0 || finishedMatches.length === 0)
    .sort(compareStageRanking)
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}

export function buildAnnualRanking(
  players: Player[],
  dayRanking: RankingEntry[],
  statuses: StagePlayerStatus[],
  previousPoints: Map<string, number>
): RankingEntry[] {
  const annualEntries = players.map((player) => {
    const stagePosition = dayRanking.find((entry) => entry.playerId === player.id)?.position;
    const status = statuses.find((item) => item.playerId === player.id);
    const stagePoints =
      stagePosition && status?.paidDaily
        ? calculateAnnualStagePoints(stagePosition, Boolean(status.leftStageEarly))
        : 0;
    const current = dayRanking.find((entry) => entry.playerId === player.id);

    return {
      playerId: player.id,
      playerName: player.name,
      position: 0,
      points: (previousPoints.get(player.id) ?? 0) + stagePoints,
      wins: current?.wins ?? 0,
      secondPlaces: current?.secondPlaces ?? 0,
      thirdPlaces: current?.thirdPlaces ?? 0,
      tiebreakSummary: status?.leftStageEarly
        ? "Penalidade: saiu antes"
        : "Ajuste manual disponível",
    };
  });

  return annualEntries.sort(compareRanking).map((entry, index) => ({
    ...entry,
    position: index + 1,
  }));
}

export function deriveStagePlayers(
  players: Player[],
  dayRanking: RankingEntry[],
  statuses: StagePlayerStatus[],
  liveMatch?: Match
): StagePlayerSnapshot[] {
  return players.map((player) => {
    const status = statuses.find((item) => item.playerId === player.id);
    const ranking = dayRanking.find((entry) => entry.playerId === player.id);
    const visualStatus = resolveVisualStatus(status);
    const inCurrentMatch = liveMatch?.participantIds.includes(player.id) ?? false;

    return {
      playerId: player.id,
      playerName: player.name,
      paidAnnual: Boolean(status?.paidAnnual),
      paidDaily: Boolean(status?.paidDaily),
      dayPoints: ranking?.points ?? 0,
      inCurrentMatch,
      visualStatus,
      statusLabel: buildStageStatusLabel(status, inCurrentMatch),
      availableActions: buildAvailableActions(status, inCurrentMatch),
    };
  });
}

function buildAvailableActions(
  status?: StagePlayerStatus,
  inCurrentMatch?: boolean
) {
  const actions: string[] = [];

  if (!status?.paidAnnual) actions.push("Buy-in anual");
  if (!status?.paidDaily && status?.paidAnnual) actions.push("Buy-in do dia");
  if (!status?.paidDaily && !status?.paidAnnual) actions.push("Buy-in geral");
  if (status?.activeForStage && inCurrentMatch) actions.push("Eliminar da partida");
  if (status?.activeForStage && !status?.leftStageEarly) actions.push("Saiu da etapa");

  return actions.length > 0 ? actions : ["Sem ação"];
}

function resolveVisualStatus(status?: StagePlayerStatus) {
  if (!status?.paidAnnual && !status?.paidDaily) return "neutral";
  if (status?.paidAnnual && !status?.paidDaily) return "warning";
  if (status?.leftStageEarly) return "danger";
  if (status?.paidAnnual && status?.paidDaily) return "success";
  return "neutral";
}

function buildStageStatusLabel(
  status?: StagePlayerStatus,
  inCurrentMatch?: boolean
) {
  if (!status) return "Sem ação";
  if (status.leftStageEarly) return "Saiu da etapa";
  if (inCurrentMatch) return "Jogando agora";
  if (status.paidAnnual && status.paidDaily) return "Apto para jogar";
  if (status.paidAnnual) return "Anual pago";
  return "Sem ação";
}

function compareRanking(a: RankingEntry, b: RankingEntry) {
  return (
    b.points - a.points ||
    b.wins - a.wins ||
    b.secondPlaces - a.secondPlaces ||
    b.thirdPlaces - a.thirdPlaces ||
    a.playerName.localeCompare(b.playerName)
  );
}

export function compareStageRanking(a: RankingEntry, b: RankingEntry) {
  return (
    b.wins - a.wins ||
    b.points - a.points ||
    b.secondPlaces - a.secondPlaces ||
    b.thirdPlaces - a.thirdPlaces ||
    a.playerName.localeCompare(b.playerName)
  );
}

function buildTiebreakSummary(entry: RankingEntry) {
  return `${entry.wins} vitórias • ${entry.secondPlaces} segundos • ${entry.thirdPlaces} terceiros`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function calculateFinalPosition(
  totalParticipants: number,
  eliminationOrder: number
) {
  return totalParticipants - eliminationOrder + 1;
}

export function normalizeMatchResults(results: MatchResult[]) {
  return results.map((result, index) => ({
    ...result,
    finalPosition:
      result.finalPosition || calculateFinalPosition(results.length, index + 1),
  }));
}
