import { NextResponse } from "next/server";

import {
  deleteStoredStage,
  getStoredStages,
  saveStoredStage,
} from "@/lib/data/demo-admin-store";

export async function GET() {
  const stages = await getStoredStages();
  return NextResponse.json({ stages });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const stage = await saveStoredStage(payload);
    return NextResponse.json({ stage });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel salvar a etapa." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { stageId } = (await request.json()) as { stageId?: string };

    if (!stageId) {
      return NextResponse.json({ error: "Informe a etapa a excluir." }, { status: 400 });
    }

    await deleteStoredStage(stageId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel excluir a etapa." }, { status: 400 });
  }
}
