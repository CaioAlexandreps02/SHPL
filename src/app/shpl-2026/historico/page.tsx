import { redirect } from "next/navigation";

import { SHPLHistoryPage } from "@/components/shpl-history-page";
import { getCurrentUserAccess, isAdmin } from "@/lib/auth/access";
import { getLeagueSnapshot } from "@/lib/data/repository";

export default async function HistoricoPage() {
  const access = await getCurrentUserAccess();

  if (!isAdmin(access)) {
    redirect("/shpl-2026/dashboard");
  }

  const snapshot = await getLeagueSnapshot();

  return <SHPLHistoryPage snapshot={snapshot} />;
}
