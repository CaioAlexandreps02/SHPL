import type {
  PokerHandContext,
  PokerSemanticIntent,
  PokerSemanticIntentType,
  PokerTranscriptLine,
} from "@/lib/poker/types";

const synonymDictionary: Array<{
  intentType: PokerSemanticIntentType;
  phrases: string[];
}> = [
  {
    intentType: "fold",
    phrases: ["passou a mao", "desistiu", "largou", "foldou", "saiu", "fold"],
  },
  {
    intentType: "all_in",
    phrases: ["all in", "all-in", "foi tudo", "colocou tudo", "apostou tudo", "shovou", "tudo"],
  },
  {
    intentType: "raise",
    phrases: [
      "aumentou para",
      "subiu para",
      "voltou para",
      "colocou para",
      "puxou para",
      "aumentou",
      "subiu",
      "voltou",
      "raise",
      "fez tanto",
      "fez",
    ],
  },
  {
    intentType: "bet",
    phrases: ["saiu apostando", "apostou", "aposta", "mandou", "colocou", "bet"],
  },
  {
    intentType: "call",
    phrases: ["acompanhou", "acompanha", "foi junto", "completou", "pagou", "paga", "call"],
  },
  {
    intentType: "check",
    phrases: ["bateu mesa", "mesa", "passou", "check"],
  },
];

export function normalizePokerText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAmountFromSpeech(value: string) {
  const normalized = normalizePokerText(value);
  const amountMatches = normalized.match(/\d[\d.]*/g);

  if (!amountMatches || amountMatches.length === 0) {
    return null;
  }

  const numericValue = Number.parseInt(amountMatches[amountMatches.length - 1].replace(/\./g, ""), 10);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function matchPlayerFromSpeech(context: PokerHandContext, spokenText: string) {
  const normalizedText = normalizePokerText(spokenText);
  const candidates = context.players.flatMap((player) => {
    const aliases = [player.playerName, ...(player.aliases ?? [])];

    return aliases.map((alias) => ({
      playerId: player.playerId,
      playerName: player.playerName,
      alias,
      normalizedAlias: normalizePokerText(alias),
    }));
  });

  const matchedCandidate = candidates
    .filter((candidate) => candidate.normalizedAlias && normalizedText.includes(candidate.normalizedAlias))
    .sort((left, right) => right.normalizedAlias.length - left.normalizedAlias.length)[0];

  if (!matchedCandidate) {
    return null;
  }

  return {
    playerId: matchedCandidate.playerId,
    playerName: matchedCandidate.playerName,
    aliasMatched: matchedCandidate.alias,
  };
}

export function parseSemanticIntent(
  context: PokerHandContext,
  transcriptLine: PokerTranscriptLine
): PokerSemanticIntent {
  const normalizedText = normalizePokerText(transcriptLine.spokenText);
  const matchedPlayer = matchPlayerFromSpeech(context, transcriptLine.spokenText);
  const mentionedAmount = parseAmountFromSpeech(transcriptLine.spokenText);
  const matchedIntent = synonymDictionary.find((dictionaryEntry) =>
    dictionaryEntry.phrases.some((phrase) => normalizedText.includes(normalizePokerText(phrase)))
  );
  const isAllInHint = synonymDictionary
    .find((dictionaryEntry) => dictionaryEntry.intentType === "all_in")
    ?.phrases.some((phrase) => normalizedText.includes(normalizePokerText(phrase))) ?? false;
  const reviewReasons: string[] = [];
  let confidenceScore = 0.95;

  if (!matchedPlayer) {
    reviewReasons.push("nome do jogador nao identificado");
    confidenceScore -= 0.25;
  }

  if (!matchedIntent) {
    reviewReasons.push("fala sem intencao reconhecida");
    confidenceScore -= 0.3;
  }

  if (normalizedText === "passou") {
    reviewReasons.push("fala ambigua entre check e fold");
    confidenceScore -= 0.2;
  }

  return {
    sequence: transcriptLine.sequence,
    spokenText: transcriptLine.spokenText,
    normalizedText,
    playerId: matchedPlayer?.playerId ?? null,
    playerName: matchedPlayer?.playerName ?? null,
    aliasMatched: matchedPlayer?.aliasMatched ?? null,
    intentType: matchedIntent?.intentType ?? "unknown",
    mentionedAmount,
    isAllInHint,
    confidenceScore: Math.max(Number(confidenceScore.toFixed(2)), 0),
    needsReview: reviewReasons.length > 0,
    reviewReasons,
  };
}
