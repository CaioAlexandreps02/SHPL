import { redirect } from "next/navigation";

import { LiveLabPage } from "@/components/live-lab-page";
import { canManageTable, getCurrentUserAccess } from "@/lib/auth/access";
import { getLeagueSnapshot } from "@/lib/data/repository";

export default async function TransmissaoPage() {
  const access = await getCurrentUserAccess();

  if (!canManageTable(access)) {
    redirect("/shpl-2026/dashboard");
  }

  const snapshot = await getLeagueSnapshot();
  const stage = snapshot.currentStage;
  const playerNameById = Object.fromEntries(
    [...snapshot.stagePlayers, ...snapshot.annualRanking].map((entry) => [
      entry.playerId,
      entry.playerName,
    ]),
  );

  return (
    <LiveLabPage
      linkedStageOption={{
        stageId: stage.id,
        stageTitle: stage.title,
        stageDateLabel: stage.stageDateLabel,
        blindStructure: snapshot.blindStructure,
        playerNameById,
      }}
      mode="integrated"
    />
  );
}
