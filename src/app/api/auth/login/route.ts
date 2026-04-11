import { NextResponse } from "next/server";

import { validateDemoUser } from "@/lib/auth/demo-users";
import { createSessionValue, AUTH_COOKIE } from "@/lib/auth/session";
import { createServerSupabaseClient, hasSupabaseServerEnv } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Informe email e senha para entrar." },
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

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
  } else {
    const user = await validateDemoUser({ email, password });

    if (!user) {
      return NextResponse.json(
        { error: "Login invalido. Verifique se voce ja fez o cadastro." },
        { status: 401 }
      );
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE, createSessionValue(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });

  return response;
}
