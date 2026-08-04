"use client";

import type { BlindLevel } from "@/lib/domain/types";
import {
  buildStageRuntimeStorageKey,
  normalizeSeatAssignments,
  normalizeStageRuntimeTables,
  normalizeStageRuntimePayload,
  type StoredStageRuntimePayload,
} from "@/lib/live-lab/stage-runtime-shared";
import { buildStageSessionStorageKey } from "@/lib/live-lab/stage-session-shared";

export type LiveLinkedSeatAssignment = {
  tableIndex: number;
  seatIndex: number;
  playerId: string | null;
  playerName: string | null;
};

export type LiveLinkedTable = {
  tableIndex: number;
  seatCount: number;
  seatAssignments: LiveLinkedSeatAssignment[];
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
  remainingSeconds: number;
  matchElapsedSeconds: number;
  isRunning: boolean;
  currentMatchNumber: number;
  tables: LiveLinkedTable[];
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

    return buildLinkedStageContext(option, parsed);
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

    return buildLinkedStageContext(option, parsed);
  } catch {
    return null;
  }
}

function buildLinkedStageContext(
  option: LiveLinkedStageOption,
  parsed: StoredStageRuntimePayload,
): LiveLinkedStageContext {
  const currentLevelIndex = Math.max(0, parsed.currentLevelIndex ?? 0);
  const currentLevel = option.blindStructure[currentLevelIndex] ?? option.blindStructure[0] ?? null;
  const tables = normalizeStageRuntimeTables(
    parsed.tables,
    parsed.seatAssignments ?? [],
    parsed.tableSeatCount,
  ).map((table, tableIndex) => {
    const seatAssignments = normalizeSeatAssignments(table.seatAssignments, table.seatCount).map(
      (playerId, seatIndex) => ({
        tableIndex,
        seatIndex,
        playerId,
        playerName: playerId ? option.playerNameById[playerId] ?? null : null,
      }),
    );

    return {
      tableIndex,
      seatCount: table.seatCount,
      seatAssignments,
    };
  });
  const completedMatchCount = parsed.completedMatchDurations?.length ?? 0;
  const hasOpenMatch = Boolean(parsed.currentMatchStartedAt) && !parsed.currentMatchClosed;

  return {
    stageId: option.stageId,
    stageTitle: option.stageTitle,
    stageDateLabel: option.stageDateLabel,
    currentLevelIndex,
    currentBlindLabel: currentLevel ? buildBlindLabel(currentLevel) : null,
    remainingSeconds: Math.max(parsed.remainingSeconds ?? 0, 0),
    matchElapsedSeconds: Math.max(parsed.matchElapsedSeconds ?? 0, 0),
    isRunning: Boolean(parsed.isRunning),
    currentMatchNumber: Math.max(1, completedMatchCount + (hasOpenMatch ? 1 : 1)),
    tables,
    seatAssignments: tables.flatMap((table) => table.seatAssignments),
    currentMatchClosed: parsed.currentMatchClosed ?? false,
    stageClosed: Boolean(parsed.stageClosedAt),
  };
}

function buildBlindLabel(level: BlindLevel) {
  return level.ante && level.ante > 0
    ? `${level.smallBlind}/${level.bigBlind}/${level.ante}`
    : `${level.smallBlind}/${level.bigBlind}`;
}
