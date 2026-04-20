import { NextResponse } from "next/server";

import { canManageTable, getUserAccessFromCookieHeader } from "@/lib/auth/access";
import {
  appendStageEventLogEntries,
  ensureStageEventLog,
} from "@/lib/data/stage-event-log";

type StageLogRequestPayload = {
  stage: {
    id: string;
    title: string;
    stageDate?: string;
    scheduledStartTime?: string;
  };
  entries?: string[];
  ensureOnly?: boolean;
};

export async function POST(request: Request) {
  const access = await getUserAccessFromCookieHeader(request.headers.get("cookie") ?? "");

  if (!canManageTable(access)) {
    return NextResponse.json(
      { error: "Apenas dealer e administrador podem registrar eventos da mesa." },
      { status: 403 },
    );
  }

  try {
    const payload = (await request.json()) as Partial<StageLogRequestPayload>;

    if (!payload.stage?.id || !payload.stage.title) {
      return NextResponse.json(
        { error: "Informe a etapa para gerar o TXT operacional." },
        { status: 400 },
      );
    }

    if (payload.ensureOnly) {
      await ensureStageEventLog(payload.stage);
    } else {
      await appendStageEventLogEntries(payload.stage, payload.entries ?? []);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar o TXT operacional da etapa.",
      },
      { status: 400 },
    );
  }
}
