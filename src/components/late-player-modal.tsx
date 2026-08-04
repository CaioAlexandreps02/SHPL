"use client";

import { useMemo, useState } from "react";

export type LatePlayerSeatOption = {
  tableIndex: number;
  seatIndex: number;
  label: string;
};

export type LatePlayerModalProps = {
  isOpen: boolean;
  playerName: string;
  matchNumber: number;
  averageStack: number;
  availableSeats: LatePlayerSeatOption[];
  onJoinNow: (stack: number, tableIndex: number, seatIndex: number) => void;
  onJoinNextMatch: () => void;
  onCancel: () => void;
};

export function LatePlayerModal({
  isOpen,
  playerName,
  matchNumber,
  averageStack,
  availableSeats,
  onJoinNow,
  onJoinNextMatch,
  onCancel,
}: LatePlayerModalProps) {
  const [stackDraft, setStackDraft] = useState(String(Math.max(averageStack, 0)));
  const [selectedSeatKey, setSelectedSeatKey] = useState("");
  const selectedSeat = useMemo(
    () => availableSeats.find((seat) => buildSeatKey(seat) === selectedSeatKey) ?? null,
    [availableSeats, selectedSeatKey],
  );
  const parsedStack = Math.max(Number.parseInt(stackDraft || "0", 10) || 0, 0);

  if (!isOpen) {
    return null;
  }

  function handleJoinNow() {
    if (!selectedSeat || parsedStack <= 0) {
      return;
    }

    onJoinNow(parsedStack, selectedSeat.tableIndex, selectedSeat.seatIndex);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Cancelar entrada de jogador atrasado"
        className="absolute inset-0 bg-[rgba(2,10,7,0.76)] backdrop-blur-[3px]"
        onClick={onCancel}
        type="button"
      />

      <div className="relative z-10 w-full max-w-2xl rounded-[1.55rem] border border-[rgba(255,208,101,0.18)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] p-5 shadow-[0_28px_60px_rgba(0,0,0,0.48)] md:p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
          Jogador atrasado
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
          {playerName} vai entrar na partida?
        </h2>
        <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.72)]">
          A partida {matchNumber} ja comecou. Escolha se o jogador entra agora com stack ajustado ou se fica para a proxima.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.2rem] border border-[rgba(129,211,120,0.2)] bg-[rgba(129,211,120,0.08)] p-4">
            <p className="text-sm font-semibold text-[rgba(222,255,221,0.96)]">
              Entrar agora
            </p>
            <p className="mt-2 text-xs leading-5 text-[rgba(222,255,221,0.72)]">
              Sugestao baseada na media dos jogadores ativos: {formatStackValue(averageStack)} fichas.
            </p>

            <label className="mt-4 grid gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-[rgba(222,255,221,0.58)]">
                Stack
              </span>
              <input
                className="h-11 rounded-[0.95rem] border border-[rgba(129,211,120,0.18)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none"
                inputMode="numeric"
                onChange={(event) => setStackDraft(event.target.value)}
                type="number"
                value={stackDraft}
              />
            </label>

            <label className="mt-4 grid gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-[rgba(222,255,221,0.58)]">
                Lugar
              </span>
              <select
                className="h-11 rounded-[0.95rem] border border-[rgba(129,211,120,0.18)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none disabled:opacity-50"
                disabled={availableSeats.length === 0}
                onChange={(event) => setSelectedSeatKey(event.target.value)}
                value={selectedSeatKey}
              >
                {availableSeats.length > 0 ? (
                  <>
                    <option value="">Escolha mesa/lugar</option>
                    {availableSeats.map((seat) => (
                      <option key={buildSeatKey(seat)} value={buildSeatKey(seat)}>
                        {seat.label}
                      </option>
                    ))}
                  </>
                ) : (
                  <option value="">Nenhum lugar disponivel</option>
                )}
              </select>
            </label>

            <button
              className="mt-4 h-11 w-full rounded-[0.95rem] border border-[rgba(129,211,120,0.28)] bg-[rgba(129,211,120,0.16)] px-5 text-sm font-semibold text-[rgba(222,255,221,0.96)] transition hover:bg-[rgba(129,211,120,0.22)] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!selectedSeat || parsedStack <= 0}
              onClick={handleJoinNow}
              type="button"
            >
              Confirmar entrada
            </button>
          </div>

          <div className="rounded-[1.2rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className="text-sm font-semibold text-[rgba(255,244,214,0.96)]">
              So na proxima
            </p>
            <p className="mt-2 text-xs leading-5 text-[rgba(236,225,196,0.68)]">
              O buy-in fica confirmado, mas o jogador permanece fora da partida atual e recebe 0 ponto nela.
            </p>
            <button
              className="mt-4 h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(255,183,32,0.1)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.96)] transition hover:bg-[rgba(255,183,32,0.16)]"
              onClick={onJoinNextMatch}
              type="button"
            >
              Ficar para proxima
            </button>
          </div>
        </div>

        <div className="mt-5 flex justify-end border-t border-[rgba(255,208,101,0.1)] pt-5">
          <button
            className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] px-5 text-sm font-semibold text-[rgba(236,225,196,0.72)] transition hover:bg-[rgba(255,255,255,0.04)]"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function buildSeatKey(seat: LatePlayerSeatOption) {
  return `${seat.tableIndex}:${seat.seatIndex}`;
}

function formatStackValue(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(value || 0, 0));
}
