"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { LiveLabPage } from "@/components/live-lab-page";
import type { LiveSessionHubMode } from "@/lib/live-lab/session";
import type { LiveLinkedStageOption } from "@/lib/live-lab/stage-runtime-link";

type StageTransmissionOption = {
  stageId: string;
  stageTitle: string;
  stageDateLabel: string;
};

export function SHPLTransmissaoPage({
  selectedStageId,
  stageOptions,
  linkedStageOption,
}: {
  selectedStageId: string;
  stageOptions: StageTransmissionOption[];
  linkedStageOption: LiveLinkedStageOption | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedMode, setSelectedMode] = useState<LiveSessionHubMode>("hub");

  const selectedStageSummary = useMemo(
    () => stageOptions.find((option) => option.stageId === selectedStageId) ?? null,
    [selectedStageId, stageOptions],
  );

  function handleSelectStage(nextStageId: string) {
    setSelectedMode("hub");
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("stage", nextStageId);
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(8,28,20,0.92)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.72rem] uppercase tracking-[0.28em] text-[rgba(240,227,189,0.56)]">
              Vinculo da transmissao
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.03em] text-[rgba(255,239,192,0.98)] md:text-5xl">
              Escolha a etapa da live
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[rgba(237,226,197,0.72)] md:text-base">
              A transmissao nasce vinculada a uma etapa em aberto. Isso faz a captura, o TXT e a
              administracao herdarem corretamente a etapa, o blind e o contexto da mesa.
            </p>
          </div>

          <div className="grid w-full gap-3 xl:max-w-xl">
            <label className="grid gap-2">
              <span className="text-[0.72rem] uppercase tracking-[0.2em] text-[rgba(240,227,189,0.48)]">
                Etapa vinculada
              </span>
              <select
                className="h-12 rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none"
                onChange={(event) => handleSelectStage(event.target.value)}
                value={selectedStageId}
              >
                {stageOptions.map((option) => (
                  <option key={option.stageId} value={option.stageId}>
                    {option.stageTitle} - {option.stageDateLabel}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {selectedStageSummary ? (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <SummaryCard label="Etapa selecionada" value={selectedStageSummary.stageTitle} />
            <SummaryCard label="Data" value={selectedStageSummary.stageDateLabel} />
            <SummaryCard
              label="Status do vinculo"
              value={linkedStageOption ? "pronto para transmitir" : "aguardando contexto"}
            />
          </div>
        ) : null}
      </section>

      {selectedMode === "hub" ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <HubModeCard
            description="Use no celular que vai ficar no tripé, focado só na captura da câmera e da sessão."
            label="Este aparelho transmite"
            onClick={() => setSelectedMode("transmit")}
          />
          <HubModeCard
            description="Use no computador ou segundo celular para controlar a sessão e acompanhar os eventos."
            label="Este aparelho monitora"
            onClick={() => setSelectedMode("monitor")}
          />
          <HubModeCard
            description="Use quando um único aparelho vai capturar e administrar tudo na mesma interface."
            label="Este aparelho faz tudo"
            onClick={() => setSelectedMode("full")}
          />
          <HubModeCard
            description="Abra a biblioteca da etapa para assistir, excluir, exportar e revisar cortes salvos."
            label="Videos salvos"
            onClick={() => setSelectedMode("videos")}
          />
        </section>
      ) : (
        <section className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[rgba(240,227,189,0.48)]">
                Modo ativo
              </p>
              <p className="mt-1 text-lg font-semibold text-[rgba(255,244,214,0.96)]">
                {formatModeLabel(selectedMode)}
              </p>
            </div>

            <button
              className="rounded-[0.95rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-semibold text-[rgba(255,236,184,0.96)] transition hover:border-[rgba(255,208,101,0.3)] hover:bg-[rgba(255,255,255,0.05)]"
              onClick={() => setSelectedMode("hub")}
              type="button"
            >
              Voltar ao hub da transmissao
            </button>
          </div>

          <LiveLabPage
            integratedEntryMode={selectedMode}
            linkedStageOption={linkedStageOption}
            mode="integrated"
            onRequestModeChange={setSelectedMode}
          />
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-4 shadow-[0_14px_28px_rgba(0,0,0,0.18)]">
      <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-[rgba(255,244,214,0.96)]">{value}</p>
    </div>
  );
}

function HubModeCard({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-[1.5rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] p-5 text-left transition hover:border-[rgba(255,208,101,0.3)] hover:bg-[rgba(255,255,255,0.05)]"
      onClick={onClick}
      type="button"
    >
      <p className="text-lg font-bold text-[rgba(255,239,192,0.96)]">{label}</p>
      <p className="mt-2 text-sm leading-7 text-[rgba(237,226,197,0.72)]">{description}</p>
    </button>
  );
}

function formatModeLabel(mode: Exclude<LiveSessionHubMode, "hub">) {
  switch (mode) {
    case "transmit":
      return "Este aparelho transmite";
    case "monitor":
      return "Este aparelho monitora";
    case "full":
      return "Este aparelho faz tudo";
    default:
      return "Videos salvos";
  }
}
