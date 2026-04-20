import type { BlindLevel } from "@/lib/domain/types";

export const STAGE_RUNTIME_STORAGE_KEY_PREFIX = "shpl-stage-runtime";
export const LIVE_LAB_TOTAL_TABLE_SEATS = 8;

export type StageRuntimePlayerState = {
  playerId: string;
  playerName: string;
  annualPaid: boolean;
  dailyPaid: boolean;
  leftStage: boolean;
  outOfCurrentMatch: boolean;
  estimatedStack: number;
  matchPoints: number[];
};

export type StoredStageRuntimePayload = {
  actualStageStartedAt?: string | null;
  currentMatchStartedAt?: string | null;
  matchElapsedSeconds?: number;
  completedMatchDurations?: number[];
  stageClosedAt?: string | null;
  currentMatchClosed?: boolean;
  currentLevelIndex?: number;
  seatAssignments?: Array<string | null>;
  blindLevels?: BlindLevel[];
  clockSeconds?: number;
  showActionClock?: boolean;
  breakDurationMinutes?: number;
  breakEveryLevels?: number;
  remainingSeconds?: number;
  isRunning?: boolean;
  actionClockRemaining?: number | null;
  selectedPlayerId?: string | null;
  players?: StageRuntimePlayerState[];
  updatedAt?: string;
};

export function buildStageRuntimeStorageKey(stageId: string) {
  return `${STAGE_RUNTIME_STORAGE_KEY_PREFIX}-${stageId}`;
}

export function normalizeSeatAssignments(assignments: Array<string | null>) {
  return Array.from({ length: LIVE_LAB_TOTAL_TABLE_SEATS }, (_, seatIndex) => {
    const value = assignments[seatIndex];
    return typeof value === "string" && value.length > 0 ? value : null;
  });
}

export function normalizeStageRuntimePayload(
  payload: StoredStageRuntimePayload | null | undefined,
): StoredStageRuntimePayload | null {
  if (!payload) {
    return null;
  }

  return {
    ...payload,
    actualStageStartedAt: payload.actualStageStartedAt ?? null,
    currentMatchStartedAt: payload.currentMatchStartedAt ?? null,
    matchElapsedSeconds: payload.matchElapsedSeconds ?? 0,
    completedMatchDurations: payload.completedMatchDurations ?? [],
    stageClosedAt: payload.stageClosedAt ?? null,
    currentMatchClosed: Boolean(payload.currentMatchClosed),
    currentLevelIndex: Math.max(0, payload.currentLevelIndex ?? 0),
    seatAssignments: normalizeSeatAssignments(payload.seatAssignments ?? []),
    blindLevels: payload.blindLevels ?? [],
    clockSeconds: payload.clockSeconds ?? 0,
    showActionClock: payload.showActionClock ?? true,
    breakDurationMinutes: Math.max(payload.breakDurationMinutes ?? 0, 0),
    breakEveryLevels: Math.max(payload.breakEveryLevels ?? 0, 0),
    remainingSeconds: Math.max(payload.remainingSeconds ?? 0, 0),
    isRunning: Boolean(payload.isRunning),
    actionClockRemaining:
      payload.actionClockRemaining === null || payload.actionClockRemaining === undefined
        ? null
        : Math.max(payload.actionClockRemaining, 0),
    selectedPlayerId: payload.selectedPlayerId ?? null,
    players: payload.players ?? [],
    updatedAt: payload.updatedAt ?? undefined,
  };
}
