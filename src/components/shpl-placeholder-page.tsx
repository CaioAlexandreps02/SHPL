export function SHPLPlaceholderPage({
  section,
  description,
}: {
  section: string;
  description: string;
}) {
  return (
    <section className="rounded-[2rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-6 shadow-[0_20px_45px_rgba(0,0,0,0.28)] md:p-8">
      <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[rgba(236,225,196,0.68)]">
        SHPL 2026
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[rgba(255,244,214,0.96)]">
        {section}
      </h1>
      <p className="mt-5 max-w-3xl text-sm leading-7 text-[rgba(236,225,196,0.74)]">
        {description}
      </p>
    </section>
  );
}
