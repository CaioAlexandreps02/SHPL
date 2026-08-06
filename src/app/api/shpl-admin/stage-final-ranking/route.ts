import { NextResponse } from "next/server";

import { getUserAccessFromCookieHeader, isAdmin } from "@/lib/auth/access";
import { updateStageFinalRanking } from "@/lib/data/demo-league-state";

export async function POST(request: Request) {
  const access = await getUserAccessFromCookieHeader(request.headers.get("cookie") ?? "");

  if (!isAdmin(access)) {
    return NextResponse.json(
      { error: "Apenas administradores podem editar o ranking final da etapa." },
      { status: 403 }
    );
  }

  try {
    const payload = (await request.json()) as {
      stageId?: string;
      finalRankingPlayerIds?: string[];
    };

    if (!payload.stageId) {
      return NextResponse.json({ error: "Informe a etapa." }, { status: 400 });
    }

    if (!Array.isArray(payload.finalRankingPlayerIds) || payload.finalRankingPlayerIds.length === 0) {
      return NextResponse.json(
        { error: "Informe a ordem dos jogadores." },
        { status: 400 }
      );
    }

    const result = await updateStageFinalRanking({
      stageId: payload.stageId,
      finalRankingPlayerIds: payload.finalRankingPlayerIds,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar o ranking final da etapa.",
      },
      { status: 400 }
    );
  }
}
