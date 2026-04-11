import type {
  PokerHandSummary,
  PokerPlayerHandStatistics,
  PokerPlayerProfile,
  PokerPlayerStatisticsAggregate,
  PokerProfileResult,
} from "@/lib/poker/types";

export function computeHandStatistics(summary: PokerHandSummary) {
  return summary.context.players.map<PokerPlayerHandStatistics>((player) => {
    const playerEvents = summary.events.filter((event) => event.playerId === player.playerId);
    const voluntaryPreflopEvent = playerEvents.find(
      (event) =>
        event.street === "preflop" &&
        (event.actionType === "call" || event.actionType === "raise") &&
        (event.amountIncrement ?? 0) > 0
    );
    const preflopRaiseEvent = playerEvents.find(
      (event) => event.street === "preflop" && event.actionType === "raise"
    );
    const limpEvent = playerEvents.find((event) => event.tags.includes("limp"));
    const foldedPreflopEvent = playerEvents.find(
      (event) => event.street === "preflop" && event.actionType === "fold"
    );
    const postflopEvents = playerEvents.filter(
      (event) =>
        event.street === "flop" || event.street === "turn" || event.street === "river"
    );
    const tags = Array.from(new Set(playerEvents.flatMap((event) => event.tags)));

    if (summary.playersAtStreetStart.flop.includes(player.playerId)) {
      tags.push("saw_flop");
    }
    if (summary.playersAtStreetStart.turn.includes(player.playerId)) {
      tags.push("saw_turn");
    }
    if (summary.playersAtStreetStart.river.includes(player.playerId)) {
      tags.push("saw_river");
    }
    if (summary.reachedShowdownPlayerIds.includes(player.playerId)) {
      tags.push("reached_showdown");
    }
    if (summary.winnerPlayerIds.includes(player.playerId) && summary.reachedShowdownPlayerIds.includes(player.playerId)) {
      tags.push("won_showdown");
    }

    return {
      playerId: player.playerId,
      playerName: player.playerName,
      handsPlayed: 1,
      vpipHands: voluntaryPreflopEvent ? 1 : 0,
      pfrHands: preflopRaiseEvent ? 1 : 0,
      limpHands: limpEvent ? 1 : 0,
      foldedPreflopHands: foldedPreflopEvent ? 1 : 0,
      postflopBets: postflopEvents.filter((event) => event.actionType === "bet").length,
      postflopRaises: postflopEvents.filter((event) => event.actionType === "raise").length,
      postflopCalls: postflopEvents.filter((event) => event.actionType === "call").length,
      postflopChecks: postflopEvents.filter((event) => event.actionType === "check").length,
      postflopFolds: postflopEvents.filter((event) => event.actionType === "fold").length,
      sawFlop: summary.playersAtStreetStart.flop.includes(player.playerId) ? 1 : 0,
      sawTurn: summary.playersAtStreetStart.turn.includes(player.playerId) ? 1 : 0,
      sawRiver: summary.playersAtStreetStart.river.includes(player.playerId) ? 1 : 0,
      reachedShowdown: summary.reachedShowdownPlayerIds.includes(player.playerId) ? 1 : 0,
      wonShowdown:
        summary.winnerPlayerIds.includes(player.playerId) &&
        summary.reachedShowdownPlayerIds.includes(player.playerId)
          ? 1
          : 0,
      cbetFlopOpportunity:
        summary.preflopAggressorPlayerId === player.playerId &&
        summary.playersAtStreetStart.flop.includes(player.playerId)
          ? 1
          : 0,
      cbetFlopDone: playerEvents.some((event) => event.tags.includes("cbet_done")) ? 1 : 0,
      tags: Array.from(new Set(tags)),
    };
  });
}

export function accumulatePlayerStatistics(
  currentAggregate: PokerPlayerStatisticsAggregate | null,
  handStatistics: PokerPlayerHandStatistics
): PokerPlayerStatisticsAggregate {
  const nextAggregate = {
    playerId: handStatistics.playerId,
    playerName: handStatistics.playerName,
    handsPlayed: (currentAggregate?.handsPlayed ?? 0) + handStatistics.handsPlayed,
    vpipHands: (currentAggregate?.vpipHands ?? 0) + handStatistics.vpipHands,
    pfrHands: (currentAggregate?.pfrHands ?? 0) + handStatistics.pfrHands,
    limpHands: (currentAggregate?.limpHands ?? 0) + handStatistics.limpHands,
    foldedPreflopHands:
      (currentAggregate?.foldedPreflopHands ?? 0) + handStatistics.foldedPreflopHands,
    postflopBets: (currentAggregate?.postflopBets ?? 0) + handStatistics.postflopBets,
    postflopRaises: (currentAggregate?.postflopRaises ?? 0) + handStatistics.postflopRaises,
    postflopCalls: (currentAggregate?.postflopCalls ?? 0) + handStatistics.postflopCalls,
    postflopChecks: (currentAggregate?.postflopChecks ?? 0) + handStatistics.postflopChecks,
    postflopFolds: (currentAggregate?.postflopFolds ?? 0) + handStatistics.postflopFolds,
    sawFlop: (currentAggregate?.sawFlop ?? 0) + handStatistics.sawFlop,
    sawTurn: (currentAggregate?.sawTurn ?? 0) + handStatistics.sawTurn,
    sawRiver: (currentAggregate?.sawRiver ?? 0) + handStatistics.sawRiver,
    reachedShowdown:
      (currentAggregate?.reachedShowdown ?? 0) + handStatistics.reachedShowdown,
    wonShowdown: (currentAggregate?.wonShowdown ?? 0) + handStatistics.wonShowdown,
    cbetFlopOpportunity:
      (currentAggregate?.cbetFlopOpportunity ?? 0) + handStatistics.cbetFlopOpportunity,
    cbetFlopDone: (currentAggregate?.cbetFlopDone ?? 0) + handStatistics.cbetFlopDone,
    vpip: 0,
    pfr: 0,
    limpPercentage: 0,
    foldPreflopPercentage: 0,
    aggressionFactor: 0,
    aggressionFrequency: 0,
    wtsd: 0,
    wsd: 0,
    cbetFlop: 0,
    tags: Array.from(new Set([...(currentAggregate?.tags ?? []), ...handStatistics.tags])),
  };

  nextAggregate.vpip = ratio(nextAggregate.vpipHands, nextAggregate.handsPlayed);
  nextAggregate.pfr = ratio(nextAggregate.pfrHands, nextAggregate.handsPlayed);
  nextAggregate.limpPercentage = ratio(nextAggregate.limpHands, nextAggregate.handsPlayed);
  nextAggregate.foldPreflopPercentage = ratio(
    nextAggregate.foldedPreflopHands,
    nextAggregate.handsPlayed
  );
  nextAggregate.aggressionFactor = safeDivision(
    nextAggregate.postflopBets + nextAggregate.postflopRaises,
    nextAggregate.postflopCalls
  );
  nextAggregate.aggressionFrequency = safeDivision(
    nextAggregate.postflopBets + nextAggregate.postflopRaises,
    nextAggregate.postflopBets +
      nextAggregate.postflopRaises +
      nextAggregate.postflopCalls +
      nextAggregate.postflopChecks +
      nextAggregate.postflopFolds
  );
  nextAggregate.wtsd = ratio(nextAggregate.reachedShowdown, nextAggregate.sawFlop);
  nextAggregate.wsd = ratio(nextAggregate.wonShowdown, nextAggregate.reachedShowdown);
  nextAggregate.cbetFlop = ratio(
    nextAggregate.cbetFlopDone,
    nextAggregate.cbetFlopOpportunity
  );

  return nextAggregate;
}

export function inferPlayerProfile(
  aggregate: PokerPlayerStatisticsAggregate
): PokerProfileResult {
  const secondaryProfiles: PokerPlayerProfile[] = [];
  let primaryProfile: PokerPlayerProfile = "regular";

  if (aggregate.vpip < 0.18 && aggregate.pfr < 0.11) {
    primaryProfile = "tight_passive";
  } else if (aggregate.vpip < 0.26 && aggregate.pfr >= 0.13) {
    primaryProfile = "tight_aggressive";
  } else if (aggregate.vpip >= 0.28 && aggregate.aggressionFrequency < 0.28) {
    primaryProfile = "loose_passive";
  } else if (aggregate.vpip >= 0.28 && aggregate.aggressionFrequency >= 0.32) {
    primaryProfile = "loose_aggressive";
  }

  if (aggregate.vpip < 0.14) {
    secondaryProfiles.push("nit");
  }
  if (aggregate.aggressionFrequency < 0.2 && aggregate.wtsd >= 0.34) {
    secondaryProfiles.push("calling_station");
  }
  if (aggregate.vpip >= 0.38 && aggregate.pfr >= 0.28 && aggregate.aggressionFrequency >= 0.45) {
    secondaryProfiles.push("maniac");
  }
  if (
    primaryProfile === "tight_aggressive" &&
    aggregate.vpip >= 0.18 &&
    aggregate.vpip <= 0.28 &&
    aggregate.pfr >= 0.14 &&
    aggregate.pfr <= 0.24
  ) {
    secondaryProfiles.push("regular");
  }

  return {
    primaryProfile,
    secondaryProfiles: Array.from(new Set(secondaryProfiles)).filter(
      (profile) => profile !== primaryProfile
    ),
  };
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;
}

function safeDivision(numerator: number, denominator: number) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;
}
