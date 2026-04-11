import type { StagePlayerSnapshot } from "@/lib/domain/types";

const statusClassMap = {
  neutral: "status-neutral",
  warning: "status-warning",
  success: "status-success",
  danger: "status-danger",
} as const;

export function StagePlayersTable({
  players,
}: {
  players: StagePlayerSnapshot[];
}) {
  return (
    <section className="glass-card rounded-[2rem] p-6">
      <div>
        <p className="text-muted text-xs uppercase tracking-[0.25em]">Jogadores da etapa</p>
        <h2 className="mt-2 text-2xl font-semibold">Status operacional</h2>
        <p className="text-muted mt-2 text-sm">
          Linha financeira e de jogo pronta para buy-ins, eliminações e saída antecipada.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5">
            <tr>
              {["Jogador", "Status", "Anual", "Dia", "Pontos", "Partida atual", "Ações"].map((label) => (
                <th
                  key={label}
                  className="px-4 py-3 text-left font-semibold text-[var(--muted)]"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {players.map((player) => (
              <tr key={player.playerId} className="bg-black/10 align-top">
                <td className="px-4 py-4 font-semibold">{player.playerName}</td>
                <td className="px-4 py-4">
                  <span className={`status-pill ${statusClassMap[player.visualStatus]}`}>
                    {player.statusLabel}
                  </span>
                </td>
                <td className="px-4 py-4">{player.paidAnnual ? "Pago" : "-"}</td>
                <td className="px-4 py-4">{player.paidDaily ? "Pago" : "-"}</td>
                <td className="px-4 py-4 font-semibold">{player.dayPoints}</td>
                <td className="px-4 py-4">{player.inCurrentMatch ? "Jogando" : "Fora da atual"}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    {player.availableActions.map((action) => (
                      <span
                        key={action}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium"
                      >
                        {action}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
