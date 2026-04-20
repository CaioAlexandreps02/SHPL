"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";

import {
  simulateTranscriptHand,
  type HandReplay,
  type ParsedTranscriptSession,
  type SimulatedAction,
  type SimulatedStreet,
  type SimulationSeatAssignment,
} from "@/lib/live-lab/hand-simulation";

type KnownPlayer = {
  id: string;
  name: string;
};

type ReplayTimelineStep = {
  id: string;
  street: SimulatedStreet;
  description: string;
  action: SimulatedAction | null;
};

type ReplaySeatMarker =
  | {
      type: "chips";
      amount: number | null;
      actionLabel: string;
    }
  | {
      type: "fold";
    }
  | {
      type: "check";
    };

type ReplayVisualState = {
  seatStates: Record<number, "waiting" | "folded" | "winner" | "active">;
  seatMarkers: Partial<Record<number, ReplaySeatMarker>>;
  currentActorSeatIndex: number | null;
};

const inputClassName =
  "h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none";

export function StatisticsSimulationPanel({
  playerOptions,
  sessions,
}: {
  playerOptions: KnownPlayer[];
  sessions: ParsedTranscriptSession[];
}) {
  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.id ?? "");
  const [selectedHandId, setSelectedHandId] = useState("");
  const [currentReplayStepIndex, setCurrentReplayStepIndex] = useState(0);
  const effectiveSessionId =
    selectedSessionId && sessions.some((session) => session.id === selectedSessionId)
      ? selectedSessionId
      : sessions[0]?.id ?? "";

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === effectiveSessionId) ?? null,
    [effectiveSessionId, sessions],
  );
  const effectiveHandId =
    selectedHandId && selectedSession?.hands.some((hand) => hand.id === selectedHandId)
      ? selectedHandId
      : selectedSession?.hands[0]?.id ?? "";

  const selectedHand = useMemo(
    () => selectedSession?.hands.find((hand) => hand.id === effectiveHandId) ?? null,
    [effectiveHandId, selectedSession],
  );
  const selectedHandIndex = useMemo(
    () => selectedSession?.hands.findIndex((hand) => hand.id === effectiveHandId) ?? -1,
    [effectiveHandId, selectedSession],
  );
  const effectiveSeatAssignments = useMemo(
    () =>
      selectedSession?.declaredSeatAssignments
        ? normalizeSeatAssignments(selectedSession.declaredSeatAssignments, playerOptions)
        : buildDefaultSeatAssignments(playerOptions),
    [playerOptions, selectedSession],
  );
  const effectiveButtonSeatIndex =
    selectedSession?.declaredButtonSeatIndex ?? effectiveSeatAssignments[0]?.seatIndex ?? 0;
  const currentBigBlindAmount = useMemo(
    () => extractBigBlindAmount(selectedSession?.declaredBlindLabel ?? null),
    [selectedSession],
  );

  const handReplay = useMemo(() => {
    if (!selectedHand) {
      return null;
    }

    return simulateTranscriptHand(
      selectedHand,
      effectiveSeatAssignments,
      effectiveButtonSeatIndex,
      Math.max(selectedHandIndex, 0),
    );
  }, [effectiveButtonSeatIndex, effectiveSeatAssignments, selectedHand, selectedHandIndex]);

  const replayTimeline = useMemo(
    () => buildReplayTimeline(handReplay, effectiveSeatAssignments),
    [effectiveSeatAssignments, handReplay],
  );
  const effectiveReplayStepIndex =
    replayTimeline.length > 0 ? Math.min(currentReplayStepIndex, replayTimeline.length - 1) : 0;
  const currentReplayStep = replayTimeline[effectiveReplayStepIndex] ?? null;
  const replayVisualState: ReplayVisualState = useMemo(
    () =>
      deriveReplayVisualState(
        effectiveSeatAssignments,
        handReplay,
        replayTimeline,
        effectiveReplayStepIndex,
        currentBigBlindAmount,
      ),
    [
      currentBigBlindAmount,
      effectiveReplayStepIndex,
      effectiveSeatAssignments,
      handReplay,
      replayTimeline,
    ],
  );
  const currentSeatStates = replayVisualState.seatStates;
  const totalActionCount = useMemo(
    () => handReplay?.sections.reduce((total, section) => total + section.actions.length, 0) ?? 0,
    [handReplay],
  );
  const occupiedSeats = useMemo(
    () => effectiveSeatAssignments.filter((seat) => Boolean(seat.playerName)).length,
    [effectiveSeatAssignments],
  );
  const hasPreviousReplayStep = effectiveReplayStepIndex > 0 || selectedHandIndex > 0;
  const hasNextReplayStep =
    (replayTimeline.length > 0 && effectiveReplayStepIndex < replayTimeline.length - 1) ||
    (selectedSession !== null &&
      selectedHandIndex >= 0 &&
      selectedHandIndex < selectedSession.hands.length - 1);

  const handleAdvanceReplay = useCallback(() => {
    if (replayTimeline.length > 0 && effectiveReplayStepIndex < replayTimeline.length - 1) {
      setCurrentReplayStepIndex((currentValue) => currentValue + 1);
      return;
    }

    if (!selectedSession || selectedHandIndex < 0) {
      return;
    }

    const nextHand = selectedSession.hands[selectedHandIndex + 1];

    if (!nextHand) {
      return;
    }

    setSelectedHandId(nextHand.id);
    setCurrentReplayStepIndex(0);
  }, [effectiveReplayStepIndex, replayTimeline.length, selectedHandIndex, selectedSession]);

  const handleRewindReplay = useCallback(() => {
    if (effectiveReplayStepIndex > 0) {
      setCurrentReplayStepIndex((currentValue) => currentValue - 1);
      return;
    }

    if (!selectedSession || selectedHandIndex <= 0) {
      return;
    }

    const previousHand = selectedSession.hands[selectedHandIndex - 1];

    if (!previousHand) {
      return;
    }

    setSelectedHandId(previousHand.id);
    setCurrentReplayStepIndex(0);
  }, [effectiveReplayStepIndex, selectedHandIndex, selectedSession]);

  if (sessions.length === 0) {
    return null;
  }

  return (
    <article className="rounded-[1.35rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-[rgba(236,225,196,0.48)]">
        Mesa simulada
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
        Replay visual da mao
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[rgba(236,225,196,0.7)]">
        Painel administrativo para validar a leitura dos TXT gravados. Aqui a mesa simulada
        continua disponivel para acompanhar o passo a passo da mao.
      </p>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.58)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Sessao gravada">
              <select
                className={inputClassName}
                onChange={(event) => {
                  setSelectedSessionId(event.target.value);
                  setSelectedHandId("");
                  setCurrentReplayStepIndex(0);
                }}
                value={effectiveSessionId}
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title} - {formatShortDateTime(session.startedAt)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Partida">
              <select
                className={inputClassName}
                onChange={(event) => {
                  setSelectedHandId(event.target.value);
                  setCurrentReplayStepIndex(0);
                }}
                value={effectiveHandId}
              >
                {selectedSession?.hands.map((hand) => (
                  <option key={hand.id} value={hand.id}>
                    {hand.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <InfoCard label="TXT selecionado" value={selectedSession?.title ?? "-"} />
            <InfoCard label="Partida atual" value={selectedHand?.label ?? "-"} />
            <InfoCard label="Acoes lidas" value={String(totalActionCount)} />
            <InfoCard
              label="Fim inferido"
              value={handReplay ? formatReplayStreetLabel(handReplay.finalStreet) : "-"}
            />
          </div>
        </div>

        <div className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.58)] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
            Resumo da mesa
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <InfoCard label="Jogadores sentados" value={String(occupiedSeats)} />
            <InfoCard
              label="Jogadores ativos"
              value={String(handReplay?.finalActiveSeatIndexes.length ?? 0)}
            />
            <InfoCard label="Botao da sessao" value={`Lugar ${effectiveButtonSeatIndex + 1}`} />
          </div>
        </div>
      </div>

      <div className="relative mt-6 flex min-h-[520px] items-center justify-center overflow-hidden rounded-[1.9rem] border border-[rgba(255,208,101,0.14)] bg-[radial-gradient(circle_at_center,rgba(23,92,58,0.76),rgba(7,24,18,0.98)_72%)] px-4 py-6">
        <div className="absolute h-[68%] w-[78%] rounded-full border-[3px] border-[rgba(255,208,101,0.22)] bg-[radial-gradient(circle_at_center,rgba(20,92,57,0.84),rgba(8,34,24,0.96)_70%)] shadow-[inset_0_0_0_1px_rgba(255,208,101,0.06)]" />
        <div className="absolute h-[46%] w-[54%] rounded-full border border-[rgba(255,208,101,0.14)]" />
        <div className="relative z-10 flex min-w-[280px] max-w-[460px] flex-col items-center px-7 py-6 text-center">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-[rgba(236,225,196,0.5)]">
            Passo atual
          </p>
          <p className="mt-3 text-4xl font-black uppercase tracking-[0.12em] text-[rgba(255,244,214,0.98)] md:text-[2.8rem]">
            {currentReplayStep ? formatReplayStreetLabel(currentReplayStep.street) : "Aguardando"}
          </p>
          {renderStreetVisual(currentReplayStep?.street ?? null)}
        </div>

        {effectiveSeatAssignments.map((seat) => {
          const seatPosition = getSeatPosition(seat.seatIndex);
          const isButton = seat.seatIndex === handReplay?.buttonSeatIndex;
          const seatState = currentSeatStates[seat.seatIndex] ?? "waiting";
          const positionLabel = handReplay?.positionsBySeatIndex[seat.seatIndex] ?? null;
          const isCurrentActor = replayVisualState.currentActorSeatIndex === seat.seatIndex;
          const actionMarker = replayVisualState.seatMarkers[seat.seatIndex] ?? null;
          const actionMarkerPosition = getSeatActionMarkerPosition(seat.seatIndex);

          return (
            <div className="contents" key={`statistics-seat-${seat.seatIndex}`}>
              <div
                className={`absolute flex h-[78px] w-[110px] flex-col items-center justify-center rounded-[1.55rem] border px-3 py-2 text-center shadow-[0_14px_28px_rgba(0,0,0,0.22)] ${getSeatVisualClassName(
                  seat.playerName,
                  seatState,
                  isCurrentActor,
                )}`}
                style={seatPosition}
              >
                <span className="text-[0.66rem] uppercase tracking-[0.18em] text-[rgba(236,225,196,0.54)]">
                  Lugar {seat.seatIndex + 1}
                </span>
                <span className="mt-1.5 line-clamp-1 text-sm font-semibold text-[rgba(255,244,214,0.96)]">
                  {seat.playerName ?? "Vazio"}
                </span>
                <span className="mt-1 text-[0.65rem] uppercase tracking-[0.16em] text-[rgba(236,225,196,0.54)]">
                  {isButton ? "Botao" : positionLabel ?? formatSeatStateLabel(seatState)}
                </span>
              </div>
              {actionMarker ? (
                <div className="absolute z-20" style={actionMarkerPosition}>
                  {renderSeatActionMarker(actionMarker)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
            Replay da mesa
          </p>
          <p className="mt-2 text-sm leading-6 text-[rgba(236,225,196,0.72)]">
            {currentReplayStep?.description ??
              "Selecione uma partida para navegar pela simulacao passo a passo."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="h-11 rounded-full border border-[rgba(255,208,101,0.18)] bg-[rgba(7,24,18,0.82)] px-5 text-sm font-black uppercase tracking-[0.14em] text-[rgba(255,244,214,0.9)] transition hover:border-[rgba(255,208,101,0.3)] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!hasPreviousReplayStep}
            onClick={handleRewindReplay}
            type="button"
          >
            Voltar
          </button>
          <button
            className="h-11 rounded-full border border-[rgba(255,208,101,0.18)] bg-[rgba(255,183,32,0.14)] px-5 text-sm font-black uppercase tracking-[0.14em] text-[rgba(255,244,214,0.94)] transition hover:border-[rgba(255,208,101,0.32)] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!hasNextReplayStep}
            onClick={handleAdvanceReplay}
            type="button"
          >
            Avancar
          </button>
        </div>
      </div>
    </article>
  );
}

function buildDefaultSeatAssignments(players: KnownPlayer[]): SimulationSeatAssignment[] {
  return Array.from({ length: 8 }, (_, seatIndex) => {
    const player = players[seatIndex];

    return {
      seatIndex,
      playerId: player?.id ?? null,
      playerName: player?.name ?? null,
    };
  });
}

function normalizeSeatAssignments(
  assignments: SimulationSeatAssignment[],
  players: KnownPlayer[],
) {
  const playerMap = new Map(players.map((player) => [player.id, player.name]));

  return Array.from({ length: 8 }, (_, seatIndex) => {
    const savedSeat = assignments.find((assignment) => assignment.seatIndex === seatIndex);
    const playerId = savedSeat?.playerId ?? null;

    return {
      seatIndex,
      playerId,
      playerName: playerId
        ? playerMap.get(playerId) ?? savedSeat?.playerName ?? null
        : savedSeat?.playerName ?? null,
    };
  });
}

function buildReplayTimeline(
  handReplay: HandReplay | null,
  seatAssignments: SimulationSeatAssignment[],
): ReplayTimelineStep[] {
  if (!handReplay) {
    return [];
  }

  const timeline: ReplayTimelineStep[] = [];
  const positionSummary = seatAssignments
    .filter((seat) => seat.playerName)
    .map((seat) => {
      const positionLabel =
        handReplay.positionsBySeatIndex[seat.seatIndex] ?? `Lugar ${seat.seatIndex + 1}`;
      return `${seat.playerName} ${positionLabel}`;
    })
    .join(", ");

  timeline.push({
    id: `${handReplay.handId}-setup`,
    street: "preflop",
    description:
      positionSummary.length > 0
        ? `Mesa configurada: ${positionSummary}.`
        : "Mesa configurada para o inicio da partida.",
    action: null,
  });

  for (const section of handReplay.sections) {
    if (section.street !== "preflop") {
      timeline.push({
        id: `${handReplay.handId}-${section.street}-street`,
        street: section.street,
        description:
          section.announcements[0] ??
          `A mao avancou para ${formatReplayStreetLabel(section.street).toLowerCase()}.`,
        action: null,
      });
    }

    for (const action of section.actions) {
      timeline.push({
        id: action.id,
        street: action.street,
        description: buildActionDescription(action),
        action,
      });
    }
  }

  return timeline;
}

function deriveReplayVisualState(
  seatAssignments: SimulationSeatAssignment[],
  handReplay: HandReplay | null,
  timeline: ReplayTimelineStep[],
  currentStepIndex: number,
  bigBlindAmount: number | null,
) {
  const baseStates = Object.fromEntries(
    Array.from({ length: 8 }, (_, seatIndex) => [
      seatIndex,
      seatAssignments[seatIndex]?.playerName ? "active" : "waiting",
    ]),
  ) as Record<number, "waiting" | "folded" | "winner" | "active">;
  const seatMarkers: Partial<Record<number, ReplaySeatMarker>> = {};

  if (!handReplay || timeline.length === 0) {
    return {
      seatStates: baseStates,
      seatMarkers,
      currentActorSeatIndex: null,
    };
  }

  let currentStreet = timeline[0]?.street ?? "preflop";
  let currentAmountToCall = bigBlindAmount;

  for (let index = 0; index <= currentStepIndex; index += 1) {
    const step = timeline[index];

    if (!step) {
      continue;
    }

    if (!step.action) {
      if (index > 0 && step.street !== currentStreet) {
        currentStreet = step.street;
        currentAmountToCall = null;

        for (const seatIndex of Object.keys(seatMarkers).map((value) => Number.parseInt(value, 10))) {
          if (seatMarkers[seatIndex]?.type === "chips" || seatMarkers[seatIndex]?.type === "check") {
            delete seatMarkers[seatIndex];
          }
        }
      }

      continue;
    }

    if (step.action.seatIndex === null) {
      continue;
    }

    const seatIndex = step.action.seatIndex;

    if (step.action.action === "fold") {
      baseStates[seatIndex] = "folded";
      seatMarkers[seatIndex] = { type: "fold" };
      continue;
    }

    if (
      step.action.action === "call" ||
      step.action.action === "bet" ||
      step.action.action === "raise" ||
      step.action.action === "all-in"
    ) {
      const visualAmount =
        step.action.action === "call" ? step.action.amount ?? currentAmountToCall : step.action.amount;

      seatMarkers[seatIndex] = {
        type: "chips",
        amount: visualAmount,
        actionLabel: formatActionLabel(step.action.action),
      };

      if (
        (step.action.action === "bet" ||
          step.action.action === "raise" ||
          step.action.action === "all-in") &&
        step.action.amount !== null
      ) {
        currentAmountToCall = step.action.amount;
      }
    } else if (step.action.action === "check") {
      seatMarkers[seatIndex] = { type: "check" };
    }

    if (baseStates[seatIndex] !== "folded") {
      baseStates[seatIndex] = "active";
    }
  }

  const currentStep = timeline[currentStepIndex];

  if (currentStep?.street === "showdown" && handReplay.finalActiveSeatIndexes.length === 1) {
    const winnerSeatIndex = handReplay.finalActiveSeatIndexes[0];

    if (winnerSeatIndex !== undefined) {
      baseStates[winnerSeatIndex] = "winner";
    }
  }

  return {
    seatStates: baseStates,
    seatMarkers,
    currentActorSeatIndex: currentStep?.action?.seatIndex ?? null,
  };
}

function getSeatPosition(seatIndex: number) {
  const positions = [
    { top: "7%", left: "50%", transform: "translate(-50%, 0)" },
    { top: "19%", right: "9%" },
    { top: "50%", right: "4%", transform: "translate(0, -50%)" },
    { bottom: "12%", right: "10%" },
    { bottom: "5%", left: "50%", transform: "translate(-50%, 0)" },
    { bottom: "12%", left: "10%" },
    { top: "50%", left: "4%", transform: "translate(0, -50%)" },
    { top: "19%", left: "9%" },
  ] as const;

  return positions[seatIndex] ?? positions[0];
}

function getSeatActionMarkerPosition(seatIndex: number) {
  const positions = [
    { top: "24%", left: "50%", transform: "translate(-50%, 0)" },
    { top: "31%", right: "23%" },
    { top: "50%", right: "20%", transform: "translate(0, -50%)" },
    { bottom: "27%", right: "24%" },
    { bottom: "23%", left: "50%", transform: "translate(-50%, 0)" },
    { bottom: "27%", left: "24%" },
    { top: "50%", left: "20%", transform: "translate(0, -50%)" },
    { top: "31%", left: "23%" },
  ] as const;

  return positions[seatIndex] ?? positions[0];
}

function getSeatVisualClassName(
  playerName: string | null,
  state: "waiting" | "folded" | "winner" | "active",
  isCurrentActor: boolean,
) {
  if (!playerName) {
    return "border-[rgba(255,208,101,0.16)] bg-[rgba(7,24,18,0.9)]";
  }

  if (isCurrentActor) {
    return "border-[rgba(255,183,32,0.42)] bg-[rgba(255,183,32,0.18)] shadow-[0_16px_32px_rgba(224,170,22,0.2)]";
  }

  if (state === "winner") {
    return "border-[rgba(129,196,255,0.42)] bg-[rgba(73,146,255,0.18)]";
  }

  if (state === "folded") {
    return "border-[rgba(129,196,255,0.28)] bg-[rgba(73,146,255,0.1)] opacity-75";
  }

  return "border-[rgba(129,196,255,0.34)] bg-[rgba(73,146,255,0.14)]";
}

function renderStreetVisual(street: SimulatedStreet | null) {
  if (!street || street === "preflop") {
    return null;
  }

  const count = getStreetCardBackCount(street);

  if (count === 0) {
    return null;
  }

  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
      {Array.from({ length: count }, (_, index) => (
        <div
          className="relative h-[74px] w-[52px] overflow-hidden rounded-[0.95rem] border border-[rgba(255,208,101,0.24)] shadow-[0_10px_18px_rgba(0,0,0,0.24)]"
          key={`street-card-back-${street}-${index}`}
        >
          <Image
            alt="Verso da carta"
            className="object-cover"
            fill
            sizes="52px"
            src="/images/statistics-card-back-blue.png"
          />
        </div>
      ))}
    </div>
  );
}

function renderSeatActionMarker(marker: ReplaySeatMarker) {
  if (marker.type === "fold") {
    return (
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            className={`relative h-[38px] w-[26px] overflow-hidden rounded-[0.65rem] border border-[rgba(255,208,101,0.24)] shadow-[0_8px_16px_rgba(0,0,0,0.22)] ${
              index === 1 ? "-ml-3 rotate-[10deg]" : "rotate-[-8deg]"
            }`}
            key={`fold-card-${index}`}
          >
            <Image
              alt="Carta descartada"
              className="object-cover"
              fill
              sizes="32px"
              src="/images/statistics-card-back-blue.png"
            />
          </div>
        ))}
      </div>
    );
  }

  if (marker.type === "check") {
    return (
      <div className="rounded-full border border-[rgba(129,196,255,0.24)] bg-[rgba(129,196,255,0.1)] px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[rgba(220,239,255,0.94)]">
        Check
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-[rgba(255,208,101,0.18)] bg-[rgba(7,24,18,0.84)] px-3 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.2)]">
      <ChipStackIcon />
      <div className="flex flex-col items-start">
        <span className="text-[0.56rem] font-black uppercase tracking-[0.14em] text-[rgba(236,225,196,0.5)]">
          {marker.actionLabel}
        </span>
        {marker.amount !== null ? (
          <span className="text-[0.82rem] font-black uppercase tracking-[0.1em] text-[rgba(255,244,214,0.96)]">
            {formatAmount(marker.amount)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ChipStackIcon() {
  return (
    <div className="relative h-9 w-11 overflow-hidden">
      <Image
        alt="Pilha de fichas"
        className="object-contain"
        fill
        sizes="44px"
        src="/images/statistics-chip-single-blue.png"
      />
    </div>
  );
}

function extractBigBlindAmount(blindLabel: string | null) {
  if (!blindLabel) {
    return null;
  }

  const parts = blindLabel.split("/");

  if (parts.length < 2) {
    return null;
  }

  const amount = Number.parseFloat((parts[1] ?? "").replace(",", ".").trim());
  return Number.isFinite(amount) ? amount : null;
}

function getStreetCardBackCount(street: SimulatedStreet) {
  if (street === "flop") {
    return 3;
  }

  if (street === "turn") {
    return 4;
  }

  if (street === "river" || street === "showdown") {
    return 5;
  }

  return 0;
}

function formatReplayStreetLabel(street: SimulatedStreet) {
  if (street === "preflop") {
    return "Pre-flop";
  }

  if (street === "flop") {
    return "Flop";
  }

  if (street === "turn") {
    return "Turn";
  }

  if (street === "river") {
    return "River";
  }

  return "Showdown";
}

function formatSeatStateLabel(state: "waiting" | "folded" | "winner" | "active") {
  if (state === "winner") {
    return "Vencedor";
  }

  if (state === "folded") {
    return "Foldou";
  }

  if (state === "active") {
    return "Ativo";
  }

  return "Aguardando";
}

function formatActionLabel(action: SimulatedAction["action"]) {
  if (action === "all-in") {
    return "All-in";
  }

  if (action === "raise") {
    return "Raise";
  }

  if (action === "bet") {
    return "Bet";
  }

  if (action === "call") {
    return "Call";
  }

  if (action === "check") {
    return "Check";
  }

  return "Fold";
}

function buildActionDescription(action: SimulatedAction) {
  const amountLabel = action.amount !== null ? ` ${formatAmount(action.amount)}` : "";
  const positionLabel = action.positionLabel ? ` (${action.positionLabel})` : "";

  return `${action.playerName}${positionLabel} fez ${formatActionLabel(action.action)}${amountLabel}.`;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-[rgba(255,244,214,0.96)]">{value}</p>
    </div>
  );
}
