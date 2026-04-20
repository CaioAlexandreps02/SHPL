"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { SHPLNavIcon } from "@/components/shpl-nav-icon";
import type { AccessRole } from "@/lib/auth/roles";
import { getVisibleShplNavItems, isShplNavItemActive } from "@/lib/navigation/shpl-nav";

export function SHPLSidebar({ roles }: { roles: AccessRole[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const visibleNavItems = getVisibleShplNavItems(roles);

  function handleBackToMenu() {
    router.push("/menu");
    router.refresh();
  }

  return (
    <aside className="w-full rounded-[2rem] border border-[rgba(255,208,101,0.18)] bg-[linear-gradient(180deg,rgba(7,27,19,0.96),rgba(5,19,14,0.98))] p-4 shadow-[0_20px_45px_rgba(0,0,0,0.32)] xl:sticky xl:top-6 xl:w-[255px] xl:self-start">
      <div className="px-2 py-3">
        <Image
          alt="Logo oficial da SHPL"
          className="mx-auto h-auto w-[122px]"
          height={122}
          priority
          src="/shpl-logo.png"
          width={122}
        />
      </div>

      <nav className="mt-4 grid gap-2">
        {visibleNavItems.map((item) => (
          <Link
            key={item.href}
            className={`flex items-center gap-3 rounded-[1.1rem] border px-4 py-3 text-sm font-semibold transition ${
              isShplNavItemActive(pathname, item.href)
                ? "border-[rgba(255,208,101,0.52)] bg-[linear-gradient(180deg,rgba(255,187,39,0.12),rgba(255,187,39,0.04))] text-[rgba(255,236,184,0.98)] shadow-[0_0_0_1px_rgba(255,208,101,0.08)]"
                : "border-transparent bg-white/[0.03] text-[rgba(248,242,225,0.88)] hover:border-[rgba(255,208,101,0.22)] hover:bg-white/[0.06]"
            }`}
            href={item.href}
          >
            <SHPLNavIcon fallback={item.icon} src={item.iconSrc} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <button
        className="mt-5 flex w-full items-center justify-center gap-3 rounded-[1.1rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-semibold text-[rgba(248,242,225,0.88)] transition hover:border-[rgba(255,208,101,0.3)] hover:bg-white/[0.06]"
        onClick={handleBackToMenu}
        type="button"
      >
        <SHPLNavIcon fallback="S" src="/icons/shpl-menu/sair.svg" />
        <span>Sair</span>
      </button>
    </aside>
  );
}
