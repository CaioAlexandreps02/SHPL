import { NextResponse } from "next/server";

import { getWhisperStatus, transcribeWaveBuffer } from "@/lib/live-lab/whisper";

export const runtime = "nodejs";

export async function GET() {
  const status = await getWhisperStatus();

  return NextResponse.json(status);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("audio");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo de audio nao enviado." }, { status: 400 });
    }

    if (!file.type.includes("wav")) {
      return NextResponse.json(
        { error: "O laboratorio aceita apenas WAV na fase atual." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await transcribeWaveBuffer(buffer);

    return NextResponse.json({
      success: true,
      text: result.text,
      modelPath: result.modelPath,
      binaryPath: result.binaryPath,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Nao foi possivel transcrever o audio local.",
      },
      { status: 500 },
    );
  }
}
