import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-grid flex min-h-screen items-center justify-center px-6 py-10">
      <div className="glass-card max-w-xl rounded-[2rem] p-8 text-center">
        <span className="status-pill status-warning">Rota não encontrada</span>
        <h1 className="mt-5 text-4xl font-semibold">Etapa ou tela inválida.</h1>
        <p className="text-muted mt-4 leading-7">
          A rota solicitada não existe no snapshot atual do campeonato. Volte para o painel principal para continuar operando a mesa.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[#18200b]"
        >
          Voltar ao painel
        </Link>
      </div>
    </main>
  );
}
