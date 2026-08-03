"use client";

import { useState } from "react";

import type { BlindLevel } from "@/lib/domain/types";

const inputClassName =
  "h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none placeholder:text-[rgba(236,225,196,0.4)]";

const chipButtonClassName =
  "h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm font-medium text-[rgba(255,244,214,0.82)]";

const selectedChipButtonClassName =
  "h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.28)] bg-[rgba(255,183,32,0.12)] px-4 text-sm font-semibold text-[rgba(255,236,184,0.98)]";

export function BlindEditorModal({
  blindLevels,
  defaultBlindLevels,
  onSave,
  onClose,
}: {
  blindLevels: BlindLevel[];
  defaultBlindLevels: BlindLevel[];
  onSave: (levels: BlindLevel[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<BlindLevel[]>(() =>
    blindLevels.map((level) => ({ ...level }))
  );
  const [applyDurationMinutes, setApplyDurationMinutes] = useState("");
  const [anteEnabled, setAnteEnabled] = useState(
    defaultBlindLevels.some((level) => (level.ante ?? 0) > 0)
  );

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(blindLevels);

  function updateLevel(
    levelNumber: number,
    field: keyof Pick<BlindLevel, "smallBlind" | "durationMinutes" | "ante">,
    value: string,
  ) {
    const nextValue = Math.max(Number.parseInt(value || "0", 10) || 0, 0);

    setDraft((current) =>
      current.map((level) =>
        level.levelNumber === levelNumber
          ? field === "smallBlind"
            ? { ...level, smallBlind: nextValue, bigBlind: nextValue * 2 }
            : { ...level, [field]: nextValue }
          : level,
      ),
    );
  }

  function applyDurationToAll() {
    const nextDuration = Math.max(Number.parseInt(applyDurationMinutes || "0", 10) || 0, 0);

    if (nextDuration <= 0) {
      return;
    }

    setDraft((current) =>
      current.map((level) => ({
        ...level,
        durationMinutes: nextDuration,
      })),
    );
  }

  function toggleAnte(enabled: boolean) {
    setAnteEnabled(enabled);
    setDraft((current) =>
      current.map((level) => ({
        ...level,
        ante: enabled ? level.ante ?? 0 : 0,
      })),
    );
  }

  function addLevel() {
    setDraft((current) => {
      const lastLevel = current[current.length - 1];
      const nextSmallBlind = lastLevel ? lastLevel.bigBlind : 25;

      return [
        ...current,
        {
          levelNumber: current.length + 1,
          smallBlind: nextSmallBlind,
          bigBlind: nextSmallBlind * 2,
          durationMinutes: lastLevel?.durationMinutes ?? 15,
          ante: anteEnabled ? lastLevel?.ante ?? 0 : 0,
        },
      ];
    });
  }

  function removeLevel(levelNumber: number) {
    setDraft((current) =>
      current.length <= 1
        ? current
        : current
            .filter((level) => level.levelNumber !== levelNumber)
            .map((level, index) => ({
              ...level,
              levelNumber: index + 1,
            })),
    );
  }

  function handleRestore() {
    setDraft(defaultBlindLevels.map((level) => ({ ...level })));
    setAnteEnabled(defaultBlindLevels.some((level) => (level.ante ?? 0) > 0));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Fechar editor de blinds"
        className="absolute inset-0 bg-[rgba(2,10,7,0.72)] backdrop-blur-[3px]"
        onClick={onClose}
        type="button"
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[1.4rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] p-5 shadow-[0_28px_60px_rgba(0,0,0,0.42)] md:p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
          Edicao manual
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
          Blinds da Partida
        </h2>
        <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.72)]">
          Ajuste a estrutura de blinds desta partida. As alteracoes entram em vigor imediatamente.
        </p>

        <div className="mt-5 grid flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1 lg:grid-cols-[minmax(0,1fr)_200px]">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                Aplicar duracao a todos (min)
              </p>
              <input
                className={`${inputClassName} mt-2`}
                onChange={(e) => setApplyDurationMinutes(e.target.value)}
                placeholder="Ex: 15"
                value={applyDurationMinutes}
              />
            </div>
            <div className="flex items-end">
              <button
                className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.2)] bg-[rgba(255,183,32,0.12)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.98)] transition hover:bg-[rgba(255,183,32,0.18)]"
                onClick={applyDurationToAll}
                type="button"
              >
                Aplicar
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
              Ante
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                className={anteEnabled ? selectedChipButtonClassName : chipButtonClassName}
                onClick={() => toggleAnte(true)}
                type="button"
              >
                Sim
              </button>
              <button
                className={!anteEnabled ? selectedChipButtonClassName : chipButtonClassName}
                onClick={() => toggleAnte(false)}
                type="button"
              >
                Nao
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid max-h-[45vh] flex-1 gap-3 overflow-y-auto pr-1">
          {draft.map((level) => (
            <div
              key={level.levelNumber}
              className={`grid gap-3 rounded-[1.15rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] p-4 ${
                anteEnabled
                  ? "md:grid-cols-[90px_repeat(4,minmax(0,1fr))_56px]"
                  : "md:grid-cols-[90px_repeat(3,minmax(0,1fr))_56px]"
              }`}
            >
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[rgba(236,225,196,0.48)]">
                  Nivel
                </p>
                <p className="mt-1 text-lg font-semibold text-[rgba(255,244,214,0.96)]">
                  {level.levelNumber}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                  Small blind
                </p>
                <input
                  className={`${inputClassName} mt-2`}
                  onChange={(e) => updateLevel(level.levelNumber, "smallBlind", e.target.value)}
                  value={String(level.smallBlind)}
                />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                  Big blind
                </p>
                <input
                  className={`${inputClassName} mt-2 opacity-70`}
                  readOnly
                  value={String(level.bigBlind)}
                />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                  Duracao (min)
                </p>
                <input
                  className={`${inputClassName} mt-2`}
                  onChange={(e) => updateLevel(level.levelNumber, "durationMinutes", e.target.value)}
                  value={String(level.durationMinutes)}
                />
              </div>

              {anteEnabled ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                    Ante
                  </p>
                  <input
                    className={`${inputClassName} mt-2`}
                    onChange={(e) => updateLevel(level.levelNumber, "ante", e.target.value)}
                    value={String(level.ante ?? 0)}
                  />
                </div>
              ) : null}

              <div className="flex items-end">
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-[rgba(255,132,92,0.24)] bg-[rgba(255,132,92,0.08)] text-lg font-semibold text-[rgba(255,203,184,0.96)] transition hover:bg-[rgba(255,132,92,0.14)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={draft.length <= 1}
                  onClick={() => removeLevel(level.levelNumber)}
                  type="button"
                >
                  -
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          className="mt-4 h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.2)] bg-[rgba(255,183,32,0.12)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.98)] transition hover:bg-[rgba(255,183,32,0.18)]"
          onClick={addLevel}
          type="button"
        >
          Adicionar nivel
        </button>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(255,255,255,0.03)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.96)] transition hover:bg-[rgba(255,255,255,0.05)]"
            onClick={handleRestore}
            type="button"
          >
            Restaurar padrao
          </button>
          <div className="flex gap-3">
            <button
              className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(255,255,255,0.03)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.96)] transition hover:bg-[rgba(255,255,255,0.05)]"
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="h-11 rounded-[0.95rem] border border-[rgba(129,211,120,0.3)] bg-[rgba(129,211,120,0.12)] px-5 text-sm font-semibold text-[rgba(129,211,120,0.96)] transition hover:bg-[rgba(129,211,120,0.2)] disabled:opacity-40"
              disabled={!hasChanges}
              onClick={() => onSave(draft)}
              type="button"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
