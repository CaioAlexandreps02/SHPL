"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const payload = (await response.json()) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      setMessage(payload.error ?? "Nao foi possivel concluir a autenticacao.");
      return;
    }

    router.push("/menu");
    router.refresh();
  }

  return (
    <section className="relative w-full max-w-[640px] overflow-hidden rounded-[2rem] border border-[rgba(255,215,120,0.22)] bg-[linear-gradient(180deg,rgba(7,30,20,0.88),rgba(6,22,16,0.94))] p-6 shadow-[0_25px_90px_rgba(0,0,0,0.45)] md:p-8">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,214,107,0.75),transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-24 w-56 -translate-x-1/2 bg-[radial-gradient(circle,rgba(255,191,73,0.35),transparent_70%)] blur-2xl" />

      <div className="mt-7 text-center">
        <p className="text-[0.72rem] uppercase tracking-[0.35em] text-[rgba(240,230,196,0.68)]">
          Login
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-[rgba(255,244,214,0.96)]">
          Acesse sua conta
        </h2>
      </div>

      <form className="mt-8 grid gap-3.5" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm">
          <span className="text-[rgba(235,224,193,0.84)]">Email</span>
          <input
            className="rounded-[1rem] border border-[rgba(255,226,140,0.14)] bg-[rgba(2,18,11,0.72)] px-4 py-3 text-[rgba(255,245,217,0.94)] outline-none transition placeholder:text-[rgba(230,219,190,0.34)] focus:border-[rgba(255,203,82,0.8)] focus:shadow-[0_0_0_3px_rgba(255,198,64,0.12)]"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@email.com"
            required
            type="email"
            value={email}
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="text-[rgba(235,224,193,0.84)]">Senha</span>
          <input
            className="rounded-[1rem] border border-[rgba(255,226,140,0.14)] bg-[rgba(2,18,11,0.72)] px-4 py-3 text-[rgba(255,245,217,0.94)] outline-none transition placeholder:text-[rgba(230,219,190,0.34)] focus:border-[rgba(255,203,82,0.8)] focus:shadow-[0_0_0_3px_rgba(255,198,64,0.12)]"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Digite sua senha"
            required
            type="password"
            value={password}
          />
        </label>

        <div className="mt-1 flex items-center justify-between gap-4 text-sm text-[rgba(235,224,193,0.82)]">
          <label className="flex items-center gap-2">
            <input
              className="h-4 w-4 rounded border border-[rgba(255,214,107,0.3)] bg-transparent accent-[var(--accent)]"
              type="checkbox"
            />
            <span>Lembrar acesso</span>
          </label>
          <span>Esqueceu a senha?</span>
        </div>

        <button
          className="mt-2 rounded-[0.95rem] bg-[linear-gradient(180deg,#ffd86a_0%,#ffbf27_55%,#d98b00_100%)] px-5 py-3.5 text-base font-black uppercase tracking-[0.18em] text-[#2a1a00] shadow-[0_12px_24px_rgba(255,183,0,0.22),inset_0_1px_0_rgba(255,255,255,0.5)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={loading}
          type="submit"
        >
          {loading ? "Processando" : "Log In"}
        </button>
      </form>

      <div className="mt-6 rounded-[1.25rem] border border-[rgba(255,214,107,0.12)] bg-[rgba(255,255,255,0.03)] p-4 text-sm leading-6 text-[rgba(241,232,205,0.82)]">
        {message || "Use sua conta para acessar o menu principal do aplicativo."}
      </div>

      <div className="mt-5 flex items-center justify-center gap-4 text-sm text-[rgba(235,224,193,0.7)]">
        <span>Need help?</span>
        <span className="h-1 w-1 rounded-full bg-[rgba(255,214,107,0.55)]" />
        <span>
          Nao tem conta?{" "}
          <Link className="font-semibold text-[var(--accent)]" href="/signup">
            Cadastre-se
          </Link>
        </span>
      </div>
    </section>
  );
}
