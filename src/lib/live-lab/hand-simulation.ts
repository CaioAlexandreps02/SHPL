export type TranscriptSessionRecord = {
  id: string;
  title: string;
  createdAt: string;
  startedAt: string;
  endedAt: string;
  lineCount: number;
  content: string;
};

export type SimulatedStreet = "preflop" | "flop" | "turn" | "river" | "showdown";

export type ParsedTranscriptLine = {
  id: string;
  timestampLabel: string | null;
  source: string;
  content: string;
  normalizedContent: string;
  raw: string;
};

export type ParsedHandActionKind =
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "all-in"
  | "amount-only";

export type ParsedHandEvent =
  | {
      id: string;
      kind: "street";
      street: SimulatedStreet;
      detail: string | null;
      line: ParsedTranscriptLine;
    }
  | {
      id: string;
      kind: "action";
      action: ParsedHandActionKind;
      amount: number | null;
      line: ParsedTranscriptLine;
    };

export type ParsedTranscriptHand = {
  id: string;
  label: string;
  startLine: ParsedTranscriptLine;
  endLine: ParsedTranscriptLine | null;
  events: ParsedHandEvent[];
  rawLines: ParsedTranscriptLine[];
};

export type ParsedTranscriptSession = {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string;
  declaredSeatAssignments: SimulationSeatAssignment[] | null;
  declaredButtonSeatIndex: number | null;
  declaredBlindLabel: string | null;
  hands: ParsedTranscriptHand[];
};

export type SimulationSeatAssignment = {
  seatIndex: number;
  playerId: string | null;
  playerName: string | null;
};

export type SimulationSeatPosition =
  | "BTN"
  | "SB"
  | "BB"
  | "UTG"
  | "UTG+1"
  | "LJ"
  | "HJ"
  | "CO";

export type SimulatedAction = {
  id: string;
  street: SimulatedStreet;
  seatIndex: number | null;
  playerId: string | null;
  playerName: string;
  positionLabel: SimulationSeatPosition | null;
  action: ParsedHandActionKind;
  amount: number | null;
  rawText: string;
  source: string;
  timestampLabel: string | null;
  inference: "inferred-order" | "confirmed-name" | "corrected-by-name";
  notes: string[];
};

export type StreetReplay = {
  street: SimulatedStreet;
  title: string;
  announcements: string[];
  actions: SimulatedAction[];
};

export type HandReplay = {
  handId: string;
  sections: StreetReplay[];
  seatStates: Record<number, "waiting" | "folded" | "winner" | "active">;
  finalStreet: SimulatedStreet;
  finalActiveSeatIndexes: number[];
  buttonSeatIndex: number;
  positionsBySeatIndex: Partial<Record<number, SimulationSeatPosition>>;
  reviewNotes: string[];
};

const STREET_LABELS: Record<SimulatedStreet, string> = {
  preflop: "Preflop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};

export function parseTranscriptSessions(records: TranscriptSessionRecord[]) {
  return records.map(parseTranscriptSession).filter((session) => session.hands.length > 0);
}

export function parseTranscriptSession(record: TranscriptSessionRecord): ParsedTranscriptSession {
  const lines = record.content
    .split(/\r?\n/)
    .map((line, index) => parseTranscriptLine(line, index))
    .filter((line) => line.content.length > 0);
  const configuration = extractSessionConfiguration(lines);

  const hands: ParsedTranscriptHand[] = [];
  let currentHand: ParsedTranscriptHand | null = null;
  let handCounter = 1;

  for (const line of lines) {
    const isStart = isStartCommandLine(line);
    const isEnd = isEndCommandLine(line);

    if (isStart) {
      if (currentHand) {
        hands.push(currentHand);
      }

      currentHand = {
        id: `${record.id}-hand-${handCounter}`,
        label: `Partida ${handCounter}`,
        startLine: line,
        endLine: null,
        events: [],
        rawLines: [line],
      };
      handCounter += 1;
      continue;
    }

    if (!currentHand) {
      continue;
    }

    currentHand.rawLines.push(line);

    if (isEnd) {
      currentHand.endLine = line;
      hands.push(currentHand);
      currentHand = null;
      continue;
    }

    const parsedEvent = parseTranscriptEvent(line);

    if (parsedEvent) {
      currentHand.events.push(parsedEvent);
    }
  }

  if (currentHand) {
    hands.push(currentHand);
  }

  return {
    id: record.id,
    title: record.title,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    declaredSeatAssignments: configuration.seatAssignments,
    declaredButtonSeatIndex: configuration.buttonSeatIndex,
    declaredBlindLabel: configuration.blindLabel,
    hands,
  };
}

export function simulateTranscriptHand(
  hand: ParsedTranscriptHand,
  seats: SimulationSeatAssignment[],
  buttonSeatIndex: number,
  handOffset = 0,
): HandReplay {
  const seatMap = new Map(seats.map((seat) => [seat.seatIndex, seat]));
  const occupiedSeatIndexes = seats
    .filter((seat) => Boolean(seat.playerName))
    .map((seat) => seat.seatIndex)
    .sort((left, right) => left - right);
  const effectiveButtonSeatIndex = rotateButtonSeat(buttonSeatIndex, occupiedSeatIndexes, handOffset);
  const positionsBySeatIndex = buildPositionsBySeatIndex(occupiedSeatIndexes, effectiveButtonSeatIndex);

  const sections = createStreetSections();
  const seatStates = Object.fromEntries(
    Array.from({ length: 8 }, (_, seatIndex) => [
      seatIndex,
      occupiedSeatIndexes.includes(seatIndex) ? "waiting" : "active",
    ]),
  ) as Record<number, "waiting" | "folded" | "winner" | "active">;
  const reviewNotes: string[] = [];

  let activeSeatIndexes = [...occupiedSeatIndexes];
  let currentStreet: SimulatedStreet = "preflop";
  let pendingSeatIndexes = buildStreetOrder(currentStreet, activeSeatIndexes, effectiveButtonSeatIndex);

  for (const event of hand.events) {
    if (event.kind === "street") {
      sections[event.street].announcements.push(
        event.detail?.trim() ? event.detail : `${STREET_LABELS[event.street]} anunciado por voz.`,
      );

      if (event.street !== currentStreet) {
        currentStreet = event.street;
        pendingSeatIndexes =
          currentStreet === "showdown"
            ? []
            : buildStreetOrder(currentStreet, activeSeatIndexes, effectiveButtonSeatIndex);
      }

      continue;
    }

    const resolvedActor = resolveActingSeat(
      event.line,
      pendingSeatIndexes,
      activeSeatIndexes,
      seatMap,
    );

    if (resolvedActor.seatIndex === null) {
      reviewNotes.push(`Nao foi possivel inferir o jogador para a linha: ${event.line.content}`);
      continue;
    }

    const actingSeatIndex = resolvedActor.seatIndex;
    pendingSeatIndexes = pendingSeatIndexes.filter((seatIndex) => seatIndex !== actingSeatIndex);
    const inferredAmountAction =
      event.action === "amount-only"
        ? inferActionFromAmountOnly(event.amount, currentStreet, sections[currentStreet].actions)
        : null;
    const effectiveAction = inferredAmountAction?.action ?? event.action;
    const effectiveNotes = [
      ...resolvedActor.notes,
      ...(inferredAmountAction?.notes ?? []),
    ];

    const assignedSeat = seatMap.get(actingSeatIndex);
    sections[currentStreet].actions.push({
      id: event.id,
      street: currentStreet,
      seatIndex: actingSeatIndex,
      playerId: assignedSeat?.playerId ?? null,
      playerName: assignedSeat?.playerName ?? `Lugar ${actingSeatIndex + 1}`,
      positionLabel: positionsBySeatIndex[actingSeatIndex] ?? null,
      action: effectiveAction,
      amount: event.amount,
      rawText: event.line.content,
      source: event.line.source,
      timestampLabel: event.line.timestampLabel,
      inference: resolvedActor.inference,
      notes: effectiveNotes,
    });

    if (effectiveNotes.length > 0) {
      reviewNotes.push(...effectiveNotes);
    }

    if (effectiveAction === "fold") {
      activeSeatIndexes = activeSeatIndexes.filter((seatIndex) => seatIndex !== actingSeatIndex);
      pendingSeatIndexes = pendingSeatIndexes.filter((seatIndex) => seatIndex !== actingSeatIndex);
      seatStates[actingSeatIndex] = "folded";
    } else if (
      effectiveAction === "bet" ||
      effectiveAction === "raise" ||
      effectiveAction === "all-in"
    ) {
      pendingSeatIndexes = buildResponderOrder(actingSeatIndex, activeSeatIndexes);
      seatStates[actingSeatIndex] = "active";
    } else {
      seatStates[actingSeatIndex] = "active";
    }

    if (activeSeatIndexes.length === 1) {
      const winnerSeatIndex = activeSeatIndexes[0];
      seatStates[winnerSeatIndex] = "winner";
      sections[currentStreet].announcements.push(
        `Partida encerrada automaticamente: sobrou apenas ${seatMap.get(winnerSeatIndex)?.playerName ?? `Lugar ${winnerSeatIndex + 1}`}.`,
      );
      pendingSeatIndexes = [];
      continue;
    }

    if (pendingSeatIndexes.length === 0 && currentStreet !== "showdown" && activeSeatIndexes.length > 1) {
      const nextStreet = getNextStreet(currentStreet);

      if (nextStreet) {
        currentStreet = nextStreet;

        if (currentStreet !== "showdown") {
          pendingSeatIndexes = buildStreetOrder(currentStreet, activeSeatIndexes, effectiveButtonSeatIndex);
          sections[currentStreet].announcements.push(
            "Street inferida automaticamente pela ordem das acoes.",
          );
        } else {
          sections.showdown.announcements.push(
            "Showdown inferido automaticamente apos o encerramento das acoes.",
          );
        }
      }
    }
  }

  if (activeSeatIndexes.length === 1) {
    seatStates[activeSeatIndexes[0]] = "winner";
  }

  for (const seatIndex of activeSeatIndexes) {
    if (seatStates[seatIndex] !== "winner") {
      seatStates[seatIndex] = "active";
    }
  }

  return {
    handId: hand.id,
    sections: Object.values(sections).filter(
      (section) => section.actions.length > 0 || section.announcements.length > 0 || section.street === "preflop",
    ),
    seatStates,
    finalStreet: currentStreet,
    finalActiveSeatIndexes: activeSeatIndexes,
    buttonSeatIndex: effectiveButtonSeatIndex,
    positionsBySeatIndex,
    reviewNotes: Array.from(new Set(reviewNotes)),
  };
}

function parseTranscriptLine(rawLine: string, index: number): ParsedTranscriptLine {
  const match = rawLine.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*([^:]+):\s*(.+)$/);

  if (!match) {
    return {
      id: `line-${index + 1}`,
      timestampLabel: null,
      source: "Desconhecido",
      content: rawLine.trim(),
      normalizedContent: normalizeText(rawLine),
      raw: rawLine,
    };
  }

  const [, timestampLabel, source, content] = match;

  return {
    id: `line-${index + 1}`,
    timestampLabel,
    source: source.trim(),
    content: content.trim(),
    normalizedContent: normalizeText(content),
    raw: rawLine,
  };
}

function extractSessionConfiguration(lines: ParsedTranscriptLine[]) {
  const seatAssignments = Array.from({ length: 8 }, (_, seatIndex) => ({
    seatIndex,
    playerId: null,
    playerName: null,
  })) as SimulationSeatAssignment[];
  let hasDeclaredSeats = false;
  let buttonSeatIndex: number | null = null;
  let buttonPlayerName: string | null = null;
  let blindLabel: string | null = null;

  for (const line of lines) {
    const seatMatch = line.content.match(/^Lugar\s+(\d+)\s+(.+)$/i);

    if (seatMatch) {
      const seatIndex = Number.parseInt(seatMatch[1] ?? "", 10) - 1;
      const playerName = seatMatch[2]?.trim() ?? "";

      if (seatIndex >= 0 && seatIndex < 8 && playerName) {
        seatAssignments[seatIndex] = {
          seatIndex,
          playerId: null,
          playerName,
        };
        hasDeclaredSeats = true;
      }

      continue;
    }

    const buttonSeatMatch = line.content.match(/^Botao(?: inicial)?(?: no| em)?\s+Lugar\s+(\d+)$/i);

    if (buttonSeatMatch) {
      const seatIndex = Number.parseInt(buttonSeatMatch[1] ?? "", 10) - 1;

      if (seatIndex >= 0 && seatIndex < 8) {
        buttonSeatIndex = seatIndex;
      }

      continue;
    }

    const buttonPlayerMatch = line.content.match(/^Botao(?: inicial)?(?: no| em)\s+(.+)$/i);

    if (buttonPlayerMatch) {
      buttonPlayerName = buttonPlayerMatch[1]?.trim() ?? null;
      continue;
    }

    const blindMatch = line.content.match(/\bBlind\s+(\d+(?:[./]\d+)?\s*\/\s*\d+(?:[./]\d+)?)\b/i);

    if (blindMatch) {
      blindLabel = blindMatch[1]?.replace(/\s+/g, "") ?? null;
    }
  }

  if (buttonSeatIndex === null && buttonPlayerName) {
    const matchedSeat = seatAssignments.find(
      (seat) => normalizeText(seat.playerName ?? "") === normalizeText(buttonPlayerName),
    );

    if (matchedSeat) {
      buttonSeatIndex = matchedSeat.seatIndex;
    }
  }

  return {
    seatAssignments: hasDeclaredSeats ? seatAssignments : null,
    buttonSeatIndex,
    blindLabel,
  };
}

function parseTranscriptEvent(line: ParsedTranscriptLine): ParsedHandEvent | null {
  const street = detectStreet(line.normalizedContent);

  if (street) {
    return {
      id: `${line.id}-${street}`,
      kind: "street",
      street,
      detail: extractStreetDetail(line.content, street),
      line,
    };
  }

  const action = detectAction(line.normalizedContent);

  if (action) {
    return {
      id: `${line.id}-${action}`,
      kind: "action",
      action,
      amount: extractAmount(line.content),
      line,
    };
  }

  const standaloneAmount = detectStandaloneAmountUtterance(line.content, line.normalizedContent);

  if (standaloneAmount === null) {
    return null;
  }

  return {
    id: `${line.id}-amount-only`,
    kind: "action",
    action: "amount-only",
    amount: standaloneAmount,
    line,
  };
}

function isStartCommandLine(line: ParsedTranscriptLine) {
  return (
    line.source === "Sistema" &&
    /comando de voz detectado para iniciar partida/.test(line.normalizedContent)
  ) || /(^|\s)(nova partida|iniciar partida|comecar partida|abrir partida|nova mao|iniciar mao)(\s|$)/.test(line.normalizedContent);
}

function isEndCommandLine(line: ParsedTranscriptLine) {
  return (
    line.source === "Sistema" &&
    /comando de voz detectado para encerrar partida/.test(line.normalizedContent)
  ) || /(^|\s)(encerrar partida|fim da partida|partida encerrada|fechar partida|terminar partida|finalizar partida|encerrar mao|fim da mao|mao encerrada)(\s|$)/.test(line.normalizedContent);
}

function detectStreet(normalizedText: string): SimulatedStreet | null {
  if (/\bshowdown\b/.test(normalizedText)) {
    return "showdown";
  }

  if (/\briver\b/.test(normalizedText)) {
    return "river";
  }

  if (/\bturn\b/.test(normalizedText)) {
    return "turn";
  }

  if (/\bflop\b/.test(normalizedText)) {
    return "flop";
  }

  if (/\bpreflop\b/.test(normalizedText)) {
    return "preflop";
  }

  return null;
}

function detectAction(normalizedText: string): ParsedHandActionKind | null {
  if (/\ball[\s-]?in\b|\ballin\b/.test(normalizedText)) {
    return "all-in";
  }

  if (/\baumentou\b|\braise\b|\bre-raise\b|\bre raise\b|\bsubiu\b/.test(normalizedText)) {
    return "raise";
  }

  if (/\bapostou\b|\baposta\b|\bbet\b/.test(normalizedText)) {
    return "bet";
  }

  if (/\bpagou\b|\bcall\b|\bcobriu\b|\bacompanhou\b/.test(normalizedText)) {
    return "call";
  }

  if (/\bcheck\b|\bmesa\b|\bpassou\b/.test(normalizedText)) {
    return "check";
  }

  if (/\bfold\b|\blargou\b|\bdesistiu\b/.test(normalizedText)) {
    return "fold";
  }

  return null;
}

function extractAmount(text: string) {
  return extractSpokenAmountValue(text);
}

function detectStandaloneAmountUtterance(text: string, normalizedText: string) {
  const trimmedText = text.trim();

  if (!/^(?:r\$\s*)?\d+(?:[.,]\d+)?$/.test(trimmedText)) {
    const normalizedAmountOnly = extractSpokenAmountValue(normalizedText);

    if (normalizedAmountOnly !== null && looksLikeAmountWordsOnly(normalizedText)) {
      return normalizedAmountOnly;
    }

    const compactTokens = normalizedText
      .split(" ")
      .map((token) => token.trim())
      .filter(Boolean);

    if (compactTokens.length < 2 || compactTokens.length > 4) {
      return null;
    }

    const hasNumericToken = compactTokens.some((token) => /^(?:r\$)?\d+(?:[.,]\d+)?$/.test(token));
    const namedAmountOnly = extractNamedAmountValue(normalizedText);

    if (!hasNumericToken && namedAmountOnly === null) {
      return null;
    }

    const hasPokerVerb = compactTokens.some((token) =>
      /^(apostou|aposta|bet|raise|aumentou|subiu|call|pagou|check|mesa|passou|fold|largou|desistiu|allin|all-in)$/.test(
        token,
      ),
    );

    if (hasPokerVerb) {
      return null;
    }

    if (namedAmountOnly !== null) {
      return namedAmountOnly;
    }

    const numericToken = compactTokens.find((token) => /^(?:r\$)?\d+(?:[.,]\d+)?$/.test(token));

    return numericToken ? extractSpokenAmountValue(numericToken) : null;
  }

  return extractSpokenAmountValue(trimmedText);
}

function extractStreetDetail(text: string, street: SimulatedStreet) {
  const pattern = new RegExp(`${STREET_LABELS[street]}(?:\\s+e|\\s*:\\s*|\\s+)?`, "i");
  const detail = text.replace(pattern, "").trim();
  return detail.length > 0 && detail !== text ? detail : null;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extractSpokenAmountValue(text: string) {
  const numericAmount = extractNumericAmountValue(text);

  if (numericAmount !== null) {
    return numericAmount;
  }

  return extractPortugueseAmountValue(text);
}

function extractNumericAmountValue(text: string) {
  const matches = [...text.matchAll(/(?:r\$\s*)?(\d+(?:[.,]\d+)?)/gi)];

  if (matches.length === 0) {
    return null;
  }

  const rawValue = matches[matches.length - 1]?.[1] ?? "";
  const normalized = rawValue.replace(/\./g, "").replace(",", ".");
  const amount = Number.parseFloat(normalized);

  return Number.isFinite(amount) ? amount : null;
}

function extractPortugueseAmountValue(text: string) {
  const normalized = normalizeText(text).replace(/[^a-z0-9\s]/g, " ");
  const tokens = normalized.split(" ").filter(Boolean);
  let bestMatch: { value: number; length: number } | null = null;

  for (let start = 0; start < tokens.length; start += 1) {
    for (let end = start; end < Math.min(tokens.length, start + 6); end += 1) {
      const candidateValue = parsePortugueseNumberTokens(tokens.slice(start, end + 1));

      if (candidateValue === null || candidateValue < 5) {
        continue;
      }

      const candidateLength = end - start + 1;

      if (!bestMatch || candidateLength >= bestMatch.length) {
        bestMatch = {
          value: candidateValue,
          length: candidateLength,
        };
      }
    }
  }

  return bestMatch?.value ?? null;
}

function extractNamedAmountValue(normalizedText: string) {
  const tokens = normalizedText.split(" ").filter(Boolean);

  if (tokens.length < 2) {
    return null;
  }

  const amountTokens = tokens.slice(1).join(" ");
  return extractSpokenAmountValue(amountTokens);
}

function looksLikeAmountWordsOnly(normalizedText: string) {
  const tokens = normalizedText.split(" ").filter(Boolean);

  if (tokens.length === 0) {
    return false;
  }

  return tokens.every((token) => token === "e" || isPortugueseNumberToken(token));
}

function parsePortugueseNumberTokens(tokens: string[]) {
  if (tokens.length === 0) {
    return null;
  }

  let total = 0;
  let current = 0;
  let sawNumberWord = false;

  for (const token of tokens) {
    if (token === "e") {
      continue;
    }

    const numberValue = resolvePortugueseNumberToken(token);

    if (numberValue === null) {
      return null;
    }

    sawNumberWord = true;

    if (token === "mil") {
      total += (current || 1) * 1000;
      current = 0;
      continue;
    }

    current += numberValue;
  }

  if (!sawNumberWord) {
    return null;
  }

  return total + current;
}

function isPortugueseNumberToken(token: string) {
  return resolvePortugueseNumberToken(token) !== null;
}

function resolvePortugueseNumberToken(token: string) {
  const tokenMap: Record<string, number> = {
    zero: 0,
    um: 1,
    uma: 1,
    dois: 2,
    duas: 2,
    tres: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
    sete: 7,
    oito: 8,
    nove: 9,
    dez: 10,
    onze: 11,
    doze: 12,
    treze: 13,
    quatorze: 14,
    catorze: 14,
    quinze: 15,
    dezesseis: 16,
    dezessete: 17,
    dezoito: 18,
    dezenove: 19,
    vinte: 20,
    trinta: 30,
    quarenta: 40,
    cinquenta: 50,
    sessenta: 60,
    setenta: 70,
    oitenta: 80,
    noventa: 90,
    cem: 100,
    cento: 100,
    duzentos: 200,
    trezentos: 300,
    quatrocentos: 400,
    quinhentos: 500,
    seiscentos: 600,
    setecentos: 700,
    oitocentos: 800,
    novecentos: 900,
    mil: 1000,
  };

  return tokenMap[token] ?? null;
}

function createStreetSections(): Record<SimulatedStreet, StreetReplay> {
  return {
    preflop: { street: "preflop", title: STREET_LABELS.preflop, announcements: [], actions: [] },
    flop: { street: "flop", title: STREET_LABELS.flop, announcements: [], actions: [] },
    turn: { street: "turn", title: STREET_LABELS.turn, announcements: [], actions: [] },
    river: { street: "river", title: STREET_LABELS.river, announcements: [], actions: [] },
    showdown: {
      street: "showdown",
      title: STREET_LABELS.showdown,
      announcements: [],
      actions: [],
    },
  };
}

function inferActionFromAmountOnly(
  amount: number | null,
  street: SimulatedStreet,
  actions: SimulatedAction[],
) {
  const lastAggressiveAction = [...actions]
    .reverse()
    .find(
      (action) =>
        action.action === "bet" || action.action === "raise" || action.action === "all-in",
    );

  if (!lastAggressiveAction || lastAggressiveAction.amount === null || amount === null) {
    return {
      action: street === "preflop" ? ("call" as const) : ("bet" as const),
      notes: [
        `Valor falado sem verbo. Acao inferida como ${street === "preflop" ? "call" : "bet"} pelo contexto da street.`,
      ],
    };
  }

  if (Math.abs(lastAggressiveAction.amount - amount) < 0.001) {
    return {
      action: "call" as const,
      notes: ["Valor falado sem verbo. Acao inferida como call por repetir o valor em jogo."],
    };
  }

  if (amount > lastAggressiveAction.amount) {
    return {
      action: "raise" as const,
      notes: ["Valor falado sem verbo. Acao inferida como raise por aumentar o valor em jogo."],
    };
  }

  return {
    action: "call" as const,
    notes: ["Valor falado sem verbo. Acao inferida como call por contexto, mas a linha segue ambigua."],
  };
}

function buildStreetOrder(
  street: SimulatedStreet,
  activeSeatIndexes: number[],
  buttonSeatIndex: number,
) {
  if (activeSeatIndexes.length === 0) {
    return [];
  }

  const startSeatIndex =
    street === "preflop"
      ? getNthActiveSeatAfter(buttonSeatIndex, activeSeatIndexes, 3)
      : getNthActiveSeatAfter(buttonSeatIndex, activeSeatIndexes, 1);

  return buildCircularSeatOrder(startSeatIndex, activeSeatIndexes);
}

function buildResponderOrder(actingSeatIndex: number, activeSeatIndexes: number[]) {
  if (activeSeatIndexes.length === 0) {
    return [];
  }

  const startSeatIndex = getNthActiveSeatAfter(actingSeatIndex, activeSeatIndexes, 1);
  return buildCircularSeatOrder(startSeatIndex, activeSeatIndexes).filter(
    (seatIndex) => seatIndex !== actingSeatIndex,
  );
}

function buildCircularSeatOrder(startSeatIndex: number, activeSeatIndexes: number[]) {
  const activeSeatSet = new Set(activeSeatIndexes);
  const order: number[] = [];
  let currentSeatIndex = startSeatIndex;

  for (let step = 0; step < 8; step += 1) {
    if (activeSeatSet.has(currentSeatIndex)) {
      order.push(currentSeatIndex);
    }

    currentSeatIndex = (currentSeatIndex + 1) % 8;
  }

  return order;
}

function getNthActiveSeatAfter(
  seatIndex: number,
  activeSeatIndexes: number[],
  stepsForward: number,
) {
  const activeSeatSet = new Set(activeSeatIndexes);
  let currentSeatIndex = seatIndex;
  let remainingSteps = Math.max(stepsForward, 1);

  while (remainingSteps > 0) {
    currentSeatIndex = (currentSeatIndex + 1) % 8;

    if (activeSeatSet.has(currentSeatIndex)) {
      remainingSteps -= 1;
    }
  }

  return currentSeatIndex;
}

function resolveActingSeat(
  line: ParsedTranscriptLine,
  pendingSeatIndexes: number[],
  activeSeatIndexes: number[],
  seatMap: Map<number, SimulationSeatAssignment>,
) {
  const expectedSeatIndex = pendingSeatIndexes[0] ?? activeSeatIndexes[0] ?? null;
  const matchedSeatIndex = matchSeatByName(line.normalizedContent, seatMap);

  if (matchedSeatIndex === null) {
    return {
      seatIndex: expectedSeatIndex,
      inference: "inferred-order" as const,
      notes: expectedSeatIndex === null ? [] : ["Jogador inferido apenas pela ordem da acao."],
    };
  }

  if (matchedSeatIndex === expectedSeatIndex) {
    return {
      seatIndex: matchedSeatIndex,
      inference: "confirmed-name" as const,
      notes: [],
    };
  }

  if (pendingSeatIndexes.includes(matchedSeatIndex) || activeSeatIndexes.includes(matchedSeatIndex)) {
    return {
      seatIndex: matchedSeatIndex,
      inference: "corrected-by-name" as const,
      notes: [
        `Ordem corrigida pelo nome falado: ${seatMap.get(matchedSeatIndex)?.playerName ?? `Lugar ${matchedSeatIndex + 1}`}.`,
      ],
    };
  }

  return {
    seatIndex: expectedSeatIndex,
    inference: "inferred-order" as const,
    notes: [
      `Nome falado nao encaixou na ordem ativa da mao: ${seatMap.get(matchedSeatIndex)?.playerName ?? `Lugar ${matchedSeatIndex + 1}`}.`,
    ],
  };
}

function matchSeatByName(
  normalizedText: string,
  seatMap: Map<number, SimulationSeatAssignment>,
) {
  const candidates = [...seatMap.values()]
    .filter((seat) => Boolean(seat.playerName))
    .map((seat) => ({
      seatIndex: seat.seatIndex,
      normalizedName: normalizeText(seat.playerName ?? ""),
    }))
    .filter((seat) => seat.normalizedName.length > 0)
    .sort((left, right) => right.normalizedName.length - left.normalizedName.length);

  const match = candidates.find((candidate) => normalizedText.includes(candidate.normalizedName));
  return match?.seatIndex ?? null;
}

function rotateButtonSeat(
  baseButtonSeatIndex: number,
  occupiedSeatIndexes: number[],
  handOffset: number,
) {
  if (occupiedSeatIndexes.length === 0) {
    return baseButtonSeatIndex;
  }

  const normalizedBaseIndex = occupiedSeatIndexes.includes(baseButtonSeatIndex)
    ? occupiedSeatIndexes.indexOf(baseButtonSeatIndex)
    : 0;
  const nextIndex =
    (normalizedBaseIndex + Math.max(handOffset, 0)) % occupiedSeatIndexes.length;
  return occupiedSeatIndexes[nextIndex] ?? baseButtonSeatIndex;
}

function buildPositionsBySeatIndex(
  occupiedSeatIndexes: number[],
  buttonSeatIndex: number,
): Partial<Record<number, SimulationSeatPosition>> {
  const labels: SimulationSeatPosition[] = ["BTN", "SB", "BB", "UTG", "UTG+1", "LJ", "HJ", "CO"];

  if (occupiedSeatIndexes.length === 0) {
    return {};
  }

  const orderedSeatIndexes = buildCircularSeatOrder(buttonSeatIndex, occupiedSeatIndexes);

  return Object.fromEntries(
    orderedSeatIndexes.map((seatIndex, index) => [seatIndex, labels[index] ?? "CO"]),
  );
}

function getNextStreet(street: SimulatedStreet): SimulatedStreet | null {
  if (street === "preflop") {
    return "flop";
  }

  if (street === "flop") {
    return "turn";
  }

  if (street === "turn") {
    return "river";
  }

  if (street === "river") {
    return "showdown";
  }

  return null;
}
