import type { BlindLevel } from "@/lib/domain/types";

export const STAGE_RUNTIME_STORAGE_KEY_PREFIX = "shpl-stage-runtime";
export const LIVE_LAB_TOTAL_TABLE_SEATS = 8;
export const LIVE_LAB_TABLE_SEAT_OPTIONS = [8, 10, 12] as const;
export type LiveLabTableSeatOption = (typeof LIVE_LAB_TABLE_SEAT_OPTIONS)[number];

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

export type StageRuntimeTableState = {
  seatCount: LiveLabTableSeatOption;
  seatAssignments: Array<string | null>;
};

export type StoredStageRuntimePayload = {
  actualStageStartedAt?: string | null;
  currentMatchStartedAt?: string | null;
  matchElapsedSeconds?: number;
  completedMatchDurations?: number[];
  stageClosedAt?: string | null;
  currentMatchClosed?: boolean;
  currentLevelIndex?: number;
  tables?: StageRuntimeTableState[];
  /** @deprecated Use `tables[0].seatAssignments`. Mantido para compatibilidade com runtimes antigos. */
  seatAssignments?: Array<string | null>;
  /** @deprecated Use `tables[0].seatCount`. Mantido para compatibilidade com runtimes antigos. */
  tableSeatCount?: number;
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

export function normalizeSeatAssignments(
  assignments: Array<string | null>,
  seatCount: number = LIVE_LAB_TOTAL_TABLE_SEATS,
) {
  return Array.from({ length: seatCount }, (_, seatIndex) => {
    const value = assignments[seatIndex];
    return typeof value === "string" && value.length > 0 ? value : null;
  });
}

export function normalizeTableSeatCount(value: number | null | undefined) {
  return LIVE_LAB_TABLE_SEAT_OPTIONS.includes(value as LiveLabTableSeatOption)
    ? (value as LiveLabTableSeatOption)
    : LIVE_LAB_TOTAL_TABLE_SEATS;
}

export function normalizeStageRuntimeTables(
  tables: StageRuntimeTableState[] | null | undefined,
  legacySeatAssignments: Array<string | null> = [],
  legacyTableSeatCount?: number | null,
) {
  const normalizedTables =
    Array.isArray(tables) && tables.length > 0
      ? tables.slice(0, 2).map((table) => {
          const seatCount = normalizeTableSeatCount(table?.seatCount);
          return {
            seatCount,
            seatAssignments: normalizeSeatAssignments(table?.seatAssignments ?? [], seatCount),
          };
        })
      : [];

  if (normalizedTables.length > 0) {
    return normalizedTables;
  }

  const legacySeatCount = normalizeTableSeatCount(legacyTableSeatCount);
  return [
    {
      seatCount: legacySeatCount,
      seatAssignments: normalizeSeatAssignments(legacySeatAssignments, legacySeatCount),
    },
  ];
}

export function normalizeStageRuntimePayload(
  payload: StoredStageRuntimePayload | null | undefined,
): StoredStageRuntimePayload | null {
  if (!payload) {
    return null;
  }

  const tableSeatCount = normalizeTableSeatCount(payload.tableSeatCount);
  const tables = normalizeStageRuntimeTables(
    payload.tables,
    payload.seatAssignments ?? [],
    payload.tableSeatCount,
  );
  const primaryTable = tables[0] ?? {
    seatCount: tableSeatCount,
    seatAssignments: normalizeSeatAssignments(payload.seatAssignments ?? [], tableSeatCount),
  };

  return {
    ...payload,
    actualStageStartedAt: payload.actualStageStartedAt ?? null,
    currentMatchStartedAt: payload.currentMatchStartedAt ?? null,
    matchElapsedSeconds: payload.matchElapsedSeconds ?? 0,
    completedMatchDurations: payload.completedMatchDurations ?? [],
    stageClosedAt: payload.stageClosedAt ?? null,
    currentMatchClosed: Boolean(payload.currentMatchClosed),
    currentLevelIndex: Math.max(0, payload.currentLevelIndex ?? 0),
    tables,
    tableSeatCount: primaryTable.seatCount,
    seatAssignments: primaryTable.seatAssignments,
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
