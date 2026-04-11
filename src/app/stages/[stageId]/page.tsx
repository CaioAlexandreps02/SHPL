import { redirect } from "next/navigation";

import { StageSetupScreen } from "@/components/stage-setup-screen";
import { UserProfileFab } from "@/components/user-profile-fab";
import { canManageTable, getCurrentUserAccess } from "@/lib/auth/access";
import { getLeagueSnapshot } from "@/lib/data/repository";

type StagePageProps = {
  params: Promise<{
    stageId: string;
  }>;
};

export default async function StagePage({ params }: StagePageProps) {
  const access = await getCurrentUserAccess();

  if (!canManageTable(access)) {
    redirect("/shpl-2026/etapas");
  }

  const { stageId } = await params;
  const snapshot = await getLeagueSnapshot();
  const scheduledStages = [snapshot.currentStage, ...snapshot.upcomingStages];
  const selectedStage = scheduledStages.find((stage) => stage.id === stageId);
  const isFinishedStage = snapshot.history.some((stage) => stage.id === stageId);

  if (isFinishedStage) {
    redirect(`/shpl-2026/ranking?stage=${stageId}`);
  }

  if (!selectedStage) {
    redirect("/shpl-2026/etapas");
  }

  return (
    <>
      <UserProfileFab />
      <StageSetupScreen
        roles={access?.roles ?? ["Visitante"]}
        snapshot={snapshot}
        stage={selectedStage}
      />
    </>
  );
}
