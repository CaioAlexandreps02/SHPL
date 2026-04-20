import { NextResponse } from "next/server";

import {
  getStoredStageRuntime,
  saveStoredStageRuntime,
} from "@/lib/data/stage-runtime-store";
import { type StoredStageRuntimePayload } from "@/lib/live-lab/stage-runtime-shared";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stageId = searchParams.get("stageId");

  if (!stageId) {
    return NextResponse.json({ error: "Informe a etapa." }, { status: 400 });
  }

  const runtime = await getStoredStageRuntime(stageId);
  return NextResponse.json({ runtime });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      stageId?: string;
      runtime?: StoredStageRuntimePayload;
    };

    if (!payload.stageId) {
      return NextResponse.json({ error: "Informe a etapa." }, { status: 400 });
    }

    if (!payload.runtime) {
      return NextResponse.json({ error: "Informe o runtime da etapa." }, { status: 400 });
    }

    const runtime = await saveStoredStageRuntime(payload.stageId, payload.runtime);
    return NextResponse.json({ runtime });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar o runtime da etapa.",
      },
      { status: 400 },
    );
  }
}
