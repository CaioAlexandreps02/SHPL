import { NextResponse } from "next/server";

import { getUserAccessFromCookieHeader } from "@/lib/auth/access";
import { getDemoUserByEmail, updateDemoUserProfile } from "@/lib/auth/demo-users";
import { AUTH_COOKIE, createSessionValue } from "@/lib/auth/session";
import { resolveParticipantAccessByEmail } from "@/lib/data/demo-admin-store";
import { hasSupabaseServerEnv } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const access = await getUserAccessFromCookieHeader(cookieHeader);

  if (!access) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }

  const [user, participantAccess] = await Promise.all([
    getDemoUserByEmail(access.email),
    resolveParticipantAccessByEmail(access.email),
  ]);

  return NextResponse.json({
    fullName: user?.fullName ?? access.email.split("@")[0],
    email: access.email,
    isParticipant: access.isParticipant,
    roles: access.roles,
    photoDataUrl: user?.photoDataUrl ?? "",
    participantName:
      participantAccess.participant?.nickname ||
      participantAccess.participant?.fullName ||
      "",
  });
}

export async function PUT(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const access = await getUserAccessFromCookieHeader(cookieHeader);

  if (!access) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }

  if (hasSupabaseServerEnv) {
    return NextResponse.json(
      { error: "Edicao de perfil via Supabase ainda nao foi configurada neste ambiente." },
      { status: 501 }
    );
  }

  const { fullName, email, password, photoDataUrl } = await request.json();

  try {
    const updatedUser = await updateDemoUserProfile({
      currentEmail: access.email,
      fullName,
      nextEmail: email,
      password,
      photoDataUrl,
    });

    const refreshedAccess = await getUserAccessFromCookieHeader(
      `${AUTH_COOKIE}=${createSessionValue(updatedUser.email)}`
    );
    const participantAccess = await resolveParticipantAccessByEmail(updatedUser.email);
    const response = NextResponse.json({
      success: true,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      photoDataUrl: updatedUser.photoDataUrl ?? "",
      roles: refreshedAccess?.roles ?? ["Visitante"],
      isParticipant: refreshedAccess?.isParticipant ?? false,
      participantName:
        participantAccess.participant?.nickname ||
        participantAccess.participant?.fullName ||
        "",
    });

    response.cookies.set(AUTH_COOKIE, createSessionValue(updatedUser.email), {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Nao foi possivel atualizar o perfil.",
      },
      { status: 400 }
    );
  }
}
