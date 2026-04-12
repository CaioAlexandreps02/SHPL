import { NextResponse } from "next/server";

import { createDemoUser } from "@/lib/auth/demo-users";
import { createSessionValue, AUTH_COOKIE, getAuthCookieOptions } from "@/lib/auth/session";
import { createServerSupabaseClient, hasSupabaseServerEnv } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email, password, fullName } = await request.json();

  if (!fullName || !email || !password) {
    return NextResponse.json(
      { error: "Preencha nome, email e senha para criar a conta." },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "A senha precisa ter pelo menos 6 caracteres." },
      { status: 400 }
    );
  }

  if (hasSupabaseServerEnv) {
    const supabase = createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Não foi possível iniciar o Supabase." },
        { status: 500 }
      );
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  } else {
    try {
      await createDemoUser({ fullName, email, password });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar o cadastro.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE, createSessionValue(email), getAuthCookieOptions());

  return response;
}
