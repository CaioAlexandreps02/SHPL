"use client";

import { useEffect, useMemo, useState } from "react";

import { listSavedTranscripts } from "@/lib/live-lab/browser-transcript-store";
import {
  parseTranscriptSessions,
  simulateTranscriptHand,
  type ParsedTranscriptSession,
  type SimulatedAction,
  type SimulationSeatAssignment,
} from "@/lib/live-lab/hand-simulation";
import { inferPlayerProfile, accumulatePlayerStatistics } from "@/lib/poker/statistics";
import type {
  PokerPlayerHandStatistics,
  PokerPlayerProfile,
  PokerPlayerStatisticsAggregate,
  PokerProfileResult,
} from "@/lib/poker/types";
import type { LeagueSnapshot } from "@/lib/domain/types";

type KnownPlayer = {
  id: string;
  name: string;
};

type PlayerStatisticsEntry = {
  playerId: string;
  playerName: string;
  aggregate: PokerPlayerStatisticsAggregate;
  profile: PokerProfileResult;
  lastHandAt: string | null;
};

type PlayerRevealSummary = {
  sessionTitle: string;
  handLabel: string;
  revealedByStreet: Partial<Record<"flop" | "turn" | "river", string[]>>;
  showdownHands: Array<{
    label: string | null;
    cards: string[];
  }>;
};

export function SHPLStatisticsPage({ snapshot }: { snapshot: LeagueSnapshot }) {
  const basePlayerOptions = useMemo(() => {
    const players = new Map<string, KnownPlayer>();

    snapshot.stagePlayers.forEach((player) => {
      players.set(player.playerId, {
        id: player.playerId,
        name: player.playerName,
      });
    });

    snapshot.annualRanking.forEach((player) => {
      if (!players.has(player.playerId)) {
        players.set(player.playerId, {
          id: player.playerId,
          name: player.playerName,
        });
      }
    });

    return Array.from(players.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "pt-BR"),
    );
  }, [snapshot.annualRanking, snapshot.stagePlayers]);

  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessions, setSessions] = useState<ParsedTranscriptSession[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        setIsLoadingSessions(true);
        const savedTranscriptRecords = await listSavedTranscripts();
        const parsedSessions = parseTranscriptSessions(savedTranscriptRecords);

        if (!isMounted) {
          return;
        }

        setSessions(parsedSessions);

        if (!parsedSessions.length) {
          setStatusMessage(
            "Ainda nao existe nenhuma transmissao salva com TXT suficiente para alimentar as estatisticas.",
          );
        }
      } catch {
        if (isMounted) {
          setStatusMessage("Nao foi possivel carregar os TXT salvos da transmissao.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingSessions(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const playerStatisticsEntries = useMemo(
    () => buildPlayerStatisticsEntries(sessions, basePlayerOptions),
    [basePlayerOptions, sessions],
  );

  const availablePlayerOptions = useMemo(() => {
    const options = new Map<string, KnownPlayer>();

    basePlayerOptions.forEach((player) => {
      options.set(player.id, player);
    });

    playerStatisticsEntries.forEach((entry) => {
      if (!options.has(entry.playerId)) {
        options.set(entry.playerId, {
          id: entry.playerId,
          name: entry.playerName,
        });
      }
    });

    return Array.from(options.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "pt-BR"),
    );
  }, [basePlayerOptions, playerStatisticsEntries]);

  useEffect(() => {
    setSelectedPlayerId((currentValue) => {
      if (currentValue && availablePlayerOptions.some((player) => player.id === currentValue)) {
        return currentValue;
      }

      return availablePlayerOptions[0]?.id ?? "";
    });
  }, [availablePlayerOptions]);

  const selectedPlayerStatistics =
    playerStatisticsEntries.find((entry) => entry.playerId === selectedPlayerId) ?? null;
  const selectedPlayerLabel =
    availablePlayerOptions.find((player) => player.id === selectedPlayerId)?.name ??
    selectedPlayerStatistics?.playerName ??
    "Jogador";
  const selectedPlayerRevealSummary = useMemo(
    () => buildLatestRevealForPlayer(selectedPlayerId, sessions, basePlayerOptions),
    [basePlayerOptions, selectedPlayerId, sessions],
  );

  const totalHandsAnalyzed = useMemo(
    () => sessions.reduce((total, session) => total + session.hands.length, 0),
    [sessions],
  );
  const totalTrackedPlayers = playerStatisticsEntries.length;

  return (
    <section className="rounded-[1.8rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.28)] md:p-6">
      <div className="flex flex-col gap-4 border-b border-[rgba(255,208,101,0.1)] pb-5">
        <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[rgba(236,225,196,0.68)]">
          SHPL 2026
        </p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[rgba(255,244,214,0.96)] md:text-4xl">
            Estatisticas
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-[rgba(236,225,196,0.74)]">
            Painel administrativo para acompanhar o perfil individual dos jogadores a partir dos
            TXT salvos pela transmissao. As estatisticas sao recalculadas automaticamente sempre
            que novas maos entram no historico.
          </p>
        </div>
      </div>

      {isLoadingSessions ? (
        <div className="mt-5 rounded-[1.35rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-5 py-5 text-sm leading-7 text-[rgba(236,225,196,0.7)]">
          Carregando os TXT salvos para montar o historico dos jogadores...
        </div>
      ) : sessions.length === 0 ? (
        <div className="mt-5 rounded-[1.35rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-5 py-5 text-sm leading-7 text-[rgba(236,225,196,0.7)]">
          {statusMessage ||
            "Nenhuma transmissao com TXT salvo foi encontrada ainda. Assim que as maos forem gravadas, este painel comeca a acumular o historico individual."}
        </div>
      ) : (
        <div className="mt-5 grid gap-5">
          <div className="grid gap-4 md:grid-cols-3">
            <InfoCard label="TXT analisados" value={String(sessions.length)} />
            <InfoCard label="Maos registradas" value={String(totalHandsAnalyzed)} />
            <InfoCard label="Jogadores com historico" value={String(totalTrackedPlayers)} />
          </div>

          <article className="rounded-[1.35rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[rgba(236,225,196,0.48)]">
              Simulacao estatistica individual
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
              Perfil por participante
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[rgba(236,225,196,0.7)]">
              Escolha um jogador para ver o perfil individual. O painel so libera as estatisticas
              completas quando existir um minimo de 50 maos registradas para esse participante.
            </p>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.58)] p-4">
                <Field label="Participante">
                  <select
                    className={inputClassName}
                    onChange={(event) => setSelectedPlayerId(event.target.value)}
                    value={selectedPlayerId}
                  >
                    {availablePlayerOptions.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <InfoCard
                    label="Maos do jogador"
                    value={String(selectedPlayerStatistics?.aggregate.handsPlayed ?? 0)}
                  />
                  <InfoCard
                    label="Ultima atualizacao"
                    value={formatShortDateTime(selectedPlayerStatistics?.lastHandAt ?? null)}
                  />
                </div>

                <div className="mt-4 rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                    Estado atual
                  </p>
                  {selectedPlayerStatistics ? (
                    <div className="mt-3 grid gap-2">
                      <p className="text-lg font-semibold text-[rgba(255,244,214,0.96)]">
                        {selectedPlayerLabel}
                      </p>
                      <p className="text-sm leading-6 text-[rgba(236,225,196,0.72)]">
                        {selectedPlayerStatistics.aggregate.handsPlayed >= 50
                          ? "Ja existe base suficiente para mostrar o perfil consolidado desse jogador."
                          : `Ainda faltam ${Math.max(50 - selectedPlayerStatistics.aggregate.handsPlayed, 0)} maos para liberar as estatisticas completas.`}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.72)]">
                      Ainda nao existe mao registrada para esse participante.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4">
                {!selectedPlayerStatistics ? (
                  <EmptyStatisticsState
                    body="Esse participante ainda nao apareceu em nenhuma mao registrada pela transmissao."
                    title="Sem historico suficiente"
                  />
                ) : selectedPlayerStatistics.aggregate.handsPlayed < 50 ? (
                  <EmptyStatisticsState
                    body={`As estatisticas completas de ${selectedPlayerLabel} vao aparecer assim que esse jogador atingir no minimo 50 maos registradas.`}
                    title="Coleta em andamento"
                  />
                ) : (
                  <>
                    <article className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.58)] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                        Perfil identificado
                      </p>
                      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
                            {formatProfileLabel(selectedPlayerStatistics.profile.primaryProfile)}
                          </h3>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-[rgba(236,225,196,0.74)]">
                            {describeProfile(selectedPlayerStatistics.profile.primaryProfile)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedPlayerStatistics.profile.secondaryProfiles.length > 0 ? (
                            selectedPlayerStatistics.profile.secondaryProfiles.map((profile) => (
                              <span
                                key={profile}
                                className="rounded-full border border-[rgba(129,196,255,0.18)] bg-[rgba(129,196,255,0.08)] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[rgba(220,239,255,0.92)]"
                              >
                                {formatProfileLabel(profile)}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full border border-[rgba(255,208,101,0.14)] bg-[rgba(255,183,32,0.08)] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[rgba(255,236,184,0.92)]">
                              Perfil estavel
                            </span>
                          )}
                        </div>
                      </div>
                    </article>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <MetricCard
                        description="Percentual de maos em que entra voluntariamente no preflop."
                        label="VPIP"
                        value={formatPercentage(selectedPlayerStatistics.aggregate.vpip)}
                      />
                      <MetricCard
                        description="Percentual de maos em que sobe aposta no preflop."
                        label="PFR"
                        value={formatPercentage(selectedPlayerStatistics.aggregate.pfr)}
                      />
                      <MetricCard
                        description="Frequencia com que apenas completa o preflop sem agressao."
                        label="Limp"
                        value={formatPercentage(selectedPlayerStatistics.aggregate.limpPercentage)}
                      />
                      <MetricCard
                        description="Percentual de folds ainda no preflop."
                        label="Fold preflop"
                        value={formatPercentage(selectedPlayerStatistics.aggregate.foldPreflopPercentage)}
                      />
                      <MetricCard
                        description="Agressividade pos-flop em relacao a calls."
                        label="Aggression factor"
                        value={formatRatio(selectedPlayerStatistics.aggregate.aggressionFactor)}
                      />
                      <MetricCard
                        description="Frequencia de acoes agressivas no pos-flop."
                        label="Aggression frequency"
                        value={formatPercentage(selectedPlayerStatistics.aggregate.aggressionFrequency)}
                      />
                      <MetricCard
                        description="Percentual de vezes em que chega ao showdown depois de ver flop."
                        label="WTSD"
                        value={formatPercentage(selectedPlayerStatistics.aggregate.wtsd)}
                      />
                      <MetricCard
                        description="Percentual de showdowns vencidos."
                        label="WSD"
                        value={formatPercentage(selectedPlayerStatistics.aggregate.wsd)}
                      />
                      <MetricCard
                        description="Aproveitamento de continuation bet no flop."
                        label="C-bet flop"
                        value={formatPercentage(selectedPlayerStatistics.aggregate.cbetFlop)}
                      />
                    </div>

                    <article className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.58)] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                        Base acumulada
                      </p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <InfoRow
                          label="Flops vistos"
                          value={String(selectedPlayerStatistics.aggregate.sawFlop)}
                        />
                        <InfoRow
                          label="Turns vistos"
                          value={String(selectedPlayerStatistics.aggregate.sawTurn)}
                        />
                        <InfoRow
                          label="Rivers vistos"
                          value={String(selectedPlayerStatistics.aggregate.sawRiver)}
                        />
                        <InfoRow
                          label="Showdowns"
                          value={String(selectedPlayerStatistics.aggregate.reachedShowdown)}
                        />
                        <InfoRow
                          label="Vitorias em showdown"
                          value={String(selectedPlayerStatistics.aggregate.wonShowdown)}
                        />
                        <InfoRow
                          label="Bets pos-flop"
                          value={String(selectedPlayerStatistics.aggregate.postflopBets)}
                        />
                        <InfoRow
                          label="Raises pos-flop"
                          value={String(selectedPlayerStatistics.aggregate.postflopRaises)}
                        />
                        <InfoRow
                          label="Calls pos-flop"
                          value={String(selectedPlayerStatistics.aggregate.postflopCalls)}
                        />
                      </div>
                    </article>
                  </>
                )}

                {selectedPlayerRevealSummary ? (
                  <article className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.58)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                      Cartas reveladas no historico
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-[rgba(255,244,214,0.96)]">
                      {selectedPlayerRevealSummary.handLabel}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[rgba(236,225,196,0.72)]">
                      Sessao: {selectedPlayerRevealSummary.sessionTitle}
                    </p>
                    <div className="mt-4 grid gap-4">
                      {(["flop", "turn", "river"] as const).map((street) =>
                        selectedPlayerRevealSummary.revealedByStreet[street]?.length ? (
                          <RevealRow
                            cards={selectedPlayerRevealSummary.revealedByStreet[street] ?? []}
                            key={street}
                            label={formatStreetLabel(street)}
                          />
                        ) : null,
                      )}
                      {selectedPlayerRevealSummary.showdownHands.length > 0 ? (
                        <div className="rounded-[1rem] border border-[rgba(255,208,101,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
                          <p className="text-[0.68rem] uppercase tracking-[0.16em] text-[rgba(236,225,196,0.46)]">
                            Showdown
                          </p>
                          <div className="mt-3 grid gap-3">
                            {selectedPlayerRevealSummary.showdownHands.map((showdownHand, index) => (
                              <div key={`${showdownHand.label ?? "showdown"}-${index}`}>
                                <p className="text-sm font-semibold text-[rgba(255,244,214,0.92)]">
                                  {showdownHand.label ?? `Jogador ${index + 1}`}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {showdownHand.cards.map((card) => (
                                    <CardPill card={card} key={`${showdownHand.label ?? "card"}-${card}`} />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ) : null}
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

function buildPlayerStatisticsEntries(
  sessions: ParsedTranscriptSession[],
  knownPlayers: KnownPlayer[],
) {
  const knownPlayersByNormalizedName = new Map(
    knownPlayers.map((player) => [normalizeName(player.name), player]),
  );
  const aggregates = new Map<string, PokerPlayerStatisticsAggregate>();
  const lastHandAtByPlayer = new Map<string, string | null>();

  for (const session of sessions) {
    const seatAssignments = normalizeSeatsForStatistics(
      session.declaredSeatAssignments,
      knownPlayersByNormalizedName,
    );

    if (seatAssignments.length === 0) {
      continue;
    }

    const buttonSeatIndex = session.declaredButtonSeatIndex ?? seatAssignments[0]?.seatIndex ?? 0;

    session.hands.forEach((hand, handIndex) => {
      const replay = simulateTranscriptHand(hand, seatAssignments, buttonSeatIndex, handIndex);
      const handStatistics = deriveHandStatisticsFromReplay(replay, seatAssignments);

      handStatistics.forEach((playerStatistics) => {
        const currentAggregate = aggregates.get(playerStatistics.playerId) ?? null;
        const nextAggregate = accumulatePlayerStatistics(currentAggregate, playerStatistics);

        aggregates.set(playerStatistics.playerId, nextAggregate);
        lastHandAtByPlayer.set(
          playerStatistics.playerId,
          hand.endLine?.timestampLabel ?? hand.startLine.timestampLabel ?? session.endedAt ?? null,
        );
      });
    });
  }

  return Array.from(aggregates.values())
    .map<PlayerStatisticsEntry>((aggregate) => ({
      playerId: aggregate.playerId,
      playerName: aggregate.playerName,
      aggregate,
      profile: inferPlayerProfile(aggregate),
      lastHandAt: lastHandAtByPlayer.get(aggregate.playerId) ?? null,
    }))
    .sort((left, right) => right.aggregate.handsPlayed - left.aggregate.handsPlayed);
}

function normalizeSeatsForStatistics(
  seatAssignments: SimulationSeatAssignment[] | null,
  knownPlayersByNormalizedName: Map<string, KnownPlayer>,
) {
  if (!seatAssignments) {
    return [];
  }

  return seatAssignments
    .filter((seat) => Boolean(seat.playerName))
    .map<SimulationSeatAssignment>((seat) => {
      const normalizedName = normalizeName(seat.playerName ?? "");
      const knownPlayer = knownPlayersByNormalizedName.get(normalizedName);

      return {
        seatIndex: seat.seatIndex,
        playerId: seat.playerId ?? knownPlayer?.id ?? `name:${normalizedName}`,
        playerName: seat.playerName ?? knownPlayer?.name ?? `Jogador ${seat.seatIndex + 1}`,
      };
    })
    .sort((left, right) => left.seatIndex - right.seatIndex);
}

function deriveHandStatisticsFromReplay(
  replay: ReturnType<typeof simulateTranscriptHand>,
  seatAssignments: SimulationSeatAssignment[],
) {
  const occupiedSeats = seatAssignments.filter((seat) => seat.playerId && seat.playerName);
  const actionsBySeat = new Map<number, SimulatedAction[]>();
  const sawFlopSeats = new Set<number>();
  const sawTurnSeats = new Set<number>();
  const sawRiverSeats = new Set<number>();
  const reachedShowdownSeats = new Set<number>();
  const activeSeatIndexes = new Set(occupiedSeats.map((seat) => seat.seatIndex));
  let preflopAggressorSeatIndex: number | null = null;

  for (const section of replay.sections) {
    if (section.street === "flop") {
      activeSeatIndexes.forEach((seatIndex) => sawFlopSeats.add(seatIndex));
    } else if (section.street === "turn") {
      activeSeatIndexes.forEach((seatIndex) => sawTurnSeats.add(seatIndex));
    } else if (section.street === "river") {
      activeSeatIndexes.forEach((seatIndex) => sawRiverSeats.add(seatIndex));
    } else if (section.street === "showdown") {
      activeSeatIndexes.forEach((seatIndex) => reachedShowdownSeats.add(seatIndex));
    }

    for (const action of section.actions) {
      if (action.seatIndex === null) {
        continue;
      }

      const currentActions = actionsBySeat.get(action.seatIndex) ?? [];
      currentActions.push(action);
      actionsBySeat.set(action.seatIndex, currentActions);

      if (section.street === "preflop" && isAggressiveAction(action.action)) {
        preflopAggressorSeatIndex = action.seatIndex;
      }

      if (action.action === "fold") {
        activeSeatIndexes.delete(action.seatIndex);
      }
    }
  }

  if (replay.finalStreet === "showdown") {
    replay.finalActiveSeatIndexes.forEach((seatIndex) => reachedShowdownSeats.add(seatIndex));
  }

  return occupiedSeats.map<PokerPlayerHandStatistics>((seat) => {
    const playerActions = actionsBySeat.get(seat.seatIndex) ?? [];
    const preflopActions = playerActions.filter((action) => action.street === "preflop");
    const flopActions = playerActions.filter((action) => action.street === "flop");
    const postflopActions = playerActions.filter(
      (action) => action.street === "flop" || action.street === "turn" || action.street === "river",
    );

    const sawFlop = sawFlopSeats.has(seat.seatIndex) ? 1 : 0;
    const reachedShowdown = reachedShowdownSeats.has(seat.seatIndex) ? 1 : 0;
    const wonShowdown =
      reachedShowdown && replay.finalActiveSeatIndexes.includes(seat.seatIndex) ? 1 : 0;
    const tags = new Set<PokerPlayerHandStatistics["tags"][number]>();

    if (sawFlop) {
      tags.add("saw_flop");
    }
    if (sawTurnSeats.has(seat.seatIndex)) {
      tags.add("saw_turn");
    }
    if (sawRiverSeats.has(seat.seatIndex)) {
      tags.add("saw_river");
    }
    if (reachedShowdown) {
      tags.add("reached_showdown");
    }
    if (wonShowdown) {
      tags.add("won_showdown");
    }
    if (preflopActions.some((action) => action.action === "fold")) {
      tags.add("folded_preflop");
    }
    if (preflopActions.some((action) => action.action === "call") && !preflopActions.some((action) => isAggressiveAction(action.action))) {
      tags.add("limp");
    }
    if (preflopActions.some((action) => isAggressiveAction(action.action))) {
      tags.add("open_raise");
    }

    const cbetFlopDone =
      preflopAggressorSeatIndex === seat.seatIndex &&
      flopActions.some((action) => action.action === "bet" || isAggressiveAction(action.action));

    if (cbetFlopDone) {
      tags.add("cbet_done");
    }

    return {
      playerId: seat.playerId ?? `seat:${seat.seatIndex}`,
      playerName: seat.playerName ?? `Jogador ${seat.seatIndex + 1}`,
      handsPlayed: 1,
      vpipHands: preflopActions.some((action) => isVoluntaryPreflopAction(action.action)) ? 1 : 0,
      pfrHands: preflopActions.some((action) => isAggressiveAction(action.action)) ? 1 : 0,
      limpHands:
        preflopActions.some((action) => action.action === "call") &&
        !preflopActions.some((action) => isAggressiveAction(action.action))
          ? 1
          : 0,
      foldedPreflopHands: preflopActions.some((action) => action.action === "fold") ? 1 : 0,
      postflopBets: postflopActions.filter((action) => action.action === "bet").length,
      postflopRaises: postflopActions.filter((action) => isAggressiveAction(action.action)).length,
      postflopCalls: postflopActions.filter((action) => action.action === "call").length,
      postflopChecks: postflopActions.filter((action) => action.action === "check").length,
      postflopFolds: postflopActions.filter((action) => action.action === "fold").length,
      sawFlop,
      sawTurn: sawTurnSeats.has(seat.seatIndex) ? 1 : 0,
      sawRiver: sawRiverSeats.has(seat.seatIndex) ? 1 : 0,
      reachedShowdown,
      wonShowdown,
      cbetFlopOpportunity: preflopAggressorSeatIndex === seat.seatIndex && sawFlop ? 1 : 0,
      cbetFlopDone: cbetFlopDone ? 1 : 0,
      tags: Array.from(tags),
    };
  });
}

function buildLatestRevealForPlayer(
  playerId: string,
  sessions: ParsedTranscriptSession[],
  knownPlayers: KnownPlayer[],
) {
  if (!playerId) {
    return null;
  }

  const knownPlayersByNormalizedName = new Map(
    knownPlayers.map((player) => [normalizeName(player.name), player]),
  );

  for (const session of [...sessions].reverse()) {
    const seatAssignments = normalizeSeatsForStatistics(
      session.declaredSeatAssignments,
      knownPlayersByNormalizedName,
    );
    const buttonSeatIndex = session.declaredButtonSeatIndex ?? seatAssignments[0]?.seatIndex ?? 0;

    for (const hand of [...session.hands].reverse()) {
      const replay = simulateTranscriptHand(hand, seatAssignments, buttonSeatIndex);
      const participatesInHand = seatAssignments.some((seat) => seat.playerId === playerId);

      if (!participatesInHand) {
        continue;
      }

      const revealedByStreet = {
        flop: replay.sections.find((section) => section.street === "flop")?.revealedCards ?? [],
        turn: replay.sections.find((section) => section.street === "turn")?.revealedCards ?? [],
        river: replay.sections.find((section) => section.street === "river")?.revealedCards ?? [],
      };
      const showdownHands =
        replay.sections.find((section) => section.street === "showdown")?.showdownHands ?? [];

      if (
        revealedByStreet.flop.length === 0 &&
        revealedByStreet.turn.length === 0 &&
        revealedByStreet.river.length === 0 &&
        showdownHands.length === 0
      ) {
        continue;
      }

      return {
        sessionTitle: session.title,
        handLabel: hand.label,
        revealedByStreet,
        showdownHands,
      } satisfies PlayerRevealSummary;
    }
  }

  return null;
}

function isAggressiveAction(action: SimulatedAction["action"]) {
  return action === "raise" || action === "all-in";
}

function isVoluntaryPreflopAction(action: SimulatedAction["action"]) {
  return action === "call" || action === "raise" || action === "all-in";
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function formatShortDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPercentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatRatio(value: number) {
  return value.toFixed(2);
}

function formatProfileLabel(profile: PokerPlayerProfile) {
  const labels: Record<PokerPlayerProfile, string> = {
    tight_passive: "Tight passivo",
    tight_aggressive: "Tight agressivo",
    loose_passive: "Loose passivo",
    loose_aggressive: "Loose agressivo",
    nit: "Nit",
    calling_station: "Calling station",
    maniac: "Maniaco",
    regular: "Regular",
  };

  return labels[profile];
}

function describeProfile(profile: PokerPlayerProfile) {
  const descriptions: Record<PokerPlayerProfile, string> = {
    tight_passive:
      "Entra em menos maos e tende a pressionar pouco, escolhendo spots mais seguros.",
    tight_aggressive:
      "Seleciona bem as maos e costuma atacar quando entra no pote. Perfil bem proximo do TAG.",
    loose_passive:
      "Participa de muitas maos, mas sem tanta agressividade para pressionar os adversarios.",
    loose_aggressive:
      "Entra em bastante volume e costuma acelerar a acao. Perfil bem proximo do LAG.",
    nit: "Joga poucas maos e geralmente espera situacoes bem fortes para se comprometer.",
    calling_station:
      "Tende a pagar muito e pressionar pouco, chegando com frequencia ao showdown.",
    maniac:
      "Perfil de volume e agressividade muito altos, com pressao constante preflop e pos-flop.",
    regular:
      "Perfil equilibrado, sem tendencia extrema muito marcada nos principais indicadores.",
  };

  return descriptions[profile];
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
    <div className="rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.58)] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-[rgba(255,244,214,0.96)]">{value}</p>
    </div>
  );
}

function MetricCard({
  description,
  label,
  value,
}: {
  description: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.58)] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[rgba(236,225,196,0.68)]">{description}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.95rem] border border-[rgba(255,208,101,0.1)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-[rgba(236,225,196,0.46)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[rgba(255,244,214,0.94)]">{value}</p>
    </div>
  );
}

function EmptyStatisticsState({
  body,
  title,
}: {
  body: string;
  title: string;
}) {
  return (
    <article className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.58)] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
        Estatisticas individuais
      </p>
      <h3 className="mt-2 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">{title}</h3>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[rgba(236,225,196,0.72)]">{body}</p>
    </article>
  );
}

function RevealRow({ cards, label }: { cards: string[]; label: string }) {
  return (
    <div className="rounded-[1rem] border border-[rgba(255,208,101,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-[rgba(236,225,196,0.46)]">
        {label}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {cards.map((card) => (
          <CardPill card={card} key={`${label}-${card}`} />
        ))}
      </div>
    </div>
  );
}

function CardPill({ card }: { card: string }) {
  return (
    <span className="rounded-[0.85rem] border border-[rgba(129,196,255,0.18)] bg-[rgba(129,196,255,0.08)] px-3 py-2 text-sm font-semibold text-[rgba(220,239,255,0.94)]">
      {card}
    </span>
  );
}

const inputClassName =
  "h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none";

function formatStreetLabel(street: "flop" | "turn" | "river") {
  if (street === "flop") {
    return "Flop";
  }

  if (street === "turn") {
    return "Turn";
  }

  return "River";
}
