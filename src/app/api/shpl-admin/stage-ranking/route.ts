import { NextResponse } from "next/server";

import { getUserAccessFromCookieHeader, isAdmin } from "@/lib/auth/access";
import { updateStageMatchPlacements } from "@/lib/data/demo-league-state";

type UpdateStageRankingPayload = {
  stageId?: string;
  matchNumber?: number;
  placementsByPlayerId?: Record<string, number | null>;
};

export async function POST(request: Request) {
  const access = await getUserAccessFromCookieHeader(request.headers.get("cookie") ?? "");

  if (!isAdmin(access)) {
    return NextResponse.json(
      { error: "Apenas administradores podem ajustar manualmente o ranking da etapa." },
      { status: 403 }
    );
  }

  try {
    const payload = (await request.json()) as UpdateStageRankingPayload;

    if (!payload.stageId) {
      return NextResponse.json({ error: "Informe a etapa a ajustar." }, { status: 400 });
    }

    if (!payload.matchNumber || payload.matchNumber <= 0) {
      return NextResponse.json({ error: "Informe a partida a ajustar." }, { status: 400 });
    }

    if (!payload.placementsByPlayerId) {
      return NextResponse.json(
        { error: "Informe as colocacoes da partida para aplicar o ajuste." },
        { status: 400 }
      );
    }

    const result = await updateStageMatchPlacements({
      stageId: payload.stageId,
      matchNumber: payload.matchNumber,
      placementsByPlayerId: payload.placementsByPlayerId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel ajustar manualmente o ranking da etapa.",
      },
      { status: 400 }
    );
  }
}
