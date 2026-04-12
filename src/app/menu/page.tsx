import { redirect } from "next/navigation";

import { MainMenuV2 } from "@/components/main-menu-v2";
import { getCurrentUserAccess } from "@/lib/auth/access";

export default async function MenuPage() {
  const access = await getCurrentUserAccess();

  if (!access) {
    redirect("/login");
  }

  return <MainMenuV2 />;
}
