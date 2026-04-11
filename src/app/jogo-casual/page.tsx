import Link from "next/link";

import { UserProfileFab } from "@/components/user-profile-fab";

export default function CasualGamePage() {
  return (
    <main className="app-grid flex min-h-screen items-center justify-center px-4 py-8">
      <UserProfileFab />

      <div className="glass-card w-full max-w-3xl rounded-[2.5rem] border border-white/10 p-8 text-center md:p-12">
        <p className="text-muted text-xs uppercase tracking-[0.35em]">
          Jogo casual
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          Modulo reservado
        </h1>
        <p className="text-muted mt-6 text-lg leading-8">
          Esta area ficou separada para implementarmos depois, como voce pediu.
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold"
            href="/"
          >
            Voltar ao menu principal
          </Link>
        </div>
      </div>
    </main>
  );
}
