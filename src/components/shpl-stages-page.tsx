"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { LeagueSnapshot, StageStatus } from "@/lib/domain/types";

type StageListEntry = {
  id: string;
  title: string;
  stageDate: string;
  stageDateLabel: string;
  stageDateShortLabel: string;
  status: StageStatus;
  kind: "finished" | "current" | "upcoming";
};

type StageDraft = {
  id: string | null;
  title: string;
  stageDate: string;
  status: StageStatus;
};

type StoredStagePayload = {
  id: string;
  title: string;
  stageDate: string;
  status: StageStatus;
};

export function SHPLStagesPage({ snapshot }: { snapshot: LeagueSnapshot }) {
  const router = useRouter();
  const initialStages = useMemo(() => buildStageEntries(snapshot), [snapshot]);
  const [stages, setStages] = useState<StageListEntry[]>(initialStages);
  const [draft, setDraft] = useState<StageDraft | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStages() {
      const response = await fetch("/api/shpl-admin/stages", { cache: "no-store" });
      const payload = (await response.json()) as { stages?: StoredStagePayload[] };

      if (!cancelled && payload.stages) {
        setStages(payload.stages.map(mapStoredStageToEntry));
      }
    }

    void loadStages();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleOpenStage(stage: StageListEntry) {
    if (stage.status === "finished") {
      router.push(`/shpl-2026/ranking?stage=${stage.id}`);
      return;
    }

    router.push(`/stages/${stage.id}`);
  }

  function handleOpenAddStage() {
    setDraft({
      id: null,
      title: `Etapa ${String(stages.length + 1).padStart(2, "0")}`,
      stageDate: "",
      status: "scheduled",
    });
  }

  function handleOpenEditStage(stage: StageListEntry) {
    setDraft({
      id: stage.id,
      title: stage.title,
      stageDate: stage.stageDate,
      status: stage.status,
    });
  }

  function handleCloseDraft() {
    setDraft(null);
  }

  async function handleSaveDraft() {
    if (!draft || !draft.title.trim() || !draft.stageDate) {
      return;
    }

    const payloadToSave = {
      id: draft.id ?? `stage-${Date.now()}`,
      title: draft.title.trim(),
      stageDate: draft.stageDate,
      status: draft.status,
    };
    const response = await fetch("/api/shpl-admin/stages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payloadToSave),
    });
    const payload = (await response.json()) as {
      stage?: StoredStagePayload;
      error?: string;
    };

    if (!response.ok || !payload.stage) {
      setMessage(payload.error ?? "Nao foi possivel salvar a etapa.");
      return;
    }

    const nextEntry = mapStoredStageToEntry(payload.stage);
    setStages((currentStages) =>
      sortStages(
        draft.id
          ? currentStages.map((stage) => (stage.id === draft.id ? nextEntry : stage))
          : [...currentStages, nextEntry]
      )
    );
    setDraft(null);
    setMessage("Etapa salva com sucesso.");
  }

  async function handleDeleteDraft() {
    if (!draft?.id) {
      return;
    }

    const response = await fetch("/api/shpl-admin/stages", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ stageId: draft.id }),
    });

    if (!response.ok) {
      setMessage("Nao foi possivel excluir a etapa.");
      return;
    }

    setStages((currentStages) => currentStages.filter((stage) => stage.id !== draft.id));
    setDraft(null);
    setMessage("Etapa excluida com sucesso.");
  }

  return (
    <section className="rounded-[1.8rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.28)] md:p-6">
      <div className="flex flex-col gap-4 border-b border-[rgba(255,208,101,0.1)] pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[rgba(236,225,196,0.68)]">
            SHPL 2026
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[rgba(255,244,214,0.96)] md:text-4xl">
            Etapas
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-[rgba(236,225,196,0.74)]">
            Acompanhe as etapas da temporada, edite as datas ja cadastradas e adicione novas rodadas ao calendario.
          </p>
        </div>

        <button
          className="inline-flex h-12 items-center justify-center rounded-[0.95rem] border border-[rgba(255,208,101,0.22)] bg-[linear-gradient(180deg,#ffd54e_0%,#c88807_100%)] px-5 text-sm font-semibold text-[#2a1a00]"
          onClick={handleOpenAddStage}
          type="button"
        >
          + Adicionar etapa
        </button>
      </div>

      {message ? (
        <div className="mt-5 rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgba(255,236,184,0.9)]">
          {message}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4">
        {stages.map((stage, index) => (
          <article
            key={stage.id}
            className="grid cursor-pointer gap-4 rounded-[1.3rem] border border-[rgba(255,208,101,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-4 transition hover:border-[rgba(255,208,101,0.22)] hover:bg-[rgba(255,255,255,0.05)] md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-center"
            onClick={() => handleOpenStage(stage)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleOpenStage(stage);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="flex min-w-0 items-center gap-4 text-left">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,#ffcf46_0%,#d8970a_100%)] text-base font-black text-[#2a1a00]">
                {index + 1}
              </span>

              <div className="min-w-0">
                <p className="text-lg font-semibold text-[rgba(255,244,214,0.96)]">
                  {stage.stageDateShortLabel}
                </p>
                <p className="mt-1 text-sm text-[rgba(236,225,196,0.7)]">
                  {stage.title}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                  {stage.stageDateLabel}
                </p>
              </div>
            </div>

            <div>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getStageStatusClassName(stage.status)}`}>
                {getStageStatusLabel(stage.status)}
              </span>
            </div>

            <button
              className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(255,255,255,0.03)] px-4 text-sm font-semibold text-[rgba(255,236,184,0.96)] transition hover:bg-[rgba(255,255,255,0.06)]"
              onClick={(event) => {
                event.stopPropagation();
                handleOpenEditStage(stage);
              }}
              type="button"
            >
              Editar etapa
            </button>
          </article>
        ))}
      </div>

      {draft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Fechar edicao da etapa"
            className="absolute inset-0 bg-[rgba(2,10,7,0.72)] backdrop-blur-[3px]"
            onClick={handleCloseDraft}
            type="button"
          />

          <div className="relative z-10 w-full max-w-2xl rounded-[1.45rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] p-5 shadow-[0_28px_60px_rgba(0,0,0,0.42)] md:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-[rgba(255,208,101,0.1)] pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
                  {draft.id ? "Editar etapa" : "Nova etapa"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
                  {draft.id ? draft.title : "Adicionar etapa"}
                </h2>
              </div>

              <button
                className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] text-lg font-semibold text-[rgba(255,244,214,0.8)] transition hover:bg-[rgba(255,255,255,0.05)]"
                onClick={handleCloseDraft}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Nome da etapa">
                <input
                  className={inputClassName}
                  onChange={(event) =>
                    setDraft((currentDraft) =>
                      currentDraft ? { ...currentDraft, title: event.target.value } : null
                    )
                  }
                  value={draft.title}
                />
              </Field>

              <Field label="Data da etapa">
                <input
                  className={inputClassName}
                  onChange={(event) =>
                    setDraft((currentDraft) =>
                      currentDraft ? { ...currentDraft, stageDate: event.target.value } : null
                    )
                  }
                  type="date"
                  value={draft.stageDate}
                />
              </Field>

              <Field label="Status">
                <select
                  className={inputClassName}
                  onChange={(event) =>
                    setDraft((currentDraft) =>
                      currentDraft
                        ? { ...currentDraft, status: event.target.value as StageStatus }
                        : null
                    )
                  }
                  value={draft.status}
                >
                  <option value="scheduled">Agendada</option>
                  <option value="active">Em andamento</option>
                  <option value="finished">Finalizada</option>
                </select>
              </Field>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-[rgba(255,208,101,0.1)] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {draft.id ? (
                  <button
                    className="h-11 rounded-[0.95rem] border border-[rgba(255,132,92,0.28)] bg-[rgba(255,132,92,0.12)] px-5 text-sm font-semibold text-[rgba(255,198,182,0.96)] transition hover:bg-[rgba(255,132,92,0.18)]"
                    onClick={handleDeleteDraft}
                    type="button"
                  >
                    Excluir etapa
                  </button>
                ) : null}
              </div>

              <button
                className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.22)] bg-[linear-gradient(180deg,#ffd54e_0%,#c88807_100%)] px-5 text-sm font-semibold text-[#2a1a00]"
                onClick={handleSaveDraft}
                type="button"
              >
                Salvar etapa
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function buildStageEntries(snapshot: LeagueSnapshot) {
  const finishedStages: StageListEntry[] = snapshot.history.map((stage) => ({
    id: stage.id,
    title: stage.title,
    stageDate: buildIsoDateFromHistoryLabel(stage.stageDateLabel),
    stageDateLabel: stage.stageDateLabel,
    stageDateShortLabel: buildShortLabelFromHistoryLabel(stage.stageDateLabel),
    status: "finished",
    kind: "finished",
  }));

  const currentStage: StageListEntry = {
    id: snapshot.currentStage.id,
    title: snapshot.currentStage.title,
    stageDate: snapshot.currentStage.stageDate,
    stageDateLabel: snapshot.currentStage.stageDateLabel,
    stageDateShortLabel: formatStageShortLabel(snapshot.currentStage.stageDate),
    status: snapshot.currentStage.status,
    kind: snapshot.currentStage.status === "active" ? "current" : "upcoming",
  };

  const upcomingStages: StageListEntry[] = snapshot.upcomingStages.map((stage) => ({
    id: stage.id,
    title: stage.title,
    stageDate: stage.stageDate,
    stageDateLabel: stage.stageDateLabel,
    stageDateShortLabel: formatStageShortLabel(stage.stageDate),
    status: stage.status,
    kind: "upcoming",
  }));

  return sortStages([...finishedStages, currentStage, ...upcomingStages]);
}

function sortStages(stages: StageListEntry[]) {
  return [...stages].sort((left, right) => left.stageDate.localeCompare(right.stageDate));
}

function mapStoredStageToEntry(stage: StoredStagePayload): StageListEntry {
  return {
    id: stage.id,
    title: stage.title,
    stageDate: stage.stageDate,
    stageDateLabel: formatStageDateLabel(stage.stageDate),
    stageDateShortLabel: formatStageShortLabel(stage.stageDate),
    status: stage.status,
    kind:
      stage.status === "finished"
        ? "finished"
        : stage.status === "active"
          ? "current"
          : "upcoming",
  };
}

function buildIsoDateFromHistoryLabel(label: string) {
  const monthMap: Record<string, string> = {
    janeiro: "01",
    fevereiro: "02",
    marco: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12",
  };

  const match = label.match(/(\d{2}) de ([a-z]+) de (\d{4})/i);
  if (!match) {
    return "2026-01-01";
  }

  const [, day, monthName, year] = match;
  return `${year}-${monthMap[monthName.toLowerCase()] ?? "01"}-${day}`;
}

function buildShortLabelFromHistoryLabel(label: string) {
  const isoDate = buildIsoDateFromHistoryLabel(label);
  return formatStageShortLabel(isoDate);
}

function formatStageShortLabel(isoDate: string) {
  if (!isoDate) {
    return "--/--";
  }

  const [, month = "00", day = "00"] = isoDate.split("-");
  return `${day}/${month}`;
}

function formatStageDateLabel(isoDate: string) {
  if (!isoDate) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${isoDate}T12:00:00`));
}

function getStageStatusLabel(status: StageStatus) {
  if (status === "finished") {
    return "Finalizada";
  }

  if (status === "active") {
    return "Em andamento";
  }

  return "Agendada";
}

function getStageStatusClassName(status: StageStatus) {
  if (status === "finished") {
    return "border border-[rgba(109,214,143,0.18)] bg-[rgba(109,214,143,0.12)] text-[rgba(179,245,198,0.96)]";
  }

  if (status === "active") {
    return "border border-[rgba(255,208,101,0.18)] bg-[rgba(255,183,32,0.12)] text-[rgba(255,236,184,0.96)]";
  }

  return "border border-[rgba(151,196,255,0.16)] bg-[rgba(151,196,255,0.1)] text-[rgba(212,230,255,0.96)]";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputClassName =
  "h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none";
