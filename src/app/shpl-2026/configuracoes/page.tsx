import { redirect } from "next/navigation";

import { SHPLSettingsPage } from "@/components/shpl-settings-page";
import { getCurrentUserAccess, isAdmin } from "@/lib/auth/access";
import { getLeagueSnapshot } from "@/lib/data/repository";

export default async function ConfiguracoesPage() {
  const access = await getCurrentUserAccess();

  if (!isAdmin(access)) {
    redirect("/shpl-2026/dashboard");
  }

  const snapshot = await getLeagueSnapshot();

  return <SHPLSettingsPage snapshot={snapshot} />;
}
