import { NextResponse } from "next/server";

import { getUserAccessFromCookieHeader, isAdmin } from "@/lib/auth/access";
import {
  updateAnnualRankingStats,
  type UpdateAnnualRankingInput,
} from "@/lib/data/demo-league-state";

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function PATCH(request: Request) {
  const access = await getUserAccessFromCookieHeader(request.headers.get("cookie") ?? "");

  if (!isAdmin(access)) {
    return NextResponse.json(
      { error: "Apenas administradores podem editar o ranking anual." },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as { updates?: unknown };

    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      return NextResponse.json(
        { error: "Informe ao menos um jogador para atualizar." },
        { status: 400 }
      );
    }

    const updates: UpdateAnnualRankingInput[] = [];

    for (const raw of body.updates) {
      if (!raw || typeof raw !== "object") {
        return NextResponse.json(
          { error: "Dados invalidos no array de atualizacoes." },
          { status: 400 }
        );
      }

      const candidate = raw as Record<string, unknown>;

      if (!isString(candidate.playerId)) {
        return NextResponse.json(
          { error: "Cada atualizacao deve informar o playerId." },
          { status: 400 }
        );
      }

      updates.push({
        playerId: candidate.playerId,
        points: isFiniteNumber(candidate.points) ? Math.max(Math.round(candidate.points), 0) : 0,
        wins: isFiniteNumber(candidate.wins) ? Math.max(Math.round(candidate.wins), 0) : 0,
        secondPlaces: isFiniteNumber(candidate.secondPlaces)
          ? Math.max(Math.round(candidate.secondPlaces), 0)
          : 0,
        thirdPlaces: isFiniteNumber(candidate.thirdPlaces)
          ? Math.max(Math.round(candidate.thirdPlaces), 0)
          : 0,
      });
    }

    await updateAnnualRankingStats(updates);

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar o ranking anual.",
      },
      { status: 400 }
    );
  }
}
