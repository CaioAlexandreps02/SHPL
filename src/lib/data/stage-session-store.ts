import type {
  StoredStageSessionPayload,
  StoredStageSessionStage,
  StoredStageTransmissionPayload,
} from "@/lib/live-lab/stage-session-shared";
import {
  buildStageSessionId,
  normalizeStoredStageSessionPayload,
} from "@/lib/live-lab/stage-session-shared";
import type { StoredStageRuntimePayload } from "@/lib/live-lab/stage-runtime-shared";
import {
  appendServerTextDocument,
  readServerTextDocument,
  writeServerTextDocument,
} from "@/lib/data/server-text-store";
import {
  readServerJsonDocument,
  writeServerJsonDocument,
} from "@/lib/data/server-json-store";

function buildStageSessionDocumentName(stageId: string) {
  return `stage-sessions/${stageId}.json`;
}

function buildStageSessionTextDocumentName(stageId: string) {
  return `stage-sessions/${stageId}.txt`;
}

function buildStageSessionHeader(stage: StoredStageSessionStage) {
  const [year, month, day] = (stage.stageDate ?? "").split("-");

  return [
    "[METADADOS]",
    `sessao_id: ${buildStageSessionId(stage.id)}`,
    `etapa_id: ${stage.id}`,
    `etapa_titulo: ${stage.title}`,
    `data: ${day && month && year ? `${day}/${month}/${year}` : "nao informada"}`,
    `horario_programado: ${stage.scheduledStartTime ?? "20:00"}`,
    "",
    "[EVENTOS]",
    "",
  ].join("\n");
}

function buildDefaultStageSession(stage: StoredStageSessionStage): StoredStageSessionPayload {
  return {
    sessionId: buildStageSessionId(stage.id),
    stage,
    state: "no-session",
    modules: {
      tableActive: false,
      transmissionActive: false,
    },
    runtime: null,
    transmission: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function getStoredStageSession(stageId: string) {
  const session = await readServerJsonDocument<StoredStageSessionPayload | null>(
    buildStageSessionDocumentName(stageId),
    () => null,
  );

  return normalizeStoredStageSessionPayload(session);
}

export async function ensureStoredStageSession(stage: StoredStageSessionStage) {
  const current = await getStoredStageSession(stage.id);

  if (current) {
    await readServerTextDocument(buildStageSessionTextDocumentName(stage.id), () =>
      buildStageSessionHeader(stage),
    );
    return current;
  }

  const next = buildDefaultStageSession(stage);
  await writeServerJsonDocument(buildStageSessionDocumentName(stage.id), next);
  await writeServerTextDocument(buildStageSessionTextDocumentName(stage.id), buildStageSessionHeader(stage));
  return next;
}

export async function saveStoredStageSession({
  stage,
  runtime,
  transmission,
  state,
  modules,
}: {
  stage: StoredStageSessionStage;
  runtime?: StoredStageRuntimePayload | null;
  transmission?: StoredStageTransmissionPayload | null;
  state?: StoredStageSessionPayload["state"];
  modules?: StoredStageSessionPayload["modules"];
}) {
  const current =
    (await getStoredStageSession(stage.id)) ?? (await ensureStoredStageSession(stage));

  const next = normalizeStoredStageSessionPayload({
    ...current,
    sessionId: current.sessionId ?? buildStageSessionId(stage.id),
    stage: {
      ...current.stage,
      ...stage,
    },
    runtime: runtime === undefined ? current.runtime ?? null : runtime,
    transmission:
      transmission === undefined ? current.transmission ?? null : transmission,
    state: state ?? current.state ?? "no-session",
    modules: {
      tableActive: modules?.tableActive ?? current.modules?.tableActive ?? false,
      transmissionActive:
        modules?.transmissionActive ?? current.modules?.transmissionActive ?? false,
    },
    updatedAt: new Date().toISOString(),
  });

  if (!next) {
    throw new Error("Nao foi possivel consolidar a sessao da etapa.");
  }

  await writeServerJsonDocument(buildStageSessionDocumentName(stage.id), next);
  await readServerTextDocument(buildStageSessionTextDocumentName(stage.id), () =>
    buildStageSessionHeader(stage),
  );
  return next;
}

export async function appendStageSessionEntries(
  stage: StoredStageSessionStage,
  entries: string[],
) {
  const sanitizedEntries = entries
    .map((entry) => entry.trimEnd())
    .filter((entry) => entry.trim().length > 0);

  await ensureStoredStageSession(stage);

  if (sanitizedEntries.length === 0) {
    return readServerTextDocument(buildStageSessionTextDocumentName(stage.id), () =>
      buildStageSessionHeader(stage),
    );
  }

  return appendServerTextDocument(
    buildStageSessionTextDocumentName(stage.id),
    `${sanitizedEntries.join("\n")}\n`,
    () => buildStageSessionHeader(stage),
  );
}

