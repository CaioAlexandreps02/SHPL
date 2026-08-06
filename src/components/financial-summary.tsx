"use client";

import { useSyncExternalStore } from "react";

import { formatCurrency } from "@/lib/domain/rules";
import type { FinancialSummaryData } from "@/lib/domain/types";
import { buildStageRuntimeStorageKey } from "@/lib/live-lab/stage-runtime-shared";

const SETTINGS_STORAGE_KEY = "shpl-2026-settings";

type RuntimePlayerSnapshot = {
  playerId: string;
  annualPaid?: boolean;
  dailyPaid?: boolean;
};

type StageRuntimeSnapshot = {
  players?: RuntimePlayerSnapshot[];
};

type FinancialMetrics = {
  buyInDaily: number;
  dailyPaidPlayers: number;
  annualPaidPlayers: number;
};

const EMPTY_METRICS: FinancialMetrics = {
  buyInDaily: 0,
  dailyPaidPlayers: 0,
  annualPaidPlayers: 0,
};

function readFinancialMetrics(stageId: string | undefined): FinancialMetrics {
  if (typeof window === "undefined") {
    return EMPTY_METRICS;
  }

  let buyInDaily = 10;
  try {
    const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings) as { buyInDaily?: string };
      buyInDaily = Number.parseInt(parsed.buyInDaily ?? "10", 10) || 10;
    }
  } catch {
    return { buyInDaily, dailyPaidPlayers: 0, annualPaidPlayers: 0 };
  }

  if (!stageId) {
    return { buyInDaily, dailyPaidPlayers: 0, annualPaidPlayers: 0 };
  }

  try {
    const rawRuntime = window.localStorage.getItem(buildStageRuntimeStorageKey(stageId));
    if (!rawRuntime) {
      return { buyInDaily, dailyPaidPlayers: 0, annualPaidPlayers: 0 };
    }
    const parsed = JSON.parse(rawRuntime) as StageRuntimeSnapshot;
    const players = parsed.players ?? [];
    return {
      buyInDaily,
      dailyPaidPlayers: players.filter((p) => p.dailyPaid).length,
      annualPaidPlayers: players.filter((p) => p.annualPaid).length,
    };
  } catch {
    return { buyInDaily, dailyPaidPlayers: 0, annualPaidPlayers: 0 };
  }
}

function subscribeFinancialMetrics(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", callback);
  const intervalId = window.setInterval(callback, 2000);
  return () => {
    window.removeEventListener("storage", callback);
    window.clearInterval(intervalId);
  };
}

function getFinancialMetricsSnapshot(stageId: string | undefined): FinancialMetrics {
  return readFinancialMetrics(stageId);
}

function getServerMetricsSnapshot(): FinancialMetrics {
  return EMPTY_METRICS;
}

export function FinancialSummary({
  summary,
  currentStageId,
}: {
  summary: FinancialSummaryData;
  currentStageId?: string;
}) {
  const metrics = useSyncExternalStore(
    subscribeFinancialMetrics,
    () => getFinancialMetricsSnapshot(currentStageId),
    getServerMetricsSnapshot,
  );

  const dailyPrizePool = formatCurrency(metrics.dailyPaidPlayers * metrics.buyInDaily);

  const cards = [
    { label: "Arrecadação do dia", value: dailyPrizePool },
    { label: "Pote anual", value: summary.annualPot },
    { label: "Buy-ins do dia", value: `${metrics.dailyPaidPlayers} pagantes` },
    { label: "Pagamentos anuais", value: `${metrics.annualPaidPlayers} quites` },
  ];

  const isOverridden = summary.annualPotIsOverridden;
  const differenceCents = summary.annualPotDifferenceCents;

  return (
    <section className="glass-card rounded-[2rem] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-muted text-xs uppercase tracking-[0.25em]">Financeiro</p>
          <h2 className="mt-2 text-2xl font-semibold">Premiação e pote</h2>
        </div>
        <span className="status-pill status-success">Atualizado</span>
      </div>

      {isOverridden && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-semibold text-amber-400">Pote anual ajustado manualmente</p>
          <p className="mt-1 text-muted">
            Calculado automaticamente:{" "}
            {formatCurrency(summary.annualPotAutomaticCents / 100)}
            {differenceCents !== 0 && (
              <>
                {" · Diferença: "}
                <span className={differenceCents > 0 ? "text-emerald-400" : "text-red-400"}>
                  {differenceCents > 0 ? "+" : ""}
                  {formatCurrency(differenceCents / 100)}
                </span>
              </>
            )}
          </p>
          {summary.annualPotManualNote && (
            <p className="mt-1 text-muted">Nota: {summary.annualPotManualNote}</p>
          )}
          {summary.annualPotManualSetAt && (
            <p className="mt-1 text-xs text-muted">
              Ajustado em{" "}
              {new Date(summary.annualPotManualSetAt).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
          >
            <p className="text-muted text-sm">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
