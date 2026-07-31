import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getUserAccessFromCookieHeader, isAdmin } from "@/lib/auth/access";
import {
  calculateAnnualPotBreakdown,
  getAnnualPotBreakdown,
  updateAnnualPotOverride,
  type UpdateAnnualPotOverrideInput,
} from "@/lib/data/demo-league-state";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export async function GET() {
  const h = await headers();
  const access = await getUserAccessFromCookieHeader(h.get("cookie") ?? "");

  if (!isAdmin(access)) {
    return NextResponse.json(
      { error: "Apenas administradores podem consultar o pote anual." },
      { status: 403 },
    );
  }

  const breakdown = await getAnnualPotBreakdown();
  return NextResponse.json(breakdown);
}

export async function POST(request: Request) {
  const access = await getUserAccessFromCookieHeader(request.headers.get("cookie") ?? "");

  if (!isAdmin(access)) {
    return NextResponse.json(
      { error: "Apenas administradores podem ajustar o pote anual." },
      { status: 403 },
    );
  }

  try {
    const payload = (await request.json()) as Partial<UpdateAnnualPotOverrideInput>;

    if (payload.manualCents !== null && payload.manualCents !== undefined && !isFiniteNumber(payload.manualCents)) {
      return NextResponse.json(
        { error: "Informe um valor numerico valido em centavos para o pote manual." },
        { status: 400 },
      );
    }

    if (
      payload.manualCents !== null &&
      payload.manualCents !== undefined &&
      payload.manualCents < 0
    ) {
      return NextResponse.json(
        { error: "O valor manual do pote nao pode ser negativo." },
        { status: 400 },
      );
    }

    if (
      payload.note !== undefined &&
      payload.note !== null &&
      typeof payload.note !== "string"
    ) {
      return NextResponse.json(
        { error: "A nota do ajuste manual precisa ser texto." },
        { status: 400 },
      );
    }

    if (!isStringOrNull(payload.note)) {
      return NextResponse.json(
        { error: "A nota do ajuste manual precisa ser texto ou null." },
        { status: 400 },
      );
    }

    const manualCents = payload.manualCents === undefined ? null : payload.manualCents;
    const note = payload.note ?? null;

    const result = await updateAnnualPotOverride({
      manualCents,
      note,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar o ajuste do pote anual.",
      },
      { status: 400 },
    );
  }
}
