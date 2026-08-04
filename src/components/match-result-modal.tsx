"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { calculateMatchPoints } from "@/lib/domain/rules";

export type MatchResultPlayer = {
  playerId: string;
  playerName: string;
  photoDataUrl?: string;
  currentPoints: number;
  outOfCurrentMatch: boolean;
  hasParticipated: boolean;
  estimatedStack: number;
};

export type MatchResultPayload = {
  placements: Array<{
    playerId: string;
    placement: number;
  }>;
};

export type MatchResultModalProps = {
  isOpen: boolean;
  matchNumber: number;
  matchDurationSeconds: number;
  currentBlindLabel: string;
  players: MatchResultPlayer[];
  onConfirm: (result: MatchResultPayload) => void;
  onCancel: () => void;
};

type OrderedMatchResultPlayer = MatchResultPlayer & {
  originalIndex: number;
};

export function MatchResultModal({
  isOpen,
  matchNumber,
  matchDurationSeconds,
  currentBlindLabel,
  players,
  onConfirm,
  onCancel,
}: MatchResultModalProps) {
  const [orderedPlayers, setOrderedPlayers] = useState<OrderedMatchResultPlayer[]>(() =>
    buildInitialPlayerOrder(players),
  );

  const rankedPlayerCount = useMemo(
    () => players.filter((player) => player.hasParticipated).length,
    [players],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const rankedPlayerIds = useMemo(
    () => new Set(orderedPlayers.slice(0, rankedPlayerCount).map((player) => player.playerId)),
    [orderedPlayers, rankedPlayerCount],
  );

  if (!isOpen) {
    return null;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setOrderedPlayers((currentPlayers) => {
      const oldIndex = currentPlayers.findIndex((player) => player.playerId === active.id);
      const newIndex = currentPlayers.findIndex((player) => player.playerId === over.id);

      if (oldIndex < 0 || newIndex < 0) {
        return currentPlayers;
      }

      return arrayMove(currentPlayers, oldIndex, newIndex);
    });
  }

  function handleConfirm() {
    onConfirm({
      placements: orderedPlayers.slice(0, rankedPlayerCount).map((player, index) => ({
        playerId: player.playerId,
        placement: index + 1,
      })),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Cancelar definicao do resultado"
        className="absolute inset-0 bg-[rgba(2,10,7,0.76)] backdrop-blur-[3px]"
        onClick={onCancel}
        type="button"
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col rounded-[1.55rem] border border-[rgba(255,208,101,0.18)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] p-5 shadow-[0_28px_60px_rgba(0,0,0,0.48)] md:p-6">
        <div className="flex flex-col gap-3 border-b border-[rgba(255,208,101,0.1)] pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
              Resultado da partida
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
              Partida {matchNumber}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.72)]">
              Arraste os jogadores para definir a ordem final antes de confirmar os pontos.
            </p>
          </div>

          <div className="grid gap-2 rounded-[1.05rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgba(236,225,196,0.76)]">
            <span>Tempo: {formatLongClock(matchDurationSeconds)}</span>
            <span>Blind: {currentBlindLabel || "Nao definido"}</span>
          </div>
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          {orderedPlayers.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={orderedPlayers.map((player) => player.playerId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid gap-3">
                  {orderedPlayers.map((player, index) => {
                    const placement = index + 1;
                    const isRanked = index < rankedPlayerCount;
                    const shouldShowDivider = index === rankedPlayerCount && rankedPlayerCount < orderedPlayers.length;

                    return (
                      <div key={player.playerId} className="grid gap-3">
                        {shouldShowDivider ? (
                          <div className="flex items-center gap-3 py-1">
                            <div className="h-px flex-1 bg-[rgba(255,208,101,0.14)]" />
                            <span className="text-[0.68rem] uppercase tracking-[0.2em] text-[rgba(236,225,196,0.45)]">
                              Nao participou
                            </span>
                            <div className="h-px flex-1 bg-[rgba(255,208,101,0.14)]" />
                          </div>
                        ) : null}

                        <SortableMatchResultItem
                          isRanked={isRanked}
                          player={player}
                          placement={placement}
                          points={isRanked ? calculateMatchPoints(placement) : 0}
                          wasMovedIntoResult={isRanked && !player.hasParticipated}
                          wasMovedOutOfResult={!isRanked && player.hasParticipated}
                        />
                      </div>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="rounded-[1.15rem] border border-[rgba(255,166,84,0.18)] bg-[rgba(255,166,84,0.08)] px-4 py-5 text-sm text-[rgba(255,232,203,0.94)]">
              Nenhum jogador apto para definir resultado nesta partida.
            </div>
          )}
        </div>

        <div className="mt-5 rounded-[1rem] border border-[rgba(255,208,101,0.1)] bg-[rgba(7,24,18,0.56)] px-4 py-3 text-xs leading-5 text-[rgba(236,225,196,0.68)]">
          <span className="font-semibold text-[rgba(255,236,184,0.92)]">Pontuacao:</span>{" "}
          1o=10 pts | 2o=8 pts | 3o=6 pts | 4o=4 pts | 5o+=2 pts | Nao participou=0 pts
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-[rgba(255,208,101,0.1)] pt-5 md:flex-row md:justify-end">
          <button
            className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] px-5 text-sm font-semibold text-[rgba(236,225,196,0.72)] transition hover:bg-[rgba(255,255,255,0.04)]"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="h-11 rounded-[0.95rem] border border-[rgba(129,211,120,0.28)] bg-[rgba(129,211,120,0.16)] px-5 text-sm font-semibold text-[rgba(222,255,221,0.96)] transition hover:bg-[rgba(129,211,120,0.22)] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={orderedPlayers.length === 0 || rankedPlayerIds.size === 0}
            onClick={handleConfirm}
            type="button"
          >
            Confirmar resultado
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableMatchResultItem({
  isRanked,
  player,
  placement,
  points,
  wasMovedIntoResult,
  wasMovedOutOfResult,
}: {
  isRanked: boolean;
  player: OrderedMatchResultPlayer;
  placement: number;
  points: number;
  wasMovedIntoResult: boolean;
  wasMovedOutOfResult: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.playerId,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className={`grid gap-3 rounded-[1.15rem] border p-3 shadow-[0_14px_28px_rgba(0,0,0,0.2)] transition md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center ${
        isDragging
          ? "z-20 scale-[1.01] border-[rgba(255,208,101,0.38)] bg-[rgba(255,183,32,0.16)]"
          : isRanked
            ? "border-[rgba(129,211,120,0.18)] bg-[rgba(7,24,18,0.72)]"
            : "border-[rgba(255,208,101,0.1)] bg-[rgba(255,255,255,0.025)] opacity-82"
      }`}
      style={style}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Arrastar ${player.playerName}`}
        className="flex h-11 w-11 items-center justify-center rounded-[0.9rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] text-xl text-[rgba(255,236,184,0.72)] transition hover:bg-[rgba(255,255,255,0.06)]"
        type="button"
      >
        ⠿
      </button>

      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar player={player} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[rgba(255,244,214,0.96)]">
            {player.playerName}
          </p>
          <div className="mt-1 flex flex-wrap gap-2 text-[0.72rem] text-[rgba(236,225,196,0.56)]">
            <span>{formatStackValue(player.estimatedStack)}</span>
            <span>{player.outOfCurrentMatch ? "Saiu da partida" : "Ativo"}</span>
            {wasMovedIntoResult ? (
              <span className="text-[rgba(129,211,120,0.88)]">incluido no resultado</span>
            ) : null}
            {wasMovedOutOfResult ? (
              <span className="text-[rgba(255,166,84,0.92)]">ficara com 0 pts</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            isRanked
              ? "border-[rgba(255,208,101,0.18)] bg-[rgba(255,183,32,0.1)] text-[rgba(255,236,184,0.96)]"
              : "border-[rgba(236,225,196,0.1)] bg-[rgba(255,255,255,0.03)] text-[rgba(236,225,196,0.52)]"
          }`}
        >
          {isRanked ? `${placement}o lugar` : "Sem colocacao"}
        </span>
        <span
          className={`min-w-[74px] rounded-full px-3 py-1 text-center text-xs font-semibold ${
            points > 0
              ? "bg-[rgba(129,211,120,0.14)] text-[rgba(222,255,221,0.96)]"
              : "bg-[rgba(255,255,255,0.04)] text-[rgba(236,225,196,0.56)]"
          }`}
        >
          {points} pts
        </span>
      </div>
    </div>
  );
}

function PlayerAvatar({ player }: { player: MatchResultPlayer }) {
  if (player.photoDataUrl) {
    return (
      <Image
        alt={player.playerName}
        className="h-11 w-11 rounded-full border border-[rgba(255,208,101,0.16)] object-cover"
        height={44}
        src={player.photoDataUrl}
        unoptimized
        width={44}
      />
    );
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(255,208,101,0.16)] bg-[rgba(255,183,32,0.12)] text-sm font-semibold text-[rgba(255,236,184,0.96)]">
      {buildPlayerInitials(player.playerName)}
    </span>
  );
}

function buildInitialPlayerOrder(players: MatchResultPlayer[]): OrderedMatchResultPlayer[] {
  return players
    .map((player, originalIndex) => ({ ...player, originalIndex }))
    .sort((left, right) => {
      if (left.hasParticipated !== right.hasParticipated) {
        return left.hasParticipated ? -1 : 1;
      }

      if (left.hasParticipated && left.outOfCurrentMatch !== right.outOfCurrentMatch) {
        return left.outOfCurrentMatch ? 1 : -1;
      }

      if (left.hasParticipated && left.currentPoints !== right.currentPoints) {
        return right.currentPoints - left.currentPoints;
      }

      return left.originalIndex - right.originalIndex;
    });
}

function buildPlayerInitials(playerName: string) {
  return playerName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatLongClock(totalSeconds: number) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const hours = Math.floor(safeSeconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((safeSeconds % 3600) / 60).toString().padStart(2, "0");
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatStackValue(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(value || 0, 0));
}
