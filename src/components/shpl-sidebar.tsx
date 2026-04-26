"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SHPLNavIcon } from "@/components/shpl-nav-icon";
import type { AccessRole } from "@/lib/auth/roles";
import { getVisibleShplNavItems, isShplNavItemActive } from "@/lib/navigation/shpl-nav";

const DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY = "shpl-desktop-sidebar-collapsed";

export function SHPLSidebar({ roles }: { roles: AccessRole[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [hasHydratedDesktopSidebar, setHasHydratedDesktopSidebar] = useState(false);
  const visibleNavItems = getVisibleShplNavItems(roles);
  const activeItemLabel = useMemo(
    () => visibleNavItems.find((item) => isShplNavItemActive(pathname, item.href))?.label ?? "SHPL 2026",
    [pathname, visibleNavItems],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setIsDesktopCollapsed(
        window.localStorage.getItem(DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY) === "true",
      );
      setHasHydratedDesktopSidebar(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!hasHydratedDesktopSidebar || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY,
      isDesktopCollapsed ? "true" : "false",
    );
  }, [hasHydratedDesktopSidebar, isDesktopCollapsed]);

  function handleBackToMenu() {
    setIsMobileMenuOpen(false);
    router.push("/menu");
    router.refresh();
  }

  return (
    <>
      <div className="xl:hidden">
        <div className="mr-[4.5rem] flex items-center gap-3 rounded-[1.5rem] border border-[rgba(255,208,101,0.18)] bg-[linear-gradient(180deg,rgba(7,27,19,0.96),rgba(5,19,14,0.98))] px-3 py-3 shadow-[0_20px_45px_rgba(0,0,0,0.32)] md:mr-[5rem]">
          <button
            aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(255,255,255,0.04)] text-[rgba(255,244,214,0.96)] transition hover:bg-[rgba(255,255,255,0.08)]"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            type="button"
          >
            <span className="flex flex-col gap-1.5">
              <span className="block h-[2px] w-5 rounded-full bg-current" />
              <span className="block h-[2px] w-5 rounded-full bg-current" />
              <span className="block h-[2px] w-5 rounded-full bg-current" />
            </span>
          </button>

          <div className="min-w-0 flex items-center gap-3">
            <Image
              alt="Logo oficial da SHPL"
              className="h-auto w-[52px] shrink-0"
              height={52}
              priority
              src="/shpl-logo.png"
              width={52}
            />
            <div className="min-w-0">
              <p className="text-[0.66rem] uppercase tracking-[0.22em] text-[rgba(240,227,189,0.48)]">
                SHPL 2026
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-[rgba(255,244,214,0.96)]">
                {activeItemLabel}
              </p>
            </div>
          </div>
        </div>

        {isMobileMenuOpen ? (
          <div className="fixed inset-0 z-50 xl:hidden">
            <button
              aria-label="Fechar menu"
              className="absolute inset-0 bg-[rgba(3,11,8,0.72)] backdrop-blur-[2px]"
              onClick={() => setIsMobileMenuOpen(false)}
              type="button"
            />

            <div className="absolute inset-x-4 top-4 rounded-[1.8rem] border border-[rgba(255,208,101,0.18)] bg-[linear-gradient(180deg,rgba(7,27,19,0.98),rgba(5,19,14,0.99))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
              <div className="flex items-center justify-between gap-3 px-2 py-2">
                <div className="flex items-center gap-3">
                  <Image
                    alt="Logo oficial da SHPL"
                    className="h-auto w-[52px]"
                    height={52}
                    priority
                    src="/shpl-logo.png"
                    width={52}
                  />
                  <div>
                    <p className="text-[0.66rem] uppercase tracking-[0.22em] text-[rgba(240,227,189,0.48)]">
                      Menu SHPL
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[rgba(255,244,214,0.96)]">
                      {activeItemLabel}
                    </p>
                  </div>
                </div>

                <button
                  aria-label="Fechar menu"
                  className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(255,255,255,0.04)] text-lg font-semibold text-[rgba(255,244,214,0.96)]"
                  onClick={() => setIsMobileMenuOpen(false)}
                  type="button"
                >
                  ×
                </button>
              </div>

              <nav className="mt-3 grid gap-2">
                {visibleNavItems.map((item) => (
                  <Link
                    key={item.href}
                    className={`flex items-center gap-3 rounded-[1.1rem] border px-4 py-3 text-sm font-semibold transition ${
                      isShplNavItemActive(pathname, item.href)
                        ? "border-[rgba(255,208,101,0.52)] bg-[linear-gradient(180deg,rgba(255,187,39,0.12),rgba(255,187,39,0.04))] text-[rgba(255,236,184,0.98)] shadow-[0_0_0_1px_rgba(255,208,101,0.08)]"
                        : "border-transparent bg-white/[0.03] text-[rgba(248,242,225,0.88)] hover:border-[rgba(255,208,101,0.22)] hover:bg-white/[0.06]"
                    }`}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
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
            </div>
          </div>
        ) : null}
      </div>

      <aside
        className={`hidden w-full rounded-[2rem] border border-[rgba(255,208,101,0.18)] bg-[linear-gradient(180deg,rgba(7,27,19,0.96),rgba(5,19,14,0.98))] p-4 shadow-[0_20px_45px_rgba(0,0,0,0.32)] transition-[width,padding] duration-200 xl:sticky xl:top-6 xl:block xl:self-start ${
          isDesktopCollapsed ? "xl:w-[104px]" : "xl:w-[255px]"
        }`}
      >
        <div
          className={`px-2 py-3 ${
            isDesktopCollapsed
              ? "flex flex-col items-center gap-4"
              : "flex items-start justify-between gap-3"
          }`}
        >
          <Image
            alt="Logo oficial da SHPL"
            className={`h-auto ${isDesktopCollapsed ? "w-[58px]" : "mx-auto w-[122px]"}`}
            height={122}
            priority
            src="/shpl-logo.png"
            width={122}
          />

          <button
            aria-label={isDesktopCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(255,255,255,0.04)] text-lg font-semibold text-[rgba(255,244,214,0.96)] transition hover:bg-[rgba(255,255,255,0.08)]"
            onClick={() => setIsDesktopCollapsed((current) => !current)}
            type="button"
          >
            {isDesktopCollapsed ? ">" : "<"}
          </button>
        </div>

        <nav className="mt-4 grid gap-2">
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              className={`flex items-center rounded-[1.1rem] border py-3 text-sm font-semibold transition ${
                isShplNavItemActive(pathname, item.href)
                  ? "border-[rgba(255,208,101,0.52)] bg-[linear-gradient(180deg,rgba(255,187,39,0.12),rgba(255,187,39,0.04))] text-[rgba(255,236,184,0.98)] shadow-[0_0_0_1px_rgba(255,208,101,0.08)]"
                  : "border-transparent bg-white/[0.03] text-[rgba(248,242,225,0.88)] hover:border-[rgba(255,208,101,0.22)] hover:bg-white/[0.06]"
              } ${isDesktopCollapsed ? "justify-center px-3" : "gap-3 px-4"}`}
              href={item.href}
              title={isDesktopCollapsed ? item.label : undefined}
            >
              <SHPLNavIcon fallback={item.icon} src={item.iconSrc} />
              {!isDesktopCollapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          ))}
        </nav>

        <button
          className={`mt-5 flex w-full items-center rounded-[1.1rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(255,255,255,0.03)] py-3 text-sm font-semibold text-[rgba(248,242,225,0.88)] transition hover:border-[rgba(255,208,101,0.3)] hover:bg-white/[0.06] ${
            isDesktopCollapsed ? "justify-center px-3" : "justify-center gap-3 px-4"
          }`}
          onClick={handleBackToMenu}
          title={isDesktopCollapsed ? "Sair" : undefined}
          type="button"
        >
          <SHPLNavIcon fallback="S" src="/icons/shpl-menu/sair.svg" />
          {!isDesktopCollapsed ? <span>Sair</span> : null}
        </button>
      </aside>
    </>
  );
}
