"use client";

import { useState } from "react";
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

export type StageResultPlayer = {
  playerId: string;
  playerName: string;
  totalPoints: number;
  wins: number;
  secondPlaces: number;
  thirdPlaces: number;
  dailyPaid: boolean;
  leftStage: boolean;
};

export type StageResultPayload = {
  finalRankingPlayerIds: string[];
};

type OrderedStageResultPlayer = StageResultPlayer & {
  originalIndex: number;
};

export function StageResultModal({
  isOpen,
  players,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  players: StageResultPlayer[];
  onConfirm: (payload: StageResultPayload) => void;
  onCancel: () => void;
}) {
  const [orderedPlayers, setOrderedPlayers] = useState<OrderedStageResultPlayer[]>(() =>
    buildInitialStageResultOrder(players),
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
      finalRankingPlayerIds: orderedPlayers.map((player) => player.playerId),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Cancelar confirmacao do resultado da etapa"
        className="absolute inset-0 bg-[rgba(2,10,7,0.76)] backdrop-blur-[3px]"
        onClick={onCancel}
        type="button"
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col rounded-[1.55rem] border border-[rgba(255,208,101,0.18)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] p-5 shadow-[0_28px_60px_rgba(0,0,0,0.48)] md:p-6">
        <div className="flex flex-col gap-3 border-b border-[rgba(255,208,101,0.1)] pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
              Resultado final da etapa
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
              Confirmar ranking da etapa
            </h2>
            <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.72)]">
              Confira a ordem final. Se algo estiver errado, arraste os jogadores antes de encerrar a etapa.
            </p>
          </div>

          <div className="rounded-[1.05rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgba(236,225,196,0.76)]">
            {players.length} participante(s)
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
                  {orderedPlayers.map((player, index) => (
                    <SortableStageResultItem
                      key={player.playerId}
                      player={player}
                      position={index + 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="rounded-[1.15rem] border border-[rgba(255,166,84,0.18)] bg-[rgba(255,166,84,0.08)] px-4 py-5 text-sm text-[rgba(255,232,203,0.94)]">
              Nenhum participante com buy-in do dia para confirmar.
            </div>
          )}
        </div>

        <div className="mt-5 rounded-[1rem] border border-[rgba(255,208,101,0.1)] bg-[rgba(7,24,18,0.56)] px-4 py-3 text-xs leading-5 text-[rgba(236,225,196,0.68)]">
          Essa ordem será usada para o ranking final da etapa, pontuação anual e histórico. Os pontos por partida continuam preservados.
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
            disabled={orderedPlayers.length === 0}
            onClick={handleConfirm}
            type="button"
          >
            Confirmar ranking
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableStageResultItem({
  player,
  position,
}: {
  player: OrderedStageResultPlayer;
  position: number;
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
      className={`grid gap-3 rounded-[1.15rem] border p-3 shadow-[0_14px_28px_rgba(0,0,0,0.2)] transition md:grid-cols-[auto_auto_minmax(0,1fr)_auto] md:items-center ${
        isDragging
          ? "z-20 scale-[1.01] border-[rgba(255,208,101,0.38)] bg-[rgba(255,183,32,0.16)]"
          : "border-[rgba(129,211,120,0.18)] bg-[rgba(7,24,18,0.72)]"
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

      <span className="flex h-11 min-w-11 items-center justify-center rounded-[0.9rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(255,183,32,0.1)] px-3 text-sm font-black text-[rgba(255,236,184,0.96)]">
        {position}º
      </span>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[rgba(255,244,214,0.96)]">
          {player.playerName}
        </p>
        <div className="mt-1 flex flex-wrap gap-2 text-[0.72rem] text-[rgba(236,225,196,0.56)]">
          <span>{player.totalPoints} pts</span>
          <span>{player.wins} vit.</span>
          <span>{player.secondPlaces} seg.</span>
          <span>{player.thirdPlaces} terc.</span>
          {player.leftStage ? (
            <span className="text-[rgba(255,166,84,0.92)]">saiu da etapa</span>
          ) : null}
        </div>
      </div>

      <span className="rounded-full bg-[rgba(129,211,120,0.14)] px-3 py-1 text-center text-xs font-semibold text-[rgba(222,255,221,0.96)]">
        {formatAnnualPointsPreview(position, player.leftStage)}
      </span>
    </div>
  );
}

function buildInitialStageResultOrder(players: StageResultPlayer[]): OrderedStageResultPlayer[] {
  return players
    .map((player, originalIndex) => ({ ...player, originalIndex }))
    .sort((left, right) => {
      if (right.wins !== left.wins) return right.wins - left.wins;
      if (right.totalPoints !== left.totalPoints) return right.totalPoints - left.totalPoints;
      if (right.secondPlaces !== left.secondPlaces) return right.secondPlaces - left.secondPlaces;
      if (right.thirdPlaces !== left.thirdPlaces) return right.thirdPlaces - left.thirdPlaces;
      return left.originalIndex - right.originalIndex;
    });
}

function formatAnnualPointsPreview(position: number, leftStage: boolean) {
  if (leftStage) {
    return "1 anual";
  }

  if (position === 1) return "10 anual";
  if (position === 2) return "8 anual";
  if (position === 3) return "6 anual";
  if (position === 4) return "4 anual";
  return "2 anual";
}
