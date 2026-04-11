import { NextResponse } from "next/server";

import { getUserAccessFromCookieHeader, isAdmin } from "@/lib/auth/access";
import { getDemoUserPhotoMap } from "@/lib/auth/demo-users";
import {
  createStoredPlayer,
  deleteStoredPlayer,
  getStoredPlayers,
  updateStoredPlayer,
} from "@/lib/data/demo-admin-store";

export async function GET() {
  const players = await attachPlayerPhotos(await getStoredPlayers());
  return NextResponse.json({ players });
}

export async function POST(request: Request) {
  const access = await getUserAccessFromCookieHeader(request.headers.get("cookie") ?? "");

  if (!isAdmin(access)) {
    return NextResponse.json({ error: "Apenas administradores podem editar participantes." }, { status: 403 });
  }

  try {
    const { name } = (await request.json()) as { name?: string };
    const player = await createStoredPlayer({ name: name ?? "" });
    return NextResponse.json({ player: (await attachPlayerPhotos([player]))[0] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel criar o participante." },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  const access = await getUserAccessFromCookieHeader(request.headers.get("cookie") ?? "");

  if (!isAdmin(access)) {
    return NextResponse.json({ error: "Apenas administradores podem editar participantes." }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const player = await updateStoredPlayer(payload);
    return NextResponse.json({ player: (await attachPlayerPhotos([player]))[0] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel atualizar o participante." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const access = await getUserAccessFromCookieHeader(request.headers.get("cookie") ?? "");

  if (!isAdmin(access)) {
    return NextResponse.json({ error: "Apenas administradores podem editar participantes." }, { status: 403 });
  }

  try {
    const { playerId } = (await request.json()) as { playerId?: string };

    if (!playerId) {
      return NextResponse.json({ error: "Informe o participante a excluir." }, { status: 400 });
    }

    await deleteStoredPlayer(playerId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel excluir o participante." }, { status: 400 });
  }
}

async function attachPlayerPhotos<T extends { email: string }>(players: T[]) {
  const photoByEmail = await getDemoUserPhotoMap();

  return players.map((player) => ({
    ...player,
    photoDataUrl: player.email
      ? (photoByEmail.get(player.email.trim().toLowerCase()) ?? "")
      : "",
  }));
}
