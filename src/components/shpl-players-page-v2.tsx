"use client";

import { useEffect, useMemo, useState } from "react";

import { PlayerAvatar } from "@/components/player-avatar";
import type { LeagueSnapshot } from "@/lib/domain/types";

type PlayerRosterEntry = {
  id: string;
  fullName: string;
  nickname: string;
  status: "Ativo" | "Inativo" | "Novo cadastro";
  birthDate: string;
  email: string;
  extraRoles: Array<"Dealer" | "Administrador">;
  active: boolean;
  photoDataUrl?: string;
};

export function SHPLPlayersPageV2({ snapshot }: { snapshot: LeagueSnapshot }) {
  const initialPlayers = useMemo<PlayerRosterEntry[]>(
    () =>
      snapshot.annualRanking.map((entry) => ({
        id: entry.playerId,
        fullName: entry.playerName,
        nickname: entry.playerName,
        status: "Ativo",
        birthDate: "",
        email: "",
        extraRoles: [],
        active: true,
        photoDataUrl: entry.photoDataUrl ?? "",
      })),
    [snapshot.annualRanking]
  );

  const [players, setPlayers] = useState(initialPlayers);
  const [isAdding, setIsAdding] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [draftPlayer, setDraftPlayer] = useState<PlayerRosterEntry | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPlayers() {
      const response = await fetch("/api/shpl-admin/players", { cache: "no-store" });
      const payload = (await response.json()) as { players?: PlayerRosterEntry[] };

      if (!cancelled && payload.players) {
        setPlayers(payload.players);
      }
    }

    void loadPlayers();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAddPlayer() {
    const normalizedName = newPlayerName.trim();

    if (!normalizedName) {
      return;
    }

    const alreadyExists = players.some(
      (player) =>
        player.fullName.toLowerCase() === normalizedName.toLowerCase() ||
        player.nickname.toLowerCase() === normalizedName.toLowerCase()
    );

    if (alreadyExists) {
      return;
    }

    const response = await fetch("/api/shpl-admin/players", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: normalizedName,
      }),
    });
    const payload = (await response.json()) as {
      player?: PlayerRosterEntry;
      error?: string;
    };

    if (!response.ok || !payload.player) {
      setMessage(payload.error ?? "Nao foi possivel criar o participante.");
      return;
    }

    const createdPlayer = payload.player;

    setPlayers((currentPlayers) => [...currentPlayers, createdPlayer]);
    setNewPlayerName("");
    setIsAdding(false);
    setMessage("Participante adicionado com sucesso.");
  }

  async function handleDeletePlayer(playerId: string) {
    const response = await fetch("/api/shpl-admin/players", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ playerId }),
    });

    if (!response.ok) {
      setMessage("Nao foi possivel excluir o participante.");
      return;
    }

    setPlayers((currentPlayers) => currentPlayers.filter((player) => player.id !== playerId));
    setSelectedPlayerId(null);
    setDraftPlayer(null);
    setMessage("Participante excluido com sucesso.");
  }

  function handleOpenPlayer(playerId: string) {
    const player = players.find((currentPlayer) => currentPlayer.id === playerId);
    setSelectedPlayerId(playerId);
    setDraftPlayer(player ?? null);
  }

  function handleClosePlayerModal() {
    setSelectedPlayerId(null);
    setDraftPlayer(null);
  }

  function updateDraftPlayer(
    field: keyof Pick<
      PlayerRosterEntry,
      "fullName" | "nickname" | "birthDate" | "status" | "email"
    >,
    value: string
  ) {
    setDraftPlayer((currentPlayer) =>
      currentPlayer
        ? {
            ...currentPlayer,
            [field]: value,
          }
        : null
    );
  }

  function toggleDraftExtraRole(role: "Dealer" | "Administrador") {
    setDraftPlayer((currentPlayer) => {
      if (!currentPlayer) {
        return null;
      }

      const hasRole = currentPlayer.extraRoles.includes(role);

      return {
        ...currentPlayer,
        extraRoles: hasRole
          ? currentPlayer.extraRoles.filter((currentRole) => currentRole !== role)
          : [...currentPlayer.extraRoles, role],
      };
    });
  }

  async function handleSavePlayer() {
    if (!draftPlayer) {
      return;
    }

    const response = await fetch("/api/shpl-admin/players", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...draftPlayer,
        fullName: draftPlayer.fullName.trim(),
        nickname: draftPlayer.nickname.trim() || draftPlayer.fullName.trim(),
      }),
    });
    const payload = (await response.json()) as {
      player?: PlayerRosterEntry;
      error?: string;
    };

    if (!response.ok || !payload.player) {
      setMessage(payload.error ?? "Nao foi possivel salvar o participante.");
      return;
    }

    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => (player.id === payload.player?.id ? payload.player : player))
    );
    setMessage("Participante atualizado com sucesso.");
    handleClosePlayerModal();
  }

  return (
    <section className="rounded-[1.8rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.28)] md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[rgba(236,225,196,0.68)]">
            SHPL 2026
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[rgba(255,244,214,0.96)] md:text-4xl">
            Participantes
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[rgba(236,225,196,0.74)]">
            Cadastre participantes do campeonato, mantenha o email vinculado e defina o apelido
            que sera usado nas mesas, rankings e historicos.
          </p>
        </div>

        <button
          className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(255,208,101,0.24)] bg-[linear-gradient(180deg,#ffd54e_0%,#c88807_100%)] text-2xl font-semibold text-[#2a1a00] shadow-[0_10px_20px_rgba(255,183,32,0.2)] transition hover:scale-[1.02]"
          onClick={() => setIsAdding((currentValue) => !currentValue)}
          type="button"
        >
          +
        </button>
      </div>

      {isAdding ? (
        <div className="mt-5 rounded-[1.3rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] p-4">
          <label
            className="text-sm font-medium text-[rgba(255,236,184,0.92)]"
            htmlFor="new-player-name"
          >
            Nome completo do novo participante
          </label>
          <div className="mt-3 flex flex-col gap-3 md:flex-row">
            <input
              className="h-12 flex-1 rounded-[0.95rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none placeholder:text-[rgba(236,225,196,0.4)]"
              id="new-player-name"
              onChange={(event) => setNewPlayerName(event.target.value)}
              placeholder="Digite o nome completo do jogador"
              value={newPlayerName}
            />
            <button
              className="h-12 rounded-[0.95rem] border border-[rgba(255,208,101,0.2)] bg-[rgba(255,183,32,0.12)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.98)] transition hover:bg-[rgba(255,183,32,0.18)]"
              onClick={handleAddPlayer}
              type="button"
            >
              Adicionar participante
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="mt-5 rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgba(255,236,184,0.9)]">
          {message}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {players.map((player, index) => {
          const isSelected = player.id === selectedPlayerId;

          return (
            <article
              key={player.id}
              className={`grid gap-3 rounded-[1.25rem] border px-4 py-4 transition md:grid-cols-[72px_minmax(0,1fr)_120px] md:items-center ${
                isSelected
                  ? "border-[rgba(255,208,101,0.24)] bg-[linear-gradient(180deg,rgba(255,183,32,0.08),rgba(255,255,255,0.03))]"
                  : "border-[rgba(255,208,101,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))]"
              }`}
            >
              <button
                className="contents text-left"
                onClick={() => handleOpenPlayer(player.id)}
                type="button"
              >
                <div className="flex items-center gap-3">
                  <PlayerAvatar
                    name={player.nickname || player.fullName}
                    photoDataUrl={player.photoDataUrl}
                    size="md"
                  />
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(180deg,#ffcf46_0%,#d8970a_100%)] text-sm font-black text-[#2a1a00]">
                    {index + 1}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold text-[rgba(255,244,214,0.96)]">
                    {player.nickname}
                  </p>
                  <p className="mt-1 text-sm text-[rgba(236,225,196,0.62)]">
                    {player.fullName} • {buildParticipantSummary(player)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[rgba(236,225,196,0.48)]">
                    Status
                  </p>
                  <p className="mt-1 text-sm font-medium text-[rgba(167,229,178,0.92)]">
                    {player.status}
                  </p>
                </div>
              </button>
            </article>
          );
        })}
      </div>

      {draftPlayer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Fechar ficha do participante"
            className="absolute inset-0 bg-[rgba(2,10,7,0.72)] backdrop-blur-[3px]"
            onClick={handleClosePlayerModal}
            type="button"
          />

          <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.45rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,0.99))] p-5 shadow-[0_28px_60px_rgba(0,0,0,0.42)] md:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-[rgba(255,208,101,0.1)] pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[rgba(236,225,196,0.48)]">
                  Ficha do participante
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
                  {draftPlayer.nickname}
                </h2>
              </div>

              <button
                className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] text-lg font-semibold text-[rgba(255,244,214,0.8)] transition hover:bg-[rgba(255,255,255,0.05)]"
                onClick={handleClosePlayerModal}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid flex-1 gap-4 overflow-y-auto pr-1">
              <div className="flex items-center gap-4 rounded-[1.1rem] border border-[rgba(255,208,101,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
                <PlayerAvatar
                  name={draftPlayer.nickname || draftPlayer.fullName}
                  photoDataUrl={draftPlayer.photoDataUrl}
                  size="lg"
                />
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                    Foto vinculada
                  </p>
                  <p className="mt-1 text-sm text-[rgba(236,225,196,0.72)]">
                    A imagem vem da conta vinculada pelo e-mail do participante.
                  </p>
                </div>
              </div>

              <Field label="Nome completo">
                <input
                  className={inputClassName}
                  onChange={(event) => updateDraftPlayer("fullName", event.target.value)}
                  value={draftPlayer.fullName}
                />
              </Field>

              <Field label="Apelido">
                <input
                  className={inputClassName}
                  onChange={(event) => updateDraftPlayer("nickname", event.target.value)}
                  value={draftPlayer.nickname}
                />
              </Field>

              <Field label="Data de nascimento">
                <input
                  className={inputClassName}
                  onChange={(event) => updateDraftPlayer("birthDate", event.target.value)}
                  type="date"
                  value={draftPlayer.birthDate}
                />
              </Field>

              <Field label="Status">
                <select
                  className={inputClassName}
                  onChange={(event) => updateDraftPlayer("status", event.target.value)}
                  value={draftPlayer.status}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Novo cadastro">Novo cadastro</option>
                </select>
              </Field>

              <Field label="Email vinculado">
                <input
                  className={inputClassName}
                  onChange={(event) => updateDraftPlayer("email", event.target.value)}
                  placeholder="voce@email.com"
                  type="email"
                  value={draftPlayer.email}
                />
              </Field>

              <Field label="Funcao do sistema">
                <div className="rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 py-3 text-sm text-[rgba(255,244,214,0.92)]">
                  Jogador
                </div>
              </Field>

              <Field label="Funcao secundaria">
                <div className="grid gap-2 md:grid-cols-2">
                  <button
                    className={
                      draftPlayer.extraRoles.includes("Dealer")
                        ? selectedToggleClassName
                        : toggleClassName
                    }
                    onClick={() => toggleDraftExtraRole("Dealer")}
                    type="button"
                  >
                    Dealer
                  </button>
                  <button
                    className={
                      draftPlayer.extraRoles.includes("Administrador")
                        ? selectedToggleClassName
                        : toggleClassName
                    }
                    onClick={() => toggleDraftExtraRole("Administrador")}
                    type="button"
                  >
                    Administrador
                  </button>
                </div>
              </Field>

              <div className="rounded-[1.1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                  Resumo
                </p>
                <p className="mt-2 text-lg font-semibold text-[rgba(255,244,214,0.96)]">
                  {draftPlayer.nickname}
                </p>
                <p className="mt-1 text-sm text-[rgba(236,225,196,0.68)]">
                  Nome completo: {draftPlayer.fullName}
                </p>
                <p className="mt-1 text-sm text-[rgba(236,225,196,0.68)]">
                  Status atual: {draftPlayer.status} • Acesso: {buildParticipantSummary(draftPlayer)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-[rgba(255,208,101,0.1)] pt-4 sm:flex-row sm:justify-between">
              <button
                className="h-11 rounded-[0.95rem] border border-[rgba(255,132,92,0.24)] bg-[rgba(255,132,92,0.08)] px-5 text-sm font-semibold text-[rgba(255,203,184,0.96)] transition hover:bg-[rgba(255,132,92,0.14)]"
                onClick={() => handleDeletePlayer(draftPlayer.id)}
                type="button"
              >
                Excluir participante
              </button>

              <button
                className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.22)] bg-[linear-gradient(180deg,#ffd54e_0%,#c88807_100%)] px-5 text-sm font-semibold text-[#2a1a00]"
                onClick={handleSavePlayer}
                type="button"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function buildParticipantSummary(player: PlayerRosterEntry) {
  return ["Jogador", ...player.extraRoles].join(" • ");
}

const inputClassName =
  "h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none";

const toggleClassName =
  "h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm font-medium text-[rgba(255,244,214,0.82)] transition hover:border-[rgba(255,208,101,0.22)]";

const selectedToggleClassName =
  "h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.28)] bg-[rgba(255,183,32,0.12)] px-4 text-sm font-semibold text-[rgba(255,236,184,0.98)]";
