export type PokerStreet = "preflop" | "flop" | "turn" | "river" | "showdown";

export type BettingStreet = Exclude<PokerStreet, "showdown">;

export type PokerActionType = "fold" | "check" | "call" | "bet" | "raise";

export type PokerActionSubtype =
  | "limp"
  | "open_raise"
  | "3bet"
  | "4bet"
  | "5bet_plus"
  | "blind_defense"
  | "cold_call"
  | "all_in_call"
  | "all_in_bet"
  | "all_in_raise";

export type PokerStatTag =
  | "faced_open_raise"
  | "faced_3bet"
  | "faced_4bet"
  | "limp"
  | "open_raise"
  | "three_bet"
  | "four_bet"
  | "cold_call"
  | "blind_defense"
  | "cbet_opportunity"
  | "cbet_done"
  | "faced_cbet"
  | "fold_to_cbet"
  | "double_barrel_opportunity"
  | "double_barrel_done"
  | "triple_barrel_opportunity"
  | "triple_barrel_done"
  | "saw_flop"
  | "saw_turn"
  | "saw_river"
  | "reached_showdown"
  | "won_showdown"
  | "folded_preflop"
  | "folded_flop"
  | "folded_turn"
  | "folded_river";

export type PokerClosureKind =
  | "single_player_remaining"
  | "showdown"
  | "all_in_without_showdown"
  | "needs_review";

export type PokerPlayerContext = {
  playerId: string;
  playerName: string;
  aliases?: string[];
  position: string;
  seatIndex: number;
  startingStack?: number;
};

export type PokerHandContext = {
  handId: string;
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  buttonPlayerId: string;
  players: PokerPlayerContext[];
  startedAt?: string;
};

export type PokerTranscriptLine = {
  sequence: number;
  spokenText: string;
  street?: PokerStreet;
  timestamp?: string;
};

export type PokerSemanticIntentType =
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "all_in"
  | "unknown";

export type PokerSemanticIntent = {
  sequence: number;
  spokenText: string;
  normalizedText: string;
  playerId: string | null;
  playerName: string | null;
  aliasMatched: string | null;
  intentType: PokerSemanticIntentType;
  mentionedAmount: number | null;
  isAllInHint: boolean;
  confidenceScore: number;
  needsReview: boolean;
  reviewReasons: string[];
};

export type PokerActionEvent = {
  sequence: number;
  street: PokerStreet;
  playerId: string | null;
  playerName: string | null;
  position: string | null;
  spokenText: string;
  actionType: PokerActionType | null;
  actionSubtype?: PokerActionSubtype;
  amountTotal?: number | null;
  amountIncrement?: number | null;
  isAllIn: boolean;
  needsReview: boolean;
  reviewReasons: string[];
  confidenceScore: number;
  tags: PokerStatTag[];
};

export type PokerStreetState = {
  currentBet: number;
  minCall: number;
  minRaiseTo: number;
  raiseCount: number;
  lastAggressorPlayerId: string | null;
  investedByPlayer: Record<string, number>;
};

export type PokerHandState = {
  context: PokerHandContext;
  street: PokerStreet;
  potTotal: number;
  activePlayerIds: string[];
  foldedPlayerIds: string[];
  allInPlayerIds: string[];
  investedTotalByPlayer: Record<string, number>;
  playersAtStreetStart: Record<BettingStreet, string[]>;
  streetStates: Record<BettingStreet, PokerStreetState>;
  pendingActionOrder: string[];
  events: PokerActionEvent[];
  preflopAggressorPlayerId: string | null;
  winnerPlayerIds: string[];
  reachedShowdownPlayerIds: string[];
  ended: boolean;
  endReason: PokerClosureKind | null;
  needsReview: boolean;
  reviewReasons: string[];
};

export type PokerHandSummary = {
  context: PokerHandContext;
  events: PokerActionEvent[];
  finalStreet: PokerStreet;
  finalPot: number;
  winnerPlayerIds: string[];
  reachedShowdownPlayerIds: string[];
  endReason: PokerClosureKind | null;
  playersAtStreetStart: Record<BettingStreet, string[]>;
  preflopAggressorPlayerId: string | null;
  needsReview: boolean;
  reviewReasons: string[];
  writtenSummary: string[];
};

export type PokerPlayerHandStatistics = {
  playerId: string;
  playerName: string;
  handsPlayed: number;
  vpipHands: number;
  pfrHands: number;
  limpHands: number;
  foldedPreflopHands: number;
  postflopBets: number;
  postflopRaises: number;
  postflopCalls: number;
  postflopChecks: number;
  postflopFolds: number;
  sawFlop: number;
  sawTurn: number;
  sawRiver: number;
  reachedShowdown: number;
  wonShowdown: number;
  cbetFlopOpportunity: number;
  cbetFlopDone: number;
  tags: PokerStatTag[];
};

export type PokerPlayerStatisticsAggregate = {
  playerId: string;
  playerName: string;
  handsPlayed: number;
  vpipHands: number;
  pfrHands: number;
  limpHands: number;
  foldedPreflopHands: number;
  postflopBets: number;
  postflopRaises: number;
  postflopCalls: number;
  postflopChecks: number;
  postflopFolds: number;
  sawFlop: number;
  sawTurn: number;
  sawRiver: number;
  reachedShowdown: number;
  wonShowdown: number;
  cbetFlopOpportunity: number;
  cbetFlopDone: number;
  vpip: number;
  pfr: number;
  limpPercentage: number;
  foldPreflopPercentage: number;
  aggressionFactor: number;
  aggressionFrequency: number;
  wtsd: number;
  wsd: number;
  cbetFlop: number;
  tags: PokerStatTag[];
};

export type PokerPlayerProfile =
  | "tight_passive"
  | "tight_aggressive"
  | "loose_passive"
  | "loose_aggressive"
  | "nit"
  | "calling_station"
  | "maniac"
  | "regular";

export type PokerProfileResult = {
  primaryProfile: PokerPlayerProfile;
  secondaryProfiles: PokerPlayerProfile[];
};

export type PokerHandProcessingResult = {
  state: PokerHandState;
  summary: PokerHandSummary;
  handStatistics: PokerPlayerHandStatistics[];
};
