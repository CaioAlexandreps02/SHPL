import type { Stage } from "@/lib/domain/types";

export function StageQueue({ stages }: { stages: Stage[] }) {
  return (
    <section className="glass-card rounded-[2rem] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-muted text-xs uppercase tracking-[0.25em]">Agenda</p>
          <h2 className="mt-2 text-2xl font-semibold">Próximas etapas</h2>
        </div>
        <span className="status-pill status-neutral">Planejamento</span>
      </div>

      <div className="mt-6 grid gap-3">
        {stages.map((stage) => (
          <article
            key={stage.id}
            className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">{stage.title}</p>
                <p className="text-muted mt-1 text-sm">{stage.stageDateLabel}</p>
              </div>
              <span className="status-pill status-warning">
                {stage.status === "scheduled" ? "Agendada" : "Em jogo"}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
