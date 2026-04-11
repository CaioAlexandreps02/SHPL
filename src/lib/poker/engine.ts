import { parseSemanticIntent } from "@/lib/poker/normalization";
import { computeHandStatistics } from "@/lib/poker/statistics";
import type {
  BettingStreet,
  PokerActionEvent,
  PokerActionSubtype,
  PokerActionType,
  PokerHandContext,
  PokerHandProcessingResult,
  PokerHandState,
  PokerHandSummary,
  PokerPlayerContext,
  PokerSemanticIntent,
  PokerStreet,
  PokerStreetState,
  PokerTranscriptLine,
} from "@/lib/poker/types";

const bettingStreets: BettingStreet[] = ["preflop", "flop", "turn", "river"];

export function createInitialHandState(context: PokerHandContext): PokerHandState {
  const sortedPlayers = sortPlayersBySeat(context.players);
  const investedTotalByPlayer = Object.fromEntries(
    sortedPlayers.map((player) => [player.playerId, 0])
  );
  const preflopInvestedByPlayer = Object.fromEntries(
    sortedPlayers.map((player) => [player.playerId, 0])
  );
  let potTotal = 0;

  if (context.ante && context.ante > 0) {
    for (const player of sortedPlayers) {
      investedTotalByPlayer[player.playerId] += context.ante;
      preflopInvestedByPlayer[player.playerId] += context.ante;
      potTotal += context.ante;
    }
  }

  const smallBlindPlayer = sortedPlayers.find((player) => player.position === "SB");
  const bigBlindPlayer = sortedPlayers.find((player) => player.position === "BB");

  if (smallBlindPlayer) {
    investedTotalByPlayer[smallBlindPlayer.playerId] += context.smallBlind;
    preflopInvestedByPlayer[smallBlindPlayer.playerId] += context.smallBlind;
    potTotal += context.smallBlind;
  }

  if (bigBlindPlayer) {
    investedTotalByPlayer[bigBlindPlayer.playerId] += context.bigBlind;
    preflopInvestedByPlayer[bigBlindPlayer.playerId] += context.bigBlind;
    potTotal += context.bigBlind;
  }

  return {
    context,
    street: "preflop",
    potTotal,
    activePlayerIds: sortedPlayers.map((player) => player.playerId),
    foldedPlayerIds: [],
    allInPlayerIds: [],
    investedTotalByPlayer,
    playersAtStreetStart: {
      preflop: sortedPlayers.map((player) => player.playerId),
      flop: [],
      turn: [],
      river: [],
    },
    streetStates: {
      preflop: {
        currentBet: context.bigBlind,
        minCall: context.bigBlind,
        minRaiseTo: context.bigBlind * 2,
        raiseCount: 0,
        lastAggressorPlayerId: null,
        investedByPlayer: preflopInvestedByPlayer,
      },
      flop: buildEmptyStreetState(sortedPlayers),
      turn: buildEmptyStreetState(sortedPlayers),
      river: buildEmptyStreetState(sortedPlayers),
    },
    pendingActionOrder: buildActionOrderForStreet(context, "preflop", sortedPlayers.map((player) => player.playerId)),
    events: [],
    preflopAggressorPlayerId: null,
    winnerPlayerIds: [],
    reachedShowdownPlayerIds: [],
    ended: false,
    endReason: null,
    needsReview: false,
    reviewReasons: [],
  };
}

export function processTranscribedHand(
  context: PokerHandContext,
  transcriptLines: PokerTranscriptLine[]
): PokerHandProcessingResult {
  let state = createInitialHandState(context);

  for (const line of [...transcriptLines].sort((left, right) => left.sequence - right.sequence)) {
    state = applyTranscriptLine(state, line);
  }

  const summary = buildHandSummary(state);

  return {
    state,
    summary,
    handStatistics: computeHandStatistics(summary),
  };
}

export function applyTranscriptLine(state: PokerHandState, transcriptLine: PokerTranscriptLine) {
  if (state.ended) {
    return appendEvent(state, buildReviewOnlyEvent(state, transcriptLine, ["mao ja encerrada"]));
  }

  let nextState = { ...state };

  if (transcriptLine.street && transcriptLine.street !== nextState.street) {
    nextState = moveToDeclaredStreet(nextState, transcriptLine.street);
  }

  const semanticIntent = parseSemanticIntent(nextState.context, transcriptLine);
  const event = resolveSemanticIntent(nextState, transcriptLine, semanticIntent);
  nextState = appendEvent(nextState, event);

  if (!event.playerId || !event.actionType) {
    return markReview(nextState, event.reviewReasons);
  }

  nextState = applyResolvedEvent(nextState, event);
  nextState = maybeAdvanceStreet(nextState);

  return nextState;
}

export function buildHandSummary(state: PokerHandState): PokerHandSummary {
  const finalStreet =
    state.ended && state.endReason === "showdown"
      ? "showdown"
      : state.street;

  const writtenSummary = state.events.map((event) => {
    const amountText =
      typeof event.amountTotal === "number" ? ` ${event.amountTotal}` : "";
    return `${event.street} - ${event.playerName ?? "Jogador"} ${event.actionType ?? "acao"}${amountText}`;
  });

  return {
    context: state.context,
    events: state.events,
    finalStreet,
    finalPot: state.potTotal,
    winnerPlayerIds: state.winnerPlayerIds,
    reachedShowdownPlayerIds: state.reachedShowdownPlayerIds,
    endReason: state.endReason,
    playersAtStreetStart: state.playersAtStreetStart,
    preflopAggressorPlayerId: state.preflopAggressorPlayerId,
    needsReview: state.needsReview,
    reviewReasons: state.reviewReasons,
    writtenSummary,
  };
}

function appendEvent(state: PokerHandState, event: PokerActionEvent) {
  return {
    ...state,
    events: [...state.events, event],
  };
}

function buildReviewOnlyEvent(
  state: PokerHandState,
  transcriptLine: PokerTranscriptLine,
  reviewReasons: string[]
): PokerActionEvent {
  return {
    sequence: transcriptLine.sequence,
    street: state.street,
    playerId: null,
    playerName: null,
    position: null,
    spokenText: transcriptLine.spokenText,
    actionType: null,
    isAllIn: false,
    needsReview: true,
    reviewReasons,
    confidenceScore: 0,
    tags: [],
  };
}

function resolveSemanticIntent(
  state: PokerHandState,
  transcriptLine: PokerTranscriptLine,
  semanticIntent: PokerSemanticIntent
): PokerActionEvent {
  const player = state.context.players.find(
    (contextPlayer) => contextPlayer.playerId === semanticIntent.playerId
  );
  const reviewReasons = [...semanticIntent.reviewReasons];
  let actionType: PokerActionType | null = null;
  let actionSubtype: PokerActionSubtype | undefined;
  let amountTotal: number | null = null;
  let amountIncrement: number | null = null;
  let isAllIn = semanticIntent.isAllInHint;
  const tags: PokerActionEvent["tags"] = [];

  if (!player) {
    reviewReasons.push("jogador fora da mesa ou nao reconhecido");
  }

  if (!player || state.street === "showdown") {
    return {
      sequence: transcriptLine.sequence,
      street: state.street,
      playerId: semanticIntent.playerId,
      playerName: semanticIntent.playerName,
      position: player?.position ?? null,
      spokenText: transcriptLine.spokenText,
      actionType,
      actionSubtype,
      amountTotal,
      amountIncrement,
      isAllIn,
      needsReview: true,
      reviewReasons,
      confidenceScore: semanticIntent.confidenceScore,
      tags,
    };
  }

  const streetState = state.streetStates[state.street];
  const playerStreetInvestment = streetState.investedByPlayer[player.playerId] ?? 0;
  const amountToCall = Math.max(streetState.currentBet - playerStreetInvestment, 0);
  const remainingStack = calculateRemainingStack(state, player);

  switch (semanticIntent.intentType) {
    case "fold":
      actionType = "fold";
      addFoldTag(tags, state.street);
      break;
    case "check":
      actionType = "check";
      if (streetState.currentBet > playerStreetInvestment) {
        reviewReasons.push("check com aposta ativa");
      }
      break;
    case "call":
      actionType = "call";
      amountTotal = streetState.currentBet;
      amountIncrement = amountToCall;
      if (amountToCall <= 0) {
        reviewReasons.push("call sem aposta ativa");
      }
      break;
    case "bet":
      if (state.street === "preflop" || streetState.currentBet > playerStreetInvestment) {
        actionType = "raise";
      } else {
        actionType = "bet";
      }
      amountTotal = semanticIntent.mentionedAmount;
      amountIncrement =
        typeof amountTotal === "number" ? amountTotal - playerStreetInvestment : null;
      break;
    case "raise":
      actionType = "raise";
      amountTotal = semanticIntent.mentionedAmount;
      amountIncrement =
        typeof amountTotal === "number" ? amountTotal - playerStreetInvestment : null;
      break;
    case "all_in":
      isAllIn = true;
      if (amountToCall > 0 && remainingStack !== null && amountToCall >= remainingStack) {
        actionType = "call";
        actionSubtype = "all_in_call";
      } else if (streetState.currentBet > playerStreetInvestment) {
        actionType = "raise";
        actionSubtype = "all_in_raise";
      } else {
        actionType = "bet";
        actionSubtype = "all_in_bet";
      }
      amountTotal =
        semanticIntent.mentionedAmount ??
        (remainingStack !== null ? playerStreetInvestment + remainingStack : null);
      amountIncrement =
        amountTotal !== null ? Math.max(amountTotal - playerStreetInvestment, 0) : null;
      break;
    default:
      reviewReasons.push("fala sem intencao interpretavel");
      break;
  }

  if (actionType === "raise") {
    const raiseSubtype = classifyRaiseSubtype(state.street, streetState.raiseCount + 1);
    if (raiseSubtype) {
      actionSubtype = actionSubtype ?? raiseSubtype;
      if (raiseSubtype === "open_raise") {
        tags.push("open_raise");
      }
      if (raiseSubtype === "3bet") {
        tags.push("three_bet");
      }
      if (raiseSubtype === "4bet") {
        tags.push("four_bet");
      }
    }

    if (typeof amountTotal === "number" && amountTotal < streetState.minRaiseTo && !isAllIn) {
      reviewReasons.push("raise abaixo do minimo");
    }
  }

  if (
    state.street === "preflop" &&
    actionType === "call" &&
    amountTotal === state.context.bigBlind &&
    streetState.raiseCount === 0
  ) {
    actionSubtype = "limp";
    tags.push("limp");
  }

  if (
    state.street === "preflop" &&
    actionType === "call" &&
    streetState.raiseCount > 0 &&
    player.position !== "SB" &&
    player.position !== "BB"
  ) {
    actionSubtype = actionSubtype ?? "cold_call";
    tags.push("cold_call");
  }

  if (
    state.street === "preflop" &&
    (player.position === "SB" || player.position === "BB") &&
    streetState.raiseCount > 0 &&
    (actionType === "call" || actionType === "raise")
  ) {
    tags.push("blind_defense");
    if (!actionSubtype) {
      actionSubtype = "blind_defense";
    }
  }

  if (
    state.street === "flop" &&
    actionType === "bet" &&
    state.preflopAggressorPlayerId === player.playerId
  ) {
    tags.push("cbet_done");
  }

  if (
    state.street === "turn" &&
    actionType === "bet" &&
    state.events.some(
      (event) =>
        event.playerId === player.playerId &&
        event.street === "flop" &&
        event.tags.includes("cbet_done")
    )
  ) {
    tags.push("double_barrel_done");
  }

  if (
    state.street === "river" &&
    actionType === "bet" &&
    state.events.some(
      (event) =>
        event.playerId === player.playerId &&
        event.street === "turn" &&
        event.tags.includes("double_barrel_done")
    )
  ) {
    tags.push("triple_barrel_done");
  }

  if (!state.pendingActionOrder.includes(player.playerId)) {
    reviewReasons.push("jogador fora da ordem esperada");
  }

  return {
    sequence: transcriptLine.sequence,
    street: state.street,
    playerId: player.playerId,
    playerName: player.playerName,
    position: player.position,
    spokenText: transcriptLine.spokenText,
    actionType,
    actionSubtype,
    amountTotal,
    amountIncrement,
    isAllIn,
    needsReview: reviewReasons.length > 0 || semanticIntent.needsReview,
    reviewReasons,
    confidenceScore: semanticIntent.confidenceScore,
    tags,
  };
}

function applyResolvedEvent(state: PokerHandState, event: PokerActionEvent) {
  if (!event.playerId || !event.actionType || event.street === "showdown") {
    return markReview(state, event.reviewReasons);
  }

  const nextState: PokerHandState = {
    ...state,
    activePlayerIds: [...state.activePlayerIds],
    foldedPlayerIds: [...state.foldedPlayerIds],
    allInPlayerIds: [...state.allInPlayerIds],
    investedTotalByPlayer: { ...state.investedTotalByPlayer },
    pendingActionOrder: state.pendingActionOrder.filter((playerId) => playerId !== event.playerId),
    streetStates: {
      ...state.streetStates,
      [event.street]: {
        ...state.streetStates[event.street],
        investedByPlayer: { ...state.streetStates[event.street].investedByPlayer },
      },
    },
  };
  const streetState = nextState.streetStates[event.street];
  const playerId = event.playerId;

  if (event.actionType === "fold") {
    nextState.activePlayerIds = nextState.activePlayerIds.filter((activeId) => activeId !== playerId);
    nextState.foldedPlayerIds.push(playerId);
  }

  if (event.actionType === "call" || event.actionType === "bet" || event.actionType === "raise") {
    const increment = Math.max(event.amountIncrement ?? 0, 0);
    streetState.investedByPlayer[playerId] =
      (streetState.investedByPlayer[playerId] ?? 0) + increment;
    nextState.investedTotalByPlayer[playerId] =
      (nextState.investedTotalByPlayer[playerId] ?? 0) + increment;
    nextState.potTotal += increment;
  }

  if (event.actionType === "bet") {
    streetState.currentBet = event.amountTotal ?? streetState.currentBet;
    streetState.minCall = streetState.currentBet;
    streetState.minRaiseTo = streetState.currentBet * 2;
    streetState.lastAggressorPlayerId = playerId;
    nextState.pendingActionOrder = buildPendingOrderAfterAggression(nextState, playerId);
  }

  if (event.actionType === "raise") {
    const previousBet = streetState.currentBet;
    const nextBet = event.amountTotal ?? previousBet;
    const raiseSize = Math.max(nextBet - previousBet, nextState.context.bigBlind);

    streetState.currentBet = nextBet;
    streetState.minCall = nextBet;
    streetState.minRaiseTo = nextBet + raiseSize;
    streetState.raiseCount += 1;
    streetState.lastAggressorPlayerId = playerId;
    nextState.pendingActionOrder = buildPendingOrderAfterAggression(nextState, playerId);

    if (event.street === "preflop" && !nextState.preflopAggressorPlayerId) {
      nextState.preflopAggressorPlayerId = playerId;
    }
  }

  if (event.isAllIn) {
    const playerContext = nextState.context.players.find((player) => player.playerId === playerId);
    const remainingStack = playerContext ? calculateRemainingStack(nextState, playerContext) : null;
    if (remainingStack === 0 || event.actionSubtype?.startsWith("all_in")) {
      if (!nextState.allInPlayerIds.includes(playerId)) {
        nextState.allInPlayerIds.push(playerId);
      }
      nextState.pendingActionOrder = nextState.pendingActionOrder.filter(
        (pendingPlayerId) => pendingPlayerId !== playerId
      );
    }
  }

  if (nextState.activePlayerIds.length === 1) {
    nextState.ended = true;
    nextState.endReason = "single_player_remaining";
    nextState.winnerPlayerIds = [...nextState.activePlayerIds];
    return nextState;
  }

  return nextState;
}

function maybeAdvanceStreet(state: PokerHandState) {
  if (state.ended) {
    return state;
  }

  let nextState = state;

  while (!nextState.ended && nextState.pendingActionOrder.length === 0) {
    const actionablePlayers = nextState.activePlayerIds.filter(
      (playerId) => !nextState.allInPlayerIds.includes(playerId)
    );

    if (nextState.street === "river") {
      nextState = {
        ...nextState,
        street: "showdown",
        ended: true,
        endReason: actionablePlayers.length <= 1 ? "all_in_without_showdown" : "showdown",
        reachedShowdownPlayerIds: [...nextState.activePlayerIds],
      };
      break;
    }

    const nextStreet = getNextStreet(nextState.street);
    if (!nextStreet) {
      break;
    }

    nextState = advanceStreet(nextState, nextStreet);

    if (nextState.pendingActionOrder.length === 0) {
      if (nextStreet === "river") {
        continue;
      }
    }
  }

  return nextState;
}

function advanceStreet(state: PokerHandState, nextStreet: BettingStreet) {
  const actionablePlayers = state.activePlayerIds.filter(
    (playerId) => !state.allInPlayerIds.includes(playerId)
  );

  return {
    ...state,
    street: nextStreet,
    playersAtStreetStart: {
      ...state.playersAtStreetStart,
      [nextStreet]: [...state.activePlayerIds],
    },
    pendingActionOrder: buildActionOrderForStreet(state.context, nextStreet, actionablePlayers),
  };
}

function moveToDeclaredStreet(state: PokerHandState, declaredStreet: PokerStreet) {
  if (declaredStreet === state.street || declaredStreet === "showdown") {
    return state;
  }

  const currentIndex = bettingStreets.indexOf(state.street as BettingStreet);
  const targetIndex = bettingStreets.indexOf(declaredStreet as BettingStreet);

  if (targetIndex < 0 || targetIndex <= currentIndex) {
    return markReview(state, ["street declarada incoerente com a progressao da mao"]);
  }

  let nextState = state;
  for (let index = currentIndex + 1; index <= targetIndex; index += 1) {
    nextState = advanceStreet(nextState, bettingStreets[index]);
  }

  return nextState;
}

function markReview(state: PokerHandState, reviewReasons: string[]) {
  if (reviewReasons.length === 0) {
    return state;
  }

  return {
    ...state,
    needsReview: true,
    reviewReasons: Array.from(new Set([...state.reviewReasons, ...reviewReasons])),
  };
}

function buildEmptyStreetState(players: PokerPlayerContext[]): PokerStreetState {
  return {
    currentBet: 0,
    minCall: 0,
    minRaiseTo: 0,
    raiseCount: 0,
    lastAggressorPlayerId: null,
    investedByPlayer: Object.fromEntries(players.map((player) => [player.playerId, 0])),
  };
}

function buildActionOrderForStreet(
  context: PokerHandContext,
  street: BettingStreet,
  activePlayerIds: string[]
) {
  const players = sortPlayersBySeat(context.players).filter((player) =>
    activePlayerIds.includes(player.playerId)
  );

  if (players.length === 0) {
    return [];
  }

  if (street === "preflop") {
    const bigBlindIndex = players.findIndex((player) => player.position === "BB");
    const startIndex = bigBlindIndex >= 0 ? (bigBlindIndex + 1) % players.length : 0;
    return rotatePlayerIds(players, startIndex);
  }

  const buttonIndex = players.findIndex((player) => player.playerId === context.buttonPlayerId);
  const startIndex = buttonIndex >= 0 ? (buttonIndex + 1) % players.length : 0;
  return rotatePlayerIds(players, startIndex);
}

function buildPendingOrderAfterAggression(state: PokerHandState, aggressorPlayerId: string) {
  const streetPlayers = state.playersAtStreetStart[state.street as BettingStreet].filter(
    (playerId) =>
      state.activePlayerIds.includes(playerId) &&
      !state.allInPlayerIds.includes(playerId) &&
      playerId !== aggressorPlayerId
  );
  const orderedPlayers = buildActionOrderForStreet(
    state.context,
    state.street as BettingStreet,
    streetPlayers
  );

  const aggressorIndex = orderedPlayers.findIndex((playerId) => playerId === aggressorPlayerId);
  if (aggressorIndex >= 0) {
    return [...orderedPlayers.slice(aggressorIndex + 1), ...orderedPlayers.slice(0, aggressorIndex)];
  }

  const sortedPlayers = sortPlayersBySeat(state.context.players)
    .map((player) => player.playerId)
    .filter((playerId) => streetPlayers.includes(playerId));
  const aggressorSeatIndex = sortPlayersBySeat(state.context.players).findIndex(
    (player) => player.playerId === aggressorPlayerId
  );

  if (aggressorSeatIndex < 0) {
    return sortedPlayers;
  }

  const startIndex = sortedPlayers.findIndex((playerId) => {
    const seatIndex = sortPlayersBySeat(state.context.players).findIndex(
      (player) => player.playerId === playerId
    );
    return seatIndex > aggressorSeatIndex;
  });

  return startIndex >= 0
    ? [...sortedPlayers.slice(startIndex), ...sortedPlayers.slice(0, startIndex)]
    : sortedPlayers;
}

function rotatePlayerIds(players: PokerPlayerContext[], startIndex: number) {
  const ids = players.map((player) => player.playerId);
  return [...ids.slice(startIndex), ...ids.slice(0, startIndex)];
}

function sortPlayersBySeat(players: PokerPlayerContext[]) {
  return [...players].sort((left, right) => left.seatIndex - right.seatIndex);
}

function classifyRaiseSubtype(street: PokerStreet, raiseCount: number) {
  if (street !== "preflop") {
    return undefined;
  }

  if (raiseCount === 1) {
    return "open_raise";
  }
  if (raiseCount === 2) {
    return "3bet";
  }
  if (raiseCount === 3) {
    return "4bet";
  }
  if (raiseCount >= 4) {
    return "5bet_plus";
  }

  return undefined;
}

function calculateRemainingStack(state: PokerHandState, player: PokerPlayerContext) {
  if (typeof player.startingStack !== "number") {
    return null;
  }

  return Math.max(player.startingStack - (state.investedTotalByPlayer[player.playerId] ?? 0), 0);
}

function addFoldTag(tags: PokerActionEvent["tags"], street: PokerStreet) {
  if (street === "preflop") {
    tags.push("folded_preflop");
  }
  if (street === "flop") {
    tags.push("folded_flop");
  }
  if (street === "turn") {
    tags.push("folded_turn");
  }
  if (street === "river") {
    tags.push("folded_river");
  }
}

function getNextStreet(street: PokerStreet): BettingStreet | null {
  if (street === "preflop") {
    return "flop";
  }
  if (street === "flop") {
    return "turn";
  }
  if (street === "turn") {
    return "river";
  }

  return null;
}
