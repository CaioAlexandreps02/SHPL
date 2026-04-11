"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { createBrowserSupabaseClient, hasSupabaseEnv } from "@/lib/supabase/client";

export function AuthPanel() {
  const [email, setEmail] = useState("admin@shpl.dev");
  const [password, setPassword] = useState("12345678");
  const [message, setMessage] = useState("Entre com Supabase Auth ou use o modo demonstração.");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseEnv) {
      setMessage("Supabase ainda não configurado. Use o modo demonstração e preencha .env.local para ativar o login real.");
      return;
    }

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setMessage("Não foi possível iniciar o cliente Supabase no navegador.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    setMessage(
      error
        ? `Falha no login: ${error.message}`
        : "Login realizado com sucesso. Você já pode abrir o painel principal."
    );
  }

  return (
    <section className="glass-card rounded-[2rem] border border-white/10 p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-muted text-sm uppercase tracking-[0.2em]">Autenticação</p>
          <h2 className="mt-2 text-3xl font-semibold">Entrar no SHPL</h2>
        </div>
        <span className={`status-pill ${hasSupabaseEnv ? "status-success" : "status-warning"}`}>
          {hasSupabaseEnv ? "Supabase pronto" : "Modo demo"}
        </span>
      </div>

      <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm">
          <span className="text-muted">Email</span>
          <input
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="text-muted">Senha</span>
          <input
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button
          className="mt-2 rounded-full bg-[var(--primary-soft)] px-5 py-3 text-sm font-bold text-[#092514] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={loading}
          type="submit"
        >
          {loading ? "Entrando..." : "Entrar com Supabase"}
        </button>
      </form>

      <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6">
        {message}
      </p>

      <div className="mt-6 grid gap-3">
        <Link
          href="/"
          className="rounded-full border border-white/10 px-5 py-3 text-center text-sm font-medium transition hover:bg-white/5"
        >
          Abrir painel em modo demonstração
        </Link>
        <Link
          href="/settings"
          className="rounded-full border border-white/10 px-5 py-3 text-center text-sm font-medium transition hover:bg-white/5"
        >
          Ver estrutura administrativa
        </Link>
      </div>
    </section>
  );
}
