"use client";

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

type EditMatchPlayer = {
  playerId: string;
  playerName: string;
  currentPoints: number;
  hasParticipated: boolean;
};

type EditMatchData = {
  matchIndex: number;
  matchNumber: number;
  durationSeconds: number;
  players: EditMatchPlayer[];
};

export type EditMatchResultsModalProps = {
  isOpen: boolean;
  matches: EditMatchData[];
  onConfirm: (reorderedPlayerIdsByMatch: Record<number, string[]>) => void;
  onCancel: () => void;
};

type OrderedPlayer = EditMatchPlayer & {
  originalIndex: number;
};

function buildInitialOrder(players: EditMatchPlayer[]): OrderedPlayer[] {
  return players
    .map((player, originalIndex) => ({ ...player, originalIndex }))
    .sort((left, right) => {
      if (left.hasParticipated !== right.hasParticipated) {
        return left.hasParticipated ? -1 : 1;
      }
      if (left.currentPoints !== right.currentPoints) {
        return right.currentPoints - left.currentPoints;
      }
      return left.originalIndex - right.originalIndex;
    });
}

function formatClock(totalSeconds: number) {
  const safe = Math.max(totalSeconds, 0);
  const m = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const s = (safe % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function SortableEditMatchItem({
  player,
  placement,
  points,
  isRanked,
}: {
  player: OrderedPlayer;
  placement: number;
  points: number;
  isRanked: boolean;
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
      className={`flex items-center gap-3 rounded-[1rem] border px-3 py-2.5 transition ${
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
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.8rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] text-lg text-[rgba(255,236,184,0.72)] transition hover:bg-[rgba(255,255,255,0.06)]"
        type="button"
      >
        &#x2801;&#x2801;
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[rgba(255,244,214,0.96)]">
          {player.playerName}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[0.72rem] font-semibold ${
            isRanked
              ? "border-[rgba(255,208,101,0.18)] bg-[rgba(255,183,32,0.1)] text-[rgba(255,236,184,0.96)]"
              : "border-[rgba(236,225,196,0.1)] bg-[rgba(255,255,255,0.03)] text-[rgba(236,225,196,0.52)]"
          }`}
        >
          {isRanked ? `${placement}o` : "-"}
        </span>
        <span
          className={`min-w-[48px] rounded-full px-2.5 py-0.5 text-center text-[0.72rem] font-semibold ${
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

function EditMatchSection({
  match,
  onReorder,
}: {
  match: EditMatchData;
  onReorder: (matchIndex: number, orderedPlayerIds: string[]) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [orderedPlayers, setOrderedPlayers] = useState<OrderedPlayer[]>(() =>
    buildInitialOrder(match.players),
  );

  const rankedCount = useMemo(
    () => match.players.filter((p) => p.hasParticipated).length,
    [match.players],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedPlayers((current) => {
      const oldIndex = current.findIndex((p) => p.playerId === active.id);
      const newIndex = current.findIndex((p) => p.playerId === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      const next = arrayMove(current, oldIndex, newIndex);
      onReorder(match.matchIndex, next.map((p) => p.playerId));
      return next;
    });
  }

  const hasChanges = useMemo(() => {
    const original = buildInitialOrder(match.players);
    return orderedPlayers.some((p, i) => p.playerId !== original[i]?.playerId);
  }, [orderedPlayers, match.players]);

  return (
    <div className="rounded-[1.15rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)]">
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[rgba(255,255,255,0.02)]"
        onClick={() => setIsExpanded((prev) => !prev)}
        type="button"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(236,225,196,0.54)]">
            Partida {match.matchNumber}
          </span>
          <span className="text-[0.72rem] text-[rgba(236,225,196,0.42)]">
            {formatClock(match.durationSeconds)}
          </span>
          {hasChanges ? (
            <span className="rounded-full bg-[rgba(255,183,32,0.14)] px-2 py-0.5 text-[0.68rem] font-semibold text-[rgba(255,236,184,0.92)]">
              Alterado
            </span>
          ) : null}
        </div>
        <span className="text-[rgba(236,225,196,0.42)] transition-transform" style={{ transform: isExpanded ? "rotate(180deg)" : undefined }}>
          &#x25BC;
        </span>
      </button>

      {isExpanded ? (
        <div className="border-t border-[rgba(255,208,101,0.08)] px-4 pb-4 pt-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={orderedPlayers.map((p) => p.playerId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid gap-2">
                {orderedPlayers.map((player, index) => {
                  const isRanked = index < rankedCount;
                  return (
                    <SortableEditMatchItem
                      key={player.playerId}
                      isRanked={isRanked}
                      placement={index + 1}
                      player={player}
                      points={isRanked ? calculateMatchPoints(index + 1) : 0}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ) : null}
    </div>
  );
}

export function EditMatchResultsModal({
  isOpen,
  matches,
  onConfirm,
  onCancel,
}: EditMatchResultsModalProps) {
  const [reorderHistory, setReorderHistory] = useState<Record<number, string[]>>({});

  function handleReorder(matchIndex: number, orderedPlayerIds: string[]) {
    setReorderHistory((prev) => ({ ...prev, [matchIndex]: orderedPlayerIds }));
  }

  function handleConfirm() {
    const result: Record<number, string[]> = {};

    matches.forEach((match) => {
      const reordered = reorderHistory[match.matchIndex];
      if (reordered) {
        result[match.matchIndex] = reordered;
      }
    });

    onConfirm(result);
  }

  if (!isOpen) return null;

  const hasAnyChange = Object.keys(reorderHistory).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Cancelar edicao de resultados"
        className="absolute inset-0 bg-[rgba(2,10,7,0.76)] backdrop-blur-[3px]"
        onClick={onCancel}
        type="button"
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col rounded-[1.55rem] border border-[rgba(255,208,101,0.18)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] p-5 shadow-[0_28px_60px_rgba(0,0,0,0.48)] md:p-6">
        <div className="border-b border-[rgba(255,208,101,0.1)] pb-5">
          <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
            Editar resultados
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
            Corrigir classificacao
          </h2>
          <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.72)]">
            Expanda a partida, arraste os jogadores para reordenar e confirme. Os pontos serao recalculados automaticamente.
          </p>
        </div>

        <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {matches.length === 0 ? (
            <div className="rounded-[1.15rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-5 text-sm text-[rgba(236,225,196,0.72)]">
              Nenhuma partida finalizada ainda.
            </div>
          ) : (
            matches.map((match) => (
              <EditMatchSection
                key={`edit-match-${match.matchIndex}`}
                match={match}
                onReorder={handleReorder}
              />
            ))
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
            disabled={!hasAnyChange}
            onClick={handleConfirm}
            type="button"
          >
            Aplicar alteracoes
          </button>
        </div>
      </div>
    </div>
  );
}
