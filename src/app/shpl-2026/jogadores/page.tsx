import { redirect } from "next/navigation";

import { SHPLPlayersPageV2 } from "@/components/shpl-players-page-v2";
import { getCurrentUserAccess, isAdmin } from "@/lib/auth/access";
import { getLeagueSnapshot } from "@/lib/data/repository";

export default async function JogadoresPage() {
  const access = await getCurrentUserAccess();

  if (!isAdmin(access)) {
    redirect("/shpl-2026/dashboard");
  }

  const snapshot = await getLeagueSnapshot();

  return <SHPLPlayersPageV2 snapshot={snapshot} />;
}
