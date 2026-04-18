import { redirect } from "next/navigation";

import { SHPLTransmissaoPage } from "@/components/shpl-transmissao-page";
import { canManageTable, getCurrentUserAccess } from "@/lib/auth/access";
import { getLeagueSnapshot } from "@/lib/data/repository";
import type { LeagueSnapshot } from "@/lib/domain/types";

type TransmissaoPageProps = {
  searchParams?: Promise<{
    stage?: string;
  }>;
};

export default async function TransmissaoPage({ searchParams }: TransmissaoPageProps) {
  const access = await getCurrentUserAccess();

  if (!canManageTable(access)) {
    redirect("/shpl-2026/dashboard");
  }

  const snapshot = await getLeagueSnapshot();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedStageId = resolvedSearchParams.stage ?? snapshot.currentStage.id;
  const stageOptions = buildTransmissionStageOptions(snapshot);
  const selectedStage =
    stageOptions.find((option) => option.stageId === selectedStageId) ?? stageOptions[0] ?? null;
  const playerNameById = Object.fromEntries(
    [...snapshot.stagePlayers, ...snapshot.annualRanking].map((entry) => [
      entry.playerId,
      entry.playerName,
    ]),
  );

  const linkedStageOption = selectedStage
    ? {
        stageId: selectedStage.stageId,
        stageTitle: selectedStage.stageTitle,
        stageDateLabel: selectedStage.stageDateLabel,
        blindStructure: snapshot.blindStructure,
        playerNameById,
      }
    : null;

  return (
    <SHPLTransmissaoPage
      linkedStageOption={linkedStageOption}
      selectedStageId={selectedStage?.stageId ?? snapshot.currentStage.id}
      stageOptions={stageOptions}
    />
  );
}

function buildTransmissionStageOptions(snapshot: LeagueSnapshot) {
  const optionMap = new Map<string, { stageId: string; stageTitle: string; stageDateLabel: string }>();

  const register = (stageId: string, stageTitle: string, stageDateLabel: string) => {
    if (!optionMap.has(stageId)) {
      optionMap.set(stageId, {
        stageId,
        stageTitle,
        stageDateLabel,
      });
    }
  };

  register(
    snapshot.currentStage.id,
    snapshot.currentStage.title,
    snapshot.currentStage.stageDateLabel,
  );

  snapshot.upcomingStages.forEach((stage) => {
    register(stage.id, stage.title, stage.stageDateLabel);
  });

  snapshot.history.forEach((stage) => {
    register(stage.id, stage.title, stage.stageDateLabel);
  });

  return Array.from(optionMap.values());
}
