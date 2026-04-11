import Image from "next/image";
import Link from "next/link";

const menuItems = [
  {
    href: "/shpl-2026",
    label: "SHPL 2026",
    variant: "league" as const,
  },
  {
    href: "/jogo-casual",
    label: "Jogo Casual",
    variant: "casual" as const,
  },
  {
    href: "/cash-game",
    label: "Cash Game",
    variant: "cash" as const,
  },
];

export function MainMenu() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#11442f_0%,#082017_38%,#04120d_72%,#020a07_100%)] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-x-0 bottom-[-8%] h-[48%] bg-[radial-gradient(circle_at_center,rgba(255,183,32,0.38),transparent_58%)] blur-2xl" />
        <div className="absolute inset-x-[12%] bottom-[16%] h-[16rem] bg-[radial-gradient(circle,rgba(255,210,110,0.16),transparent_60%)] blur-3xl" />
        <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(rgba(255,214,107,0.2)_0.8px,transparent_0.8px)] [background-size:14px_14px] opacity-[0.08]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-8">
        <header className="flex flex-col items-center text-center">
          <div className="rounded-[2.2rem] border border-[rgba(241,196,15,0.2)] bg-[radial-gradient(circle_at_top,rgba(27,110,55,0.22),transparent_65%),rgba(255,255,255,0.02)] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
            <Image
              alt="Logo oficial da SHPL"
              className="h-auto w-[220px] drop-shadow-[0_10px_24px_rgba(0,0,0,0.38)] md:w-[260px]"
              height={260}
              priority
              src="/shpl-logo.png"
              width={260}
            />
          </div>

          <h1 className="mt-5 text-6xl font-black tracking-[0.08em] text-[rgba(255,220,143,0.98)] drop-shadow-[0_6px_18px_rgba(0,0,0,0.3)] md:text-7xl">
            SHPL
          </h1>
        </header>

        <section className="grid w-full max-w-5xl gap-6 md:grid-cols-3">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              className="group overflow-hidden rounded-[1.35rem] border border-[rgba(255,206,92,0.38)] bg-[linear-gradient(180deg,rgba(12,46,33,0.96),rgba(8,27,20,0.98))] shadow-[0_16px_42px_rgba(0,0,0,0.34)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_54px_rgba(0,0,0,0.42)]"
              href={item.href}
            >
              <div className="relative h-[270px] overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,193,59,0.26),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_35%)]" />
                <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,214,107,0.95),transparent)]" />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(5,20,14,0.85))]" />

                {item.variant === "league" ? <LeagueArt /> : null}
                {item.variant === "casual" ? <CasualArt /> : null}
                {item.variant === "cash" ? <CashArt /> : null}
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

function LeagueArt() {
  return (
    <div className="relative h-full w-full">
      <Image
        alt="Emblema SHPL 2026 iluminado"
        className="object-cover object-center transition duration-300 group-hover:scale-[1.03]"
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        src="/shpl-2026-emblem.png"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,12,9,0.02),rgba(4,12,9,0.08)_42%,rgba(4,12,9,0.58)_100%)]" />
    </div>
  );
}

function CasualArt() {
  return (
    <div className="relative flex h-full items-center justify-center p-6">
      <div className="absolute left-5 top-10 h-24 w-24 rounded-full bg-[rgba(255,195,77,0.24)] blur-2xl" />
      <div className="absolute right-8 top-12 h-20 w-20 rounded-full bg-[rgba(255,255,255,0.15)] blur-xl" />

      <div className="relative h-full w-full">
        <div className="absolute left-[18%] top-[18%] rotate-[-14deg] rounded-[1rem] border border-[rgba(255,245,217,0.78)] bg-[linear-gradient(180deg,#fffdf6_0%,#f2e3c2_100%)] px-5 py-7 shadow-[0_12px_24px_rgba(0,0,0,0.28)]">
          <div className="text-left">
            <p className="text-4xl font-black text-[#202020]">A</p>
            <p className="mt-8 text-3xl text-[#0d0d0d]">♠</p>
          </div>
        </div>
        <div className="absolute left-[38%] top-[14%] rotate-[8deg] rounded-[1rem] border border-[rgba(255,245,217,0.78)] bg-[linear-gradient(180deg,#fffdf6_0%,#f2e3c2_100%)] px-5 py-7 shadow-[0_12px_24px_rgba(0,0,0,0.28)]">
          <div className="text-left">
            <p className="text-4xl font-black text-[#cc2b22]">A</p>
            <p className="mt-8 text-3xl text-[#cc2b22]">♥</p>
          </div>
        </div>

        <div className="absolute bottom-[22%] left-[20%] h-12 w-12 rounded-full border-4 border-white/70 bg-[linear-gradient(180deg,#ffe790_0%,#ffbc2d_100%)] shadow-[0_10px_18px_rgba(0,0,0,0.25)]" />
        <div className="absolute bottom-[18%] left-[45%] h-16 w-16 rounded-full border-[6px] border-white/80 bg-[radial-gradient(circle_at_center,#ffffff_0%,#f5f1ea_24%,#d53427_24%,#d53427_54%,#f5f1ea_54%,#f5f1ea_68%,#d53427_68%)] shadow-[0_12px_20px_rgba(0,0,0,0.28)]" />
        <div className="absolute bottom-[15%] left-[58%] h-16 w-16 rounded-full border-[6px] border-white/80 bg-[radial-gradient(circle_at_center,#ffffff_0%,#f5f1ea_24%,#d53427_24%,#d53427_54%,#f5f1ea_54%,#f5f1ea_68%,#d53427_68%)] shadow-[0_12px_20px_rgba(0,0,0,0.28)]" />
        <div className="absolute bottom-[12%] left-[35%] h-16 w-16 rounded-full border-[6px] border-white/80 bg-[radial-gradient(circle_at_center,#ffffff_0%,#f5f1ea_24%,#d53427_24%,#d53427_54%,#f5f1ea_54%,#f5f1ea_68%,#d53427_68%)] shadow-[0_12px_20px_rgba(0,0,0,0.28)]" />
      </div>
    </div>
  );
}

function CashArt() {
  return (
    <div className="relative flex h-full items-center justify-center p-6">
      <div className="absolute inset-x-5 bottom-9 h-14 rounded-full bg-[rgba(0,0,0,0.42)] blur-xl" />
      <div className="absolute inset-x-8 bottom-0 top-[42%] rotate-[-10deg] rounded-[1.25rem] border border-[rgba(255,244,214,0.15)] bg-[linear-gradient(180deg,#b2b18d_0%,#75745f_100%)] opacity-65 shadow-[0_10px_24px_rgba(0,0,0,0.32)]" />
      <div className="absolute inset-x-10 bottom-[12%] top-[36%] rotate-[8deg] rounded-[1.25rem] border border-[rgba(255,244,214,0.15)] bg-[linear-gradient(180deg,#c0bf9a_0%,#7f7d67_100%)] opacity-75 shadow-[0_10px_24px_rgba(0,0,0,0.32)]" />

      <div className="relative flex items-end gap-4">
        <ChipStack heightClass="h-24" />
        <ChipStack heightClass="h-36" highlight />
        <ChipStack heightClass="h-28" />
      </div>
    </div>
  );
}

function ChipStack({
  heightClass,
  highlight = false,
}: {
  heightClass: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative w-20 ${heightClass} rounded-[1.25rem] border border-[rgba(255,234,163,0.2)] bg-[linear-gradient(180deg,rgba(9,26,19,0.8),rgba(5,18,12,0.92))] px-2 py-3 shadow-[0_16px_24px_rgba(0,0,0,0.28)]`}
    >
      <div
        className={`absolute inset-0 rounded-[1.25rem] ${
          highlight
            ? "bg-[radial-gradient(circle_at_top,rgba(255,201,76,0.25),transparent_48%)]"
            : "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_40%)]"
        }`}
      />
      <div className="relative flex h-full flex-col justify-end gap-1">
        {Array.from({ length: highlight ? 8 : 6 }).map((_, index) => (
          <div
            key={index}
            className="h-3 rounded-full border border-[rgba(255,240,187,0.2)] bg-[repeating-linear-gradient(90deg,#e9d47b_0_22%,#2f5a33_22%_44%,#e9d47b_44%_66%,#162f18_66%_88%,#e9d47b_88%_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
          />
        ))}
      </div>
    </div>
  );
}
