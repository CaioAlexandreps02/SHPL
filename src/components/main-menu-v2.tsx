import Image from "next/image";
import Link from "next/link";

import { UserProfileFab } from "@/components/user-profile-fab";

type MainMenuItem = {
  href: string;
  label: string;
  imageSrc?: string;
  imageAlt?: string;
};

const menuItems: MainMenuItem[] = [
  {
    href: "/shpl-2026",
    label: "SHPL 2026",
    imageSrc: "/shpl-2026-emblem.png",
    imageAlt: "Emblema SHPL 2026 iluminado",
  },
  {
    href: "/jogo-casual",
    label: "Jogo Casual",
    imageSrc: "/cash-game-menu.png",
    imageAlt: "Aces e fichas no feltro verde",
  },
  {
    href: "/cash-game",
    label: "Cash Game",
    imageSrc: "/jogo-casual-menu.png",
    imageAlt: "Jogo de poker e pilhas de dinheiro",
  },
];

export function MainMenuV2() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#11442f_0%,#082017_38%,#04120d_72%,#020a07_100%)] px-4 py-8">
      <UserProfileFab />

      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-x-0 bottom-[-8%] h-[48%] bg-[radial-gradient(circle_at_center,rgba(255,183,32,0.38),transparent_58%)] blur-2xl" />
        <div className="absolute inset-x-[12%] bottom-[16%] h-[16rem] bg-[radial-gradient(circle,rgba(255,210,110,0.16),transparent_60%)] blur-3xl" />
        <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(rgba(255,214,107,0.2)_0.8px,transparent_0.8px)] [background-size:14px_14px] opacity-[0.08]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-8">
        <header className="flex flex-col items-center text-center">
          <Image
            alt="Logo oficial da SHPL"
            className="h-auto w-[220px] drop-shadow-[0_10px_24px_rgba(0,0,0,0.38)] md:w-[260px]"
            height={260}
            priority
            src="/shpl-logo.png"
            width={260}
          />
        </header>

        <section className="grid w-full max-w-6xl gap-6 md:grid-cols-2 xl:grid-cols-4">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              className="group overflow-hidden rounded-[1.35rem] border border-[rgba(255,206,92,0.38)] bg-[linear-gradient(180deg,rgba(12,46,33,0.96),rgba(8,27,20,0.98))] shadow-[0_16px_42px_rgba(0,0,0,0.34)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_54px_rgba(0,0,0,0.42)]"
              href={item.href}
            >
              <div className="relative h-[270px] overflow-hidden">
                <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_top,rgba(255,193,59,0.26),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_35%)]" />
                <div className="absolute inset-x-0 top-0 z-10 h-px bg-[linear-gradient(90deg,transparent,rgba(255,214,107,0.95),transparent)]" />
                <div className="absolute inset-x-0 bottom-0 z-10 h-24 bg-[linear-gradient(180deg,transparent,rgba(5,20,14,0.85))]" />

                {item.imageSrc ? (
                  <div className="relative h-full w-full">
                    <Image
                      alt={item.imageAlt ?? item.label}
                      className="object-cover object-center transition duration-300 group-hover:scale-[1.03]"
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                      src={item.imageSrc}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,12,9,0.03),rgba(4,12,9,0.1)_42%,rgba(4,12,9,0.56)_100%)]" />
                  </div>
                ) : (
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,194,66,0.24),transparent_28%),linear-gradient(180deg,rgba(8,33,24,0.98),rgba(5,18,13,1))]">
                    <div className="absolute inset-0 bg-[radial-gradient(rgba(255,214,107,0.16)_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.12]" />
                    <div className="absolute inset-x-[12%] top-[18%] h-[6.5rem] rounded-full bg-[radial-gradient(circle,rgba(255,194,66,0.34),transparent_70%)] blur-2xl" />
                    <div className="relative z-20 flex flex-col items-center gap-5">
                      <div className="rounded-full border border-[rgba(255,208,101,0.34)] bg-[rgba(255,183,32,0.12)] px-4 py-1.5 text-[0.72rem] font-black uppercase tracking-[0.24em] text-[rgba(255,236,184,0.92)]">
                        Lab isolado
                      </div>

                      <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-[rgba(255,208,101,0.28)] bg-[radial-gradient(circle,rgba(15,61,43,0.94),rgba(6,21,15,0.98))] shadow-[0_18px_36px_rgba(0,0,0,0.32)]">
                        <div className="absolute inset-3 rounded-full border border-[rgba(255,208,101,0.16)]" />
                        <div className="h-10 w-10 rounded-full border border-[rgba(255,208,101,0.22)] bg-[linear-gradient(180deg,rgba(255,214,107,0.98),rgba(224,170,22,0.92))] shadow-[0_0_28px_rgba(255,200,70,0.4)]" />
                        <div className="absolute h-16 w-16 rounded-full border border-[rgba(255,208,101,0.18)]" />
                        <div className="absolute h-24 w-24 rounded-full border border-[rgba(255,208,101,0.1)]" />
                      </div>

                      <div className="flex items-end gap-2">
                        <div className="h-8 w-2.5 rounded-full bg-[linear-gradient(180deg,#f6d46f,#d89b13)]" />
                        <div className="h-12 w-2.5 rounded-full bg-[linear-gradient(180deg,#f6d46f,#d89b13)]" />
                        <div className="h-16 w-2.5 rounded-full bg-[linear-gradient(180deg,#f6d46f,#d89b13)]" />
                        <div className="h-12 w-2.5 rounded-full bg-[linear-gradient(180deg,#f6d46f,#d89b13)]" />
                        <div className="h-8 w-2.5 rounded-full bg-[linear-gradient(180deg,#f6d46f,#d89b13)]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-[rgba(255,206,92,0.18)] bg-[linear-gradient(180deg,rgba(10,42,29,0.98),rgba(7,23,17,1))] px-5 py-4 text-center">
                <p className="text-[2rem] font-black tracking-tight text-[rgba(255,220,143,0.98)] drop-shadow-[0_4px_10px_rgba(0,0,0,0.2)]">
                  {item.label}
                </p>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
