import type { RankingEntry } from "@/lib/domain/types";

export function RankingTable({
  title,
  subtitle,
  entries,
}: {
  title: string;
  subtitle: string;
  entries: RankingEntry[];
}) {
  return (
    <section className="glass-card rounded-[2rem] p-6">
      <div>
        <p className="text-muted text-xs uppercase tracking-[0.25em]">Classificação</p>
        <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
        <p className="text-muted mt-2 text-sm">{subtitle}</p>
      </div>

      <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5">
            <tr>
              {["Pos.", "Jogador", "Pontos", "1º", "2º", "3º", "Critério"].map((label) => (
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
            {entries.map((entry) => (
              <tr key={entry.playerId} className="bg-black/10">
                <td className="px-4 py-3 font-semibold">{entry.position}</td>
                <td className="px-4 py-3">{entry.playerName}</td>
                <td className="px-4 py-3 font-semibold">{entry.points}</td>
                <td className="px-4 py-3">{entry.wins}</td>
                <td className="px-4 py-3">{entry.secondPlaces}</td>
                <td className="px-4 py-3">{entry.thirdPlaces}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{entry.tiebreakSummary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
