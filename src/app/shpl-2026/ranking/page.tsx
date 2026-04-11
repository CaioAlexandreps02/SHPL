import { SHPLRankingPage } from "@/components/shpl-ranking-page";
import { getLeagueSnapshot } from "@/lib/data/repository";

type RankingPageProps = {
  searchParams?: Promise<{
    stage?: string;
  }>;
};

export default async function RankingPage({ searchParams }: RankingPageProps) {
  const snapshot = await getLeagueSnapshot();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <SHPLRankingPage
      initialStageId={resolvedSearchParams?.stage ?? null}
      snapshot={snapshot}
    />
  );
}
