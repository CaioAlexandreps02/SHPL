"use client";

import { useState } from "react";

import { SHPLAnnualClassification } from "@/components/shpl-annual-classification";
import { StageRankingHistoryModal } from "@/components/stage-ranking-history-modal";
import type { LeagueSnapshot } from "@/lib/domain/types";

export function SHPLRankingPage({
  canEditStageRanking,
  snapshot,
  initialStageId,
}: {
  canEditStageRanking: boolean;
  snapshot: LeagueSnapshot;
  initialStageId?: string | null;
}) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(initialStageId ?? null);

  return (
    <div className="grid gap-5">
      <SHPLAnnualClassification
        description="Acompanhe o ranking anual por etapa e a soma total acumulada da temporada."
        snapshot={snapshot}
        title="Ranking Anual"
      />

      <section className="rounded-[1.8rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.28)] md:p-6">
        <div className="border-b border-[rgba(255,208,101,0.1)] pb-5">
          <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[rgba(236,225,196,0.68)]">
            Ranking por etapa
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[rgba(255,244,214,0.96)]">
            Etapas finalizadas
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-[rgba(236,225,196,0.74)]">
            Toque em uma etapa para abrir o ranking daquele dia junto com os detalhes completos da etapa.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.stageMatchPoints.map((stage, index) => (
            <button
              key={stage.stageId}
              className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-left transition hover:border-[rgba(255,208,101,0.2)] hover:bg-[rgba(255,255,255,0.05)]"
              onClick={() => setSelectedStageId(stage.stageId)}
              type="button"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[rgba(236,225,196,0.5)]">
                {buildStageOrdinalLabel(index + 1)}
              </p>
              <p className="mt-2 text-lg font-semibold text-[rgba(255,244,214,0.96)]">
                {stage.stageDateShortLabel}
              </p>
              <p className="mt-1 text-sm text-[rgba(236,225,196,0.68)]">{stage.stageDateLabel}</p>
            </button>
          ))}
        </div>
      </section>

      <StageRankingHistoryModal
        canEditStageRanking={canEditStageRanking}
        onClose={() => setSelectedStageId(null)}
        snapshot={snapshot}
        stageId={selectedStageId}
      />
    </div>
  );
}

function buildStageOrdinalLabel(stageNumber: number) {
  const ordinalMap: Record<number, string> = {
    1: "Primeira etapa",
    2: "Segunda etapa",
    3: "Terceira etapa",
    4: "Quarta etapa",
    5: "Quinta etapa",
    6: "Sexta etapa",
    7: "Setima etapa",
    8: "Oitava etapa",
    9: "Nona etapa",
    10: "Decima etapa",
  };

  return ordinalMap[stageNumber] ?? `${stageNumber}a etapa`;
}
