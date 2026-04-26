import { SHPLRankingPage } from "@/components/shpl-ranking-page";
import { getCurrentUserAccess, isAdmin } from "@/lib/auth/access";
import { getLeagueSnapshot } from "@/lib/data/repository";

type RankingPageProps = {
  searchParams?: Promise<{
    stage?: string;
  }>;
};

export default async function RankingPage({ searchParams }: RankingPageProps) {
  const access = await getCurrentUserAccess();
  const snapshot = await getLeagueSnapshot();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <SHPLRankingPage
      canEditStageRanking={isAdmin(access)}
      initialStageId={resolvedSearchParams?.stage ?? null}
      snapshot={snapshot}
    />
  );
}
