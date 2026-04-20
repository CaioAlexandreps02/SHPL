import {
  normalizeStageRuntimePayload,
  type StoredStageRuntimePayload,
} from "@/lib/live-lab/stage-runtime-shared";
import {
  readServerJsonDocument,
  writeServerJsonDocument,
} from "@/lib/data/server-json-store";

function buildStageRuntimeDocumentName(stageId: string) {
  return `stage-runtime-${stageId}.json`;
}

export async function getStoredStageRuntime(stageId: string) {
  const payload = await readServerJsonDocument<StoredStageRuntimePayload | null>(
    buildStageRuntimeDocumentName(stageId),
    () => null,
  );

  return normalizeStageRuntimePayload(payload);
}

export async function saveStoredStageRuntime(stageId: string, payload: StoredStageRuntimePayload) {
  const normalized = normalizeStageRuntimePayload(payload);

  if (!normalized) {
    throw new Error("Runtime da etapa invalido.");
  }

  await writeServerJsonDocument(buildStageRuntimeDocumentName(stageId), normalized);
  return normalized;
}
