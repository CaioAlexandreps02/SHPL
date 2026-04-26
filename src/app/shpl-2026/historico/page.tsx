import { redirect } from "next/navigation";

import { SHPLHistoryPage } from "@/components/shpl-history-page";
import { getCurrentUserAccess, isAdmin } from "@/lib/auth/access";
import { getLeagueSnapshot } from "@/lib/data/repository";

type HistoricoPageProps = {
  searchParams?: Promise<{
    stage?: string;
  }>;
};

export default async function HistoricoPage({ searchParams }: HistoricoPageProps) {
  const access = await getCurrentUserAccess();

  if (!isAdmin(access)) {
    redirect("/shpl-2026/dashboard");
  }

  const snapshot = await getLeagueSnapshot();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <SHPLHistoryPage
      initialStageId={resolvedSearchParams?.stage}
      snapshot={snapshot}
    />
  );
}
