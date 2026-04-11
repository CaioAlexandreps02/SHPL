import { NextResponse } from "next/server";

import { classifyCardImages, getCardClassifierStatus } from "@/lib/live-lab/card-classifier";

export const runtime = "nodejs";

export async function GET() {
  const status = await getCardClassifierStatus();

  return NextResponse.json(status);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { images?: string[] };
    const images = Array.isArray(body.images)
      ? body.images.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [];

    if (images.length === 0) {
      return NextResponse.json({ error: "Nenhuma imagem de carta foi enviada." }, { status: 400 });
    }

    const result = await classifyCardImages(images);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel classificar as cartas localmente.",
      },
      { status: 500 },
    );
  }
}
