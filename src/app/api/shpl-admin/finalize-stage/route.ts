import { NextResponse } from "next/server";

import { getUserAccessFromCookieHeader, canManageTable, isAdmin } from "@/lib/auth/access";
import {
  finalizeStage,
  type FinalizeStageInput,
  type FinalizeStagePlayerPayload,
} from "@/lib/data/demo-league-state";

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function parsePlayer(raw: unknown): FinalizeStagePlayerPayload | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const candidate = raw as Record<string, unknown>;
  if (!isString(candidate.playerId) || !isString(candidate.playerName)) {
    return null;
  }
  if (!isBoolean(candidate.annualPaid) || !isBoolean(candidate.dailyPaid) || !isBoolean(candidate.leftStage)) {
    return null;
  }
  if (!Array.isArray(candidate.matchPoints) || !candidate.matchPoints.every(isFiniteNumber)) {
    return null;
  }
  return {
    playerId: candidate.playerId,
    playerName: candidate.playerName,
    annualPaid: candidate.annualPaid,
    dailyPaid: candidate.dailyPaid,
    leftStage: candidate.leftStage,
    matchPoints: candidate.matchPoints,
    receivesAnnualPoint: isBoolean(candidate.receivesAnnualPoint) ? candidate.receivesAnnualPoint : undefined,
  };
}

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

    if (!isString(payload.stageId)) {
      return NextResponse.json({ error: "Informe a etapa a encerrar." }, { status: 400 });
    }

    if (!isString(payload.closedAt)) {
      return NextResponse.json(
        { error: "Informe o horario real de encerramento da etapa." },
        { status: 400 }
      );
    }

    if (!Array.isArray(payload.players) || payload.players.length === 0) {
      return NextResponse.json(
        { error: "Nao existem jogadores suficientes para fechar a etapa." },
        { status: 400 }
      );
    }

    const players: FinalizeStagePlayerPayload[] = [];
    for (const raw of payload.players) {
      const parsed = parsePlayer(raw);
      if (!parsed) {
        return NextResponse.json(
          { error: "Lista de jogadores contem dados invalidos." },
          { status: 400 }
        );
      }
      players.push(parsed);
    }

    const finalRankingPlayerIds = Array.isArray(payload.finalRankingPlayerIds)
      ? payload.finalRankingPlayerIds.filter(isString)
      : undefined;

    const completedMatchDurations = Array.isArray(payload.completedMatchDurations)
      ? payload.completedMatchDurations.filter(isFiniteNumber)
      : [];

    const buyInAnnual = isFiniteNumber(payload.buyInAnnual) ? Math.max(payload.buyInAnnual, 0) : 0;
    const buyInDaily = isFiniteNumber(payload.buyInDaily) ? Math.max(payload.buyInDaily, 0) : 0;

    const overrideDailyPrizeCents =
      payload.overrideDailyPrizeCents != null && isFiniteNumber(payload.overrideDailyPrizeCents)
        ? Math.max(payload.overrideDailyPrizeCents, 0)
        : null;
    const overrideDailyPrizeNote = isString(payload.overrideDailyPrizeNote)
      ? payload.overrideDailyPrizeNote
      : null;

    const overrideAnnualContributionCents =
      payload.overrideAnnualContributionCents != null && isFiniteNumber(payload.overrideAnnualContributionCents)
        ? Math.max(payload.overrideAnnualContributionCents, 0)
        : null;
    const overrideAnnualContributionNote = isString(payload.overrideAnnualContributionNote)
      ? payload.overrideAnnualContributionNote
      : null;

    const overrideIncludeInAnnual = isBoolean(payload.overrideIncludeInAnnual)
      ? payload.overrideIncludeInAnnual
      : undefined;

    const hasOverrides =
      overrideDailyPrizeCents != null ||
      overrideAnnualContributionCents != null ||
      overrideIncludeInAnnual != null;

    if (hasOverrides && !isAdmin(access)) {
      return NextResponse.json(
        { error: "Apenas administradores podem usar overrides na finalizacao da etapa." },
        { status: 403 }
      );
    }

    const actualStageStartedAt = isString(payload.actualStageStartedAt) ? payload.actualStageStartedAt : null;

    const result = await finalizeStage({
      stageId: payload.stageId,
      actualStageStartedAt,
      closedAt: payload.closedAt,
      completedMatchDurations,
      players,
      finalRankingPlayerIds,
      buyInAnnual,
      buyInDaily,
      overrideDailyPrizeCents,
      overrideDailyPrizeNote,
      overrideAnnualContributionCents,
      overrideAnnualContributionNote,
      overrideIncludeInAnnual,
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
