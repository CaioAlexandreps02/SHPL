"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { AccessRole } from "@/lib/auth/roles";
import { calculateMatchPoints, compareStageRanking } from "@/lib/domain/rules";
import type { BlindLevel, LeagueSnapshot, Stage } from "@/lib/domain/types";
import {
  LIVE_LAB_TOTAL_TABLE_SEATS,
  STAGE_RUNTIME_STORAGE_KEY_PREFIX,
} from "@/lib/live-lab/stage-runtime-link";
import { getVisibleShplNavItems, isShplNavItemActive } from "@/lib/navigation/shpl-nav";

type StagePlayerControl = {
  playerId: string;
  playerName: string;
  annualPaid: boolean;
  dailyPaid: boolean;
  leftStage: boolean;
  outOfCurrentMatch: boolean;
  matchPoints: number[];
};

type PlayerActionSnapshot = {
  players: StagePlayerControl[];
  selectedPlayerId: string | null;
  currentMatchClosed: boolean;
  completedMatchDurations: number[];
  isRunning: boolean;
};

const SETTINGS_STORAGE_KEY = "shpl-2026-settings";
const TOTAL_TABLE_SEATS = LIVE_LAB_TOTAL_TABLE_SEATS;

export function StageSetupScreen({
  snapshot,
  stage,
  roles,
}: {
  snapshot: LeagueSnapshot;
  stage: Stage;
  roles: AccessRole[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [blindLevels, setBlindLevels] = useState<BlindLevel[]>(snapshot.blindStructure);
  const [clockSeconds, setClockSeconds] = useState(
    snapshot.liveControls.actionClockOptions[1] ?? snapshot.liveControls.actionClockOptions[0] ?? 30
  );
  const [showActionClock, setShowActionClock] = useState(true);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(0);
  const [breakEveryLevels, setBreakEveryLevels] = useState(0);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(
    (snapshot.blindStructure[0]?.durationMinutes ?? 0) * 60
  );
  const [isRunning, setIsRunning] = useState(false);
  const [actualStageStartedAt, setActualStageStartedAt] = useState<string | null>(null);
  const [currentMatchStartedAt, setCurrentMatchStartedAt] = useState<string | null>(null);
  const [matchElapsedSeconds, setMatchElapsedSeconds] = useState(0);
  const [completedMatchDurations, setCompletedMatchDurations] = useState<number[]>([]);
  const [stageClosedAt, setStageClosedAt] = useState<string | null>(null);
  const [currentMatchClosed, setCurrentMatchClosed] = useState(false);
  const [showCloseStageConfirm, setShowCloseStageConfirm] = useState(false);
  const [isClosingStage, setIsClosingStage] = useState(false);
  const [stageNotice, setStageNotice] = useState<string | null>(null);
  const [actionClockRemaining, setActionClockRemaining] = useState<number | null>(null);
  const [showSeatSelector, setShowSeatSelector] = useState(false);
  const [seatAssignments, setSeatAssignments] = useState<Array<string | null>>(
    Array.from({ length: TOTAL_TABLE_SEATS }, () => null)
  );
  const [draftSeatAssignments, setDraftSeatAssignments] = useState<Array<string | null>>(
    Array.from({ length: TOTAL_TABLE_SEATS }, () => null)
  );
  const [selectedSeatIndex, setSelectedSeatIndex] = useState(0);
  const [pendingSeatAction, setPendingSeatAction] = useState<"start-current" | "start-next" | null>(
    null
  );
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    snapshot.annualRanking[0]?.playerId ?? null
  );
  const [playerActionHistory, setPlayerActionHistory] = useState<PlayerActionSnapshot[]>([]);
  const [averageStack, setAverageStack] = useState("3000");
  const [players, setPlayers] = useState<StagePlayerControl[]>(
    snapshot.annualRanking.map((entry) => ({
      playerId: entry.playerId,
      playerName: entry.playerName,
      annualPaid: false,
      dailyPaid: false,
      leftStage: false,
      outOfCurrentMatch: false,
      matchPoints: [0],
    }))
  );

  useEffect(() => {
    let timeoutId: number | undefined;

    try {
      const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!rawSettings) {
        return;
      }

      const parsedSettings = JSON.parse(rawSettings) as {
        blindLevels?: BlindLevel[];
        actionClockPreset?: string;
        showActionClockOnTable?: boolean;
        desiredStack?: string;
        breakDurationMinutes?: string;
        breakEveryLevels?: string;
      };

      timeoutId = window.setTimeout(() => {
        const nextBlindLevels = parsedSettings.blindLevels?.length
          ? parsedSettings.blindLevels
          : snapshot.blindStructure;

        setBlindLevels(nextBlindLevels);
        setRemainingSeconds((nextBlindLevels[0]?.durationMinutes ?? 0) * 60);
        setClockSeconds(
          Number.parseInt(parsedSettings.actionClockPreset ?? "", 10) ||
            snapshot.liveControls.actionClockOptions[1] ||
            snapshot.liveControls.actionClockOptions[0] ||
            30
        );
        setShowActionClock(parsedSettings.showActionClockOnTable ?? true);
        setAverageStack(parsedSettings.desiredStack ?? "3000");
        setBreakDurationMinutes(
          Math.max(Number.parseInt(parsedSettings.breakDurationMinutes ?? "0", 10) || 0, 0)
        );
        setBreakEveryLevels(
          Math.max(Number.parseInt(parsedSettings.breakEveryLevels ?? "0", 10) || 0, 0)
        );
      }, 0);
    } catch {
      return;
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [snapshot.blindStructure, snapshot.liveControls.actionClockOptions]);

  useEffect(() => {
    try {
      const rawRuntime = window.localStorage.getItem(
        `${STAGE_RUNTIME_STORAGE_KEY_PREFIX}-${stage.id}`
      );

      if (!rawRuntime) {
        return;
      }

      const parsedRuntime = JSON.parse(rawRuntime) as {
        actualStageStartedAt?: string | null;
        currentMatchStartedAt?: string | null;
        matchElapsedSeconds?: number;
        completedMatchDurations?: number[];
        stageClosedAt?: string | null;
        currentMatchClosed?: boolean;
        currentLevelIndex?: number;
        seatAssignments?: Array<string | null>;
      };

      const timeoutId = window.setTimeout(() => {
        setActualStageStartedAt(parsedRuntime.actualStageStartedAt ?? null);
        setCurrentMatchStartedAt(parsedRuntime.currentMatchStartedAt ?? null);
        setMatchElapsedSeconds(parsedRuntime.matchElapsedSeconds ?? 0);
        setCompletedMatchDurations(parsedRuntime.completedMatchDurations ?? []);
        setStageClosedAt(parsedRuntime.stageClosedAt ?? null);
        setCurrentMatchClosed(parsedRuntime.currentMatchClosed ?? false);
        setCurrentLevelIndex(parsedRuntime.currentLevelIndex ?? 0);
        setSeatAssignments(
          normalizeSeatAssignments(parsedRuntime.seatAssignments ?? [])
        );
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    } catch {
      return;
    }
  }, [stage.id]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `${STAGE_RUNTIME_STORAGE_KEY_PREFIX}-${stage.id}`,
        JSON.stringify({
          actualStageStartedAt,
          currentMatchStartedAt,
          matchElapsedSeconds,
          completedMatchDurations,
          stageClosedAt,
          currentMatchClosed,
          currentLevelIndex,
          seatAssignments,
        })
      );
    } catch {
      return;
    }
  }, [
    actualStageStartedAt,
    completedMatchDurations,
    currentMatchStartedAt,
    currentMatchClosed,
    currentLevelIndex,
    matchElapsedSeconds,
    seatAssignments,
    stageClosedAt,
    stage.id,
  ]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setRemainingSeconds((currentValue) => (currentValue > 0 ? currentValue - 1 : 0));
      setMatchElapsedSeconds((currentValue) => currentValue + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || remainingSeconds > 0) {
      return;
    }

    let timeoutId: number | undefined;

    if (currentLevelIndex < blindLevels.length - 1) {
      const nextIndex = currentLevelIndex + 1;
      timeoutId = window.setTimeout(() => {
        setCurrentLevelIndex(nextIndex);
        setRemainingSeconds((blindLevels[nextIndex]?.durationMinutes ?? 0) * 60);
      }, 0);
    } else {
      timeoutId = window.setTimeout(() => {
        setIsRunning(false);
      }, 0);
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [blindLevels, currentLevelIndex, isRunning, remainingSeconds]);

  useEffect(() => {
    if (!blindLevels.length) {
      return;
    }

    if (currentLevelIndex > blindLevels.length - 1) {
      const timeoutId = window.setTimeout(() => {
        setCurrentLevelIndex(blindLevels.length - 1);
        setRemainingSeconds((blindLevels[blindLevels.length - 1]?.durationMinutes ?? 0) * 60);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [blindLevels, currentLevelIndex]);

  useEffect(() => {
    if (actionClockRemaining === null) {
      return;
    }

    const interval = window.setInterval(() => {
      setActionClockRemaining((currentValue) => {
        if (currentValue === null) {
          return null;
        }

        return currentValue > 0 ? currentValue - 1 : 0;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [actionClockRemaining]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);

      if (
        event.code !== "Space" ||
        event.repeat ||
        isTypingTarget ||
        !showActionClock ||
        stageClosedAt !== null
      ) {
        return;
      }

      event.preventDefault();
      setActionClockRemaining((currentValue) => (currentValue === null ? clockSeconds : null));
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showActionClock, stageClosedAt, clockSeconds]);

  const currentLevel = blindLevels[currentLevelIndex] ?? blindLevels[0] ?? null;
  const nextLevel = blindLevels[currentLevelIndex + 1] ?? null;
  const thirdLevel = blindLevels[currentLevelIndex + 2] ?? null;
  const currentMatchIndex = Math.max(players[0]?.matchPoints.length ?? 1, 1) - 1;
  const selectedPlayer =
    players.find((player) => player.playerId === selectedPlayerId) ?? players[0] ?? null;
  const eligibleStagePlayers = useMemo(
    () => players.filter((player) => player.annualPaid && player.dailyPaid && !player.leftStage),
    [players]
  );
  const activeMatchPlayers = useMemo(
    () => eligibleStagePlayers.filter((player) => !player.outOfCurrentMatch),
    [eligibleStagePlayers]
  );
  const currentMatchHasResults = useMemo(
    () => players.some((player) => (player.matchPoints[currentMatchIndex] ?? 0) > 0),
    [currentMatchIndex, players]
  );
  const canMarkSelectedPlayerOut =
    Boolean(selectedPlayer) &&
    !selectedPlayer?.leftStage &&
    !selectedPlayer?.outOfCurrentMatch &&
    Boolean(selectedPlayer?.annualPaid) &&
    Boolean(selectedPlayer?.dailyPaid) &&
    !stageClosedAt &&
    !currentMatchClosed;
  const canCloseCurrentMatch =
    currentMatchStartedAt !== null &&
    !currentMatchClosed &&
    eligibleStagePlayers.length >= 2 &&
    activeMatchPlayers.length <= 1 &&
    currentMatchHasResults;
  const canStartCurrentMatch =
    !stageClosedAt && eligibleStagePlayers.length >= 2 && !currentMatchClosed;
  const canStartNextMatch =
    !stageClosedAt && currentMatchClosed && eligibleStagePlayers.length >= 2;
  const canCloseStage =
    !stageClosedAt && completedMatchDurations.length > 0 && !isRunning && currentMatchClosed;

  const rankingRows = useMemo(
    () =>
      players
        .map((player) => {
          const totalPoints = player.matchPoints.reduce((total, value) => total + value, 0);
          const wins = player.matchPoints.filter((value) => value === 10).length;
          const secondPlaces = player.matchPoints.filter((value) => value === 8).length;
          const thirdPlaces = player.matchPoints.filter((value) => value === 6).length;
          return {
            ...player,
            totalPoints,
            wins,
            secondPlaces,
            thirdPlaces,
          };
        })
        .sort((left, right) =>
          compareStageRanking(
            {
              playerId: left.playerId,
              playerName: left.playerName,
              position: 0,
              points: left.totalPoints,
              wins: left.wins,
              secondPlaces: left.secondPlaces,
              thirdPlaces: left.thirdPlaces,
              tiebreakSummary: "",
            },
            {
              playerId: right.playerId,
              playerName: right.playerName,
              position: 0,
              points: right.totalPoints,
              wins: right.wins,
              secondPlaces: right.secondPlaces,
              thirdPlaces: right.thirdPlaces,
              tiebreakSummary: "",
            }
          )
        ),
    [players]
  );

  const nextBreakLabel = useMemo(() => {
    if (!breakDurationMinutes || !breakEveryLevels || !currentLevel) {
      return "00:00:00";
    }

    const levelsIntoBlock = currentLevelIndex % breakEveryLevels;
    const levelsUntilBreakAfterCurrent = breakEveryLevels - levelsIntoBlock - 1;
    let secondsUntilBreak = remainingSeconds;

    for (let offset = 1; offset <= levelsUntilBreakAfterCurrent; offset += 1) {
      const level = blindLevels[currentLevelIndex + offset];
      if (!level) {
        break;
      }
      secondsUntilBreak += level.durationMinutes * 60;
    }

    return formatLongClock(secondsUntilBreak);
  }, [blindLevels, breakDurationMinutes, breakEveryLevels, currentLevel, currentLevelIndex, remainingSeconds]);

  function handleSetCurrentLevel(nextIndex: number) {
    const boundedIndex = Math.max(0, Math.min(nextIndex, Math.max(blindLevels.length - 1, 0)));
    setCurrentLevelIndex(boundedIndex);
    setRemainingSeconds((blindLevels[boundedIndex]?.durationMinutes ?? 0) * 60);
    setIsRunning(false);
  }

  function handleStartTimer() {
    if (stageClosedAt) {
      setStageNotice("A etapa ja foi encerrada e nao aceita novas partidas.");
      return;
    }

    if (currentMatchClosed) {
      setStageNotice("A partida atual ja foi encerrada. Inicie a proxima partida para continuar.");
      return;
    }

    if (eligibleStagePlayers.length < 2) {
      setStageNotice("Nao e possivel iniciar a partida sem ao menos 2 jogadores aptos.");
      return;
    }

    if (currentMatchStartedAt && matchElapsedSeconds > 0) {
      setStageNotice(null);
      setIsRunning(true);
      return;
    }

    openSeatSelector("start-current");
  }

  function handleCloseCurrentMatch() {
    if (!canCloseCurrentMatch) {
      setStageNotice(
        "A partida so pode ser encerrada quando houver resultado consistente e apenas um jogador restante."
      );
      return;
    }

    setIsRunning(false);
    setCurrentMatchClosed(true);
    setCompletedMatchDurations((currentDurations) => {
      if (currentDurations.length > currentMatchIndex) {
        return currentDurations;
      }

      return [...currentDurations, matchElapsedSeconds];
    });
    setStageNotice("Partida encerrada com sucesso. Agora voce pode iniciar a proxima partida.");
  }

  function handleStartNextMatch() {
    if (stageClosedAt) {
      setStageNotice("A etapa ja foi encerrada e nao aceita novas partidas.");
      return;
    }

    if (!currentMatchClosed) {
      setStageNotice("Encerre formalmente a partida atual antes de iniciar a proxima.");
      return;
    }

    if (eligibleStagePlayers.length < 2) {
      setStageNotice("Nao ha jogadores aptos suficientes para abrir uma nova partida.");
      return;
    }

    openSeatSelector("start-next");
  }

  function performStartCurrentMatch() {
    const nowIso = new Date().toISOString();
    setPlayerActionHistory([]);
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => ({
        ...player,
        outOfCurrentMatch: player.leftStage || !player.annualPaid || !player.dailyPaid,
      }))
    );
    setActualStageStartedAt((currentValue) => currentValue ?? nowIso);
    setCurrentMatchStartedAt((currentValue) => currentValue ?? nowIso);
    setStageNotice("Assentos confirmados. Partida iniciada.");
    setIsRunning(true);
  }

  function performStartNextMatch() {
    const nowIso = new Date().toISOString();

    setPlayerActionHistory([]);
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => ({
        ...player,
        outOfCurrentMatch: player.leftStage || !player.annualPaid || !player.dailyPaid,
        matchPoints: [...player.matchPoints, 0],
      }))
    );
    setCurrentMatchStartedAt(nowIso);
    setMatchElapsedSeconds(0);
    setCurrentLevelIndex(0);
    setRemainingSeconds((blindLevels[0]?.durationMinutes ?? 0) * 60);
    setCurrentMatchClosed(false);
    setStageNotice("Nova partida preparada e iniciada com os assentos confirmados.");
    setIsRunning(true);
  }

  function openSeatSelector(mode: "start-current" | "start-next") {
    const eligibleIds = new Set(eligibleStagePlayers.map((player) => player.playerId));
    const nextAssignments = normalizeSeatAssignments(
      seatAssignments.map((playerId) =>
        playerId && eligibleIds.has(playerId) ? playerId : null
      )
    );

    setDraftSeatAssignments(nextAssignments);
    setSelectedSeatIndex(findFirstEditableSeat(nextAssignments));
    setPendingSeatAction(mode);
    setShowSeatSelector(true);
    setStageNotice(null);
  }

  function handleSeatAssignmentChange(seatIndex: number, playerId: string) {
    setDraftSeatAssignments((currentAssignments) => {
      const nextAssignments = [...currentAssignments];
      const normalizedPlayerId = playerId || null;

      for (let index = 0; index < nextAssignments.length; index += 1) {
        if (index !== seatIndex && nextAssignments[index] === normalizedPlayerId) {
          nextAssignments[index] = null;
        }
      }

      nextAssignments[seatIndex] = normalizedPlayerId;
      return nextAssignments;
    });
  }

  function handleConfirmSeatAssignments() {
    const normalizedAssignments = normalizeSeatAssignments(draftSeatAssignments);
    const assignedPlayerIds = normalizedAssignments.filter(
      (playerId): playerId is string => Boolean(playerId)
    );
    const duplicateCheck = new Set(assignedPlayerIds);

    if (duplicateCheck.size !== assignedPlayerIds.length) {
      setStageNotice("Cada jogador pode ocupar somente um lugar na mesa.");
      return;
    }

    const missingPlayers = eligibleStagePlayers.filter(
      (player) => !duplicateCheck.has(player.playerId)
    );

    if (missingPlayers.length > 0) {
      setStageNotice("Defina um lugar para todos os jogadores aptos antes de continuar.");
      return;
    }

    setSeatAssignments(normalizedAssignments);
    setShowSeatSelector(false);

    if (pendingSeatAction === "start-next") {
      performStartNextMatch();
    } else {
      performStartCurrentMatch();
    }

    setPendingSeatAction(null);
  }

  function handleCloseSeatSelector() {
    setShowSeatSelector(false);
    setPendingSeatAction(null);
  }

  function updateSelectedPlayer(updater: (player: StagePlayerControl) => StagePlayerControl) {
    if (!selectedPlayer) {
      return;
    }

    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.playerId === selectedPlayer.playerId ? updater(player) : player
      )
      );
  }

  function pushPlayerActionSnapshot() {
    setPlayerActionHistory((currentHistory) => [
      ...currentHistory,
      {
        players: structuredClone(players),
        selectedPlayerId,
        currentMatchClosed,
        completedMatchDurations: structuredClone(completedMatchDurations),
        isRunning,
      },
    ]);
  }

  function handleConfirmAnnualBuyIn() {
    pushPlayerActionSnapshot();
    updateSelectedPlayer((player) => ({ ...player, annualPaid: true }));
    setStageNotice("Buy-in anual confirmado.");
  }

  function handleConfirmDailyBuyIn() {
    if (!selectedPlayer?.annualPaid) {
      setStageNotice("Confirme primeiro o buy-in anual para liberar o buy-in do dia.");
      return;
    }

    pushPlayerActionSnapshot();
    updateSelectedPlayer((player) => ({ ...player, dailyPaid: true }));
    setStageNotice("Buy-in do dia confirmado.");
  }

  function handleConfirmBothBuyIns() {
    pushPlayerActionSnapshot();
    updateSelectedPlayer((player) => ({ ...player, annualPaid: true, dailyPaid: true }));
    setStageNotice("Buy-in anual e do dia confirmados.");
  }

  function toggleActionClock() {
    setActionClockRemaining((currentValue) => (currentValue === null ? clockSeconds : null));
  }

  function handlePlayerOutFromMatch() {
    if (!selectedPlayer || selectedPlayer.leftStage || selectedPlayer.outOfCurrentMatch || stageClosedAt || currentMatchClosed) {
      return;
    }

    if (!selectedPlayer.annualPaid || !selectedPlayer.dailyPaid) {
      setStageNotice("So e possivel marcar a saida da partida para jogadores com buy-in anual e do dia confirmados.");
      return;
    }

    pushPlayerActionSnapshot();
    let winnerName: string | null = null;

    setPlayers((currentPlayers) => {
      const activePlayers = currentPlayers.filter(
        (player) =>
          player.annualPaid &&
          player.dailyPaid &&
          !player.leftStage &&
          !player.outOfCurrentMatch
      );
      const finalPosition = activePlayers.length;
      const pointsForThisExit = calculateMatchPoints(finalPosition);

      const nextPlayers = currentPlayers.map((player) => {
        if (player.playerId !== selectedPlayer.playerId) {
          return player;
        }

        const nextMatchPoints = [...player.matchPoints];
        nextMatchPoints[currentMatchIndex] = pointsForThisExit;

        return {
          ...player,
          outOfCurrentMatch: true,
          matchPoints: nextMatchPoints,
        };
      });

      const remainingPlayers = nextPlayers.filter(
        (player) => !player.leftStage && !player.outOfCurrentMatch
      );

      if (remainingPlayers.length === 1) {
        const winnerId = remainingPlayers[0].playerId;
        winnerName = remainingPlayers[0].playerName;
        return nextPlayers.map((player) => {
          if (player.playerId !== winnerId) {
            return player;
          }

          const nextMatchPoints = [...player.matchPoints];
          nextMatchPoints[currentMatchIndex] = calculateMatchPoints(1);

          return {
            ...player,
            outOfCurrentMatch: true,
            matchPoints: nextMatchPoints,
          };
        });
      }

        return nextPlayers;
      });

    if (winnerName) {
      setIsRunning(false);
      setCurrentMatchClosed(true);
      setCompletedMatchDurations((currentDurations) => {
        if (currentDurations.length > currentMatchIndex) {
          return currentDurations;
        }

        return [...currentDurations, matchElapsedSeconds];
      });
      setStageNotice(`${winnerName} ficou sozinho na partida e assumiu automaticamente o 1o lugar.`);
      return;
    }

    setStageNotice(`${selectedPlayer.playerName} saiu da partida atual.`);
  }

  function handleLeaveStage() {
    if (!selectedPlayer || stageClosedAt) {
      return;
    }

    pushPlayerActionSnapshot();
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => {
        if (player.playerId !== selectedPlayer.playerId) {
          return player;
        }

        return {
          ...player,
          leftStage: true,
          outOfCurrentMatch: true,
        };
        })
      );
    setStageNotice(`${selectedPlayer.playerName} saiu da etapa.`);
  }

  function handleUndoLastAction() {
    setPlayerActionHistory((currentHistory) => {
      const previousSnapshot = currentHistory[currentHistory.length - 1];

      if (!previousSnapshot) {
        setStageNotice("Nao ha nenhuma acao recente para desfazer.");
        return currentHistory;
      }

      setPlayers(previousSnapshot.players);
      setSelectedPlayerId(previousSnapshot.selectedPlayerId);
      setCurrentMatchClosed(previousSnapshot.currentMatchClosed);
      setCompletedMatchDurations(previousSnapshot.completedMatchDurations);
      setIsRunning(previousSnapshot.isRunning);
      setStageNotice("Ultima acao desfeita.");
      return currentHistory.slice(0, -1);
    });
  }

  function handleRequestCloseStage() {
    if (!canCloseStage) {
      setStageNotice(
        "A etapa so pode ser encerrada depois de pelo menos uma partida finalizada e com a rodada atual fechada."
      );
      return;
    }

    setShowCloseStageConfirm(true);
  }

  async function handleConfirmCloseStage() {
    const nowIso = new Date().toISOString();

    setIsClosingStage(true);

    try {
      const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      const parsedSettings = rawSettings
        ? (JSON.parse(rawSettings) as {
            buyInAnnual?: string;
            buyInDaily?: string;
          })
        : null;

      const response = await fetch("/api/shpl-admin/finalize-stage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stageId: stage.id,
          actualStageStartedAt,
          closedAt: nowIso,
          completedMatchDurations,
          players: players.map((player) => ({
            playerId: player.playerId,
            playerName: player.playerName,
            annualPaid: player.annualPaid,
            dailyPaid: player.dailyPaid,
            leftStage: player.leftStage,
            matchPoints: player.matchPoints,
          })),
          buyInAnnual: Number.parseInt(parsedSettings?.buyInAnnual ?? "0", 10) || 0,
          buyInDaily: Number.parseInt(parsedSettings?.buyInDaily ?? "0", 10) || 0,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel encerrar a etapa.");
      }

      setStageClosedAt(nowIso);
      setShowCloseStageConfirm(false);
      setIsRunning(false);
      setStageNotice("Etapa encerrada com confirmacao administrativa.");
      window.localStorage.removeItem(`${STAGE_RUNTIME_STORAGE_KEY_PREFIX}-${stage.id}`);
      router.push(`/shpl-2026/ranking?stage=${stage.id}`);
      router.refresh();
    } catch (error) {
      setStageNotice(
        error instanceof Error ? error.message : "Nao foi possivel encerrar a etapa."
      );
    } finally {
      setIsClosingStage(false);
    }
  }

  function getPlayerRowClassName(player: StagePlayerControl, isSelected: boolean) {
    if (player.leftStage) {
      return isSelected
        ? "border-[rgba(255,132,92,0.34)] bg-[rgba(255,132,92,0.18)]"
        : "border-[rgba(255,132,92,0.18)] bg-[rgba(255,132,92,0.08)]";
    }

    if (player.outOfCurrentMatch) {
      return isSelected
        ? "border-[rgba(255,166,84,0.36)] bg-[rgba(255,166,84,0.18)]"
        : "border-[rgba(255,166,84,0.2)] bg-[rgba(255,166,84,0.08)]";
    }

    if (player.dailyPaid) {
      return isSelected
        ? "border-[rgba(129,211,120,0.4)] bg-[rgba(129,211,120,0.18)]"
        : "border-[rgba(129,211,120,0.22)] bg-[rgba(129,211,120,0.08)]";
    }

    if (player.annualPaid) {
      return isSelected
        ? "border-[rgba(255,208,101,0.38)] bg-[rgba(255,208,101,0.16)]"
        : "border-[rgba(255,208,101,0.2)] bg-[rgba(255,208,101,0.07)]";
    }

    return isSelected
      ? "border-[rgba(255,208,101,0.22)] bg-[rgba(255,255,255,0.06)]"
      : "border-[rgba(255,208,101,0.1)] bg-[rgba(255,255,255,0.03)]";
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#07160f_0%,#04110c_100%)] px-4 py-4 md:px-6">
      <div className="mx-auto grid w-full max-w-[1460px] gap-5 xl:grid-cols-[106px_minmax(0,1fr)]">
        <aside className="rounded-[1.8rem] border border-[rgba(255,208,101,0.18)] bg-[linear-gradient(180deg,rgba(7,27,19,0.96),rgba(5,19,14,0.98))] p-3 shadow-[0_20px_45px_rgba(0,0,0,0.32)]">
          <div className="flex flex-col items-center gap-4">
            <Image
              alt="Logo oficial da SHPL"
              className="h-auto w-[72px]"
              height={72}
              priority
              src="/shpl-logo.png"
              width={72}
            />

            <div className="grid w-full gap-3">
              {getVisibleShplNavItems(roles).map((item) => (
                <Link
                  key={item.href}
                  className={`${sideButtonClassName} ${
                    isShplNavItemActive(pathname, item.href)
                      ? activeSideButtonClassName
                        : ""
                  }`}
                  href={item.href}
                >
                  {item.icon}
                </Link>
              ))}
              <button
                className={sideButtonClassName}
                onClick={() => {
                  router.push("/menu");
                  router.refresh();
                }}
                type="button"
              >
                S
              </button>
            </div>
          </div>
        </aside>

        <main className="rounded-[2rem] border border-[rgba(255,208,101,0.18)] bg-[linear-gradient(180deg,rgba(11,34,24,0.94),rgba(6,19,14,0.98))] p-5 shadow-[0_24px_54px_rgba(0,0,0,0.34)] md:p-6">
          <div className="flex flex-col gap-4 border-b border-[rgba(255,208,101,0.1)] pb-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-[rgba(255,220,143,0.98)] md:text-5xl">
                  Mesa
                </h1>
                <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.72)]">
                  Painel operacional da {stage.title} para controle da mesa, cronometro de acao e acoes dos jogadores.
                </p>
              </div>

              <div className="inline-flex items-center gap-3 rounded-[0.95rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-sm font-semibold text-[rgba(255,236,184,0.96)]">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(255,191,39,0.14)] text-xs font-black">
                  {stage.title.replace("Etapa ", "")}
                </span>
                <span>
                  {stageClosedAt
                    ? "Etapa encerrada"
                    : stage.status === "scheduled"
                      ? "Etapa agendada"
                      : "Etapa em andamento"}
                </span>
              </div>
            </div>

            <div className="grid gap-3 rounded-[1.45rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-4 py-4 md:grid-cols-[minmax(0,1fr)_280px] md:items-center">
              <div className="grid gap-1">
                <p className="text-lg font-semibold text-[rgba(255,236,184,0.96)]">
                  Inicio programado: {formatStageStart(stage.stageDate)}
                </p>
                <p className="text-sm text-[rgba(236,225,196,0.68)]">
                  Inicio real: {actualStageStartedAt ? formatDateTime(actualStageStartedAt) : "--/--/---- --:--"}
                </p>
              </div>
              <div className="grid gap-1 text-left md:text-right">
                <p className="text-lg font-semibold text-[rgba(255,236,184,0.96)]">
                  Duracao da partida: {formatLongClock(matchElapsedSeconds)}
                </p>
                <p className="text-sm text-[rgba(236,225,196,0.68)]">
                  Partida atual iniciada: {currentMatchStartedAt ? formatDateTime(currentMatchStartedAt) : "--/--/---- --:--"}
                </p>
              </div>
            </div>

            {stageNotice ? (
              <div className="rounded-[1.15rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,183,32,0.08)] px-4 py-3 text-sm text-[rgba(255,236,184,0.92)]">
                {stageNotice}
              </div>
            ) : null}
          </div>

          <div className="mt-5 rounded-[1.7rem] border border-[rgba(255,208,101,0.18)] bg-[linear-gradient(180deg,rgba(28,16,8,0.42),rgba(255,255,255,0.02))] p-5 shadow-[inset_0_0_0_1px_rgba(255,208,101,0.06)] md:p-6">
            <div className="grid gap-4 xl:grid-cols-[1.5fr_0.95fr_0.95fr]">
              {[currentLevel, nextLevel, thirdLevel].map((level, index) => (
                <button
                  key={level?.levelNumber ?? `empty-${index}`}
                  className={`rounded-[1.35rem] border text-left transition ${
                    index === 0
                      ? "border-[rgba(255,208,101,0.36)] bg-[linear-gradient(180deg,rgba(255,183,32,0.18),rgba(255,255,255,0.05))] px-6 py-7"
                      : "border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-5 py-5"
                  } ${level ? "hover:border-[rgba(255,208,101,0.28)]" : "opacity-50"}`}
                  disabled={!level}
                  onClick={() => handleSetCurrentLevel(currentLevelIndex + index)}
                  type="button"
                >
                  <p className={`uppercase tracking-[0.2em] text-[rgba(236,225,196,0.56)] ${index === 0 ? "text-sm" : "text-[0.76rem]"}`}>
                    {index === 0 ? "Blind Atual" : `Nivel ${level?.levelNumber ?? "-"}`}
                  </p>
                  <p className={`mt-3 font-black tracking-tight text-[rgba(255,244,214,0.98)] ${index === 0 ? "text-[3.6rem] md:text-[4.3rem]" : "text-4xl md:text-[2.7rem]"}`}>
                    {level ? buildBlindLabel(level) : "-"}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-8 text-center">
              <p className="text-[5rem] font-black tracking-tight text-[rgba(181,214,255,0.96)] md:text-[7.2rem]">
                {formatClock(remainingSeconds)}
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button className={timerButtonClassName} disabled={!canStartCurrentMatch || isRunning} onClick={handleStartTimer} type="button">
                  INICIAR
                </button>
                <button className={timerButtonClassName} disabled={!isRunning} onClick={() => setIsRunning(false)} type="button">
                  PAUSAR
                </button>
                <button
                  className={timerButtonClassName}
                  disabled={stageClosedAt !== null}
                  onClick={() => handleSetCurrentLevel(Math.max(currentLevelIndex - 1, 0))}
                  type="button"
                >
                  VOLTAR
                </button>
                <button
                  className={timerButtonClassName}
                  disabled={stageClosedAt !== null}
                  onClick={() => handleSetCurrentLevel(Math.min(currentLevelIndex + 1, blindLevels.length - 1))}
                  type="button"
                >
                  AVANCAR
                </button>
                <button className={timerButtonClassName} disabled={!canCloseCurrentMatch} onClick={handleCloseCurrentMatch} type="button">
                  ENCERRAR PARTIDA
                </button>
                <button className={timerButtonClassName} disabled={!canStartNextMatch} onClick={handleStartNextMatch} type="button">
                  INICIAR PROXIMA PARTIDA
                </button>
                {showActionClock ? (
                  <button
                    className="rounded-[0.95rem] border border-[rgba(129,196,255,0.28)] bg-[rgba(129,196,255,0.1)] px-4 py-3 text-sm font-semibold text-[rgba(220,239,255,0.96)] transition hover:bg-[rgba(129,196,255,0.16)] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={stageClosedAt !== null}
                    onClick={toggleActionClock}
                    type="button"
                  >
                    Cronometro de acao
                  </button>
                ) : null}
              </div>

              <div className="mt-4 flex flex-col items-center justify-center gap-3 md:flex-row md:gap-6">
                <p className="text-lg text-[rgba(236,225,196,0.76)]">
                  Proximo intervalo: {nextBreakLabel}
                </p>
                <div className="rounded-[1rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
                  <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[rgba(236,225,196,0.52)]">
                    Stack medio
                  </p>
                  <p className="mt-1 text-2xl font-black text-[rgba(255,220,143,0.98)]">
                    {averageStack}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <StageStatusChip
                  label="Jogadores aptos"
                  value={`${eligibleStagePlayers.length}`}
                />
                <StageStatusChip
                  label="Jogadores vivos"
                  value={`${activeMatchPlayers.length}`}
                />
                <StageStatusChip
                  label="Partida atual"
                  value={currentMatchClosed ? "fechada" : "aberta"}
                />
                <button
                  className="rounded-[0.95rem] border border-[rgba(255,132,92,0.24)] bg-[rgba(255,132,92,0.1)] px-4 py-3 text-sm font-semibold text-[rgba(255,214,198,0.96)] transition hover:bg-[rgba(255,132,92,0.16)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!canCloseStage}
                  onClick={handleRequestCloseStage}
                  type="button"
                >
                  Encerrar etapa
                </button>
              </div>
            </div>
          </div>

          <section className="mt-5 grid overflow-hidden rounded-[1.55rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] shadow-[0_28px_60px_rgba(0,0,0,0.28)] xl:grid-cols-[1.35fr_0.65fr]">
            <div className="border-b border-[rgba(255,208,101,0.1)] p-5 xl:border-b-0 xl:border-r md:p-6">
              <div className="border-b border-[rgba(255,208,101,0.1)] pb-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
                  Jogadores da etapa
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
                  Ranking parcial da etapa
                </h2>
                <p className="mt-2 text-sm text-[rgba(236,225,196,0.68)]">
                  Acompanhe as partidas e selecione um jogador para aplicar as acoes da rodada.
                </p>
              </div>

              <div className="mt-5 overflow-x-auto rounded-[1.2rem] border border-[rgba(255,208,101,0.12)]">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-[rgba(6,17,12,0.92)]">
                      <th className="border-b border-r border-[rgba(255,208,101,0.12)] px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(255,236,184,0.92)]">
                        Jogador
                      </th>
                      {players[0]?.matchPoints.map((_, matchIndex) => (
                        <th
                          key={`match-head-${matchIndex}`}
                          className="min-w-[120px] border-b border-r border-[rgba(255,208,101,0.12)] px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(255,236,184,0.92)]"
                        >
                          {matchIndex + 1}a partida
                        </th>
                      ))}
                      <th className="min-w-[120px] border-b border-[rgba(255,208,101,0.12)] px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(255,236,184,0.92)]">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingRows.map((player, index) => {
                      const isSelected = player.playerId === selectedPlayer?.playerId;

                      return (
                        <tr
                          key={player.playerId}
                          className={`${index % 2 === 0 ? "bg-[rgba(11,37,27,0.82)]" : "bg-[rgba(8,28,20,0.96)]"} ${getPlayerRowClassName(player, isSelected)}`}
                        >
                          <td className="border-b border-r border-[rgba(255,208,101,0.1)] px-4 py-3">
                            <button
                              className="flex w-full items-center gap-3 text-left"
                              onClick={() => setSelectedPlayerId(player.playerId)}
                              type="button"
                            >
                              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(255,208,101,0.18)] bg-[rgba(255,183,32,0.12)] text-xs font-semibold text-[rgba(255,236,184,0.96)]">
                                {index + 1}
                              </span>
                              <span className="truncate text-base font-medium text-[rgba(255,244,214,0.96)]">
                                {player.playerName}
                              </span>
                            </button>
                          </td>
                          {player.matchPoints.map((points, matchIndex) => (
                            <td
                              key={`${player.playerId}-${matchIndex}`}
                              className="border-b border-r border-[rgba(255,208,101,0.1)] px-4 py-3 text-center text-base text-[rgba(236,225,196,0.9)]"
                            >
                              {points}
                            </td>
                          ))}
                          <td className="border-b border-[rgba(255,208,101,0.1)] px-4 py-3 text-center text-lg font-semibold text-[rgba(255,236,184,0.96)]">
                            {player.totalPoints}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-5 md:p-6">
              {selectedPlayer ? (
                <>
                  <div className="rounded-[1.2rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
                      Jogador selecionado
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
                      {selectedPlayer.playerName}
                    </h3>
                    <p className="mt-1 text-sm text-[rgba(236,225,196,0.68)]">
                      {buildPlayerStatus(selectedPlayer)}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    <button className={compactActionButtonClassName} disabled={stageClosedAt !== null} onClick={handleConfirmAnnualBuyIn} type="button">
                      Buy-in anual
                    </button>
                    <button
                      className={`${compactActionButtonClassName} ${!selectedPlayer.annualPaid ? "opacity-45" : ""}`}
                      disabled={!selectedPlayer.annualPaid || stageClosedAt !== null}
                      onClick={handleConfirmDailyBuyIn}
                      type="button"
                    >
                      Buy-in do dia
                    </button>
                    <button className={compactActionButtonClassName} disabled={stageClosedAt !== null} onClick={handleConfirmBothBuyIns} type="button">
                      Buy-in dos dois
                    </button>
                    <button className={compactActionButtonClassName} disabled={stageClosedAt !== null} onClick={handleLeaveStage} type="button">
                      Sair da etapa
                    </button>
                    <button className={compactActionButtonClassName} disabled={!canMarkSelectedPlayerOut} onClick={handlePlayerOutFromMatch} type="button">
                      Saiu da partida
                    </button>
                    <button className={compactActionButtonClassName} disabled={playerActionHistory.length === 0} onClick={handleUndoLastAction} type="button">
                      Desfazer ultima acao
                    </button>
                  </div>

                  <div className="mt-4 rounded-[1.1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgba(236,225,196,0.48)]">
                      Legenda de cores
                    </p>
                    <div className="mt-3 grid gap-2">
                      <LegendRow
                        colorClassName="bg-[rgba(255,208,101,0.16)] border-[rgba(255,208,101,0.3)]"
                        label="Amarelo: buy-in anual pago"
                      />
                      <LegendRow
                        colorClassName="bg-[rgba(129,211,120,0.16)] border-[rgba(129,211,120,0.3)]"
                        label="Verde: buy-in anual e do dia pagos"
                      />
                      <LegendRow
                        colorClassName="bg-[rgba(255,166,84,0.16)] border-[rgba(255,166,84,0.3)]"
                        label="Laranja: perdeu ou saiu da partida atual"
                      />
                      <LegendRow
                        colorClassName="bg-[rgba(255,132,92,0.16)] border-[rgba(255,132,92,0.28)]"
                        label="Vermelho: saiu da etapa"
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </main>
      </div>

      {actionClockRemaining !== null ? (
        <div className="fixed bottom-6 right-6 z-40 rounded-[1.25rem] border border-[rgba(129,196,255,0.24)] bg-[rgba(10,29,44,0.92)] px-5 py-4 shadow-[0_16px_34px_rgba(0,0,0,0.28)]">
          <p className="text-xs uppercase tracking-[0.22em] text-[rgba(202,230,255,0.62)]">
            Cronometro de acao
          </p>
          <p className="mt-2 text-4xl font-black text-[rgba(220,239,255,0.98)]">
            {formatClock(actionClockRemaining)}
          </p>
          <button
            className="mt-3 rounded-[0.85rem] border border-[rgba(129,196,255,0.22)] bg-[rgba(129,196,255,0.1)] px-4 py-2 text-sm font-semibold text-[rgba(220,239,255,0.96)]"
            onClick={() => setActionClockRemaining(null)}
            type="button"
          >
            Fechar
          </button>
        </div>
      ) : null}

      {showSeatSelector ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Fechar selecao de lugares"
            className="absolute inset-0 bg-[rgba(2,10,7,0.72)] backdrop-blur-[3px]"
            onClick={handleCloseSeatSelector}
            type="button"
          />

          <div className="relative z-10 grid w-full max-w-6xl gap-5 rounded-[1.55rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] p-5 shadow-[0_28px_60px_rgba(0,0,0,0.42)] xl:grid-cols-[1.2fr_0.8fr] md:p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
                Confirmacao da mesa
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[rgba(255,244,214,0.96)] md:text-3xl">
                {pendingSeatAction === "start-next"
                  ? "Confirmar lugares da proxima partida"
                  : "Definir lugares da partida"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.72)]">
                Clique em um dos 8 lugares da mesa e selecione qual jogador verde vai ocupar esse assento.
              </p>

              <div className="relative mt-6 flex min-h-[430px] items-center justify-center overflow-hidden rounded-[1.7rem] border border-[rgba(255,208,101,0.14)] bg-[radial-gradient(circle_at_center,rgba(23,92,58,0.72),rgba(7,24,18,0.98)_72%)]">
                <div className="absolute h-[62%] w-[72%] rounded-full border-[3px] border-[rgba(255,208,101,0.22)] bg-[radial-gradient(circle_at_center,rgba(20,92,57,0.8),rgba(8,34,24,0.96)_70%)] shadow-[inset_0_0_0_1px_rgba(255,208,101,0.06)]" />
                <div className="absolute h-[46%] w-[52%] rounded-full border border-[rgba(255,208,101,0.12)] bg-[rgba(5,15,11,0.34)]" />

                {normalizeSeatAssignments(draftSeatAssignments).map((playerId, seatIndex) => {
                  const seatPosition = getSeatPosition(seatIndex);
                  const assignedPlayer = eligibleStagePlayers.find(
                    (player) => player.playerId === playerId
                  );
                  const isSelected = selectedSeatIndex === seatIndex;

                  return (
                    <button
                      key={`seat-${seatIndex + 1}`}
                      className={`absolute flex h-[84px] w-[124px] flex-col items-center justify-center rounded-[1.1rem] border px-3 py-3 text-center shadow-[0_14px_28px_rgba(0,0,0,0.22)] transition ${
                        isSelected
                          ? "border-[rgba(255,208,101,0.42)] bg-[rgba(255,183,32,0.14)]"
                          : "border-[rgba(255,208,101,0.16)] bg-[rgba(7,24,18,0.9)]"
                      }`}
                      onClick={() => setSelectedSeatIndex(seatIndex)}
                      style={seatPosition}
                      type="button"
                    >
                      <span className="text-[0.66rem] uppercase tracking-[0.18em] text-[rgba(236,225,196,0.54)]">
                        Lugar {seatIndex + 1}
                      </span>
                      <span className="mt-2 text-sm font-semibold text-[rgba(255,244,214,0.96)]">
                        {assignedPlayer?.playerName ?? "Selecionar"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4 md:p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[rgba(236,225,196,0.48)]">
                Lugar selecionado
              </p>
              <h3 className="mt-2 text-xl font-semibold text-[rgba(255,244,214,0.96)]">
                Lugar {selectedSeatIndex + 1}
              </h3>

              <label className="mt-4 grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.52)]">
                  Jogador
                </span>
                <select
                  className="h-12 rounded-[0.95rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none"
                  onChange={(event) =>
                    handleSeatAssignmentChange(selectedSeatIndex, event.target.value)
                  }
                  value={draftSeatAssignments[selectedSeatIndex] ?? ""}
                >
                  <option value="">Deixar vazio</option>
                  {buildSeatPlayerOptions(eligibleStagePlayers, draftSeatAssignments, selectedSeatIndex).map(
                    (player) => (
                      <option key={player.playerId} value={player.playerId}>
                        {player.playerName}
                      </option>
                    )
                  )}
                </select>
              </label>

              <div className="mt-5 rounded-[1rem] border border-[rgba(255,208,101,0.1)] bg-[rgba(7,24,18,0.56)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                  Jogadores aptos
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {eligibleStagePlayers.map((player) => {
                    const assignedSeat = draftSeatAssignments.findIndex(
                      (playerId) => playerId === player.playerId
                    );

                    return (
                      <span
                        key={player.playerId}
                        className="rounded-full border border-[rgba(129,211,120,0.22)] bg-[rgba(129,211,120,0.1)] px-3 py-1 text-xs font-semibold text-[rgba(222,255,221,0.96)]"
                      >
                        {player.playerName}
                        {assignedSeat >= 0 ? ` - L${assignedSeat + 1}` : ""}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                <button
                  className="h-12 rounded-[0.95rem] border border-[rgba(255,208,101,0.24)] bg-[linear-gradient(180deg,#ffd54e_0%,#c88807_100%)] px-5 text-sm font-black uppercase tracking-[0.16em] text-[#2a1a00] transition hover:brightness-110"
                  onClick={handleConfirmSeatAssignments}
                  type="button"
                >
                  {pendingSeatAction === "start-next" ? "Continuar" : "Salvar e iniciar"}
                </button>
                <button
                  className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(255,255,255,0.03)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.96)] transition hover:bg-[rgba(255,255,255,0.05)]"
                  onClick={handleCloseSeatSelector}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showCloseStageConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Fechar confirmacao de encerramento"
            className="absolute inset-0 bg-[rgba(2,10,7,0.72)] backdrop-blur-[3px]"
            onClick={() => setShowCloseStageConfirm(false)}
            type="button"
          />

          <div className="relative z-10 w-full max-w-xl rounded-[1.4rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] p-5 shadow-[0_28px_60px_rgba(0,0,0,0.42)] md:p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
              Confirmacao administrativa
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
              Encerrar etapa
            </h2>
            <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.72)]">
              Isso vai travar a operacao da etapa atual. Use essa confirmacao somente quando todas as partidas do dia ja tiverem sido concluidas.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(255,255,255,0.03)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.96)] transition hover:bg-[rgba(255,255,255,0.05)]"
                onClick={() => setShowCloseStageConfirm(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="h-11 rounded-[0.95rem] border border-[rgba(255,132,92,0.28)] bg-[rgba(255,132,92,0.12)] px-5 text-sm font-semibold text-[rgba(255,214,198,0.96)] transition hover:bg-[rgba(255,132,92,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isClosingStage}
                onClick={handleConfirmCloseStage}
                type="button"
              >
                {isClosingStage ? "Encerrando..." : "Confirmar encerramento"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StageStatusChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-[rgba(255,208,101,0.16)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm text-[rgba(255,236,184,0.9)]">
      <span className="text-[rgba(236,225,196,0.58)]">{label}: </span>
      <span className="font-semibold text-[rgba(255,244,214,0.98)]">{value}</span>
    </div>
  );
}

function LegendRow({
  colorClassName,
  label,
}: {
  colorClassName: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-4 w-4 rounded-full border ${colorClassName}`} />
      <span className="text-sm text-[rgba(236,225,196,0.74)]">{label}</span>
    </div>
  );
}

function buildPlayerStatus(player: StagePlayerControl) {
  if (player.leftStage) {
    return "Saiu da etapa";
  }

  if (player.outOfCurrentMatch) {
    return "Saiu da partida atual";
  }

  if (player.dailyPaid) {
    return "Buy-in anual e do dia confirmados";
  }

  if (player.annualPaid) {
    return "Buy-in anual confirmado";
  }

  return "Aguardando confirmacao de buy-in";
}

function normalizeSeatAssignments(assignments: Array<string | null>) {
  return Array.from({ length: TOTAL_TABLE_SEATS }, (_, index) => assignments[index] ?? null);
}

function findFirstEditableSeat(assignments: Array<string | null>) {
  const emptySeatIndex = assignments.findIndex((playerId) => playerId === null);
  return emptySeatIndex >= 0 ? emptySeatIndex : 0;
}

function buildSeatPlayerOptions(
  players: StagePlayerControl[],
  draftAssignments: Array<string | null>,
  selectedSeatIndex: number
) {
  const selectedSeatPlayerId = draftAssignments[selectedSeatIndex];

  return players.filter((player) => {
    if (player.playerId === selectedSeatPlayerId) {
      return true;
    }

    return !draftAssignments.includes(player.playerId);
  });
}

function getSeatPosition(seatIndex: number) {
  const positions = [
    { top: "8%", left: "50%", transform: "translate(-50%, 0)" },
    { top: "21%", right: "8%" },
    { top: "50%", right: "2%", transform: "translate(0, -50%)" },
    { bottom: "14%", right: "10%" },
    { bottom: "6%", left: "50%", transform: "translate(-50%, 0)" },
    { bottom: "14%", left: "10%" },
    { top: "50%", left: "2%", transform: "translate(0, -50%)" },
    { top: "21%", left: "8%" },
  ] as const;

  return positions[seatIndex] ?? positions[0];
}

function buildBlindLabel(level: BlindLevel) {
  return level.ante && level.ante > 0
    ? `${level.smallBlind}/${level.bigBlind}/${level.ante}`
    : `${level.smallBlind}/${level.bigBlind}`;
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatLongClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatStageStart(stageDate: string) {
  const [year, month, day] = stageDate.split("-");
  return `${day}/${month}/${year} 20:00`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const sideButtonClassName =
  "flex min-h-14 w-full items-center justify-center rounded-[1.1rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(255,255,255,0.03)] px-2 text-lg font-semibold text-[rgba(255,236,184,0.96)] transition hover:border-[rgba(255,208,101,0.28)] hover:bg-[rgba(255,255,255,0.06)]";

const activeSideButtonClassName =
  "border-[rgba(255,208,101,0.48)] bg-[linear-gradient(180deg,rgba(255,187,39,0.18),rgba(255,187,39,0.06))] text-[rgba(255,244,214,0.98)] shadow-[0_0_0_1px_rgba(255,208,101,0.1)]";

const timerButtonClassName =
  "flex min-h-14 min-w-[90px] items-center justify-center rounded-[0.95rem] border border-[rgba(255,208,101,0.24)] bg-[linear-gradient(180deg,#ffd54e_0%,#c88807_100%)] px-4 py-3 text-center text-[0.68rem] font-black tracking-[0.14em] text-[#2a1a00] shadow-[0_10px_20px_rgba(255,183,32,0.18)] transition hover:brightness-110";

const compactActionButtonClassName =
  "h-10 rounded-[0.9rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(255,255,255,0.03)] px-3 text-xs font-semibold text-[rgba(255,236,184,0.96)] transition hover:border-[rgba(255,208,101,0.26)] hover:bg-[rgba(255,255,255,0.05)] disabled:cursor-not-allowed disabled:opacity-50";
