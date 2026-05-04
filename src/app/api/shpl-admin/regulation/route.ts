import { NextResponse } from "next/server";

import { getUserAccessFromCookieHeader, isAdmin } from "@/lib/auth/access";
import {
  type RegulationDocument,
  saveShplRegulationDocument,
} from "@/lib/data/shpl-regulation-store";

function isValidSection(section: unknown) {
  if (!section || typeof section !== "object") {
    return false;
  }

  const value = section as Record<string, unknown>;
  return (
    typeof value.id === "string" &&
    typeof value.number === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    Array.isArray(value.paragraphs) &&
    value.paragraphs.every((paragraph) => typeof paragraph === "string")
  );
}

export async function POST(request: Request) {
  const access = await getUserAccessFromCookieHeader(request.headers.get("cookie") ?? "");

  if (!isAdmin(access)) {
    return NextResponse.json(
      { error: "Apenas administradores podem alterar o regulamento." },
      { status: 403 },
    );
  }

  try {
    const payload = (await request.json()) as RegulationDocument;

    if (
      !payload ||
      typeof payload.title !== "string" ||
      typeof payload.subtitle !== "string" ||
      typeof payload.intro !== "string" ||
      typeof payload.versionLabel !== "string" ||
      typeof payload.updatedAtLabel !== "string" ||
      typeof payload.pdfFileName !== "string" ||
      !Array.isArray(payload.sections) ||
      payload.sections.some((section) => !isValidSection(section))
    ) {
      return NextResponse.json({ error: "Dados do regulamento invalidos." }, { status: 400 });
    }

    const normalizedDocument: RegulationDocument = {
      ...payload,
      title: payload.title.trim(),
      subtitle: payload.subtitle.trim(),
      intro: payload.intro.trim(),
      versionLabel: payload.versionLabel.trim(),
      updatedAtLabel: payload.updatedAtLabel.trim(),
      pdfFileName: payload.pdfFileName.trim() || "regulamento-shpl.pdf",
      sections: payload.sections.map((section) => ({
        ...section,
        id: section.id.trim(),
        number: section.number.trim(),
        title: section.title.trim(),
        summary: section.summary.trim(),
        paragraphs: section.paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean),
      })),
    };

    await saveShplRegulationDocument(normalizedDocument);

    return NextResponse.json({ ok: true, document: normalizedDocument });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar o regulamento.",
      },
      { status: 400 },
    );
  }
}
