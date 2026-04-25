import type { Stage } from "@/lib/domain/types";
import type {
  LiveSessionLifecycleState,
  LiveSessionRole,
} from "@/lib/live-lab/session";
import {
  normalizeStageRuntimePayload,
  type StoredStageRuntimePayload,
} from "@/lib/live-lab/stage-runtime-shared";

export type StoredStageSessionStage = Pick<
  Stage,
  "id" | "title" | "stageDate" | "scheduledStartTime"
>;

export type StoredStageTransmissionPayload = {
  deviceId?: string | null;
  deviceName?: string | null;
  role?: LiveSessionRole | null;
  captureStatus?: "idle" | "preview";
  liveSessionStatus?: "idle" | "running" | "paused";
  connectionStatus?: string | null;
  eventCount?: number;
  lastCommand?: string | null;
  updatedAt?: string;
};

export type StoredStageSessionPayload = {
  sessionId?: string;
  stage: StoredStageSessionStage;
  state?: LiveSessionLifecycleState;
  modules?: {
    tableActive?: boolean;
    transmissionActive?: boolean;
  };
  runtime?: StoredStageRuntimePayload | null;
  transmission?: StoredStageTransmissionPayload | null;
  updatedAt?: string;
};

export function buildStageSessionStorageKey(stageId: string) {
  return `shpl-stage-session-${stageId}`;
}

export function buildStageSessionId(stageId: string) {
  return `stage-session-${stageId}`;
}

export function normalizeStoredStageTransmissionPayload(
  payload: StoredStageTransmissionPayload | null | undefined,
): StoredStageTransmissionPayload | null {
  if (!payload) {
    return null;
  }

  return {
    deviceId: payload.deviceId ?? null,
    deviceName: payload.deviceName ?? null,
    role: payload.role ?? null,
    captureStatus: payload.captureStatus === "preview" ? "preview" : "idle",
    liveSessionStatus:
      payload.liveSessionStatus === "running" || payload.liveSessionStatus === "paused"
        ? payload.liveSessionStatus
        : "idle",
    connectionStatus: payload.connectionStatus ?? null,
    eventCount: Math.max(payload.eventCount ?? 0, 0),
    lastCommand: payload.lastCommand ?? null,
    updatedAt: payload.updatedAt ?? undefined,
  };
}

export function normalizeStoredStageSessionPayload(
  payload: StoredStageSessionPayload | null | undefined,
): StoredStageSessionPayload | null {
  if (!payload?.stage?.id || !payload.stage.title) {
    return null;
  }

  return {
    sessionId: payload.sessionId ?? buildStageSessionId(payload.stage.id),
    stage: {
      id: payload.stage.id,
      title: payload.stage.title,
      stageDate: payload.stage.stageDate ?? undefined,
      scheduledStartTime: payload.stage.scheduledStartTime ?? undefined,
    },
    state: payload.state ?? "no-session",
    modules: {
      tableActive: Boolean(payload.modules?.tableActive),
      transmissionActive: Boolean(payload.modules?.transmissionActive),
    },
    runtime: normalizeStageRuntimePayload(payload.runtime ?? null),
    transmission: normalizeStoredStageTransmissionPayload(payload.transmission),
    updatedAt: payload.updatedAt ?? undefined,
  };
}

