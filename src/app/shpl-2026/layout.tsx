import type { ReactNode } from "react";

import { SHPLSidebar } from "@/components/shpl-sidebar";
import { UserProfileFab } from "@/components/user-profile-fab";
import { getCurrentUserAccess } from "@/lib/auth/access";

export default async function SHPL2026Layout({
  children,
}: {
  children: ReactNode;
}) {
  const access = await getCurrentUserAccess();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#11442f_0%,#082017_38%,#04120d_72%,#020a07_100%)] px-4 py-6">
      <UserProfileFab />

      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-x-0 bottom-[-8%] h-[48%] bg-[radial-gradient(circle_at_center,rgba(255,183,32,0.24),transparent_58%)] blur-2xl" />
        <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(rgba(255,214,107,0.16)_0.8px,transparent_0.8px)] [background-size:14px_14px] opacity-[0.06]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 xl:flex-row">
        <SHPLSidebar roles={access?.roles ?? ["Visitante"]} />
        <div className="min-w-0 flex-1 xl:pt-5">{children}</div>
      </div>
    </main>
  );
}
