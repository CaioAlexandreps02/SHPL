import type { BlindLevel, ChipSetItem } from "@/lib/domain/types";

export function SettingsPanel({
  blindStructure,
  chipSet,
}: {
  blindStructure: BlindLevel[];
  chipSet: ChipSetItem[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <section className="glass-card rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-muted text-xs uppercase tracking-[0.25em]">Configuracoes de blinds</p>
            <h2 className="mt-2 text-2xl font-semibold">Estrutura padrao da etapa</h2>
          </div>
          <span className="status-pill status-success">Admin</span>
        </div>

        <div className="mt-6 grid gap-3">
          {blindStructure.map((level) => (
            <div
              key={level.levelNumber}
              className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm"
            >
              <span>Level {level.levelNumber}</span>
              <span className="font-semibold">
                {level.smallBlind} / {level.bigBlind}
                {level.ante && level.ante > 0 ? ` / ante ${level.ante}` : ""}
              </span>
              <span className="text-muted">{level.durationMinutes} min</span>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card rounded-[2rem] p-6">
        <div>
          <p className="text-muted text-xs uppercase tracking-[0.25em]">Kit de fichas</p>
          <h2 className="mt-2 text-2xl font-semibold">Stack e distribuicao</h2>
          <p className="text-muted mt-2 text-sm">
            Estrutura pronta para calculo automatico e validacao do kit real.
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          {chipSet.map((chip) => (
            <div
              key={`${chip.color}-${chip.value}`}
              className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-5 w-5 rounded-full border border-white/30"
                  style={{ backgroundColor: chip.color }}
                />
                <span className="font-semibold">R$ {chip.value}</span>
              </div>
              <span className="text-muted">{chip.quantity} fichas</span>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-[var(--primary)]/30 p-5">
          <p className="text-sm font-semibold">Proximos passos administrativos</p>
          <ul className="text-muted mt-3 grid gap-2 text-sm leading-6">
            <li>Salvar presets de blind por etapa.</li>
            <li>Definir cronometros rapidos do call the clock.</li>
            <li>Automatizar calculadora de stack por numero de jogadores.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
