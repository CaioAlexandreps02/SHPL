export type Championship = {
  id: string;
  name: string;
  seasonYear: number;
};

export type Player = {
  id: string;
  name: string;
  active: boolean;
};

export type StageStatus = "scheduled" | "active" | "finished";

export type Stage = {
  id: string;
  championshipId: string;
  title: string;
  stageDate: string;
  stageDateLabel: string;
  blindStructureId: string;
  status: StageStatus;
  matchesPlayed: number;
  eligiblePlayers: number;
};

export type StagePlayerStatus = {
  playerId: string;
  stageId: string;
  paidAnnual: boolean;
  paidDaily: boolean;
  leftStageEarly: boolean;
  activeForStage: boolean;
};

export type MatchStatus = "pending" | "active" | "finished";

export type MatchResult = {
  playerId: string;
  finalPosition: number;
  eliminationOrder: number;
};

export type Match = {
  id: string;
  stageId: string;
  matchNumber: number;
  status: MatchStatus;
  participantIds: string[];
  results: MatchResult[];
};

export type RankingEntry = {
  playerId: string;
  playerName: string;
  photoDataUrl?: string;
  position: number;
  points: number;
  wins: number;
  secondPlaces: number;
  thirdPlaces: number;
  tiebreakSummary: string;
};

export type StagePlayerSnapshot = {
  playerId: string;
  playerName: string;
  photoDataUrl?: string;
  paidAnnual: boolean;
  paidDaily: boolean;
  dayPoints: number;
  inCurrentMatch: boolean;
  visualStatus: "neutral" | "warning" | "success" | "danger";
  statusLabel: string;
  availableActions: string[];
};

export type FinancialSummaryData = {
  dailyPrizePool: string;
  annualPot: string;
  dailyPaidPlayers: number;
  annualPaidPlayers: number;
};

export type AnnualAward = {
  position: number;
  percentage: number;
};

export type BlindLevel = {
  levelNumber: number;
  smallBlind: number;
  bigBlind: number;
  durationMinutes: number;
  ante?: number;
};

export type ChipSetItem = {
  value: number;
  color: string;
  quantity: number;
};

export type HistoryStageSummary = {
  id: string;
  title: string;
  stageDateLabel: string;
  winnerName: string;
  matchesPlayed: number;
  dailyPrize: string;
  annualPotContribution: string;
};

export type StageHistoryMatchRankingEntry = {
  playerId: string;
  playerName: string;
  photoDataUrl?: string;
  position: number;
  points: number;
};

export type StageHistoryFinalRankingEntry = {
  playerId: string;
  playerName: string;
  photoDataUrl?: string;
  position: number;
  totalPoints: number;
};

export type StageHistoryMatchDetail = {
  matchNumber: number;
  label: string;
  scheduledStartLabel: string;
  actualStartLabel: string;
  actualEndLabel: string;
  durationSeconds: number;
  ranking: StageHistoryMatchRankingEntry[];
};

export type StageHistoryDetail = {
  stageId: string;
  title: string;
  stageDateLabel: string;
  scheduledStartLabel: string;
  actualStartLabel: string;
  actualEndLabel: string;
  totalDurationSeconds: number;
  winnerName: string;
  dailyPrize: string;
  annualPotContribution: string;
  matchesPlayed: number;
  finalRanking: StageHistoryFinalRankingEntry[];
  matches: StageHistoryMatchDetail[];
};

export type LiveControls = {
  currentLevel: BlindLevel;
  nextLevel?: BlindLevel;
  actionClockOptions: number[];
  quickActions: Array<{
    title: string;
    description: string;
  }>;
};

export type AnnualStagePoints = {
  stageId: string;
  stageTitle: string;
  stageDateLabel: string;
  stageDateShortLabel: string;
  pointsByPlayer: Record<string, number>;
};

export type StageMatchPoints = {
  stageId: string;
  stageTitle: string;
  stageDateLabel: string;
  stageDateShortLabel: string;
  matches: Array<{
    matchNumber: number;
    label: string;
    pointsByPlayer: Record<string, number>;
  }>;
};

export type LeagueSnapshot = {
  championship: Championship;
  currentStage: Stage;
  upcomingStages: Stage[];
  stagePlayers: StagePlayerSnapshot[];
  dayRanking: RankingEntry[];
  annualRanking: RankingEntry[];
  history: HistoryStageSummary[];
  blindStructure: BlindLevel[];
  chipSet: ChipSetItem[];
  financialSummary: FinancialSummaryData;
  annualAwards: AnnualAward[];
  annualStagePoints: AnnualStagePoints[];
  stageMatchPoints: StageMatchPoints[];
  stageHistoryDetails: StageHistoryDetail[];
  liveMatch: Match;
  liveControls: LiveControls;
};
