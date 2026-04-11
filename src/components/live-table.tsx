"use client";

import { useEffect, useMemo, useState } from "react";

import type { LiveControls, Match, Stage } from "@/lib/domain/types";

type LiveTableProps = {
  stage: Stage;
  liveMatch: Match;
  controls: LiveControls;
};

export function LiveTable({ stage, liveMatch, controls }: LiveTableProps) {
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(levelDurationToSeconds(controls.currentLevel));
  const [clockSeconds, setClockSeconds] = useState(
    controls.actionClockOptions[1] ?? controls.actionClockOptions[0] ?? 30
  );
  const [actionClock, setActionClock] = useState<number | null>(null);
  const [showActionClock, setShowActionClock] = useState(true);

  const currentLevel = controls.currentLevel;
  const nextLevel = controls.nextLevel;

  useEffect(() => {
    if (!running) return;

    const interval = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(interval);
          setRunning(false);
          return 0;
        }

        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (actionClock === null) return;

    const interval = window.setInterval(() => {
      setActionClock((value) => {
        if (value === null) return null;
        return value > 0 ? value - 1 : 0;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [actionClock]);

  useEffect(() => {
    let timeoutId: number | undefined;

    try {
      const rawSettings = window.localStorage.getItem("shpl-2026-settings");

      if (!rawSettings) {
        return;
      }

      const parsedSettings = JSON.parse(rawSettings) as {
        actionClockPreset?: string;
        showActionClockOnTable?: boolean;
      };

      timeoutId = window.setTimeout(() => {
        setClockSeconds(
          Number.parseInt(parsedSettings.actionClockPreset ?? "", 10) ||
            controls.actionClockOptions[1] ||
            controls.actionClockOptions[0] ||
            30
        );
        setShowActionClock(parsedSettings.showActionClockOnTable ?? true);
      }, 0);
    } catch {
      return;
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [controls.actionClockOptions]);

  const formattedRemaining = useMemo(() => formatSeconds(remaining), [remaining]);
  const formattedActionClock = actionClock === null ? null : formatSeconds(actionClock);

  return (
    <section className="glass-card rounded-[2rem] p-6 md:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-muted text-xs uppercase tracking-[0.25em]">Tela principal da mesa</p>
            <h2 className="mt-2 text-2xl font-semibold md:text-3xl">{stage.title} em andamento</h2>
            <p className="text-muted mt-2 text-sm">
              {stage.stageDateLabel} • {liveMatch.participantIds.length} jogadores vivos • partida {liveMatch.matchNumber}
            </p>
          </div>
          <span className="status-pill status-success">Timer prioritario</span>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(46,204,113,0.18),rgba(7,22,14,0.82))] p-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-muted text-sm uppercase tracking-[0.25em]">Nivel atual</p>
              <p className="mt-2 text-2xl font-semibold">Level {currentLevel.levelNumber}</p>
              <p className="mt-4 font-mono text-6xl font-semibold tracking-tight md:text-8xl">{formattedRemaining}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoBox label="Blinds atuais" value={buildBlindLabel(currentLevel)} />
              <InfoBox
                label="Proximo blind"
                value={nextLevel ? buildBlindLabel(nextLevel) : "Fim da estrutura"}
              />
              <InfoBox label="Partidas jogadas" value={`${stage.matchesPlayed}`} />
              <InfoBox label="Jogadores aptos" value={`${stage.eligiblePlayers}`} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: running ? "Pausar timer" : "Iniciar timer", action: () => setRunning((value) => !value) },
            { label: "Resetar nivel", action: () => { setRemaining(levelDurationToSeconds(currentLevel)); setRunning(false); } },
            { label: "Avancar blind", action: () => setRemaining(nextLevel ? levelDurationToSeconds(nextLevel) : 0) },
            { label: "Voltar blind", action: () => setRemaining(levelDurationToSeconds(currentLevel)) },
            ...(showActionClock
              ? [{ label: "Call the clock", action: () => setActionClock(clockSeconds) }]
              : []),
          ].map((item) => (
            <button
              key={item.label}
              className="rounded-full border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold transition hover:bg-white/12"
              onClick={item.action}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={`grid gap-4 ${showActionClock ? "lg:grid-cols-[0.75fr_1.25fr]" : ""}`}>
          {showActionClock ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-muted text-xs uppercase tracking-[0.25em]">Cronometro de acao</p>
                  <p className="mt-2 text-4xl font-semibold">{formattedActionClock ?? "--:--"}</p>
                </div>
                <button
                  className="rounded-full bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => setActionClock(null)}
                  type="button"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-black/15 px-4 py-3">
                <p className="text-muted text-xs uppercase tracking-[0.25em]">Tempo configurado</p>
                <p className="mt-2 text-lg font-semibold">{clockSeconds}s</p>
              </div>
            </div>
          ) : null}

          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <p className="text-muted text-xs uppercase tracking-[0.25em]">Acoes rapidas da partida</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {controls.quickActions.map((action) => (
                <div
                  key={action.title}
                  className="rounded-[1.25rem] border border-white/10 bg-black/15 p-4"
                >
                  <p className="text-sm font-semibold">{action.title}</p>
                  <p className="text-muted mt-2 text-sm leading-6">{action.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
      <p className="text-muted text-sm">{label}</p>
      <p className="mt-3 text-xl font-semibold">{value}</p>
    </div>
  );
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function levelDurationToSeconds(level: LiveControls["currentLevel"]) {
  return level.durationMinutes * 60;
}

function buildBlindLabel(level: LiveControls["currentLevel"]) {
  return level.ante && level.ante > 0
    ? `${level.smallBlind} / ${level.bigBlind} / ante ${level.ante}`
    : `${level.smallBlind} / ${level.bigBlind}`;
}
