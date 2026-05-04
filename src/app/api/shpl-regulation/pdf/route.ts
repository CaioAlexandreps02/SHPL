import { NextResponse } from "next/server";

import { readShplRegulationPdf } from "@/lib/data/shpl-regulation-store";

export async function GET() {
  try {
    const pdf = await readShplRegulationPdf();

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="regulamento-shpl.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel carregar o PDF oficial do regulamento." },
      { status: 500 },
    );
  }
}
