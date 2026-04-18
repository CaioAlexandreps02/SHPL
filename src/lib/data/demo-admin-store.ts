import { createMockSnapshot } from "@/lib/data/mock";
import {
  readServerJsonDocument,
  writeServerJsonDocument,
} from "@/lib/data/server-json-store";
import type { StageStatus } from "@/lib/domain/types";

export type StoredPlayerRecord = {
  id: string;
  fullName: string;
  nickname: string;
  active: boolean;
  birthDate: string;
  email: string;
  status: "Ativo" | "Inativo" | "Novo cadastro";
  extraRoles: Array<"Dealer" | "Administrador">;
};

export type StoredStageRecord = {
  id: string;
  title: string;
  stageDate: string;
  status: StageStatus;
};

type AdminStoreData = {
  players: StoredPlayerRecord[];
  stages: StoredStageRecord[];
};

const adminStoreDocumentName = "demo-admin-store.json";
const DEFAULT_ADMIN_EMAIL = "caioporto100@gmail.com";
const DEFAULT_ADMIN_NAME = "Caio Alexandre";

function buildDefaultAdminStore(): AdminStoreData {
  const snapshot = createMockSnapshot();

  return {
    players: snapshot.annualRanking.map((entry) => {
      const isDefaultAdmin = entry.playerName.trim().toLowerCase() === "caio";

      return {
        id: entry.playerId,
        fullName: isDefaultAdmin ? DEFAULT_ADMIN_NAME : entry.playerName,
        nickname: entry.playerName,
        active: true,
        birthDate: "",
        email: isDefaultAdmin ? DEFAULT_ADMIN_EMAIL : "",
        status: "Ativo",
        extraRoles: isDefaultAdmin ? ["Administrador"] : [],
      };
    }),
    stages: [
      ...snapshot.history.map((stage) => ({
        id: stage.id,
        title: stage.title,
        stageDate: buildIsoDateFromHistoryLabel(stage.stageDateLabel),
        status: "finished" as const,
      })),
      {
        id: snapshot.currentStage.id,
        title: snapshot.currentStage.title,
        stageDate: snapshot.currentStage.stageDate,
        status: snapshot.currentStage.status,
      },
      ...snapshot.upcomingStages.map((stage) => ({
        id: stage.id,
        title: stage.title,
        stageDate: stage.stageDate,
        status: stage.status,
      })),
    ],
  };
}

function normalizeStoredPlayer(player: StoredPlayerRecord) {
  const fullName =
    player.fullName ?? (player as StoredPlayerRecord & { name?: string }).name ?? "";
  const nickname =
    player.nickname ?? (player as StoredPlayerRecord & { name?: string }).name ?? "";
  const matchesDefaultAdmin =
    fullName.trim().toLowerCase() === DEFAULT_ADMIN_NAME.toLowerCase() ||
    nickname.trim().toLowerCase() === "caio";

  const extraRoles = new Set(player.extraRoles ?? []);
  let email = player.email ?? "";

  if (matchesDefaultAdmin) {
    email = DEFAULT_ADMIN_EMAIL;
    extraRoles.add("Administrador");
  }

  return {
    ...player,
    fullName: matchesDefaultAdmin ? DEFAULT_ADMIN_NAME : fullName,
    nickname: nickname || fullName,
    email,
    extraRoles: [...extraRoles],
  };
}

async function readStore() {
  const parsed = await readServerJsonDocument(adminStoreDocumentName, buildDefaultAdminStore);
  const normalizedPlayers = parsed.players.map(normalizeStoredPlayer);
  const didChangePlayers = JSON.stringify(normalizedPlayers) !== JSON.stringify(parsed.players);

  if (didChangePlayers) {
    await writeServerJsonDocument(adminStoreDocumentName, {
      ...parsed,
      players: normalizedPlayers,
    });
  }

  return {
    players: normalizedPlayers,
    stages: parsed.stages,
  };
}

async function writeStore(data: AdminStoreData) {
  await writeServerJsonDocument(adminStoreDocumentName, data);
}

export async function getStoredPlayers() {
  const store = await readStore();
  return store.players;
}

export async function createStoredPlayer(input: {
  name: string;
}) {
  const store = await readStore();
  const normalizedName = input.name.trim();

  if (!normalizedName) {
    throw new Error("Informe o nome do participante.");
  }

  if (
    store.players.some(
      (player) =>
        player.fullName.toLowerCase() === normalizedName.toLowerCase() ||
        player.nickname.toLowerCase() === normalizedName.toLowerCase()
    )
  ) {
    throw new Error("Ja existe um participante com esse nome.");
  }

  const player: StoredPlayerRecord = {
    id: `player-${Date.now()}`,
    fullName: normalizedName,
    nickname: normalizedName,
    active: true,
    birthDate: "",
    email: "",
    status: "Novo cadastro",
    extraRoles: [],
  };

  store.players.push(player);
  await writeStore(store);
  return player;
}

export async function updateStoredPlayer(input: StoredPlayerRecord) {
  const store = await readStore();
  const playerIndex = store.players.findIndex((player) => player.id === input.id);

  if (playerIndex < 0) {
    throw new Error("Participante nao encontrado.");
  }

  store.players[playerIndex] = {
    ...input,
    fullName: input.fullName.trim(),
    nickname: input.nickname.trim() || input.fullName.trim(),
  };

  await writeStore(store);
  return store.players[playerIndex];
}

export async function deleteStoredPlayer(playerId: string) {
  const store = await readStore();
  store.players = store.players.filter((player) => player.id !== playerId);
  await writeStore(store);
}

export async function getStoredStages() {
  const store = await readStore();
  return store.stages.sort((left, right) => left.stageDate.localeCompare(right.stageDate));
}

export async function saveStoredStage(input: StoredStageRecord) {
  const store = await readStore();
  const nextStage = {
    ...input,
    title: input.title.trim(),
  };
  const existingIndex = store.stages.findIndex((stage) => stage.id === input.id);

  if (existingIndex >= 0) {
    store.stages[existingIndex] = nextStage;
  } else {
    store.stages.push(nextStage);
  }

  store.stages.sort((left, right) => left.stageDate.localeCompare(right.stageDate));
  await writeStore(store);
  return nextStage;
}

export async function deleteStoredStage(stageId: string) {
  const store = await readStore();
  store.stages = store.stages.filter((stage) => stage.id !== stageId);
  await writeStore(store);
}

export async function resolveParticipantAccessByEmail(email: string) {
  const store = await readStore();
  const normalizedEmail = email.trim().toLowerCase();
  const participant = store.players.find(
    (player) => player.email.trim().toLowerCase() === normalizedEmail
  );

  if (!participant) {
    return {
      isParticipant: false,
      roles: ["Visitante"] as string[],
      participant: null,
    };
  }

  return {
    isParticipant: true,
    roles: ["Jogador", ...participant.extraRoles],
    participant,
  };
}

function buildIsoDateFromHistoryLabel(label: string) {
  const monthMap: Record<string, string> = {
    janeiro: "01",
    fevereiro: "02",
    marco: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12",
  };

  const match = label.match(/(\d{2}) de ([a-z]+) de (\d{4})/i);
  if (!match) {
    return "2026-01-01";
  }

  const [, day, monthName, year] = match;
  return `${year}-${monthMap[monthName.toLowerCase()] ?? "01"}-${day}`;
}
