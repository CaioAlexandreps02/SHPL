import { AppShell } from "@/components/app-shell";
import { SettingsPanel } from "@/components/settings-panel";
import { getLeagueSnapshot } from "@/lib/data/repository";

export default async function SettingsPage() {
  const snapshot = await getLeagueSnapshot();

  return (
    <AppShell
      championship={snapshot.championship}
      currentStage={snapshot.currentStage}
      annualRanking={snapshot.annualRanking}
      dayRanking={snapshot.dayRanking}
    >
      <SettingsPanel blindStructure={snapshot.blindStructure} chipSet={snapshot.chipSet} />
    </AppShell>
  );
}
