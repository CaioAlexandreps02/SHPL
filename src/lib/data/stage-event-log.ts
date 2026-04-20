import type { Stage } from "@/lib/domain/types";

import {
  appendServerTextDocument,
  readServerTextDocument,
  writeServerTextDocument,
} from "@/lib/data/server-text-store";

type StageEventLogStageInput = Pick<Stage, "id" | "title"> & {
  stageDate?: string;
  scheduledStartTime?: string;
};

export function buildStageEventLogDocumentName(stageId: string) {
  return `stage-logs/${stageId}.txt`;
}

export function formatStageEventLogEntry(message: string, occurredAt = new Date()) {
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

function buildStageEventLogHeader(stage: StageEventLogStageInput) {
  const [year, month, day] = (stage.stageDate ?? "").split("-");

  return [
    `SHPL 2026 - ${stage.title}`,
    `Etapa: ${stage.id}`,
    `Data: ${day && month && year ? `${day}/${month}/${year}` : "nao informada"}`,
    `Horario programado: ${stage.scheduledStartTime ?? "20:00"}`,
    "----------------------------------------",
    "",
  ].join("\n");
}

export async function ensureStageEventLog(stage: StageEventLogStageInput) {
  const documentName = buildStageEventLogDocumentName(stage.id);
  const currentValue = await readServerTextDocument(documentName, () => buildStageEventLogHeader(stage));

  if (currentValue.trim().length > 0) {
    return currentValue;
  }

  const header = buildStageEventLogHeader(stage);
  await writeServerTextDocument(documentName, header);
  return header;
}

export async function appendStageEventLogEntries(
  stage: StageEventLogStageInput,
  entries: string[],
) {
  const sanitizedEntries = entries
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (sanitizedEntries.length === 0) {
    return ensureStageEventLog(stage);
  }

  const documentName = buildStageEventLogDocumentName(stage.id);
  await ensureStageEventLog(stage);
  return appendServerTextDocument(
    documentName,
    `${sanitizedEntries.join("\n")}\n`,
    () => buildStageEventLogHeader(stage),
  );
}
