import Link from "next/link";
import type { ReactNode } from "react";

import type { Championship, RankingEntry, Stage } from "@/lib/domain/types";

type AppShellProps = {
  children: ReactNode;
  championship: Championship;
  currentStage: Stage;
  annualRanking: RankingEntry[];
  dayRanking: RankingEntry[];
};

const navItems = [
  { href: "/", label: "Mesa" },
  { href: "/history", label: "Histórico" },
  { href: "/settings", label: "Configurações" },
  { href: "/login", label: "Login" },
];

export function AppShell({
  children,
  championship,
  currentStage,
  annualRanking,
  dayRanking,
}: AppShellProps) {
  const leader = annualRanking[0];
  const dayLeader = dayRanking[0];

  return (
    <div className="app-grid min-h-screen px-4 py-4 md:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="glass-card rounded-[2rem] border border-white/10 p-4 md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="status-pill status-success">{championship.name}</span>
                <span className="status-pill status-warning">Temporada {championship.seasonYear}</span>
                <span className="status-pill status-neutral">
                  {currentStage.status === "active" ? "Etapa ativa" : "Etapa agendada"}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
                Operação da etapa {currentStage.title}
              </h1>
              <p className="text-muted mt-3 max-w-3xl leading-7">
                Painel central para buy-ins, timer, partidas, ranking do dia,
                ranking anual e histórico consolidado.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
              <MetricCard
                label="Líder anual"
                value={leader ? leader.playerName : "A definir"}
                helper={leader ? `${leader.points} pts` : "Sem dados"}
              />
              <MetricCard
                label="Líder do dia"
                value={dayLeader ? dayLeader.playerName : "A definir"}
                helper={dayLeader ? `${dayLeader.points} pts` : "Sem partidas"}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition hover:border-white/20 hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={`/stages/${currentStage.id}`}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[#17200a] transition hover:brightness-110"
            >
              Abrir etapa atual
            </Link>
          </div>
        </header>

        <main className="grid gap-6">{children}</main>
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
    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
      <p className="text-muted text-xs uppercase tracking-[0.2em]">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
      <p className="text-muted mt-1 text-sm">{helper}</p>
    </div>
  );
}
