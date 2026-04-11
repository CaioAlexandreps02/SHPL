import Image from "next/image";

import { SignupScreen } from "@/components/signup-screen";

export default function SignupPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#11442f_0%,#082017_38%,#04120d_72%,#020a07_100%)] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-x-0 bottom-[-8%] h-[48%] bg-[radial-gradient(circle_at_center,rgba(255,183,32,0.38),transparent_58%)] blur-2xl" />
        <div className="absolute inset-x-[12%] bottom-[16%] h-[16rem] bg-[radial-gradient(circle,rgba(255,210,110,0.16),transparent_60%)] blur-3xl" />
        <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(rgba(255,214,107,0.2)_0.8px,transparent_0.8px)] [background-size:14px_14px] opacity-[0.08]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-8">
        <section className="flex flex-col items-center text-center">
          <div className="flex justify-center">
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
          </div>

          <h1 className="mt-5 text-6xl font-black tracking-[0.08em] text-[rgba(255,220,143,0.98)] drop-shadow-[0_6px_18px_rgba(0,0,0,0.3)] md:text-7xl">
            SHPL
          </h1>
          <p className="mt-3 max-w-xl text-sm uppercase tracking-[0.35em] text-[rgba(241,232,205,0.72)]">
            Crie seu cadastro antes de entrar no sistema
          </p>
        </section>

        <SignupScreen />
      </div>
    </main>
  );
}
