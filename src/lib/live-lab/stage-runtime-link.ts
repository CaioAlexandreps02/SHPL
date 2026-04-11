"use client";

import type { BlindLevel } from "@/lib/domain/types";

export const STAGE_RUNTIME_STORAGE_KEY_PREFIX = "shpl-stage-runtime";
export const LIVE_LAB_TOTAL_TABLE_SEATS = 8;

export type LiveLinkedSeatAssignment = {
  seatIndex: number;
  playerId: string | null;
  playerName: string | null;
};

export type LiveLinkedStageOption = {
  stageId: string;
  stageTitle: string;
  stageDateLabel: string;
  blindStructure: BlindLevel[];
  playerNameById: Record<string, string>;
};

export type LiveLinkedStageContext = {
  stageId: string;
  stageTitle: string;
  stageDateLabel: string;
  currentLevelIndex: number;
  currentBlindLabel: string | null;
  currentMatchNumber: number;
  seatAssignments: LiveLinkedSeatAssignment[];
  currentMatchClosed: boolean;
  stageClosed: boolean;
};

type StoredStageRuntimePayload = {
  currentLevelIndex?: number;
  completedMatchDurations?: number[];
  currentMatchStartedAt?: string | null;
  currentMatchClosed?: boolean;
  stageClosedAt?: string | null;
  seatAssignments?: Array<string | null>;
};

export function buildStageRuntimeStorageKey(stageId: string) {
  return `${STAGE_RUNTIME_STORAGE_KEY_PREFIX}-${stageId}`;
}

export function readLinkedStageContext(
  option: LiveLinkedStageOption,
): LiveLinkedStageContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(buildStageRuntimeStorageKey(option.stageId));

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredStageRuntimePayload;
    const currentLevelIndex = Math.max(0, parsed.currentLevelIndex ?? 0);
    const currentLevel = option.blindStructure[currentLevelIndex] ?? option.blindStructure[0] ?? null;
    const normalizedSeats = normalizeSeatAssignments(parsed.seatAssignments ?? []).map(
      (playerId, seatIndex) => ({
        seatIndex,
        playerId,
        playerName: playerId ? option.playerNameById[playerId] ?? null : null,
      }),
    );
    const completedMatchCount = parsed.completedMatchDurations?.length ?? 0;
    const hasOpenMatch = Boolean(parsed.currentMatchStartedAt) && !parsed.currentMatchClosed;

    return {
      stageId: option.stageId,
      stageTitle: option.stageTitle,
      stageDateLabel: option.stageDateLabel,
      currentLevelIndex,
      currentBlindLabel: currentLevel ? buildBlindLabel(currentLevel) : null,
      currentMatchNumber: Math.max(1, completedMatchCount + (hasOpenMatch ? 1 : 1)),
      seatAssignments: normalizedSeats,
      currentMatchClosed: parsed.currentMatchClosed ?? false,
      stageClosed: Boolean(parsed.stageClosedAt),
    };
  } catch {
    return null;
  }
}

function normalizeSeatAssignments(assignments: Array<string | null>) {
  const nextAssignments = Array.from({ length: LIVE_LAB_TOTAL_TABLE_SEATS }, (_, seatIndex) => {
    const value = assignments[seatIndex];
    return typeof value === "string" && value.length > 0 ? value : null;
  });

  return nextAssignments;
}

function buildBlindLabel(level: BlindLevel) {
  return level.ante && level.ante > 0
    ? `${level.smallBlind}/${level.bigBlind}/${level.ante}`
    : `${level.smallBlind}/${level.bigBlind}`;
}
