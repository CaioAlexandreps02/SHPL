import { NextResponse } from "next/server";

import { canManageTable, getUserAccessFromCookieHeader } from "@/lib/auth/access";
import {
  finalizeStage,
  type FinalizeStageInput,
} from "@/lib/data/demo-league-state";

export async function POST(request: Request) {
  const access = await getUserAccessFromCookieHeader(request.headers.get("cookie") ?? "");

  if (!canManageTable(access)) {
    return NextResponse.json(
      { error: "Apenas dealer e administrador podem operar a mesa da etapa." },
      { status: 403 }
    );
  }

  try {
    const payload = (await request.json()) as Partial<FinalizeStageInput>;

    if (!payload.stageId) {
      return NextResponse.json({ error: "Informe a etapa a encerrar." }, { status: 400 });
    }

    if (!payload.closedAt) {
      return NextResponse.json(
        { error: "Informe o horario real de encerramento da etapa." },
        { status: 400 }
      );
    }

    if (!payload.players?.length) {
      return NextResponse.json(
        { error: "Nao existem jogadores suficientes para fechar a etapa." },
        { status: 400 }
      );
    }

    const result = await finalizeStage({
      stageId: payload.stageId,
      actualStageStartedAt: payload.actualStageStartedAt ?? null,
      closedAt: payload.closedAt,
      completedMatchDurations: payload.completedMatchDurations ?? [],
      players: payload.players,
      buyInAnnual: Math.max(payload.buyInAnnual ?? 0, 0),
      buyInDaily: Math.max(payload.buyInDaily ?? 0, 0),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel encerrar a etapa.",
      },
      { status: 400 }
    );
  }
}
