"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import { SHPLNavIcon } from "@/components/shpl-nav-icon";
import { BlindEditorModal } from "@/components/blind-editor-modal";
import {
  MatchResultModal,
  type MatchResultPayload,
  type MatchResultPlayer,
} from "@/components/match-result-modal";
import {
  StageResultModal,
  type StageResultPayload,
  type StageResultPlayer,
} from "@/components/stage-result-modal";
import {
  LatePlayerModal,
  type LatePlayerSeatOption,
} from "@/components/late-player-modal";
import type { AccessRole } from "@/lib/auth/roles";
import {
  buildStagePointsSummary,
  calculateMatchPoints,
  compareStageRanking,
} from "@/lib/domain/rules";
import type { BlindLevel, LeagueSnapshot, Stage } from "@/lib/domain/types";
import {
  LIVE_LAB_TABLE_SEAT_OPTIONS,
  LIVE_LAB_TOTAL_TABLE_SEATS,
  buildStageRuntimeStorageKey,
  normalizeSeatAssignments as normalizeSharedSeatAssignments,
  normalizeStageRuntimeTables,
  normalizeTableSeatCount,
  type StageRuntimeTableState,
  type StageRuntimePlayerState,
  type StoredStageRuntimePayload,
} from "@/lib/live-lab/stage-runtime-shared";
import { getVisibleShplNavItems, isShplNavItemActive } from "@/lib/navigation/shpl-nav";

type StagePlayerControl = {
  playerId: string;
  playerName: string;
  annualPaid: boolean;
  dailyPaid: boolean;
  leftStage: boolean;
  outOfCurrentMatch: boolean;
  estimatedStack: number;
  matchPoints: number[];
  receivesAnnualPoint?: boolean;
};

type MatchResultModalContext = {
  mode: "close" | "auto-close" | "agreement";
  notice: string;
  logEntries: string[];
  announcement?: string;
  preferredWinnerId?: string;
  preferredSecondPlaceId?: string;
};

type LatePlayerContext = {
  playerId: string;
  playerName: string;
};

type SeatSetupIntent = "start-current" | "start-next";

type PlayerActionSnapshot = {
  players: StagePlayerControl[];
  selectedPlayerId: string | null;
  currentMatchClosed: boolean;
  completedMatchDurations: number[];
  isRunning: boolean;
  tables: StageRuntimeTableState[];
  currentMatchStartedAt: string | null;
  actualStageStartedAt: string | null;
  matchElapsedSeconds: number;
  currentLevelIndex: number;
  remainingSeconds: number;
  actionClockRemaining: number | null;
  stageClosedAt: string | null;
};

const SETTINGS_STORAGE_KEY = "shpl-2026-settings";

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
  const isAdminUser = roles.includes("Administrador");
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
  const [dailyPrizeOverride, setDailyPrizeOverride] = useState("");
  const [dailyPrizeOverrideNote, setDailyPrizeOverrideNote] = useState("");
  const [annualContributionOverride, setAnnualContributionOverride] = useState("");
  const [annualContributionOverrideNote, setAnnualContributionOverrideNote] = useState("");
  const [includeTestInAnnual, setIncludeTestInAnnual] = useState(false);
  const [showLeaveStageConfirm, setShowLeaveStageConfirm] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [showStageResultModal, setShowStageResultModal] = useState(false);
  const [confirmedStageRankingPlayerIds, setConfirmedStageRankingPlayerIds] = useState<string[]>([]);
  const [latePlayerContext, setLatePlayerContext] = useState<LatePlayerContext | null>(null);
  const [matchResultModalContext, setMatchResultModalContext] =
    useState<MatchResultModalContext | null>(null);
  const [showSeatSetupModal, setShowSeatSetupModal] = useState(false);
  const [seatSetupIntent, setSeatSetupIntent] = useState<SeatSetupIntent>("start-current");
  const [showBlindEditor, setShowBlindEditor] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"saved" | "saving" | "error">("saved");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [stageNotice, setStageNotice] = useState<string | null>(null);
  const [actionClockRemaining, setActionClockRemaining] = useState<number | null>(null);
  const [tables, setTables] = useState<StageRuntimeTableState[]>([
    {
      seatCount: LIVE_LAB_TOTAL_TABLE_SEATS,
      seatAssignments: Array.from({ length: LIVE_LAB_TOTAL_TABLE_SEATS }, () => null),
    },
  ]);
  const [selectedTableIndex, setSelectedTableIndex] = useState(0);
  const [selectedSeatIndex, setSelectedSeatIndex] = useState(0);
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
      estimatedStack: 3000,
      matchPoints: [0],
    }))
  );
  const previousLevelIndexRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const actionClockExpiredRef = useRef(false);
  const runtimeHydratedRef = useRef(false);
  const runtimeSyncInFlightRef = useRef(false);
  const runtimeSyncUrgentRef = useRef(false);
  const lastRuntimeSignatureRef = useRef("");
  const lastSyncedAtRef = useRef<string | null>(null);
  const stageLogEnsuredRef = useRef(false);

  const buildRuntimePlayersSnapshot = useCallback((
    currentPlayers: StagePlayerControl[] = players,
  ): StageRuntimePlayerState[] => {
    return currentPlayers.map((player) => ({
      playerId: player.playerId,
      playerName: player.playerName,
      annualPaid: player.annualPaid,
      dailyPaid: player.dailyPaid,
      leftStage: player.leftStage,
      outOfCurrentMatch: player.outOfCurrentMatch,
      estimatedStack: player.estimatedStack,
      matchPoints: [...player.matchPoints],
    }));
  }, [players]);

  const buildStageRuntimePayload = useCallback((nextUpdatedAt?: string): StoredStageRuntimePayload => {
    return {
      actualStageStartedAt,
      currentMatchStartedAt,
      matchElapsedSeconds,
      completedMatchDurations: [...completedMatchDurations],
      stageClosedAt,
      currentMatchClosed,
      currentLevelIndex,
      tables: structuredClone(tables),
      seatAssignments: [...(tables[0]?.seatAssignments ?? [])],
      tableSeatCount: tables[0]?.seatCount ?? LIVE_LAB_TOTAL_TABLE_SEATS,
      blindLevels: structuredClone(blindLevels),
      clockSeconds,
      showActionClock,
      breakDurationMinutes,
      breakEveryLevels,
      remainingSeconds,
      isRunning,
      actionClockRemaining,
      selectedPlayerId,
      players: buildRuntimePlayersSnapshot(),
      updatedAt: nextUpdatedAt,
    };
  }, [
    actualStageStartedAt,
    actionClockRemaining,
    blindLevels,
    breakDurationMinutes,
    breakEveryLevels,
    buildRuntimePlayersSnapshot,
    clockSeconds,
    completedMatchDurations,
    currentLevelIndex,
    currentMatchClosed,
    currentMatchStartedAt,
    isRunning,
    matchElapsedSeconds,
    remainingSeconds,
    selectedPlayerId,
    showActionClock,
    stageClosedAt,
    tables,
  ]);

  function serializeRuntimePayload(payload: StoredStageRuntimePayload) {
    return JSON.stringify({
      ...payload,
      updatedAt: undefined,
    });
  }

  const updateLastSyncedAt = useCallback((value: string | null) => {
    lastSyncedAtRef.current = value;
    setLastSyncedAt(value);
  }, []);

  const requestImmediateRuntimeSync = useCallback(() => {
    runtimeSyncUrgentRef.current = true;
  }, []);

  function applyStageRuntimePayload(payload: StoredStageRuntimePayload) {
    setActualStageStartedAt(payload.actualStageStartedAt ?? null);
    setCurrentMatchStartedAt(payload.currentMatchStartedAt ?? null);
    setMatchElapsedSeconds(payload.matchElapsedSeconds ?? 0);
    setCompletedMatchDurations(payload.completedMatchDurations ?? []);
    setStageClosedAt(payload.stageClosedAt ?? null);
    setCurrentMatchClosed(payload.currentMatchClosed ?? false);
    setCurrentLevelIndex(payload.currentLevelIndex ?? 0);
    const nextTables = normalizeStageRuntimeTables(
      payload.tables,
      payload.seatAssignments ?? [],
      payload.tableSeatCount,
    );
    setTables(nextTables);
    setSelectedTableIndex((currentIndex) => Math.min(currentIndex, nextTables.length - 1));
    if (payload.blindLevels?.length) {
      setBlindLevels(payload.blindLevels);
    }
    if (typeof payload.clockSeconds === "number" && payload.clockSeconds > 0) {
      setClockSeconds(payload.clockSeconds);
    }
    setShowActionClock(payload.showActionClock ?? true);
    setBreakDurationMinutes(Math.max(payload.breakDurationMinutes ?? 0, 0));
    setBreakEveryLevels(Math.max(payload.breakEveryLevels ?? 0, 0));
    if (typeof payload.remainingSeconds === "number") {
      setRemainingSeconds(Math.max(payload.remainingSeconds, 0));
    }
    setIsRunning(Boolean(payload.isRunning));
    setActionClockRemaining(
      payload.actionClockRemaining === null || payload.actionClockRemaining === undefined
        ? null
        : Math.max(payload.actionClockRemaining, 0),
    );
    setSelectedPlayerId(payload.selectedPlayerId ?? null);
    if (payload.players?.length) {
      setPlayers(
        payload.players.map((player) => ({
          playerId: player.playerId,
          playerName: player.playerName,
          annualPaid: player.annualPaid,
          dailyPaid: player.dailyPaid,
          leftStage: player.leftStage,
          outOfCurrentMatch: player.outOfCurrentMatch,
          estimatedStack: player.estimatedStack,
          matchPoints: [...player.matchPoints],
        })),
      );
    }
  }

  const appendStageLogEntries = useCallback(
    async (entries: string[], ensureOnly = false) => {
      try {
        await fetch("/api/shpl-admin/stage-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stage: {
              id: stage.id,
              title: stage.title,
              stageDate: stage.stageDate,
              scheduledStartTime: stage.scheduledStartTime,
            },
            entries,
            ensureOnly,
          }),
        });
      } catch {
        // Mantem a operacao da mesa mesmo se o TXT falhar temporariamente.
      }
    },
    [stage.id, stage.scheduledStartTime, stage.stageDate, stage.title]
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
        const nextSuggestedStack = parsedSettings.desiredStack ?? "3000";
        const nextSuggestedStackNumber = Math.max(
          Number.parseInt(nextSuggestedStack || "0", 10) || 0,
          0
        );
        setAverageStack(nextSuggestedStack);
        setPlayers((currentPlayers) =>
          currentPlayers.map((player) => ({
            ...player,
            estimatedStack:
              player.estimatedStack === 3000 ? nextSuggestedStackNumber : player.estimatedStack,
          }))
        );
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
    let cancelled = false;

    async function hydrateStageRuntime() {
      try {
        const response = await fetch(`/api/shpl-admin/stage-session?stageId=${stage.id}`, {
          cache: "no-store",
        });

        if (response.ok) {
          const payload = (await response.json()) as {
            session?: {
              runtime?: StoredStageRuntimePayload | null;
            } | null;
          };
          const runtime = payload.session?.runtime ?? null;
          if (runtime && !cancelled) {
            const signature = serializeRuntimePayload(runtime);
            applyStageRuntimePayload(runtime);
            lastRuntimeSignatureRef.current = signature;
            if (runtime.updatedAt) {
              updateLastSyncedAt(runtime.updatedAt);
            }
            window.localStorage.setItem(
              buildStageRuntimeStorageKey(stage.id),
              JSON.stringify(runtime),
            );
            runtimeHydratedRef.current = true;
            return;
          }
        }
      } catch {
        // Fallback local abaixo.
      }

      try {
        const rawRuntime = window.localStorage.getItem(buildStageRuntimeStorageKey(stage.id));

        if (rawRuntime && !cancelled) {
          const parsedRuntime = JSON.parse(rawRuntime) as StoredStageRuntimePayload;
          applyStageRuntimePayload(parsedRuntime);
          lastRuntimeSignatureRef.current = serializeRuntimePayload(parsedRuntime);
          if (parsedRuntime.updatedAt) {
            updateLastSyncedAt(parsedRuntime.updatedAt);
          }
        }
      } catch {
        // Sem runtime local valido.
      } finally {
        runtimeHydratedRef.current = true;
      }
    }

    void hydrateStageRuntime();

    return () => {
      cancelled = true;
    };
  }, [stage.id, updateLastSyncedAt]);

  useEffect(() => {
    stageLogEnsuredRef.current = false;
  }, [stage.id]);

  useEffect(() => {
    if (stageLogEnsuredRef.current) {
      return;
    }

    stageLogEnsuredRef.current = true;
    void appendStageLogEntries([], true);
  }, [appendStageLogEntries]);

  useEffect(() => {
    const selectedTableSeatCount = tables[selectedTableIndex]?.seatAssignments.length ?? 1;
    setSelectedSeatIndex((currentIndex) =>
      Math.min(currentIndex, Math.max(selectedTableSeatCount - 1, 0)),
    );
  }, [selectedTableIndex, tables]);

  useEffect(() => {
    if (!runtimeHydratedRef.current) {
      return;
    }

    const runtimePayload = buildStageRuntimePayload();
    const signature = serializeRuntimePayload(runtimePayload);

    try {
      window.localStorage.setItem(buildStageRuntimeStorageKey(stage.id), JSON.stringify(runtimePayload));
    } catch {
      // Ignora falhas locais e tenta manter a sincronizacao remota.
    }

    if (signature === lastRuntimeSignatureRef.current || runtimeSyncInFlightRef.current) {
      runtimeSyncUrgentRef.current = false;
      return;
    }

    const syncDelayMs = runtimeSyncUrgentRef.current ? 0 : isRunning ? 900 : 250;
    const timeoutId = window.setTimeout(async () => {
      runtimeSyncUrgentRef.current = false;
      runtimeSyncInFlightRef.current = true;
      setSyncStatus("saving");
      const payloadWithTimestamp = buildStageRuntimePayload(new Date().toISOString());
      const body = JSON.stringify({
        stage: {
          id: stage.id,
          title: stage.title,
          stageDate: stage.stageDate,
          scheduledStartTime: stage.scheduledStartTime,
        },
        runtime: payloadWithTimestamp,
        session: {
          modules: {
            tableActive: true,
          },
        },
      });

      const maxRetries = 3;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await fetch("/api/shpl-admin/stage-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });

          if (response.ok) {
            lastRuntimeSignatureRef.current = signature;
            if (payloadWithTimestamp.updatedAt) {
              updateLastSyncedAt(payloadWithTimestamp.updatedAt);
            }
            window.localStorage.setItem(
              buildStageRuntimeStorageKey(stage.id),
              JSON.stringify(payloadWithTimestamp),
            );
            setSyncStatus("saved");
            break;
          }
        } catch {
          // Retry com backoff exponencial
          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          }
        }
      }

      runtimeSyncInFlightRef.current = false;
      setSyncStatus((prev) => (prev === "saving" ? "error" : prev));
    }, syncDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    actualStageStartedAt,
    actionClockRemaining,
    blindLevels,
    breakDurationMinutes,
    breakEveryLevels,
    clockSeconds,
    completedMatchDurations,
    currentMatchStartedAt,
    currentMatchClosed,
    currentLevelIndex,
    isRunning,
    matchElapsedSeconds,
    players,
    remainingSeconds,
    selectedPlayerId,
    showActionClock,
    stageClosedAt,
    tables,
    stage.id,
    stage.scheduledStartTime,
    stage.stageDate,
    stage.title,
    buildStageRuntimePayload,
    updateLastSyncedAt,
  ]);

  useEffect(() => {
    function handleBeforeUnload() {
      if (stageClosedAt) {
        return;
      }

      try {
        const runtimePayload = buildStageRuntimePayload(new Date().toISOString());
        const body = JSON.stringify({
          stage: {
            id: stage.id,
            title: stage.title,
            stageDate: stage.stageDate,
            scheduledStartTime: stage.scheduledStartTime,
          },
          runtime: runtimePayload,
          session: { modules: { tableActive: true } },
        });
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/shpl-admin/stage-session", blob);
      } catch {
        // Ignora erros no beforeunload — nao ha nada mais que fazer.
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [buildStageRuntimePayload, stageClosedAt, stage.id, stage.scheduledStartTime, stage.stageDate, stage.title]);

  useEffect(() => {
    if (!runtimeHydratedRef.current) {
      return;
    }

    let cancelled = false;

    async function pollRemoteStageRuntime() {
      try {
        const response = await fetch(`/api/shpl-admin/stage-session?stageId=${stage.id}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          session?: {
            runtime?: StoredStageRuntimePayload | null;
          } | null;
        };
        const runtime = payload.session?.runtime ?? null;

        if (!runtime || cancelled) {
          return;
        }

        const nextSignature = serializeRuntimePayload(runtime);

        if (nextSignature === lastRuntimeSignatureRef.current) {
          return;
        }

        const serverUpdatedAt = runtime.updatedAt ?? null;
        if (
          serverUpdatedAt !== null &&
          lastSyncedAtRef.current !== null &&
          serverUpdatedAt < lastSyncedAtRef.current
        ) {
          return;
        }

        applyStageRuntimePayload(runtime);
        lastRuntimeSignatureRef.current = nextSignature;
        if (serverUpdatedAt !== null) {
          updateLastSyncedAt(serverUpdatedAt);
        }
        window.localStorage.setItem(
          buildStageRuntimeStorageKey(stage.id),
          JSON.stringify(runtime),
        );
      } catch {
        // Mantem o fluxo local caso a consulta remota falhe.
      }
    }

    const intervalId = window.setInterval(() => {
      void pollRemoteStageRuntime();
    }, isRunning ? 1500 : 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isRunning, stage.id, updateLastSyncedAt]);

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
    if (previousLevelIndexRef.current === null) {
      previousLevelIndexRef.current = currentLevelIndex;
      return;
    }

    if (previousLevelIndexRef.current === currentLevelIndex) {
      return;
    }

    previousLevelIndexRef.current = currentLevelIndex;
    const changedLevel = blindLevels[currentLevelIndex];

    if (!changedLevel) {
      return;
    }

    const speechDelayMs = playBlindLevelChangedSignal(audioContextRef);
    void appendStageLogEntries([
      formatStageEventLogEntry(`Blind atualizado para ${buildBlindLabel(changedLevel)}.`),
    ]);
    const timeoutId = window.setTimeout(() => {
      announceTableMessage(`Blind atual ${buildBlindAnnouncement(changedLevel)}.`);
    }, speechDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [appendStageLogEntries, blindLevels, currentLevelIndex]);

  useEffect(() => {
    if (actionClockRemaining === null) {
      actionClockExpiredRef.current = false;
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
    if (actionClockRemaining === null || actionClockRemaining > 0) {
      actionClockExpiredRef.current = false;
      return;
    }

    if (actionClockExpiredRef.current) {
      return;
    }

    actionClockExpiredRef.current = true;
    playActionClockExpiredSignal(audioContextRef);
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
  const estimatedStageChips = useMemo(
    () =>
      eligibleStagePlayers.reduce(
        (total, player) => total + Math.max(player.estimatedStack || 0, 0),
        0
      ),
    [eligibleStagePlayers]
  );
  const averageActiveStack = useMemo(
    () =>
      calculateEstimatedAverageActiveStack({
        estimatedStageChips,
        activePlayers: activeMatchPlayers,
        totalEligiblePlayers: eligibleStagePlayers.length,
        currentLevelIndex,
      }),
    [activeMatchPlayers, currentLevelIndex, eligibleStagePlayers.length, estimatedStageChips]
  );
  const averageActiveBigBlinds = useMemo(() => {
    if (!currentLevel?.bigBlind) {
      return 0;
    }

    return Math.round(averageActiveStack / currentLevel.bigBlind);
  }, [averageActiveStack, currentLevel]);
  const assignedEligibleSeatEntries = useMemo(
    () =>
      tables
        .flatMap((table, tableIndex) =>
          table.seatAssignments.map((playerId, seatIndex) => {
            if (!playerId) {
              return null;
            }

            const player = eligibleStagePlayers.find((entry) => entry.playerId === playerId);

            if (!player) {
              return null;
            }

            return {
              tableIndex,
              seatIndex,
              playerId,
              playerName: player.playerName,
            };
          }),
        )
        .filter(
          (
            entry,
          ): entry is {
            tableIndex: number;
            seatIndex: number;
            playerId: string;
            playerName: string;
          } => Boolean(entry),
        ),
    [eligibleStagePlayers, tables]
  );
  const missingSeatPlayers = useMemo(
    () =>
      eligibleStagePlayers.filter(
        (player) => !assignedEligibleSeatEntries.some((entry) => entry.playerId === player.playerId)
      ),
    [assignedEligibleSeatEntries, eligibleStagePlayers]
  );
  const hasCompleteSeatAssignments =
    eligibleStagePlayers.length > 0 && missingSeatPlayers.length === 0;
  const canMarkSelectedPlayerOut =
    Boolean(selectedPlayer) &&
    !selectedPlayer?.leftStage &&
    !selectedPlayer?.outOfCurrentMatch &&
    Boolean(selectedPlayer?.annualPaid) &&
    Boolean(selectedPlayer?.dailyPaid) &&
    !stageClosedAt &&
    !currentMatchClosed;
  const canJoinCurrentMatch =
    Boolean(selectedPlayer) &&
    !selectedPlayer?.leftStage &&
    Boolean(selectedPlayer?.outOfCurrentMatch) &&
    Boolean(selectedPlayer?.annualPaid) &&
    Boolean(selectedPlayer?.dailyPaid) &&
    currentMatchStartedAt !== null &&
    !currentMatchClosed &&
    !stageClosedAt;
  const canCloseCurrentMatch =
    currentMatchStartedAt !== null &&
    !currentMatchClosed &&
    eligibleStagePlayers.length > 0;
  const canStartCurrentMatch =
    !stageClosedAt && eligibleStagePlayers.length >= 2 && !currentMatchClosed;
  const canCloseStage =
    !stageClosedAt &&
    completedMatchDurations.length > 0 &&
    !isRunning &&
    currentMatchStartedAt === null;
  const selectedTable = tables[selectedTableIndex] ?? tables[0];
  const selectedSeatAssignments = selectedTable?.seatAssignments ?? [];
  const selectedSeatPlayerId = selectedSeatAssignments[selectedSeatIndex] ?? "";

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
  const stageResultPlayers = useMemo<StageResultPlayer[]>(
    () =>
      rankingRows
        .filter((player) => player.dailyPaid)
        .map((player) => ({
          playerId: player.playerId,
          playerName: player.playerName,
          totalPoints: player.totalPoints,
          wins: player.wins,
          secondPlaces: player.secondPlaces,
          thirdPlaces: player.thirdPlaces,
          dailyPaid: player.dailyPaid,
          leftStage: player.leftStage,
        })),
    [rankingRows],
  );
  const buildTableSeatSummary = useCallback(
    (currentTables: StageRuntimeTableState[] = tables) =>
      currentTables
        .map((table, tableIndex) => {
          const seatSummary = normalizeSharedSeatAssignments(table.seatAssignments, table.seatCount)
            .map((playerId, seatIndex) => {
              if (!playerId) {
                return `Lugar ${seatIndex + 1}: vazio`;
              }

              const assignedPlayer =
                players.find((player) => player.playerId === playerId)?.playerName ?? "Jogador indefinido";
              return `Lugar ${seatIndex + 1}: ${assignedPlayer}`;
            })
            .join(" | ");

          return `Mesa ${tableIndex + 1}: ${seatSummary}`;
        })
        .join(" | "),
    [players, tables]
  );

  const matchResultPlayers = useMemo<MatchResultPlayer[]>(
    () => buildMatchResultPlayers(players, currentMatchIndex),
    [currentMatchIndex, players],
  );
  const displayedMatchResultPlayers = useMemo(() => {
    const preferredWinnerId = matchResultModalContext?.preferredWinnerId;
    const preferredSecondPlaceId = matchResultModalContext?.preferredSecondPlaceId;

    if (!preferredWinnerId && !preferredSecondPlaceId) {
      return matchResultPlayers;
    }

    return [...matchResultPlayers].sort((left, right) => {
      if (left.playerId === preferredWinnerId) return -1;
      if (right.playerId === preferredWinnerId) return 1;
      if (left.playerId === preferredSecondPlaceId) return -1;
      if (right.playerId === preferredSecondPlaceId) return 1;
      return 0;
    });
  }, [
    matchResultModalContext?.preferredSecondPlaceId,
    matchResultModalContext?.preferredWinnerId,
    matchResultPlayers,
  ]);

  const currentBlindLabel = currentLevel ? buildBlindLabel(currentLevel) : "nao definido";
  const latePlayerAvailableSeats = useMemo<LatePlayerSeatOption[]>(
    () => buildAvailableLatePlayerSeats(tables),
    [tables],
  );

  const openMatchResultModal = useCallback((context: MatchResultModalContext) => {
    if (stageClosedAt || currentMatchClosed) {
      return;
    }

    setShowAgreementModal(false);
    setMatchResultModalContext(context);
  }, [currentMatchClosed, stageClosedAt]);

  const closeCurrentMatchAsFinished = useCallback(
    (notice: string) => {
      if (currentMatchClosed) {
        return;
      }
      requestImmediateRuntimeSync();
      setIsRunning(false);
      setActionClockRemaining(null);
      setCurrentMatchClosed(true);
      setCompletedMatchDurations((currentDurations) => {
        if (currentDurations.length > currentMatchIndex) {
          return currentDurations;
        }

        return [...currentDurations, matchElapsedSeconds];
      });
      setStageNotice(notice);
    },
    [currentMatchClosed, currentMatchIndex, matchElapsedSeconds, requestImmediateRuntimeSync]
  );

  useEffect(() => {
    if (
      stageClosedAt ||
      currentMatchClosed ||
      currentMatchStartedAt === null ||
      activeMatchPlayers.length > 0
    ) {
      return;
    }

    openMatchResultModal({
      mode: "auto-close",
      notice: "Todos os jogadores sairam da partida atual. Resultado confirmado; inicie uma nova partida quando quiser continuar.",
      logEntries: [
        formatStageEventLogEntry(
          `Partida ${currentMatchIndex + 1} encerrada automaticamente com resultado confirmado porque nao restaram jogadores ativos.`,
        ),
      ],
    });
  }, [
    activeMatchPlayers.length,
    currentMatchClosed,
    currentMatchIndex,
    currentMatchStartedAt,
    openMatchResultModal,
    stageClosedAt,
  ]);

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
    if (boundedIndex === currentLevelIndex) {
      return;
    }

    const nextLevel = blindLevels[boundedIndex];
    setCurrentLevelIndex(boundedIndex);
    setStageNotice(
      nextLevel
        ? `Blind ajustado manualmente para ${buildBlindLabel(nextLevel)}.`
        : "Blind ajustado manualmente.",
    );
    if (nextLevel) {
      void appendStageLogEntries([
        formatStageEventLogEntry(`Blind ajustado manualmente para ${buildBlindLabel(nextLevel)}.`),
      ]);
    }
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

    if (!hasCompleteSeatAssignments) {
      setStageNotice("Configure os lugares dos jogadores aptos para iniciar a partida.");
      setSeatSetupIntent("start-current");
      setShowSeatSetupModal(true);
      return;
    }

    performStartCurrentMatch();
  }

  function handleCloseCurrentMatch() {
    if (!canCloseCurrentMatch) {
      setStageNotice(
        "A partida so pode ser encerrada depois de iniciada e com jogadores aptos."
      );
      return;
    }

    openMatchResultModal({
      mode: "close",
      notice: "Partida encerrada com resultado confirmado. Agora voce pode iniciar a proxima partida.",
      logEntries: [
        formatStageEventLogEntry(`Partida ${currentMatchIndex + 1} encerrada manualmente com resultado confirmado.`),
      ],
    });
  }

  function performStartCurrentMatch() {
    const nowIso = new Date().toISOString();
    requestImmediateRuntimeSync();
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
    void appendStageLogEntries([
      formatStageEventLogEntry(`Partida ${currentMatchIndex + 1} iniciada.`),
      formatStageEventLogEntry(
        `Blind atual ${currentLevel ? buildBlindLabel(currentLevel) : "nao definido"}.`
      ),
      formatStageEventLogEntry(`Mesa: ${buildTableSeatSummary()}.`),
    ]);
  }

  function performStartNextMatch() {
    requestImmediateRuntimeSync();
    setPlayerActionHistory([]);
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => ({
        ...player,
        outOfCurrentMatch: player.leftStage || !player.annualPaid || !player.dailyPaid,
        matchPoints: [...player.matchPoints, 0],
      }))
    );
    setCurrentMatchStartedAt(null);
    setMatchElapsedSeconds(0);
    setCurrentLevelIndex(0);
    setRemainingSeconds((blindLevels[0]?.durationMinutes ?? 0) * 60);
    setActionClockRemaining(null);
    setCurrentMatchClosed(false);
    setStageNotice("Nova partida preparada. Quando quiser, aperte iniciar para o tempo comecar.");
    setIsRunning(false);
    void appendStageLogEntries([
      formatStageEventLogEntry(`Nova partida preparada: ${currentMatchIndex + 2}a partida.`),
      formatStageEventLogEntry(
        `Blind reiniciado para ${blindLevels[0] ? buildBlindLabel(blindLevels[0]) : "nao definido"}.`
      ),
      formatStageEventLogEntry(`Mesa: ${buildTableSeatSummary()}.`),
    ]);
  }

  function handleDirectSeatAssignmentChange(tableIndex: number, seatIndex: number, playerId: string) {
    const normalizedPlayerId = playerId || null;
    const targetTable = tables[tableIndex] ?? tables[0];
    const previousPlayerId = targetTable?.seatAssignments[seatIndex] ?? null;
    const previousPlayerName = previousPlayerId
      ? players.find((player) => player.playerId === previousPlayerId)?.playerName ?? "Jogador indefinido"
      : "vazio";
    const nextPlayerName = normalizedPlayerId
      ? players.find((player) => player.playerId === normalizedPlayerId)?.playerName ?? "Jogador indefinido"
      : "vazio";
    pushPlayerActionSnapshot();
    setTables((currentTables) =>
      currentTables.map((table, currentTableIndex) => {
        const nextAssignments = normalizeSharedSeatAssignments(table.seatAssignments, table.seatCount);

        for (let index = 0; index < nextAssignments.length; index += 1) {
          const isTargetSeat = currentTableIndex === tableIndex && index === seatIndex;

          if (!isTargetSeat && nextAssignments[index] === normalizedPlayerId) {
            nextAssignments[index] = null;
          }
        }

        if (currentTableIndex === tableIndex) {
          nextAssignments[seatIndex] = normalizedPlayerId;
        }

        return {
          ...table,
          seatAssignments: nextAssignments,
        };
      }),
    );
    setStageNotice(
      currentMatchStartedAt && !currentMatchClosed
        ? "Posicoes da mesa atualizadas e sincronizadas para a partida em andamento."
        : "Posicoes da mesa atualizadas com sucesso."
    );
    void appendStageLogEntries([
      formatStageEventLogEntry(
        `Posicao da mesa alterada: Mesa ${tableIndex + 1}, lugar ${seatIndex + 1} foi de ${previousPlayerName} para ${nextPlayerName}.`
      ),
    ]);
  }

  function handleSeatSetupAssignmentChange(playerId: string, seatKey: string) {
    const parsedSeat = parseSeatKey(seatKey);

    if (!parsedSeat) {
      return;
    }

    handleDirectSeatAssignmentChange(parsedSeat.tableIndex, parsedSeat.seatIndex, playerId);
  }

  function handleConfirmSeatSetupAndStart() {
    if (!hasCompleteSeatAssignments) {
      setStageNotice("Ainda falta definir lugar para todos os jogadores aptos.");
      return;
    }

    setShowSeatSetupModal(false);

    if (seatSetupIntent === "start-next") {
      performStartNextMatch();
      return;
    }

    performStartCurrentMatch();
  }

  function assignSeatToPlayer(tableIndex: number, seatIndex: number, playerId: string) {
    setTables((currentTables) =>
      currentTables.map((table, currentTableIndex) => {
        const nextAssignments = normalizeSharedSeatAssignments(table.seatAssignments, table.seatCount);

        for (let index = 0; index < nextAssignments.length; index += 1) {
          const isTargetSeat = currentTableIndex === tableIndex && index === seatIndex;

          if (!isTargetSeat && nextAssignments[index] === playerId) {
            nextAssignments[index] = null;
          }
        }

        if (currentTableIndex === tableIndex) {
          nextAssignments[seatIndex] = playerId;
        }

        return {
          ...table,
          seatAssignments: nextAssignments,
        };
      }),
    );
    setSelectedTableIndex(tableIndex);
    setSelectedSeatIndex(seatIndex);
  }

  function handleTableSeatCountChange(tableIndex: number, nextCount: number) {
    const currentTable = tables[tableIndex];
    const currentSeatCount = currentTable?.seatCount ?? LIVE_LAB_TOTAL_TABLE_SEATS;

    if (nextCount === currentSeatCount) {
      return;
    }

    const normalizedNextCount = normalizeTableSeatCount(nextCount);
    const vacatedPlayerNames = (currentTable?.seatAssignments ?? [])
      .slice(normalizedNextCount)
      .filter((playerId): playerId is string => Boolean(playerId))
      .map((playerId) => players.find((player) => player.playerId === playerId)?.playerName ?? "Jogador indefinido");

    setTables((currentTables) =>
      currentTables.map((table, currentTableIndex) =>
        currentTableIndex === tableIndex
          ? {
              ...table,
              seatCount: normalizedNextCount,
              seatAssignments: normalizeSharedSeatAssignments(table.seatAssignments, normalizedNextCount),
            }
          : table,
      ),
    );

    const direction = normalizedNextCount > currentSeatCount ? "aumentado" : "reduzido";
    setStageNotice(
      vacatedPlayerNames.length > 0
        ? `Numero de lugares da Mesa ${tableIndex + 1} ${direction} para ${normalizedNextCount}. ${vacatedPlayerNames.join(", ")} ficou(aram) sem lugar e precisa(m) ser reposicionado(s).`
        : `Numero de lugares da Mesa ${tableIndex + 1} ${direction} para ${normalizedNextCount}.`,
    );
    void appendStageLogEntries([
      formatStageEventLogEntry(
        `Numero de lugares da Mesa ${tableIndex + 1} ${direction} de ${currentSeatCount} para ${normalizedNextCount}.${
          vacatedPlayerNames.length > 0 ? ` Removidos da mesa: ${vacatedPlayerNames.join(", ")}.` : ""
        }`,
      ),
    ]);
  }

  function handleTableCountChange(nextTableCount: 1 | 2) {
    if (nextTableCount === tables.length) {
      return;
    }

    if (nextTableCount < tables.length) {
      const removedTable = tables[1];
      const vacatedPlayerNames = (removedTable?.seatAssignments ?? [])
        .filter((playerId): playerId is string => Boolean(playerId))
        .map((playerId) => players.find((player) => player.playerId === playerId)?.playerName ?? "Jogador indefinido");

      setTables((currentTables) => currentTables.slice(0, 1));
      setSelectedTableIndex(0);
      setSelectedSeatIndex(0);
      setStageNotice(
        vacatedPlayerNames.length > 0
          ? `Mesa 2 removida. ${vacatedPlayerNames.join(", ")} ficou(aram) sem lugar e precisa(m) ser reposicionado(s) na Mesa 1.`
          : "Mesa 2 removida.",
      );
      void appendStageLogEntries([
        formatStageEventLogEntry(
          `Mesa 2 removida, voltando para 1 mesa.${
            vacatedPlayerNames.length > 0 ? ` Removidos da mesa: ${vacatedPlayerNames.join(", ")}.` : ""
          }`,
        ),
      ]);
      return;
    }

    setTables((currentTables) => [
      ...currentTables,
      {
        seatCount: LIVE_LAB_TOTAL_TABLE_SEATS,
        seatAssignments: Array.from({ length: LIVE_LAB_TOTAL_TABLE_SEATS }, () => null),
      },
    ]);
    setSelectedTableIndex(1);
    setSelectedSeatIndex(0);
    setStageNotice("Mesa 2 adicionada vazia. Os jogadores da Mesa 1 foram mantidos.");
    void appendStageLogEntries([
      formatStageEventLogEntry("Mesa 2 adicionada vazia para organizacao fisica da etapa."),
    ]);
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
        tables: structuredClone(tables),
        currentMatchStartedAt,
        actualStageStartedAt,
        matchElapsedSeconds,
        currentLevelIndex,
        remainingSeconds,
        actionClockRemaining,
        stageClosedAt,
      },
    ]);
  }

  function handleConfirmAnnualBuyIn() {
    const playerName = selectedPlayer?.playerName;
    pushPlayerActionSnapshot();
    updateSelectedPlayer((player) => ({ ...player, annualPaid: true }));
    setStageNotice("Buy-in anual confirmado.");
    if (playerName) {
      void appendStageLogEntries([formatStageEventLogEntry(`${playerName} deu buy-in anual.`)]);
    }
    if (playerName) {
      announceTableMessage(`${playerName} deu buy-in anual.`);
    }
  }

  function handleConfirmDailyBuyIn() {
    if (!selectedPlayer?.annualPaid) {
      setStageNotice("Confirme primeiro o buy-in anual para liberar o buy-in do dia.");
      return;
    }

    const playerName = selectedPlayer.playerName;
    const shouldAskLatePlayerDecision = Boolean(currentMatchStartedAt && !currentMatchClosed);
    pushPlayerActionSnapshot();
    updateSelectedPlayer((player) => ({
      ...player,
      dailyPaid: true,
      outOfCurrentMatch: shouldAskLatePlayerDecision ? true : player.outOfCurrentMatch,
    }));
    setStageNotice(
      shouldAskLatePlayerDecision
        ? "Buy-in do dia confirmado. Defina se o jogador entra agora ou fica para a proxima partida."
        : "Buy-in do dia confirmado."
    );
    void appendStageLogEntries([formatStageEventLogEntry(`${playerName} deu buy-in do dia.`)]);
    announceTableMessage(`${playerName} deu buy-in do dia.`);

    if (shouldAskLatePlayerDecision) {
      setLatePlayerContext({
        playerId: selectedPlayer.playerId,
        playerName,
      });
    }
  }

  function handleConfirmBothBuyIns() {
    const playerName = selectedPlayer?.playerName;
    const selectedPlayerIdForLateModal = selectedPlayer?.playerId;
    const shouldAskLatePlayerDecision = Boolean(
      selectedPlayer && currentMatchStartedAt && !currentMatchClosed,
    );
    pushPlayerActionSnapshot();
    updateSelectedPlayer((player) => ({
      ...player,
      annualPaid: true,
      dailyPaid: true,
      outOfCurrentMatch: shouldAskLatePlayerDecision ? true : player.outOfCurrentMatch,
    }));
    setStageNotice(
      shouldAskLatePlayerDecision
        ? "Buy-in anual e do dia confirmados. Defina se o jogador entra agora ou fica para a proxima partida."
        : "Buy-in anual e do dia confirmados."
    );
    if (playerName) {
      void appendStageLogEntries([
        formatStageEventLogEntry(`${playerName} deu buy-in anual e do dia.`),
      ]);
      announceTableMessage(`${playerName} deu buy-in anual e do dia.`);
    }

    if (shouldAskLatePlayerDecision && playerName && selectedPlayerIdForLateModal) {
      setLatePlayerContext({
        playerId: selectedPlayerIdForLateModal,
        playerName,
      });
    }
  }

  function handleJoinCurrentMatch() {
    if (!canJoinCurrentMatch || !selectedPlayer) {
      return;
    }

    setLatePlayerContext({
      playerId: selectedPlayer.playerId,
      playerName: selectedPlayer.playerName,
    });
  }

  function handleLatePlayerJoinNow(stack: number, tableIndex: number, seatIndex: number) {
    if (!latePlayerContext) {
      return;
    }

    pushPlayerActionSnapshot();
    requestImmediateRuntimeSync();
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.playerId === latePlayerContext.playerId
          ? {
              ...player,
              outOfCurrentMatch: false,
              estimatedStack: stack,
            }
          : player,
      ),
    );
    assignSeatToPlayer(tableIndex, seatIndex, latePlayerContext.playerId);
    setStageNotice(
      `${latePlayerContext.playerName} entrou na partida atual com stack de ${stack} fichas.`,
    );
    void appendStageLogEntries([
      formatStageEventLogEntry(
        `${latePlayerContext.playerName} entrou na partida atual (chegou atrasado). Stack: ${stack} fichas. Mesa ${tableIndex + 1}, lugar ${seatIndex + 1}.`,
      ),
    ]);
    announceTableMessage(`${latePlayerContext.playerName} entrou na partida.`);
    setLatePlayerContext(null);
  }

  function handleLatePlayerJoinNextMatch() {
    if (!latePlayerContext) {
      return;
    }

    pushPlayerActionSnapshot();
    requestImmediateRuntimeSync();
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => {
        if (player.playerId !== latePlayerContext.playerId) {
          return player;
        }

        const nextMatchPoints = [...player.matchPoints];
        nextMatchPoints[currentMatchIndex] = 0;

        return {
          ...player,
          outOfCurrentMatch: true,
          matchPoints: nextMatchPoints,
        };
      }),
    );
    setStageNotice(`${latePlayerContext.playerName} ficou para a proxima partida.`);
    void appendStageLogEntries([
      formatStageEventLogEntry(
        `${latePlayerContext.playerName} confirmou buy-in, mas ficou para a proxima partida.`,
      ),
    ]);
    setLatePlayerContext(null);
  }

  function handleEstimatedStackChange(playerId: string, value: string) {
    const nextValue = Math.max(Number.parseInt(value || "0", 10) || 0, 0);

    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.playerId === playerId
          ? {
              ...player,
              estimatedStack: nextValue,
            }
          : player
      )
    );
  }

  function handleSuggestedStackChange(value: string) {
    const digitsOnly = value.replace(/[^\d]/g, "");
    setAverageStack(digitsOnly || "0");
  }

  function applySuggestedStackToEligiblePlayers() {
    const nextSuggestedStack = Math.max(Number.parseInt(averageStack || "0", 10) || 0, 0);

    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.annualPaid && player.dailyPaid && !player.leftStage
          ? {
              ...player,
              estimatedStack: nextSuggestedStack,
            }
          : player
      )
    );
    setStageNotice("Stack sugerido aplicado aos jogadores aptos da mesa.");
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

    const activePlayers = players.filter(
      (player) =>
        player.annualPaid &&
        player.dailyPaid &&
        !player.leftStage &&
        !player.outOfCurrentMatch
    );
    const finalPosition = activePlayers.length;
    const pointsForThisExit = calculateMatchPoints(finalPosition);

    setPlayers((currentPlayers) => {
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

      return nextPlayers;
    });

    setStageNotice(`${selectedPlayer.playerName} saiu da partida atual.`);
    void appendStageLogEntries([
      formatStageEventLogEntry(`${selectedPlayer.playerName} saiu da partida atual.`),
    ]);
    if (!stageClosedAt) {
      announceTableMessage(`${selectedPlayer.playerName} saiu da partida.`);
    }
  }

  type StageExitPenalty = "keep_points" | "zero_with_annual" | "zero_without_annual";

  function handleLeaveStage(penalty: StageExitPenalty) {
    if (!selectedPlayer || stageClosedAt) {
      return;
    }

    pushPlayerActionSnapshot();
    let winnerName: string | null = null;
    let winnerIdForModal: string | null = null;

    setPlayers((currentPlayers) => {
      const redistributedPlayers = redistributeStageExitStacks(currentPlayers, selectedPlayer.playerId);

      const nextPlayers = redistributedPlayers.map((player) => {
        if (player.playerId !== selectedPlayer.playerId) {
          return player;
        }

        if (penalty === "keep_points") {
          return {
            ...player,
            leftStage: true,
            outOfCurrentMatch: true,
            estimatedStack: 0,
          };
        }

        const nextMatchPoints = player.matchPoints.map(() => 0);
        nextMatchPoints[currentMatchIndex] = 1;

        return {
          ...player,
          leftStage: true,
          outOfCurrentMatch: true,
          estimatedStack: 0,
          matchPoints: nextMatchPoints,
          receivesAnnualPoint: penalty === "zero_with_annual",
        };
      });

      const remainingPlayers = nextPlayers.filter(
        (player) =>
          player.annualPaid &&
          player.dailyPaid &&
          !player.leftStage &&
          !player.outOfCurrentMatch
      );

      if (remainingPlayers.length === 1) {
        const winnerId = remainingPlayers[0].playerId;
        winnerName = remainingPlayers[0].playerName;
        winnerIdForModal = winnerId;

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
      openMatchResultModal({
        mode: "close",
        notice: `${selectedPlayer.playerName} saiu da etapa. Resultado confirmado para fechar a partida.`,
        logEntries: [
          formatStageEventLogEntry(`${selectedPlayer.playerName} saiu da etapa.`),
          formatStageEventLogEntry(`${winnerName} ficou sugerido em primeiro lugar.`),
        ],
        announcement: `${selectedPlayer.playerName} saiu da etapa. ${winnerName} ficou em primeiro lugar.`,
        preferredWinnerId: winnerIdForModal ?? undefined,
      });
      setShowLeaveStageConfirm(false);
      return;
    }

    const penaltyLabel =
      penalty === "keep_points"
        ? "manteve os pontos"
        : penalty === "zero_with_annual"
          ? "teve a pontuacao zerada (com ponto anual)"
          : "teve a pontuacao zerada (sem ponto anual)";

    setStageNotice(`${selectedPlayer.playerName} saiu da etapa e ${penaltyLabel}.`);
    void appendStageLogEntries([
      formatStageEventLogEntry(`${selectedPlayer.playerName} saiu da etapa.`),
      formatStageEventLogEntry(
        `${selectedPlayer.playerName} ${penaltyLabel}.`
      ),
    ]);
    announceTableMessage(`${selectedPlayer.playerName} saiu da etapa.`);
    setShowLeaveStageConfirm(false);
  }

  function handleAgreementResult(winnerId: string, winnerName: string, secondPlaceId?: string) {
    if (stageClosedAt || currentMatchClosed) {
      return;
    }

    openMatchResultModal({
      mode: "agreement",
      notice: `${winnerName} venceu a partida por acordo/desistencia, com resultado confirmado.`,
      logEntries: [
        formatStageEventLogEntry(`${winnerName} venceu a partida por fechamento manual com resultado confirmado.`),
      ],
      announcement: `${winnerName} venceu a partida.`,
      preferredWinnerId: winnerId,
      preferredSecondPlaceId: secondPlaceId,
    });
  }

  function handleConfirmMatchResult(payload: MatchResultPayload) {
    if (!matchResultModalContext || stageClosedAt || currentMatchClosed) {
      return;
    }

    const placementByPlayerId = new Map(
      payload.placements.map((placement) => [placement.playerId, placement.placement]),
    );
    const resultSummary = payload.placements
      .sort((left, right) => left.placement - right.placement)
      .map((placement) => {
        const playerName =
          players.find((player) => player.playerId === placement.playerId)?.playerName ?? "Jogador";
        return `${playerName}: ${placement.placement}o lugar`;
      })
      .join(" | ");

    pushPlayerActionSnapshot();
    requestImmediateRuntimeSync();

    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => {
        const nextMatchPoints = [...player.matchPoints];
        const placement = placementByPlayerId.get(player.playerId);
        nextMatchPoints[currentMatchIndex] = placement ? calculateMatchPoints(placement) : 0;

        return {
          ...player,
          outOfCurrentMatch:
            player.annualPaid && player.dailyPaid && !player.leftStage ? true : player.outOfCurrentMatch,
          matchPoints: nextMatchPoints,
        };
      }),
    );

    closeCurrentMatchAsFinished(matchResultModalContext.notice);
    void appendStageLogEntries([
      ...matchResultModalContext.logEntries,
      formatStageEventLogEntry(
        `Resultado confirmado da partida ${currentMatchIndex + 1}: ${resultSummary || "sem jogadores pontuados"}.`,
      ),
    ]);

    if (matchResultModalContext.announcement) {
      announceTableMessage(matchResultModalContext.announcement);
    }

    setMatchResultModalContext(null);

    if (eligibleStagePlayers.length >= 2) {
      if (!hasCompleteSeatAssignments) {
        setSeatSetupIntent("start-next");
        setShowSeatSetupModal(true);
      } else {
        performStartNextMatch();
      }
    }
  }

  const calculatedDailyPrize = useMemo(() => {
    try {
      const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      const parsed = rawSettings ? (JSON.parse(rawSettings) as { buyInDaily?: string }) : null;
      const buyInDaily = Number.parseInt(parsed?.buyInDaily ?? "0", 10) || 0;
      const dailyPaidCount = players.filter((p) => p.dailyPaid).length;
      return buyInDaily * dailyPaidCount;
    } catch {
      return 0;
    }
  }, [players]);

  const calculatedAnnualContribution = useMemo(() => {
    try {
      const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      const parsed = rawSettings ? (JSON.parse(rawSettings) as { buyInAnnual?: string }) : null;
      const buyInAnnual = Number.parseInt(parsed?.buyInAnnual ?? "0", 10) || 0;
      const annualPaidCount = players.filter((p) => p.annualPaid).length;
      return buyInAnnual * annualPaidCount;
    } catch {
      return 0;
    }
  }, [players]);

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
      setTables(normalizeStageRuntimeTables(previousSnapshot.tables));
      setSelectedTableIndex((currentIndex) =>
        Math.min(currentIndex, Math.max(previousSnapshot.tables.length - 1, 0)),
      );
      setSelectedSeatIndex(0);
      setCurrentMatchStartedAt(previousSnapshot.currentMatchStartedAt);
      setActualStageStartedAt(previousSnapshot.actualStageStartedAt);
      setMatchElapsedSeconds(previousSnapshot.matchElapsedSeconds);
      setCurrentLevelIndex(previousSnapshot.currentLevelIndex);
      setRemainingSeconds(previousSnapshot.remainingSeconds);
      setActionClockRemaining(previousSnapshot.actionClockRemaining);
      setStageClosedAt(previousSnapshot.stageClosedAt);
      setStageNotice("Ultima acao desfeita.");
      return currentHistory.slice(0, -1);
    });
  }

  function handleRequestCloseStage() {
    if (!canCloseStage) {
      setStageNotice(
        "A etapa so pode ser encerrada depois de pelo menos uma partida finalizada e com o cronometro parado (sem partida em andamento)."
      );
      return;
    }

    setShowStageResultModal(true);
  }

  function handleConfirmStageResult(payload: StageResultPayload) {
    setConfirmedStageRankingPlayerIds(payload.finalRankingPlayerIds);
    setShowStageResultModal(false);
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
            receivesAnnualPoint: player.receivesAnnualPoint,
          })),
          finalRankingPlayerIds: confirmedStageRankingPlayerIds,
          buyInAnnual: Number.parseInt(parsedSettings?.buyInAnnual ?? "0", 10) || 0,
          buyInDaily: Number.parseInt(parsedSettings?.buyInDaily ?? "0", 10) || 0,
          overrideDailyPrizeCents: dailyPrizeOverride.trim()
            ? Math.round(Number.parseFloat(dailyPrizeOverride) * 100)
            : null,
          overrideDailyPrizeNote: dailyPrizeOverrideNote.trim() || null,
          overrideAnnualContributionCents: annualContributionOverride.trim()
            ? Math.round(Number.parseFloat(annualContributionOverride) * 100)
            : null,
          overrideAnnualContributionNote: annualContributionOverrideNote.trim() || null,
          ...(stage.isTest ? { overrideIncludeInAnnual: includeTestInAnnual } : {}),
        }),
      });
      const payload = (await response.json()) as { error?: string; isTestStage?: boolean };

      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel encerrar a etapa.");
      }

      setStageClosedAt(nowIso);
      setShowCloseStageConfirm(false);
      setDailyPrizeOverride("");
      setDailyPrizeOverrideNote("");
      setAnnualContributionOverride("");
      setAnnualContributionOverrideNote("");
      setIncludeTestInAnnual(false);
      setConfirmedStageRankingPlayerIds([]);
      setIsRunning(false);
      await appendStageLogEntries([
        ...(dailyPrizeOverride.trim()
          ? [
              formatStageEventLogEntry(
                `Premiacao do dia ajustada manualmente para R$ ${Number.parseFloat(dailyPrizeOverride).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${dailyPrizeOverrideNote.trim() ? ` (${dailyPrizeOverrideNote.trim()})` : ""}.`
              ),
            ]
          : []),
        ...(annualContributionOverride.trim()
          ? [
              formatStageEventLogEntry(
                `Contribuicao anual ajustada manualmente para R$ ${Number.parseFloat(annualContributionOverride).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${annualContributionOverrideNote.trim() ? ` (${annualContributionOverrideNote.trim()})` : ""}.`
              ),
            ]
          : []),
        ...(stage.isTest && includeTestInAnnual
          ? [
              formatStageEventLogEntry(
                `Etapa de teste incluida nos resultados anuais por decisao administrativa.`
              ),
            ]
          : []),
        formatStageEventLogEntry(`Etapa encerrada em ${formatDateTime(nowIso)}.`),
      ]);
      setStageNotice(
        payload.isTestStage
          ? "Etapa de teste encerrada sem impactar ranking nem pote anual. O resultado ficou salvo para consulta."
          : stage.isTest && includeTestInAnnual
            ? "Etapa de teste incluida nos resultados anuais. Encerrada com confirmacao administrativa."
            : "Etapa encerrada com confirmacao administrativa."
      );
      window.localStorage.removeItem(buildStageRuntimeStorageKey(stage.id));
      router.push(
        payload.isTestStage
          ? `/shpl-2026/historico?stage=${stage.id}`
          : `/shpl-2026/ranking?stage=${stage.id}`
      );
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
      ? "border-[rgba(188,198,210,0.28)] bg-[rgba(141,153,166,0.16)]"
      : "border-[rgba(160,170,182,0.14)] bg-[rgba(141,153,166,0.08)]";
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
                  <SHPLNavIcon fallback={item.icon} size="sm" src={item.iconSrc} />
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
                <SHPLNavIcon fallback="S" size="sm" src="/icons/shpl-menu/sair.svg" />
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
                <p
                  className={`mt-1 text-xs ${
                    syncStatus === "error"
                      ? "text-[rgba(255,132,92,0.82)]"
                      : syncStatus === "saving"
                        ? "text-[rgba(255,236,184,0.72)]"
                        : "text-[rgba(236,225,196,0.48)]"
                  }`}
                >
                  {syncStatus === "saving"
                    ? "Salvando..."
                    : syncStatus === "error"
                      ? "Erro ao salvar - dados salvos localmente"
                      : lastSyncedAt
                        ? `Salvo às ${formatTimeLabel(lastSyncedAt)}`
                        : "Salvo localmente"}
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

              {stage.isTest ? (
                <div className="inline-flex items-center gap-3 rounded-[0.95rem] border border-[rgba(129,196,255,0.22)] bg-[rgba(129,196,255,0.08)] px-4 py-2.5 text-sm font-semibold text-[rgba(220,239,255,0.96)]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(129,196,255,0.16)] text-xs font-black">
                    T
                  </span>
                  <span>Etapa de teste</span>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 rounded-[1.45rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-4 py-4 md:grid-cols-[minmax(0,1fr)_280px] md:items-center">
              <div className="grid gap-1">
                <p className="text-lg font-semibold text-[rgba(255,236,184,0.96)]">
                  Inicio programado: {formatStageStart(stage.stageDate, stage.scheduledStartTime)}
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
                {isAdminUser ? (
                  <button
                    className="rounded-[0.95rem] border border-[rgba(255,208,101,0.28)] bg-[rgba(255,183,32,0.1)] px-4 py-3 text-sm font-semibold text-[rgba(255,236,184,0.96)] transition hover:bg-[rgba(255,183,32,0.16)] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={stageClosedAt !== null}
                    onClick={() => setShowBlindEditor(true)}
                    type="button"
                  >
                    Editar Blinds
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
                    {formatStackValue(averageActiveStack)}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[rgba(236,225,196,0.48)]">
                    ~ {averageActiveBigBlinds} BB
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
                <Link
                  className="rounded-[0.95rem] border border-[rgba(129,196,255,0.24)] bg-[rgba(129,196,255,0.1)] px-4 py-3 text-sm font-semibold text-[rgba(220,239,255,0.96)] transition hover:bg-[rgba(129,196,255,0.16)]"
                  href={`/shpl-2026/transmissao?stage=${stage.id}`}
                >
                  Abrir transmissao
                </Link>
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
                      <th className="min-w-[160px] border-b border-[rgba(255,208,101,0.12)] px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(255,236,184,0.92)]">
                        Vitorias / Pontos
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
                          <td className="border-b border-[rgba(255,208,101,0.1)] px-4 py-3 text-center text-base font-semibold text-[rgba(255,236,184,0.96)]">
                            {buildStagePointsSummary(player.wins, player.totalPoints)}
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
                    <button className={compactActionButtonClassName} disabled={stageClosedAt !== null} onClick={() => setShowLeaveStageConfirm(true)} type="button">
                      Sair da etapa
                    </button>
                    <button className={compactActionButtonClassName} disabled={!canMarkSelectedPlayerOut} onClick={handlePlayerOutFromMatch} type="button">
                      Eliminado
                    </button>
                    <button className={compactActionButtonClassName} disabled={!canJoinCurrentMatch} onClick={handleJoinCurrentMatch} type="button">
                      Entrar na partida
                    </button>
                    <button className={compactActionButtonClassName} disabled={playerActionHistory.length === 0} onClick={handleUndoLastAction} type="button">
                      Desfazer ultima acao
                    </button>
                  </div>

                  {canCloseCurrentMatch && activeMatchPlayers.length >= 1 && (
                    <div className="mt-4 rounded-[1.1rem] border border-[rgba(255,184,143,0.28)] bg-[rgba(255,166,84,0.08)] p-4">
                      <p className="text-sm font-semibold text-[rgba(255,236,184,0.96)]">
                        Partida pode ser encerrada
                      </p>
                      <p className="mt-1 text-xs text-[rgba(236,225,196,0.62)]">
                        {activeMatchPlayers.length === 1
                          ? "Resta 1 jogador ativo. Confirme o resultado antes de fechar."
                          : `${activeMatchPlayers.length} jogadores seguem ativos. Use o modal para confirmar acordo ou ordem final.`}
                      </p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          className="h-10 rounded-[0.95rem] border border-[rgba(129,211,120,0.3)] bg-[rgba(129,211,120,0.12)] px-4 text-sm font-semibold text-[rgba(129,211,120,0.96)] transition hover:bg-[rgba(129,211,120,0.2)]"
                          onClick={handleCloseCurrentMatch}
                          type="button"
                        >
                          Fechar partida
                        </button>
                        {activeMatchPlayers.length >= 2 ? (
                          <button
                            className="h-10 rounded-[0.95rem] border border-[rgba(255,208,101,0.2)] bg-[rgba(255,208,101,0.08)] px-4 text-sm font-semibold text-[rgba(255,236,184,0.96)] transition hover:bg-[rgba(255,208,101,0.14)]"
                            onClick={() => setShowAgreementModal(true)}
                            type="button"
                          >
                            Acordo entre jogadores
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 rounded-[1.1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgba(236,225,196,0.48)]">
                      Legenda de cores
                    </p>
                    <div className="mt-3 grid gap-2">
                      <LegendRow
                        colorClassName="bg-[rgba(141,153,166,0.18)] border-[rgba(160,170,182,0.32)]"
                        label="Cinza: ainda nao deu buy-in"
                      />
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

          <section className="mt-5 rounded-[1.55rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] p-5 shadow-[0_28px_60px_rgba(0,0,0,0.28)] md:p-6">
              <div className="flex flex-col gap-4 border-b border-[rgba(255,208,101,0.1)] pb-4 md:flex-row md:items-start md:justify-between">
                <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
                  Mesa
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
                  Posicoes da mesa
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[rgba(236,225,196,0.7)]">
                  Defina quem ocupa cada lugar antes de iniciar a partida. Todo jogador com buy-in anual e do dia
                  confirmados precisa estar em uma posicao da mesa.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:items-end">
                <p className="text-xs text-[rgba(236,225,196,0.62)]">
                  {hasCompleteSeatAssignments
                    ? "Mesas completas para os jogadores aptos."
                    : `${missingSeatPlayers.length} jogador(es) apto(s) ainda sem lugar definido.`}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                    Quantidade de mesas
                  </span>
                  <div className="inline-flex overflow-hidden rounded-[0.85rem] border border-[rgba(255,208,101,0.18)]">
                    {[1, 2].map((option) => {
                      const tableCount = option as 1 | 2;
                      const isSelected = tableCount === tables.length;

                      return (
                        <button
                          key={`table-count-option-${option}`}
                          className={`h-9 px-3 text-sm font-semibold transition ${
                            isSelected
                              ? "bg-[rgba(255,183,32,0.18)] text-[rgba(255,236,184,0.98)]"
                              : "text-[rgba(236,225,196,0.62)] hover:bg-[rgba(255,255,255,0.04)]"
                          }`}
                          disabled={isSelected}
                          onClick={() => handleTableCountChange(tableCount)}
                          type="button"
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
              <div className="grid gap-5">
                {tables.map((table, tableIndex) => (
                  <div
                    key={`stage-table-${tableIndex + 1}`}
                    className={`rounded-[1.35rem] border p-4 transition ${
                      selectedTableIndex === tableIndex
                        ? "border-[rgba(255,208,101,0.24)] bg-[rgba(255,183,32,0.05)]"
                        : "border-[rgba(255,208,101,0.1)] bg-[rgba(255,255,255,0.02)]"
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                          Mesa {tableIndex + 1}
                        </p>
                        <p className="mt-1 text-sm text-[rgba(236,225,196,0.62)]">
                          {table.seatCount} lugares configurados
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                          Lugares
                        </span>
                        <div className="inline-flex overflow-hidden rounded-[0.85rem] border border-[rgba(255,208,101,0.18)]">
                          {LIVE_LAB_TABLE_SEAT_OPTIONS.map((option) => {
                            const isSelected = option === table.seatCount;

                            return (
                              <button
                                key={`table-${tableIndex + 1}-seat-option-${option}`}
                                className={`h-9 px-3 text-sm font-semibold transition ${
                                  isSelected
                                    ? "bg-[rgba(255,183,32,0.18)] text-[rgba(255,236,184,0.98)]"
                                    : "text-[rgba(236,225,196,0.62)] hover:bg-[rgba(255,255,255,0.04)]"
                                }`}
                                disabled={isSelected}
                                onClick={() => handleTableSeatCountChange(tableIndex, option)}
                                type="button"
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <TableSeatMap
                      highlightedSeatIndex={selectedTableIndex === tableIndex ? selectedSeatIndex : null}
                      onSeatClick={(seatIndex) => {
                        setSelectedTableIndex(tableIndex);
                        setSelectedSeatIndex(seatIndex);
                      }}
                      seatAssignments={table.seatAssignments}
                      seatCount={table.seatCount}
                      seatLabelsByPlayerId={Object.fromEntries(
                        eligibleStagePlayers.map((player) => [player.playerId, player.playerName])
                      )}
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-[1.35rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4 md:p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[rgba(236,225,196,0.48)]">
                  Lugar selecionado
                </p>
                <h3 className="mt-2 text-xl font-semibold text-[rgba(255,244,214,0.96)]">
                  Mesa {selectedTableIndex + 1} - Lugar {selectedSeatIndex + 1}
                </h3>

                <label className="mt-4 grid gap-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.52)]">
                    Jogador
                  </span>
                  <select
                    className="h-12 rounded-[0.95rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none"
                    onChange={(event) =>
                      handleDirectSeatAssignmentChange(selectedTableIndex, selectedSeatIndex, event.target.value)
                    }
                    value={selectedSeatPlayerId}
                  >
                    <option value="">Deixar vazio</option>
                    {selectedTable
                      ? buildSeatPlayerOptions(
                          eligibleStagePlayers,
                          tables,
                          selectedTableIndex,
                          selectedSeatIndex,
                        ).map((player) => (
                          <option key={player.playerId} value={player.playerId}>
                            {player.playerName}
                          </option>
                        ))
                      : null}
                  </select>
                </label>

                <div className="mt-5 rounded-[1rem] border border-[rgba(255,208,101,0.1)] bg-[rgba(7,24,18,0.56)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                    Jogadores aptos
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {eligibleStagePlayers.map((player) => {
                      const assignedSeat = findPlayerTableSeat(tables, player.playerId);

                      return (
                        <span
                          key={player.playerId}
                          className="rounded-full border border-[rgba(129,211,120,0.22)] bg-[rgba(129,211,120,0.1)] px-3 py-1 text-xs font-semibold text-[rgba(222,255,221,0.96)]"
                        >
                          {player.playerName}
                          {assignedSeat
                            ? ` - M${assignedSeat.tableIndex + 1} L${assignedSeat.seatIndex + 1}`
                            : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {missingSeatPlayers.length > 0 ? (
              <div className="mt-5 rounded-[1.1rem] border border-[rgba(255,166,84,0.2)] bg-[rgba(255,166,84,0.08)] px-4 py-4 text-sm text-[rgba(255,232,203,0.94)]">
                Falta definir lugar para:{" "}
                <strong>{missingSeatPlayers.map((player) => player.playerName).join(", ")}</strong>.
              </div>
            ) : null}

            <div className="mt-6 border-t border-[rgba(255,208,101,0.1)] pt-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.15rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4">
                  <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                    Stack sugerido
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
                    {formatStackValue(Math.max(Number.parseInt(averageStack || "0", 10) || 0, 0))}
                  </p>
                  <p className="mt-1 text-sm text-[rgba(236,225,196,0.62)]">
                    valor base que veio das configuracoes, mas pode ser redefinido aqui
                  </p>
                  <div className="mt-4 flex flex-col gap-3">
                    <input
                      className="h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none placeholder:text-[rgba(236,225,196,0.4)]"
                      inputMode="numeric"
                      onChange={(event) => handleSuggestedStackChange(event.target.value)}
                      type="number"
                      value={averageStack}
                    />
                    <button
                      className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(255,183,32,0.12)] px-4 text-sm font-semibold text-[rgba(255,236,184,0.96)] transition hover:bg-[rgba(255,183,32,0.18)]"
                      onClick={applySuggestedStackToEligiblePlayers}
                      type="button"
                    >
                      Aplicar sugestao aos jogadores aptos
                    </button>
                  </div>
                </div>
                <InfoTile
                  label="Fichas estimadas na etapa"
                  value={formatStackValue(estimatedStageChips)}
                  helper="soma dos stacks dos jogadores aptos"
                />
                <InfoTile
                  label="Stack medio dos vivos"
                  value={formatStackValue(averageActiveStack)}
                  helper={`aprox. ${averageActiveBigBlinds} BB com concentracao estimada`}
                />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {eligibleStagePlayers.map((player) => (
                  <label
                    key={`stack-${player.playerId}`}
                    className={`rounded-[1.15rem] border px-4 py-4 ${
                      player.outOfCurrentMatch
                        ? "border-[rgba(255,166,84,0.18)] bg-[rgba(255,166,84,0.06)]"
                        : "border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)]"
                    }`}
                  >
                    <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                      {player.playerName}
                    </span>
                    <input
                      className="mt-3 h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none placeholder:text-[rgba(236,225,196,0.4)]"
                      inputMode="numeric"
                      onChange={(event) =>
                        handleEstimatedStackChange(player.playerId, event.target.value)
                      }
                      type="number"
                      value={String(player.estimatedStack)}
                    />
                    <span className="mt-2 block text-xs text-[rgba(236,225,196,0.62)]">
                      {player.outOfCurrentMatch
                        ? "Saiu da partida atual. As fichas dele seguem compondo o stack medio dos vivos."
                        : "Valor usado para estimar o stack medio da mesa."}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>

      {actionClockRemaining !== null ? (
        <div
          className={`fixed bottom-6 right-6 z-40 rounded-[1.25rem] px-5 py-4 shadow-[0_16px_34px_rgba(0,0,0,0.28)] ${
            actionClockRemaining === 0
              ? "border border-[rgba(255,102,102,0.34)] bg-[rgba(88,16,16,0.94)]"
              : "border border-[rgba(129,196,255,0.24)] bg-[rgba(10,29,44,0.92)]"
          }`}
        >
          <p
            className={`text-xs uppercase tracking-[0.22em] ${
              actionClockRemaining === 0
                ? "text-[rgba(255,214,214,0.72)]"
                : "text-[rgba(202,230,255,0.62)]"
            }`}
          >
            Cronometro de acao
          </p>
          <p
            className={`mt-2 text-4xl font-black ${
              actionClockRemaining === 0
                ? "text-[rgba(255,238,238,0.98)]"
                : "text-[rgba(220,239,255,0.98)]"
            }`}
          >
            {formatClock(actionClockRemaining)}
          </p>
          <button
            className={`mt-3 rounded-[0.85rem] px-4 py-2 text-sm font-semibold ${
              actionClockRemaining === 0
                ? "border border-[rgba(255,132,132,0.26)] bg-[rgba(255,132,132,0.14)] text-[rgba(255,232,232,0.96)]"
                : "border border-[rgba(129,196,255,0.22)] bg-[rgba(129,196,255,0.1)] text-[rgba(220,239,255,0.96)]"
            }`}
            onClick={() => setActionClockRemaining(null)}
            type="button"
          >
            Fechar
          </button>
        </div>
      ) : null}

      {showLeaveStageConfirm && selectedPlayer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-[rgba(0,0,0,0.56)]"
            onClick={() => setShowLeaveStageConfirm(false)}
            type="button"
          />
          <div className="relative z-10 w-full max-w-md rounded-[1.4rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] p-5 shadow-[0_28px_60px_rgba(0,0,0,0.42)] md:p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
              Saida da etapa
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
              {selectedPlayer.playerName}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.72)]">
              O que fazer com os pontos desta etapa?
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <button
                className="w-full rounded-[0.95rem] border border-[rgba(236,225,196,0.12)] bg-[rgba(255,255,255,0.03)] p-4 text-left transition hover:bg-[rgba(255,255,255,0.05)]"
                onClick={() => handleLeaveStage("keep_points")}
                type="button"
              >
                <p className="text-sm font-semibold text-[rgba(255,244,214,0.96)]">
                  Manter todos os pontos
                </p>
                <p className="mt-1 text-xs text-[rgba(236,225,196,0.56)]">
                  O jogador mantem os pontos conquistados. Nao recebe pontos anuais.
                </p>
              </button>

              <button
                className="w-full rounded-[0.95rem] border border-[rgba(236,225,196,0.12)] bg-[rgba(255,255,255,0.03)] p-4 text-left transition hover:bg-[rgba(255,255,255,0.05)]"
                onClick={() => handleLeaveStage("zero_with_annual")}
                type="button"
              >
                <p className="text-sm font-semibold text-[rgba(255,244,214,0.96)]">
                  Zerar pontos (padrao)
                </p>
                <p className="mt-1 text-xs text-[rgba(236,225,196,0.56)]">
                  Todos os pontos da etapa sao zerados. Recebe 1 ponto no ranking anual.
                </p>
              </button>

              <button
                className="w-full rounded-[0.95rem] border border-[rgba(236,225,196,0.12)] bg-[rgba(255,255,255,0.03)] p-4 text-left transition hover:bg-[rgba(255,255,255,0.05)]"
                onClick={() => handleLeaveStage("zero_without_annual")}
                type="button"
              >
                <p className="text-sm font-semibold text-[rgba(255,244,214,0.96)]">
                  Zerar sem ponto anual
                </p>
                <p className="mt-1 text-xs text-[rgba(236,225,196,0.56)]">
                  Todos os pontos da etapa sao zerados. Nao recebe nenhum ponto no ranking anual.
                </p>
              </button>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(255,255,255,0.03)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.96)] transition hover:bg-[rgba(255,255,255,0.05)]"
                onClick={() => setShowLeaveStageConfirm(false)}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAgreementModal && activeMatchPlayers.length >= 2 ? (
        <AgreementModal
          activePlayers={activeMatchPlayers}
          onClose={() => setShowAgreementModal(false)}
          onConfirm={(winnerId, winnerName, secondPlaceId) => {
            handleAgreementResult(winnerId, winnerName, secondPlaceId);
            setShowAgreementModal(false);
          }}
        />
      ) : null}

      {showSeatSetupModal ? (
        <SeatSetupModal
          availableSeats={latePlayerAvailableSeats}
          canConfirm={hasCompleteSeatAssignments}
          intent={seatSetupIntent}
          missingPlayers={missingSeatPlayers}
          onAssignSeat={handleSeatSetupAssignmentChange}
          onCancel={() => setShowSeatSetupModal(false)}
          onConfirm={handleConfirmSeatSetupAndStart}
        />
      ) : null}

      {matchResultModalContext ? (
        <MatchResultModal
          currentBlindLabel={currentBlindLabel}
          isOpen
          key={`match-result-${currentMatchIndex}-${matchResultModalContext.mode}-${matchResultModalContext.preferredWinnerId ?? "default"}`}
          matchDurationSeconds={matchElapsedSeconds}
          matchNumber={currentMatchIndex + 1}
          onCancel={() => setMatchResultModalContext(null)}
          onConfirm={handleConfirmMatchResult}
          players={displayedMatchResultPlayers}
        />
      ) : null}

      {showStageResultModal ? (
        <StageResultModal
          isOpen
          key={`stage-result-${stageResultPlayers.map((player) => player.playerId).join("-")}`}
          onCancel={() => setShowStageResultModal(false)}
          onConfirm={handleConfirmStageResult}
          players={stageResultPlayers}
        />
      ) : null}

      {latePlayerContext ? (
        <LatePlayerModal
          availableSeats={latePlayerAvailableSeats}
          averageStack={
            averageActiveStack || Math.max(Number.parseInt(averageStack || "0", 10) || 0, 3000)
          }
          isOpen
          key={`late-player-${latePlayerContext.playerId}-${latePlayerAvailableSeats.length}`}
          matchNumber={currentMatchIndex + 1}
          onCancel={() => setLatePlayerContext(null)}
          onJoinNextMatch={handleLatePlayerJoinNextMatch}
          onJoinNow={handleLatePlayerJoinNow}
          playerName={latePlayerContext.playerName}
        />
      ) : null}

      {showBlindEditor ? (
        <BlindEditorModal
          blindLevels={blindLevels}
          defaultBlindLevels={snapshot.blindStructure}
          onClose={() => setShowBlindEditor(false)}
          onSave={(updated) => {
            setBlindLevels(updated);
            setShowBlindEditor(false);
          }}
        />
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

            {isAdminUser && (
              <>
                <div className="mt-5 rounded-[1.1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                    Premiacao do dia
                  </p>
              <p className="mt-1 text-sm text-[rgba(236,225,196,0.62)]">
                Calculado: R${" "}
                {(calculatedDailyPrize / 100).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                ({players.filter((p) => p.dailyPaid).length} pagantes)
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                    Valor da premiacao (R$)
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none placeholder:text-[rgba(236,225,196,0.4)]"
                    inputMode="decimal"
                    onChange={(e) => setDailyPrizeOverride(e.target.value)}
                    placeholder={`Deixe vazio para usar R$ ${(calculatedDailyPrize / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    step="0.01"
                    type="number"
                    value={dailyPrizeOverride}
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                    Nota (opcional)
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none placeholder:text-[rgba(236,225,196,0.4)]"
                    maxLength={240}
                    onChange={(e) => setDailyPrizeOverrideNote(e.target.value)}
                    placeholder="Ex: Jogador pagou valor diferente"
                    value={dailyPrizeOverrideNote}
                  />
                </label>
              </div>
              {dailyPrizeOverride.trim() &&
                Number.parseFloat(dailyPrizeOverride) !== calculatedDailyPrize / 100 && (
                  <p className="mt-2 text-xs text-[rgba(255,184,143,0.96)]">
                    Diferenca:{" "}
                    {Number.parseFloat(dailyPrizeOverride) > calculatedDailyPrize / 100 ? "+" : ""}
                    R${" "}
                    {(
                      Number.parseFloat(dailyPrizeOverride) -
                      calculatedDailyPrize / 100
                    ).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                )}
            </div>

            <div className="mt-4 rounded-[1.1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                Contribuicao anual do pote
              </p>
              <p className="mt-1 text-sm text-[rgba(236,225,196,0.62)]">
                Calculado: R${" "}
                {(calculatedAnnualContribution / 100).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                ({players.filter((p) => p.annualPaid).length} pagantes)
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                    Valor da contribuicao (R$)
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none placeholder:text-[rgba(236,225,196,0.4)]"
                    inputMode="decimal"
                    onChange={(e) => setAnnualContributionOverride(e.target.value)}
                    placeholder={`Deixe vazio para usar R$ ${(calculatedAnnualContribution / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    step="0.01"
                    type="number"
                    value={annualContributionOverride}
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                    Nota (opcional)
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none placeholder:text-[rgba(236,225,196,0.4)]"
                    maxLength={240}
                    onChange={(e) => setAnnualContributionOverrideNote(e.target.value)}
                    placeholder="Ex: Jogador pagou valor diferente"
                    value={annualContributionOverrideNote}
                  />
                </label>
              </div>
              {annualContributionOverride.trim() &&
                Number.parseFloat(annualContributionOverride) !== calculatedAnnualContribution / 100 && (
                  <p className="mt-2 text-xs text-[rgba(255,184,143,0.96)]">
                    Diferenca:{" "}
                    {Number.parseFloat(annualContributionOverride) > calculatedAnnualContribution / 100 ? "+" : ""}
                    R${" "}
                    {(
                      Number.parseFloat(annualContributionOverride) -
                      calculatedAnnualContribution / 100
                    ).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                )}
            </div>

            {stage.isTest && (
              <div className="mt-4 rounded-[1.1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                  Etapa de teste
                </p>
                <p className="mt-1 text-sm text-[rgba(236,225,196,0.62)]">
                  Por padrao, etapas de teste nao contam para ranking anual nem pote.
                </p>
                <label className="mt-3 flex cursor-pointer items-center gap-3">
                  <button
                    className={`relative h-6 w-11 rounded-full border transition-colors ${
                      includeTestInAnnual
                        ? "border-[rgba(129,211,120,0.4)] bg-[rgba(129,211,120,0.28)]"
                        : "border-[rgba(236,225,196,0.16)] bg-[rgba(236,225,196,0.06)]"
                    }`}
                    onClick={() => setIncludeTestInAnnual((prev) => !prev)}
                    type="button"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full transition-transform ${
                        includeTestInAnnual
                          ? "translate-x-5 bg-[rgba(129,211,120,0.96)]"
                          : "bg-[rgba(236,225,196,0.4)]"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-[rgba(255,244,214,0.88)]">
                    Incluir nos resultados anuais
                  </span>
                </label>
                {includeTestInAnnual && (
                  <p className="mt-2 text-xs text-[rgba(129,211,120,0.8)]">
                    A etapa sera contabilizada no ranking e pote anuais.
                  </p>
                )}
              </div>
            )}
            </>)}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(255,255,255,0.03)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.96)] transition hover:bg-[rgba(255,255,255,0.05)]"
                onClick={() => {
                  setShowCloseStageConfirm(false);
                  setDailyPrizeOverride("");
                  setDailyPrizeOverrideNote("");
                  setAnnualContributionOverride("");
                  setAnnualContributionOverrideNote("");
                  setIncludeTestInAnnual(false);
                }}
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

function AgreementModal({
  activePlayers,
  onClose,
  onConfirm,
}: {
  activePlayers: StagePlayerControl[];
  onClose: () => void;
  onConfirm: (winnerId: string, winnerName: string, secondPlaceId?: string) => void;
}) {
  const [firstPlaceId, setFirstPlaceId] = useState<string>("");
  const [secondPlaceId, setSecondPlaceId] = useState<string>("");

  const availableForSecond = activePlayers.filter((p) => p.playerId !== firstPlaceId);

  function handleConfirm() {
    const firstPlayer = activePlayers.find((p) => p.playerId === firstPlaceId);
    if (!firstPlayer) return;

    onConfirm(firstPlayer.playerId, firstPlayer.playerName, secondPlaceId || undefined);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-[rgba(0,0,0,0.56)]"
        onClick={onClose}
        type="button"
      />
      <div className="relative z-10 w-full max-w-md rounded-[1.4rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] p-5 shadow-[0_28px_60px_rgba(0,0,0,0.42)] md:p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
          Acordo entre jogadores
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
          Definir colocacoes
        </h2>
        <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.72)]">
          Selecione quem ficou em cada colocacao e feche a partida.
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
              1o lugar
            </span>
            <select
              className="mt-2 h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none"
              onChange={(e) => {
                setFirstPlaceId(e.target.value);
                if (e.target.value === secondPlaceId) {
                  setSecondPlaceId("");
                }
              }}
              value={firstPlaceId}
            >
              <option value="">Selecione</option>
              {activePlayers.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.playerName}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
              2o lugar (opcional)
            </span>
            <select
              className="mt-2 h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none"
              onChange={(e) => setSecondPlaceId(e.target.value)}
              value={secondPlaceId}
            >
              <option value="">Nenhum</option>
              {availableForSecond.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.playerName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(255,255,255,0.03)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.96)] transition hover:bg-[rgba(255,255,255,0.05)]"
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="h-11 rounded-[0.95rem] border border-[rgba(129,211,120,0.3)] bg-[rgba(129,211,120,0.12)] px-5 text-sm font-semibold text-[rgba(129,211,120,0.96)] transition hover:bg-[rgba(129,211,120,0.2)] disabled:opacity-40"
            disabled={!firstPlaceId}
            onClick={handleConfirm}
            type="button"
          >
            Confirmar acordo
          </button>
        </div>
      </div>
    </div>
  );
}

function SeatSetupModal({
  availableSeats,
  canConfirm,
  intent,
  missingPlayers,
  onAssignSeat,
  onCancel,
  onConfirm,
}: {
  availableSeats: LatePlayerSeatOption[];
  canConfirm: boolean;
  intent: SeatSetupIntent;
  missingPlayers: StagePlayerControl[];
  onAssignSeat: (playerId: string, seatKey: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmLabel = intent === "start-next" ? "Iniciar proxima partida" : "Iniciar partida";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Fechar configuracao de lugares"
        className="absolute inset-0 bg-[rgba(2,10,7,0.76)] backdrop-blur-[3px]"
        onClick={onCancel}
        type="button"
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col rounded-[1.55rem] border border-[rgba(255,208,101,0.18)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] p-5 shadow-[0_28px_60px_rgba(0,0,0,0.48)] md:p-6">
        <div className="border-b border-[rgba(255,208,101,0.1)] pb-5">
          <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
            Configurar lugares
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
            Defina os assentos antes de iniciar
          </h2>
          <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.72)]">
            Escolha a mesa e o lugar de cada jogador apto. A partida so pode comecar depois que todos estiverem sentados.
          </p>
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          {missingPlayers.length > 0 ? (
            <div className="grid gap-3">
              {missingPlayers.map((player) => (
                <label
                  className="grid gap-2 rounded-[1.15rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4"
                  key={`seat-setup-${player.playerId}`}
                >
                  <span className="text-sm font-semibold text-[rgba(255,244,214,0.96)]">
                    {player.playerName}
                  </span>
                  <select
                    className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none disabled:opacity-50"
                    disabled={availableSeats.length === 0}
                    onChange={(event) => onAssignSeat(player.playerId, event.target.value)}
                    value=""
                  >
                    <option value="">Escolha mesa/lugar</option>
                    {availableSeats.map((seat) => (
                      <option key={`${player.playerId}-${buildSeatKey(seat)}`} value={buildSeatKey(seat)}>
                        {seat.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.15rem] border border-[rgba(129,211,120,0.2)] bg-[rgba(129,211,120,0.08)] px-4 py-5 text-sm text-[rgba(222,255,221,0.94)]">
              Todos os jogadores aptos ja estao com lugar definido.
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-[rgba(255,208,101,0.1)] pt-5 sm:flex-row sm:justify-end">
          <button
            className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] px-5 text-sm font-semibold text-[rgba(236,225,196,0.72)] transition hover:bg-[rgba(255,255,255,0.04)]"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="h-11 rounded-[0.95rem] border border-[rgba(129,211,120,0.28)] bg-[rgba(129,211,120,0.16)] px-5 text-sm font-semibold text-[rgba(222,255,221,0.96)] transition hover:bg-[rgba(129,211,120,0.22)] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!canConfirm}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
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

  if (player.outOfCurrentMatch && player.dailyPaid) {
    return "Aguardando entrar na partida";
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

function redistributeStageExitStacks(
  players: StagePlayerControl[],
  leavingPlayerId: string,
) {
  const leavingPlayer = players.find((player) => player.playerId === leavingPlayerId);

  if (!leavingPlayer || !leavingPlayer.annualPaid || !leavingPlayer.dailyPaid) {
    return players;
  }

  const leavingStack = Math.max(leavingPlayer.estimatedStack || 0, 0);

  if (leavingStack <= 0) {
    return players;
  }

  const recipients = players
    .filter(
      (player) =>
        player.playerId !== leavingPlayerId &&
        player.annualPaid &&
        player.dailyPaid &&
        !player.leftStage,
    )
    .sort((left, right) => {
      if (left.outOfCurrentMatch !== right.outOfCurrentMatch) {
        return Number(left.outOfCurrentMatch) - Number(right.outOfCurrentMatch);
      }

      return right.estimatedStack - left.estimatedStack;
    });

  if (recipients.length === 0) {
    return players;
  }

  const redistributedByPlayerId = new Map<string, number>();

  if (recipients.length === 1) {
    redistributedByPlayerId.set(recipients[0].playerId, leavingStack);
  } else {
    const firstShare = Math.round(leavingStack * 0.7);
    redistributedByPlayerId.set(recipients[0].playerId, firstShare);
    redistributedByPlayerId.set(recipients[1].playerId, leavingStack - firstShare);
  }

  return players.map((player) => ({
    ...player,
    estimatedStack:
      player.playerId === leavingPlayerId
        ? 0
        : player.estimatedStack + (redistributedByPlayerId.get(player.playerId) ?? 0),
  }));
}

function calculateEstimatedAverageActiveStack({
  estimatedStageChips,
  activePlayers,
  totalEligiblePlayers,
  currentLevelIndex,
}: {
  estimatedStageChips: number;
  activePlayers: StagePlayerControl[];
  totalEligiblePlayers: number;
  currentLevelIndex: number;
}) {
  if (activePlayers.length === 0) {
    return 0;
  }

  if (activePlayers.length === 1) {
    return Math.round(Math.max(estimatedStageChips, activePlayers[0].estimatedStack || 0, 0));
  }

  const baseAverage = estimatedStageChips / activePlayers.length;
  const eliminatedPlayers = Math.max(totalEligiblePlayers - activePlayers.length, 0);
  const levelPressure = Math.min(currentLevelIndex * 0.035, 0.18);
  const eliminationPressure = Math.min(eliminatedPlayers * 0.055, 0.24);
  const finalTablePressure =
    activePlayers.length <= 2 ? 0.16 : activePlayers.length <= 4 ? 0.1 : 0.05;
  const observedStacks = activePlayers
    .map((player) => Math.max(player.estimatedStack || 0, 0))
    .sort((left, right) => right - left);
  const observedLeaderBias =
    observedStacks.length > 1
      ? Math.max((observedStacks[0] - observedStacks[1]) / Math.max(observedStacks[0], 1), 0)
      : 0;
  const totalBias = Math.min(
    levelPressure + eliminationPressure + finalTablePressure + observedLeaderBias * 0.08,
    0.32,
  );

  return Math.round(baseAverage * (1 + totalBias));
}

function buildSeatPlayerOptions(
  players: StagePlayerControl[],
  draftTables: StageRuntimeTableState[],
  selectedTableIndex: number,
  selectedSeatIndex: number
) {
  const selectedSeatPlayerId = draftTables[selectedTableIndex]?.seatAssignments[selectedSeatIndex] ?? null;
  const assignedPlayerIds = new Set(
    draftTables.flatMap((table) => table.seatAssignments.filter((playerId): playerId is string => Boolean(playerId))),
  );

  return players.filter((player) => {
    if (player.playerId === selectedSeatPlayerId) {
      return true;
    }

    return !assignedPlayerIds.has(player.playerId);
  });
}

function buildAvailableLatePlayerSeats(tables: StageRuntimeTableState[]): LatePlayerSeatOption[] {
  return tables.flatMap((table, tableIndex) =>
    table.seatAssignments
      .map((playerId, seatIndex) =>
        playerId
          ? null
          : {
              tableIndex,
              seatIndex,
              label: `Mesa ${tableIndex + 1} - Lugar ${seatIndex + 1}`,
            },
      )
      .filter((seat): seat is LatePlayerSeatOption => Boolean(seat)),
  );
}

function buildSeatKey(seat: LatePlayerSeatOption) {
  return `${seat.tableIndex}:${seat.seatIndex}`;
}

function parseSeatKey(seatKey: string) {
  const [rawTableIndex, rawSeatIndex] = seatKey.split(":");
  const tableIndex = Number.parseInt(rawTableIndex ?? "", 10);
  const seatIndex = Number.parseInt(rawSeatIndex ?? "", 10);

  if (!Number.isInteger(tableIndex) || !Number.isInteger(seatIndex)) {
    return null;
  }

  if (tableIndex < 0 || seatIndex < 0) {
    return null;
  }

  return { tableIndex, seatIndex };
}

function buildMatchResultPlayers(
  players: StagePlayerControl[],
  matchIndex: number,
): MatchResultPlayer[] {
  return players
    .filter((player) => player.annualPaid && player.dailyPaid)
    .map((player) => {
      const currentPoints = player.matchPoints[matchIndex] ?? 0;

      return {
        playerId: player.playerId,
        playerName: player.playerName,
        currentPoints,
        outOfCurrentMatch: player.outOfCurrentMatch,
        hasParticipated: !player.outOfCurrentMatch || currentPoints > 0,
        estimatedStack: player.estimatedStack,
      };
    })
    .sort((left, right) => {
      if (left.hasParticipated !== right.hasParticipated) {
        return left.hasParticipated ? -1 : 1;
      }

      if (left.outOfCurrentMatch !== right.outOfCurrentMatch) {
        return left.outOfCurrentMatch ? 1 : -1;
      }

      if (left.currentPoints !== right.currentPoints) {
        return right.currentPoints - left.currentPoints;
      }

      return left.playerName.localeCompare(right.playerName, "pt-BR");
    });
}

function findPlayerTableSeat(tables: StageRuntimeTableState[], playerId: string) {
  for (let tableIndex = 0; tableIndex < tables.length; tableIndex += 1) {
    const seatIndex = tables[tableIndex]?.seatAssignments.findIndex(
      (assignedPlayerId) => assignedPlayerId === playerId,
    );

    if (seatIndex !== undefined && seatIndex >= 0) {
      return { tableIndex, seatIndex };
    }
  }

  return null;
}

type SeatPositionStyle = {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  transform?: string;
};

const SEAT_POSITIONS_BY_COUNT: Record<number, readonly SeatPositionStyle[]> = {
  8: [
    { top: "8%", left: "50%", transform: "translate(-50%, 0)" },
    { top: "18%", right: "14%" },
    { top: "50%", right: "4%", transform: "translate(0, -50%)" },
    { bottom: "18%", right: "14%" },
    { bottom: "8%", left: "50%", transform: "translate(-50%, 0)" },
    { bottom: "18%", left: "14%" },
    { top: "50%", left: "4%", transform: "translate(0, -50%)" },
    { top: "18%", left: "14%" },
  ],
  10: [
    { top: "14.8%", left: "55%" },
    { top: "18.1%", left: "73.5%" },
    { top: "43.7%", left: "83.5%" },
    { top: "69.3%", left: "73.5%" },
    { top: "71.3%", left: "54.3%" },
    { top: "71.3%", left: "33.3%" },
    { top: "69.3%", left: "14.1%" },
    { top: "43.7%", left: "4.1%" },
    { top: "18.1%", left: "14.1%" },
    { top: "14.8%", left: "32.6%" },
  ],
  12: [
    { top: "21.4%", left: "9.6%" },
    { top: "21.4%", left: "26.7%" },
    { top: "21.4%", left: "43.8%" },
    { top: "21.4%", left: "60.9%" },
    { top: "21.4%", left: "78%" },
    { top: "43.7%", left: "86.8%" },
    { top: "66%", left: "78%" },
    { top: "66%", left: "60.9%" },
    { top: "66%", left: "43.8%" },
    { top: "66%", left: "26.7%" },
    { top: "66%", left: "9.6%" },
    { top: "43.7%", left: "0.8%" },
  ],
};

function getSeatPosition(seatIndex: number, seatCount: number): SeatPositionStyle {
  const positions = SEAT_POSITIONS_BY_COUNT[seatCount] ?? SEAT_POSITIONS_BY_COUNT[8];
  return positions[seatIndex] ?? positions[0];
}

function getTableShape(seatCount: number): "oval" | "rect" {
  return seatCount === 12 ? "rect" : "oval";
}

function TableSeatMap({
  highlightedSeatIndex,
  onSeatClick,
  seatAssignments,
  seatLabelsByPlayerId,
  seatCount,
}: {
  highlightedSeatIndex?: number | null;
  onSeatClick?: (seatIndex: number) => void;
  seatAssignments: Array<string | null>;
  seatLabelsByPlayerId: Record<string, string>;
  seatCount: number;
}) {
  const shape = getTableShape(seatCount);

  return (
    <div className="relative mt-6 flex min-h-[360px] items-center justify-center overflow-hidden rounded-[1.7rem] border border-[rgba(255,208,101,0.14)] bg-[radial-gradient(circle_at_center,rgba(23,92,58,0.72),rgba(7,24,18,0.98)_72%)]">
      {shape === "oval" ? (
        <>
          <div className="absolute h-[52%] w-[84%] rounded-full border-[3px] border-[rgba(255,208,101,0.22)] bg-[radial-gradient(circle_at_center,rgba(20,92,57,0.8),rgba(8,34,24,0.96)_70%)] shadow-[inset_0_0_0_1px_rgba(255,208,101,0.06)]" />
          <div className="absolute h-[34%] w-[62%] rounded-full border border-[rgba(255,208,101,0.12)] bg-[rgba(5,15,11,0.34)]" />
        </>
      ) : (
        <>
          <div className="absolute h-[40%] w-[88%] rounded-[1.6rem] border-[3px] border-[rgba(255,208,101,0.22)] bg-[radial-gradient(circle_at_center,rgba(20,92,57,0.8),rgba(8,34,24,0.96)_70%)] shadow-[inset_0_0_0_1px_rgba(255,208,101,0.06)]" />
          <div className="absolute h-[24%] w-[70%] rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(5,15,11,0.34)]" />
        </>
      )}

      {seatAssignments.map((playerId, seatIndex) => {
        const seatPosition = getSeatPosition(seatIndex, seatCount);
        const playerName = playerId ? seatLabelsByPlayerId[playerId] ?? "Selecionar" : "Selecionar";
        const isSelected = highlightedSeatIndex === seatIndex;
        const Component = onSeatClick ? "button" : "div";

        return (
          <Component
            key={`seat-map-${seatIndex + 1}`}
            className={`absolute flex h-[76px] w-[150px] flex-col items-center justify-center rounded-[1.1rem] border px-3 py-3 text-center shadow-[0_14px_28px_rgba(0,0,0,0.22)] transition ${
              isSelected
                ? "border-[rgba(255,208,101,0.42)] bg-[rgba(255,183,32,0.14)]"
                : "border-[rgba(255,208,101,0.16)] bg-[rgba(7,24,18,0.9)]"
            } ${onSeatClick ? "hover:border-[rgba(255,208,101,0.3)]" : ""}`}
            onClick={onSeatClick ? () => onSeatClick(seatIndex) : undefined}
            style={seatPosition}
            type={onSeatClick ? "button" : undefined}
          >
            <span className="text-[0.66rem] uppercase tracking-[0.18em] text-[rgba(236,225,196,0.54)]">
              Lugar {seatIndex + 1}
            </span>
            <span className="mt-2 text-sm font-semibold text-[rgba(255,244,214,0.96)]">
              {playerName}
            </span>
          </Component>
        );
      })}
    </div>
  );
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

function formatStageStart(stageDate: string, scheduledStartTime?: string) {
  const [year, month, day] = stageDate.split("-");
  return `${day}/${month}/${year} ${scheduledStartTime ?? "20:00"}`;
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

function formatTimeLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatStageEventLogEntry(message: string, occurredAt = new Date()) {
  const timestamp = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(occurredAt);

  return `[${timestamp}] ${message}`;
}

function announceTableMessage(message: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(message);
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice =
    voices.find((voice) => voice.lang.toLowerCase().startsWith("pt-br")) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("pt")) ??
    null;

  utterance.lang = preferredVoice?.lang ?? "pt-BR";
  utterance.voice = preferredVoice;
  utterance.rate = 0.96;
  utterance.pitch = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function ensureSharedAudioContext(audioContextRef: MutableRefObject<AudioContext | null>) {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextConstructor =
    window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  const audioContext = audioContextRef.current ?? new AudioContextConstructor();
  audioContextRef.current = audioContext;

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  return audioContext;
}

function playBlindLevelChangedSignal(audioContextRef: MutableRefObject<AudioContext | null>) {
  const audioContext = ensureSharedAudioContext(audioContextRef);

  if (!audioContext) {
    return 1450;
  }

  const startAt = audioContext.currentTime;
  const totalDurationSeconds = 1.45;
  const toneSequence = [
    { frequency: 720, duration: 0.34 },
    { frequency: 840, duration: 0.34 },
    { frequency: 640, duration: 0.52 },
  ];

  let cursor = startAt;

  toneSequence.forEach((tone) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, cursor);
    gain.gain.setValueAtTime(0.0001, cursor);
    gain.gain.exponentialRampToValueAtTime(0.18, cursor + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, cursor + tone.duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(cursor);
    oscillator.stop(cursor + tone.duration + 0.02);

    cursor += tone.duration;
  });

  return Math.round(totalDurationSeconds * 1000) + 120;
}

function playActionClockExpiredSignal(audioContextRef: MutableRefObject<AudioContext | null>) {
  const audioContext = ensureSharedAudioContext(audioContextRef);

  if (!audioContext) {
    return;
  }

  const startAt = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(1180, startAt);
  oscillator.frequency.linearRampToValueAtTime(920, startAt + 0.18);
  oscillator.frequency.linearRampToValueAtTime(1180, startAt + 0.36);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.42);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.44);
}

function buildBlindAnnouncement(level: BlindLevel) {
  if (level.ante && level.ante > 0) {
    return `${level.smallBlind} / ${level.bigBlind} com ante ${level.ante}`;
  }

  return `${level.smallBlind} / ${level.bigBlind}`;
}

function formatStackValue(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function InfoTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-[1rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
      <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[rgba(236,225,196,0.52)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-[rgba(255,220,143,0.98)]">{value}</p>
      {helper ? (
        <p className="mt-1 text-xs text-[rgba(236,225,196,0.62)]">{helper}</p>
      ) : null}
    </div>
  );
}

const sideButtonClassName =
  "flex min-h-14 w-full items-center justify-center rounded-[1.1rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(255,255,255,0.03)] px-2 text-lg font-semibold text-[rgba(255,236,184,0.96)] transition hover:border-[rgba(255,208,101,0.28)] hover:bg-[rgba(255,255,255,0.06)]";

const activeSideButtonClassName =
  "border-[rgba(255,208,101,0.48)] bg-[linear-gradient(180deg,rgba(255,187,39,0.18),rgba(255,187,39,0.06))] text-[rgba(255,244,214,0.98)] shadow-[0_0_0_1px_rgba(255,208,101,0.1)]";

const timerButtonClassName =
  "flex min-h-14 min-w-[90px] items-center justify-center rounded-[0.95rem] border border-[rgba(255,208,101,0.24)] bg-[linear-gradient(180deg,#ffd54e_0%,#c88807_100%)] px-4 py-3 text-center text-[0.68rem] font-black tracking-[0.14em] text-[#2a1a00] shadow-[0_10px_20px_rgba(255,183,32,0.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100";

const compactActionButtonClassName =
  "h-10 rounded-[0.9rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(255,255,255,0.03)] px-3 text-xs font-semibold text-[rgba(255,236,184,0.96)] transition hover:border-[rgba(255,208,101,0.26)] hover:bg-[rgba(255,255,255,0.05)] disabled:cursor-not-allowed disabled:opacity-50";
