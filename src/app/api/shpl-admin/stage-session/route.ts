import { NextResponse } from "next/server";

import { canManageTable, getUserAccessFromCookieHeader } from "@/lib/auth/access";
import {
  appendStageSessionEntries,
  ensureStoredStageSession,
  getStoredStageSession,
  saveStoredStageSession,
} from "@/lib/data/stage-session-store";
import type {
  StoredStageSessionPayload,
  StoredStageSessionStage,
  StoredStageTransmissionPayload,
} from "@/lib/live-lab/stage-session-shared";
import type { StoredStageRuntimePayload } from "@/lib/live-lab/stage-runtime-shared";

type StageSessionRequestPayload = {
  stage?: StoredStageSessionStage;
  runtime?: StoredStageRuntimePayload | null;
  transmission?: StoredStageTransmissionPayload | null;
  session?: {
    state?: StoredStageSessionPayload["state"];
    modules?: StoredStageSessionPayload["modules"];
  };
  entries?: string[];
  ensureOnly?: boolean;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stageId = searchParams.get("stageId");

  if (!stageId) {
    return NextResponse.json({ error: "Informe a etapa." }, { status: 400 });
  }

  const session = await getStoredStageSession(stageId);
  return NextResponse.json({ session });
}

export async function POST(request: Request) {
  const access = await getUserAccessFromCookieHeader(request.headers.get("cookie") ?? "");

  if (!canManageTable(access)) {
    return NextResponse.json(
      { error: "Apenas dealer e administrador podem atualizar a sessao da etapa." },
      { status: 403 },
    );
  }

  try {
    const payload = (await request.json()) as StageSessionRequestPayload;

    if (!payload.stage?.id || !payload.stage.title) {
      return NextResponse.json(
        { error: "Informe a etapa para atualizar a sessao." },
        { status: 400 },
      );
    }

    if (payload.ensureOnly) {
      const session = await ensureStoredStageSession(payload.stage);
      return NextResponse.json({ session });
    }

    const shouldPersistSession =
      payload.runtime !== undefined ||
      payload.transmission !== undefined ||
      payload.session?.state !== undefined ||
      payload.session?.modules !== undefined;

    const session = shouldPersistSession
      ? await saveStoredStageSession({
          stage: payload.stage,
          runtime: payload.runtime,
          transmission: payload.transmission,
          state: payload.session?.state,
          modules: payload.session?.modules,
        })
      : await ensureStoredStageSession(payload.stage);

    if (payload.entries?.length) {
      await appendStageSessionEntries(payload.stage, payload.entries);
    }

    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar a sessao da etapa.",
      },
      { status: 400 },
    );
  }
}

