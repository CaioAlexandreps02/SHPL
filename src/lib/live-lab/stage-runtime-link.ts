"use client";

import type { BlindLevel } from "@/lib/domain/types";
import {
  buildStageRuntimeStorageKey,
  normalizeSeatAssignments,
  normalizeStageRuntimePayload,
  type StoredStageRuntimePayload,
} from "@/lib/live-lab/stage-runtime-shared";
import { buildStageSessionStorageKey } from "@/lib/live-lab/stage-session-shared";

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
    const parsed = normalizeStageRuntimePayload(JSON.parse(rawValue) as StoredStageRuntimePayload);

    if (!parsed) {
      return null;
    }

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

export async function fetchLinkedStageContext(option: LiveLinkedStageOption) {
  try {
    const response = await fetch(`/api/shpl-admin/stage-session?stageId=${option.stageId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Falha ao carregar a etapa vinculada.");
    }

    const payload = (await response.json()) as {
      session?: {
        runtime?: StoredStageRuntimePayload | null;
      } | null;
    };
    const runtime = payload.session?.runtime ?? null;

    if (runtime) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          buildStageRuntimeStorageKey(option.stageId),
          JSON.stringify(runtime),
        );
        window.localStorage.setItem(
          buildStageSessionStorageKey(option.stageId),
          JSON.stringify(payload.session),
        );
      }

      const serialized = JSON.stringify(runtime);
      return readLinkedStageContextFromSerialized(option, serialized);
    }
  } catch {
    return readLinkedStageContext(option);
  }

  return readLinkedStageContext(option);
}

function readLinkedStageContextFromSerialized(option: LiveLinkedStageOption, rawValue: string) {
  try {
    const parsed = normalizeStageRuntimePayload(JSON.parse(rawValue) as StoredStageRuntimePayload);

    if (!parsed) {
      return null;
    }

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

function buildBlindLabel(level: BlindLevel) {
  return level.ante && level.ante > 0
    ? `${level.smallBlind}/${level.bigBlind}/${level.ante}`
    : `${level.smallBlind}/${level.bigBlind}`;
}
