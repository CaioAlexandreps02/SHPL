import { redirect } from "next/navigation";

type HistoricoPageProps = {
  searchParams?: Promise<{
    stage?: string;
  }>;
};

export default async function HistoricoPage({ searchParams }: HistoricoPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const nextStageQuery = resolvedSearchParams?.stage ? `?stage=${resolvedSearchParams.stage}` : "";

  redirect(`/shpl-2026/ranking${nextStageQuery}`);
}
