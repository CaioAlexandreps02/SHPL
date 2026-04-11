"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PlayerAvatar } from "@/components/player-avatar";
import type { AnnualAward, LeagueSnapshot } from "@/lib/domain/types";

const SETTINGS_STORAGE_KEY = "shpl-2026-settings";

export function SHPLDashboard({ snapshot }: { snapshot: LeagueSnapshot }) {
  const [dashboardAwards, setDashboardAwards] = useState<AnnualAward[]>(snapshot.annualAwards);

  useEffect(() => {
    let timeoutId: number | undefined;

    try {
      const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

      if (!rawSettings) {
        return;
      }

      const parsedSettings = JSON.parse(rawSettings) as {
        annualAwards?: AnnualAward[];
      };

      if (!parsedSettings.annualAwards || parsedSettings.annualAwards.length === 0) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        setDashboardAwards(parsedSettings.annualAwards ?? snapshot.annualAwards);
      }, 0);
    } catch {
      return;
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [snapshot.annualAwards]);

  const annualPotValue = Number.parseFloat(
    snapshot.financialSummary.annualPot
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  );
  const completedStages = snapshot.history.length;
  const totalStages = 25;
  const nextStageLabel =
    snapshot.currentStage.status !== "finished"
      ? snapshot.currentStage.stageDateLabel
      : snapshot.upcomingStages[0]?.stageDateLabel ?? "A definir";
  const averagePoints =
    snapshot.annualRanking.length > 0
      ? Math.round(
          snapshot.annualRanking.reduce((total, entry) => total + entry.points, 0) /
            snapshot.annualRanking.length
        )
      : 0;
  const visibleAwards = useMemo(
    () => [...dashboardAwards].sort((left, right) => left.position - right.position),
    [dashboardAwards]
  );

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-4 rounded-[1.7rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-5 shadow-[0_18px_38px_rgba(0,0,0,0.28)] md:flex-row md:items-start md:justify-between md:p-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[rgba(255,220,143,0.98)] md:text-4xl">
            Dashboard
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[rgba(236,225,196,0.74)]">
            Acompanhe a classificacao e o premio anual da SHPL.
          </p>
        </div>

        <div className="inline-flex items-center gap-3 rounded-[0.95rem] border border-[rgba(255,208,101,0.22)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-sm font-semibold text-[rgba(255,236,184,0.98)]">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(255,191,39,0.14)] text-xs font-black">
            26
          </span>
          <span>Temporada 2026</span>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="grid gap-5">
          <section className="rounded-[1.7rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(7,24,18,0.92)] p-5 shadow-[0_18px_38px_rgba(0,0,0,0.24)]">
            <h2 className="text-2xl font-semibold text-[rgba(255,220,143,0.98)]">
              Previa da Classificacao
            </h2>

            <div className="mt-4 overflow-hidden rounded-[1.3rem] border border-[rgba(255,208,101,0.12)]">
              {snapshot.annualRanking.slice(0, 5).map((entry, index) => (
                <div
                  key={entry.playerId}
                  className="flex items-center justify-between gap-4 border-b border-[rgba(255,208,101,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-4 py-4 last:border-b-0 md:px-5"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                        index === 0
                          ? "bg-[linear-gradient(180deg,#ffcf46_0%,#e0a100_100%)] text-[#2a1a00]"
                          : index === 1
                            ? "bg-[linear-gradient(180deg,#f3f3f3_0%,#a6a6a6_100%)] text-[#202020]"
                            : index === 2
                              ? "bg-[linear-gradient(180deg,#ffb05e_0%,#d86d00_100%)] text-[#2a1600]"
                              : "bg-[linear-gradient(180deg,#5e704b_0%,#2d3e23_100%)] text-[rgba(236,225,196,0.92)]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <PlayerAvatar
                      name={entry.playerName}
                      photoDataUrl={entry.photoDataUrl}
                      size="sm"
                    />
                    <span className="truncate text-xl font-semibold text-[rgba(255,244,214,0.96)] md:text-[1.35rem]">
                      {entry.playerName}
                    </span>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-xl font-semibold text-[rgba(255,236,184,0.98)] md:text-[1.35rem]">
                      {entry.points}
                    </span>
                    <span className="ml-2 text-sm uppercase tracking-[0.14em] text-[rgba(236,225,196,0.62)] md:text-base md:tracking-[0.12em]">
                      pts
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-center">
              <Link
                href="/shpl-2026/ranking"
                className="rounded-[1rem] border border-[rgba(255,208,101,0.24)] bg-[rgba(255,255,255,0.03)] px-5 py-3 text-sm font-semibold text-[rgba(255,236,184,0.98)] transition hover:bg-[rgba(255,255,255,0.06)]"
              >
                Ver ranking completo
              </Link>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <MetricCard
              label="Participantes"
              value={`${snapshot.stagePlayers.length}`}
              helper="jogadores"
            />
            <MetricCard
              label="Etapas concluidas"
              value={`${completedStages} / ${totalStages}`}
              helper="temporada"
            />
            <MetricCard
              label="Proxima etapa"
              value={nextStageLabel}
              helper="agenda"
            />
            <MetricCard
              label="Media de pontos"
              value={`${averagePoints} pts`}
              helper="classificacao"
            />
          </section>
        </div>

        <div className="grid gap-5">
          <section className="rounded-[1.7rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(7,24,18,0.92)] p-5 shadow-[0_18px_38px_rgba(0,0,0,0.24)]">
            <h2 className="text-2xl font-semibold text-[rgba(255,220,143,0.98)]">
              Pote Anual Total
            </h2>
            <p className="mt-4 text-4xl font-black tracking-tight text-[rgba(255,220,143,0.98)] md:text-5xl">
              {snapshot.financialSummary.annualPot}
            </p>

            <div className="relative mt-5 h-[190px] overflow-hidden rounded-[1.3rem] border border-[rgba(255,208,101,0.12)]">
              <Image
                alt="Mesa de poker com fichas, cartas e dinheiro"
                className="object-cover"
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 40vw"
                src="/pote-anual-dashboard.png"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,10,8,0.1),rgba(3,10,8,0.36))]" />
            </div>
          </section>

          <section className="rounded-[1.7rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(7,24,18,0.92)] p-5 shadow-[0_18px_38px_rgba(0,0,0,0.24)]">
            <h2 className="text-2xl font-semibold text-[rgba(255,220,143,0.98)]">
              Distribuicao do Premio
            </h2>

            <div className="mt-5 grid gap-3">
              {visibleAwards.map((award, index) => (
                <PrizeRow
                  key={award.position}
                  amount={formatCurrencyValue(annualPotValue * (award.percentage / 100))}
                  percentage={award.percentage}
                  position={award.position}
                  tone={index}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-[1.35rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-4 shadow-[0_16px_34px_rgba(0,0,0,0.2)]">
      <p className="text-sm text-[rgba(236,225,196,0.72)]">{label}</p>
      <p className="mt-1.5 text-xl font-semibold text-[rgba(255,244,214,0.96)] md:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-sm text-[rgba(236,225,196,0.68)]">{helper}</p>
    </article>
  );
}

function PrizeRow({
  percentage,
  amount,
  position,
  tone,
}: {
  percentage: number;
  amount: string;
  position: number;
  tone: number;
}) {
  const gradients = [
    "from-[#ffd546] to-[#d68b00]",
    "from-[#f1f1f1] to-[#9f9f9f]",
    "from-[#b8da46] to-[#728d1f]",
    "from-[#ffb86a] to-[#d96a00]",
    "from-[#78d6d0] to-[#267b76]",
    "from-[#f09ac1] to-[#b2497e]",
    "from-[#b3a4ff] to-[#6658d3]",
    "from-[#f3dd88] to-[#c49c1f]",
  ];

  const ringColors = [
    "conic-gradient(#ffd546 0% 40%, rgba(255,255,255,0.08) 40% 100%)",
    "conic-gradient(#d7d7d7 0% 25%, rgba(255,255,255,0.08) 25% 100%)",
    "conic-gradient(#a8ce34 0% 15%, rgba(255,255,255,0.08) 15% 100%)",
    "conic-gradient(#ffb86a 0% 18%, rgba(255,255,255,0.08) 18% 100%)",
    "conic-gradient(#78d6d0 0% 12%, rgba(255,255,255,0.08) 12% 100%)",
    "conic-gradient(#f09ac1 0% 10%, rgba(255,255,255,0.08) 10% 100%)",
    "conic-gradient(#b3a4ff 0% 8%, rgba(255,255,255,0.08) 8% 100%)",
    "conic-gradient(#f3dd88 0% 6%, rgba(255,255,255,0.08) 6% 100%)",
  ];
  const colorIndex = tone % gradients.length;

  return (
    <article className="grid items-center gap-3 rounded-[1.15rem] border border-[rgba(255,208,101,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-4 py-3 md:grid-cols-[92px_1fr_auto]">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full p-2"
        style={{ background: ringColors[colorIndex] }}
      >
        <div className="flex h-full w-full items-center justify-center rounded-full bg-[rgba(9,29,20,0.96)] text-base font-black text-[rgba(255,220,143,0.98)]">
          {percentage}%
        </div>
      </div>
      <div className="min-w-0">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-b text-sm font-black text-[#2a1a00] ${gradients[colorIndex]}`}
        >
          {position}o
        </div>
        <p className="mt-2 text-sm uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
          lugar
        </p>
      </div>
      <p className="text-right text-xl font-black text-[rgba(255,220,143,0.98)] md:text-2xl">
        {amount}
      </p>
    </article>
  );
}

function formatCurrencyValue(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
