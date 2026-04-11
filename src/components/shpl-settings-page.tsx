"use client";

import { useEffect, useMemo, useState } from "react";

import { SHPLCardDatasetSettings } from "@/components/shpl-card-dataset-settings";
import type { AnnualAward, BlindLevel, ChipSetItem, LeagueSnapshot } from "@/lib/domain/types";

type SettingsSectionId =
  | "campeonato"
  | "blinds"
  | "tempo"
  | "fichas"
  | "stack"
  | "premiacao"
  | "dataset";

const settingsSections: Array<{
  id: SettingsSectionId;
  label: string;
  helper: string;
}> = [
  { id: "campeonato", label: "Campeonato", helper: "regras gerais" },
  { id: "blinds", label: "Blinds", helper: "estrutura da etapa" },
  { id: "tempo", label: "Cronometros", helper: "timers e presets" },
  { id: "fichas", label: "Kit de fichas", helper: "cores e quantidades" },
  { id: "stack", label: "Stacks", helper: "calculadora da mesa" },
  { id: "premiacao", label: "Premiacao", helper: "pote anual" },
  { id: "dataset", label: "Dataset local das cartas", helper: "treino e rotulos" },
];

const chipColorOptions = [
  { label: "Amarelo", value: "#F1C40F" },
  { label: "Vermelho", value: "#E74C3C" },
  { label: "Preto", value: "#202020" },
  { label: "Azul", value: "#3498DB" },
  { label: "Laranja", value: "#E67E22" },
  { label: "Branco", value: "#F5F5F5" },
  { label: "Verde", value: "#2ECC71" },
  { label: "Cinza", value: "#95A5A6" },
  { label: "Rosa", value: "#FF6FAE" },
  { label: "Roxo", value: "#8E44AD" },
];

const SETTINGS_STORAGE_KEY = "shpl-2026-settings";
const annualAwardPresets = {
  four: [
    { position: 1, percentage: 40 },
    { position: 2, percentage: 30 },
    { position: 3, percentage: 20 },
    { position: 4, percentage: 10 },
  ],
  six: [
    { position: 1, percentage: 40 },
    { position: 2, percentage: 25 },
    { position: 3, percentage: 15 },
    { position: 4, percentage: 10 },
    { position: 5, percentage: 6 },
    { position: 6, percentage: 4 },
  ],
  eight: [
    { position: 1, percentage: 40 },
    { position: 2, percentage: 20 },
    { position: 3, percentage: 12 },
    { position: 4, percentage: 8 },
    { position: 5, percentage: 6 },
    { position: 6, percentage: 5 },
    { position: 7, percentage: 5 },
    { position: 8, percentage: 4 },
  ],
} as const;

const defaultAnnualAwards: AnnualAward[] = [
  { position: 1, percentage: 40 },
  { position: 2, percentage: 30 },
  { position: 3, percentage: 20 },
  { position: 4, percentage: 10 },
];

function normalizeAnnualAwards(awards?: AnnualAward[]) {
  const mappedAwards = new Map((awards ?? []).map((award) => [award.position, award.percentage]));

  const fixedAwards = defaultAnnualAwards.map((award) => ({
    position: award.position,
    percentage: mappedAwards.get(award.position) ?? award.percentage,
  }));

  const extraAwards = [...mappedAwards.entries()]
    .filter(([position]) => position > 4)
    .sort((left, right) => left[0] - right[0])
    .map(([position, percentage]) => ({ position, percentage }));

  return [...fixedAwards, ...extraAwards];
}

export function SHPLSettingsPage({ snapshot }: { snapshot: LeagueSnapshot }) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("campeonato");
  const [blindLevels, setBlindLevels] = useState<BlindLevel[]>(snapshot.blindStructure);
  const [applyDurationMinutes, setApplyDurationMinutes] = useState("0");
  const [anteEnabled, setAnteEnabled] = useState(
    snapshot.blindStructure.some((level) => (level.ante ?? 0) > 0)
  );
  const [actionClockPreset, setActionClockPreset] = useState(
    String(snapshot.liveControls.actionClockOptions[1] ?? snapshot.liveControls.actionClockOptions[0] ?? 30)
  );
  const [showActionClockOnTable, setShowActionClockOnTable] = useState(true);
  const [chipSet, setChipSet] = useState<ChipSetItem[]>(snapshot.chipSet);
  const [annualAwards, setAnnualAwards] = useState<AnnualAward[]>(
    normalizeAnnualAwards(snapshot.annualAwards)
  );
  const [stackPlayers, setStackPlayers] = useState(String(snapshot.stagePlayers.length));
  const [desiredStack, setDesiredStack] = useState("3000");
  const [stackOverrides, setStackOverrides] = useState<Record<string, string>>({});
  const [championshipName, setChampionshipName] = useState(snapshot.championship.name);
  const [seasonYear, setSeasonYear] = useState(String(snapshot.championship.seasonYear));
  const [buyInAnnual, setBuyInAnnual] = useState("10");
  const [buyInDaily, setBuyInDaily] = useState("10");
  const [breakDurationMinutes, setBreakDurationMinutes] = useState("0");
  const [breakEveryLevels, setBreakEveryLevels] = useState("0");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    let timeoutId: number | undefined;

    try {
      const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

      if (!rawSettings) {
        return;
      }

      const parsedSettings = JSON.parse(rawSettings) as {
        championshipName?: string;
        seasonYear?: string;
        buyInAnnual?: string;
        buyInDaily?: string;
        breakDurationMinutes?: string;
        breakEveryLevels?: string;
        blindLevels?: BlindLevel[];
        actionClockPreset?: string;
        showActionClockOnTable?: boolean;
        chipSet?: ChipSetItem[];
        annualAwards?: AnnualAward[];
        stackPlayers?: string;
        desiredStack?: string;
        stackOverrides?: Record<string, string>;
        applyDurationMinutes?: string;
        anteEnabled?: boolean;
      };

      timeoutId = window.setTimeout(() => {
        setChampionshipName(parsedSettings.championshipName ?? snapshot.championship.name);
        setSeasonYear(parsedSettings.seasonYear ?? String(snapshot.championship.seasonYear));
        setBuyInAnnual(parsedSettings.buyInAnnual ?? "10");
        setBuyInDaily(parsedSettings.buyInDaily ?? "10");
        setBreakDurationMinutes(parsedSettings.breakDurationMinutes ?? "0");
        setBreakEveryLevels(parsedSettings.breakEveryLevels ?? "0");
        setBlindLevels(parsedSettings.blindLevels ?? snapshot.blindStructure);
        setActionClockPreset(
          parsedSettings.actionClockPreset ??
            String(
              snapshot.liveControls.actionClockOptions[1] ??
                snapshot.liveControls.actionClockOptions[0] ??
                30
            )
        );
        setShowActionClockOnTable(parsedSettings.showActionClockOnTable ?? true);
        setChipSet(parsedSettings.chipSet ?? snapshot.chipSet);
        setAnnualAwards(
          normalizeAnnualAwards(parsedSettings.annualAwards ?? snapshot.annualAwards)
        );
        setStackPlayers(parsedSettings.stackPlayers ?? String(snapshot.stagePlayers.length));
        setDesiredStack(parsedSettings.desiredStack ?? "3000");
        setStackOverrides(parsedSettings.stackOverrides ?? {});
        setApplyDurationMinutes(parsedSettings.applyDurationMinutes ?? "0");
        setAnteEnabled(
          parsedSettings.anteEnabled ??
            (parsedSettings.blindLevels ?? snapshot.blindStructure).some(
              (level) => (level.ante ?? 0) > 0
            )
        );
      }, 0);
    } catch {
      timeoutId = window.setTimeout(() => {
        setSaveStatus("error");
      }, 0);
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [snapshot]);

  const stackCalculation = useMemo(() => {
    const players = Math.max(Number.parseInt(stackPlayers || "0", 10) || 0, 1);
    const stack = Math.max(Number.parseInt(desiredStack || "0", 10) || 0, 0);
    const orderedChips = chipSet
      .map((chip, sourceIndex) => ({ ...chip, sourceIndex }))
      .sort((left, right) => right.value - left.value);

    const distributionResult = orderedChips.reduce<{
      remaining: number;
      items: Array<
        ChipSetItem & {
          key: string;
          suggestedCount: number;
          countPerPlayer: number;
          totalUsed: number;
          totalValuePerPlayer: number;
          availablePerPlayer: number;
          exceedsAvailable: boolean;
        }
      >;
    }>(
      (result, chip) => {
        const availablePerPlayer = Math.floor(chip.quantity / players);
        const baseRemaining = result.remaining;
        const suggestedCount = Math.min(
          Math.floor(baseRemaining / chip.value),
          availablePerPlayer
        );
        const chipKey = `chip-${chip.sourceIndex}`;
        const overrideValue = stackOverrides[chipKey];
        const parsedOverride = Number.parseInt(overrideValue ?? "", 10);
        const countPerPlayer =
          Number.isNaN(parsedOverride) || overrideValue === undefined
            ? suggestedCount
            : Math.max(0, parsedOverride);

        return {
          remaining: baseRemaining - countPerPlayer * chip.value,
          items: [
            ...result.items,
            {
              ...chip,
              key: chipKey,
              suggestedCount,
              countPerPlayer,
              totalUsed: countPerPlayer * players,
              totalValuePerPlayer: countPerPlayer * chip.value,
              availablePerPlayer,
              exceedsAvailable: countPerPlayer > availablePerPlayer,
            },
          ],
        };
      },
      { remaining: stack, items: [] }
    );

    const distribution = distributionResult.items;

    const totalPerPlayer = distribution.reduce(
      (total, chip) => total + chip.totalValuePerPlayer,
      0
    );
    const totalUsedValue = distribution.reduce(
      (total, chip) => total + chip.totalUsed * chip.value,
      0
    );
    const totalKitValue = chipSet.reduce(
      (total, chip) => total + chip.value * chip.quantity,
      0
    );
    const balanceValue = totalKitValue - totalUsedValue;
    const possible =
      distributionResult.remaining === 0 &&
      distribution.every((chip) => chip.totalUsed <= chip.quantity);

    return {
      distribution,
      players,
      stack,
      totalPerPlayer,
      totalUsedValue,
      totalKitValue,
      balanceValue,
      remaining: distributionResult.remaining,
      possible,
    };
  }, [chipSet, desiredStack, stackOverrides, stackPlayers]);

  const totalChipQuantity = useMemo(
    () => chipSet.reduce((total, chip) => total + chip.quantity, 0),
    [chipSet]
  );
  const totalChipValue = useMemo(
    () => chipSet.reduce((total, chip) => total + chip.value * chip.quantity, 0),
    [chipSet]
  );

  function updateBlindLevel(
    levelNumber: number,
    field: keyof Pick<BlindLevel, "smallBlind" | "durationMinutes" | "ante">,
    value: string
  ) {
    const nextValue = Math.max(Number.parseInt(value || "0", 10) || 0, 0);

    setBlindLevels((currentLevels) =>
      currentLevels.map((level) =>
        level.levelNumber === levelNumber
          ? field === "smallBlind"
            ? { ...level, smallBlind: nextValue, bigBlind: nextValue * 2 }
            : { ...level, [field]: nextValue }
          : level
      )
    );
  }

  function handleApplyDurationToAll() {
    const nextDuration = Math.max(Number.parseInt(applyDurationMinutes || "0", 10) || 0, 0);

    if (nextDuration <= 0) {
      return;
    }

    setBlindLevels((currentLevels) =>
      currentLevels.map((level) => ({
        ...level,
        durationMinutes: nextDuration,
      }))
    );
  }

  function handleToggleAnte(enabled: boolean) {
    setAnteEnabled(enabled);
    setBlindLevels((currentLevels) =>
      currentLevels.map((level) => ({
        ...level,
        ante: enabled ? level.ante ?? 0 : 0,
      }))
    );
  }

  function handleAddBlindLevel() {
    setBlindLevels((currentLevels) => {
      const lastLevel = currentLevels[currentLevels.length - 1];
      const nextSmallBlind = lastLevel ? lastLevel.bigBlind : 25;

      return [
        ...currentLevels,
        {
          levelNumber: currentLevels.length + 1,
          smallBlind: nextSmallBlind,
          bigBlind: nextSmallBlind * 2,
          durationMinutes: lastLevel?.durationMinutes ?? 15,
          ante: anteEnabled ? lastLevel?.ante ?? 0 : 0,
        },
      ];
    });
  }

  function handleRemoveBlindLevel(levelNumber: number) {
    setBlindLevels((currentLevels) =>
      currentLevels.length <= 1
        ? currentLevels
        : currentLevels
            .filter((level) => level.levelNumber !== levelNumber)
            .map((level, index) => ({
              ...level,
              levelNumber: index + 1,
            }))
    );
  }

  function updateChipItem(
    index: number,
    field: keyof ChipSetItem,
    value: string
  ) {
    setChipSet((currentItems) =>
      currentItems.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (field === "color") {
          return { ...item, color: value };
        }

        return {
          ...item,
          [field]: Math.max(Number.parseInt(value || "0", 10) || 0, 0),
        };
      })
    );
  }

  function handleAddChipItem() {
    setChipSet((currentItems) => [
      ...currentItems,
      {
        value: 0,
        color: chipColorOptions[0]?.value ?? "#F1C40F",
        quantity: 0,
      },
    ]);
  }

  function handleRemoveChipItem(index: number) {
    setChipSet((currentItems) =>
      currentItems.length <= 1
        ? currentItems
        : currentItems.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function updateAnnualAward(index: number, value: string) {
    const nextValue = Math.max(Number.parseInt(value || "0", 10) || 0, 0);

    setAnnualAwards((currentAwards) =>
      currentAwards.map((award, awardIndex) =>
        awardIndex === index ? { ...award, percentage: nextValue } : award
      )
    );
  }

  function updateStackCount(chipKey: string, value: string) {
    setStackOverrides((currentOverrides) => ({
      ...currentOverrides,
      [chipKey]: value,
    }));
  }

  function handleAddAwardPosition() {
    setAnnualAwards((currentAwards) => {
      const nextPosition = currentAwards.length + 1;

      return [...currentAwards, { position: nextPosition, percentage: 0 }];
    });
  }

  function handleApplyAwardPreset(presetKey: keyof typeof annualAwardPresets) {
    setAnnualAwards(annualAwardPresets[presetKey].map((award) => ({ ...award })));
  }

  function handleRemoveAwardPosition(position: number) {
    setAnnualAwards((currentAwards) =>
      currentAwards
        .filter((award) => award.position !== position)
        .map((award, index) => ({
          ...award,
          position: index + 1,
        }))
    );
  }

  function handleSaveSettings() {
    try {
      window.localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          championshipName,
          seasonYear,
          buyInAnnual,
          buyInDaily,
          breakDurationMinutes,
          breakEveryLevels,
          blindLevels,
          actionClockPreset,
          showActionClockOnTable,
          chipSet,
          annualAwards,
          stackPlayers,
          desiredStack,
          stackOverrides,
          applyDurationMinutes,
          anteEnabled,
        })
      );
      setSaveStatus("saved");
      window.setTimeout(() => {
        setSaveStatus("idle");
      }, 2400);
    } catch {
      setSaveStatus("error");
    }
  }

  return (
    <section className="rounded-[1.8rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.28)] md:p-6">
      <div className="flex flex-col gap-4 border-b border-[rgba(255,208,101,0.1)] pb-5">
        <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[rgba(236,225,196,0.68)]">
          SHPL 2026
        </p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[rgba(255,244,214,0.96)] md:text-4xl">
            Configuracoes
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[rgba(236,225,196,0.74)]">
            Painel administrativo com ajustes do campeonato, estrutura da etapa, cronometros,
            stacks, fichas e premiacao anual.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[1.45rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-3">
          <div className="grid gap-2">
            {settingsSections.map((section) => {
              const isActive = section.id === activeSection;

              return (
                <button
                  key={section.id}
                  className={`rounded-[1.1rem] border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-[rgba(255,208,101,0.28)] bg-[rgba(255,183,32,0.12)]"
                      : "border-transparent bg-transparent hover:border-[rgba(255,208,101,0.12)] hover:bg-[rgba(255,255,255,0.02)]"
                  }`}
                  onClick={() => setActiveSection(section.id)}
                  type="button"
                >
                  <p className="text-sm font-semibold text-[rgba(255,244,214,0.96)]">
                    {section.label}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                    {section.helper}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="grid gap-5">
          {activeSection === "campeonato" ? (
            <article className="rounded-[1.45rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-5">
              <SectionHeader
                title="Configuracoes do campeonato"
                description="Base administrativa do SHPL 2026, incluindo temporada, buy-ins e comportamento geral da etapa."
              />

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Nome do campeonato">
                  <input
                    className={inputClassName}
                    onChange={(event) => setChampionshipName(event.target.value)}
                    value={championshipName}
                  />
                </Field>
                <Field label="Temporada">
                  <input
                    className={inputClassName}
                    onChange={(event) => setSeasonYear(event.target.value)}
                    value={seasonYear}
                  />
                </Field>
                <Field label="Buy-in anual (R$)">
                  <input
                    className={inputClassName}
                    onChange={(event) => setBuyInAnnual(event.target.value)}
                    value={buyInAnnual}
                  />
                </Field>
                <Field label="Buy-in do dia (R$)">
                  <input
                    className={inputClassName}
                    onChange={(event) => setBuyInDaily(event.target.value)}
                    value={buyInDaily}
                  />
                </Field>
                <Field label="Duracao do intervalo (min)">
                  <input
                    className={inputClassName}
                    inputMode="numeric"
                    onChange={(event) => setBreakDurationMinutes(event.target.value)}
                    type="number"
                    value={breakDurationMinutes}
                  />
                </Field>
                <Field label="Intervalo a cada quantos blinds">
                  <input
                    className={inputClassName}
                    inputMode="numeric"
                    onChange={(event) => setBreakEveryLevels(event.target.value)}
                    type="number"
                    value={breakEveryLevels}
                  />
                </Field>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <InfoCard label="Etapa atual" value={snapshot.currentStage.title} />
                <InfoCard label="Jogadores ativos" value={`${snapshot.annualRanking.length}`} />
                <InfoCard label="Pote anual" value={snapshot.financialSummary.annualPot} />
              </div>
            </article>
          ) : null}

          {activeSection === "blinds" ? (
            <article className="rounded-[1.45rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-5">
              <SectionHeader
                title="Estrutura de blinds"
                description="Configure small blind, duracao em minutos, ante opcional e a progressao da estrutura usada nas etapas."
              />

              <div className="mt-5 grid gap-4 rounded-[1.15rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <Field label="Ajustar tempo para todos os blinds (min)">
                    <input
                      className={inputClassName}
                      onChange={(event) => setApplyDurationMinutes(event.target.value)}
                      value={applyDurationMinutes}
                    />
                  </Field>
                  <div className="flex items-end">
                    <button
                      className="h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.2)] bg-[rgba(255,183,32,0.12)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.98)] transition hover:bg-[rgba(255,183,32,0.18)]"
                      onClick={handleApplyDurationToAll}
                      type="button"
                    >
                      Aplicar a todos
                    </button>
                  </div>
                </div>

                <Field label="Ante">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className={anteEnabled ? selectedChipButtonClassName : chipButtonClassName}
                      onClick={() => handleToggleAnte(true)}
                      type="button"
                    >
                      Sim
                    </button>
                    <button
                      className={!anteEnabled ? selectedChipButtonClassName : chipButtonClassName}
                      onClick={() => handleToggleAnte(false)}
                      type="button"
                    >
                      Nao
                    </button>
                  </div>
                </Field>
              </div>

              <div className="mt-5 grid gap-3">
                {blindLevels.map((level) => (
                  <div
                    key={level.levelNumber}
                    className={`grid gap-3 rounded-[1.15rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] p-4 ${
                      anteEnabled
                        ? "md:grid-cols-[90px_repeat(4,minmax(0,1fr))_56px]"
                        : "md:grid-cols-[90px_repeat(3,minmax(0,1fr))_56px]"
                    }`}
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[rgba(236,225,196,0.48)]">
                        Nivel
                      </p>
                      <p className="mt-1 text-lg font-semibold text-[rgba(255,244,214,0.96)]">
                        {level.levelNumber}
                      </p>
                    </div>

                    <Field label="Small blind">
                      <input
                        className={inputClassName}
                        onChange={(event) =>
                          updateBlindLevel(level.levelNumber, "smallBlind", event.target.value)
                        }
                        value={String(level.smallBlind)}
                      />
                    </Field>

                    <Field label="Big blind">
                      <input
                        className={`${inputClassName} opacity-70`}
                        readOnly
                        value={String(level.bigBlind)}
                      />
                    </Field>

                    <Field label="Duracao (min)">
                      <input
                        className={inputClassName}
                        onChange={(event) =>
                          updateBlindLevel(
                            level.levelNumber,
                            "durationMinutes",
                            event.target.value
                          )
                        }
                        value={String(level.durationMinutes)}
                      />
                    </Field>

                    {anteEnabled ? (
                      <Field label="Ante">
                        <input
                          className={inputClassName}
                          onChange={(event) =>
                            updateBlindLevel(level.levelNumber, "ante", event.target.value)
                          }
                          value={String(level.ante ?? 0)}
                        />
                      </Field>
                    ) : null}

                    <div className="flex items-end">
                      <button
                        className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-[rgba(255,132,92,0.24)] bg-[rgba(255,132,92,0.08)] text-lg font-semibold text-[rgba(255,203,184,0.96)] transition hover:bg-[rgba(255,132,92,0.14)] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={blindLevels.length <= 1}
                        onClick={() => handleRemoveBlindLevel(level.levelNumber)}
                        type="button"
                      >
                        -
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                className={secondaryButtonClassName}
                onClick={handleAddBlindLevel}
                type="button"
              >
                Adicionar nivel
              </button>
            </article>
          ) : null}

          {activeSection === "tempo" ? (
            <article className="rounded-[1.45rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-5">
              <SectionHeader
                title="Temporizacao e cronometros"
                description="Defina o tempo unico do cronometro de acao e escolha se ele deve aparecer ou nao na tela da mesa."
              />

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Tempo do cronometro de acao">
                  <select
                    className={inputClassName}
                    onChange={(event) => setActionClockPreset(event.target.value)}
                    value={actionClockPreset}
                  >
                    {[15, 20, 25, 30, 35, 45].map((option) => (
                      <option key={option} value={option}>
                        {option} segundos
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Mostrar na mesa">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className={
                        showActionClockOnTable
                          ? selectedChipButtonClassName
                          : chipButtonClassName
                      }
                      onClick={() => setShowActionClockOnTable(true)}
                      type="button"
                    >
                      Sim
                    </button>
                    <button
                      className={
                        !showActionClockOnTable
                          ? selectedChipButtonClassName
                          : chipButtonClassName
                      }
                      onClick={() => setShowActionClockOnTable(false)}
                      type="button"
                    >
                      Nao
                    </button>
                  </div>
                </Field>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <InfoCard
                  label="Tempo padrao do blind"
                  value={`${blindLevels[0]?.durationMinutes ?? 0} min`}
                />
                <InfoCard
                  label="Cronometro configurado"
                  value={`${actionClockPreset}s`}
                />
                <InfoCard
                  label="Exibicao na mesa"
                  value={showActionClockOnTable ? "Ativa" : "Oculta"}
                />
              </div>
            </article>
          ) : null}

          {activeSection === "fichas" ? (
            <article className="rounded-[1.45rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-5">
              <SectionHeader
                title="Kit de fichas"
                description="Cadastre o kit real de fichas do campeonato com valor, cor e quantidade disponivel."
              />

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <InfoCard label="Total de fichas" value={`${totalChipQuantity}`} />
                <InfoCard label="Valores cadastrados" value={`${chipSet.length}`} />
                <InfoCard
                  label="Valor total"
                  value={formatCurrencyDisplay(totalChipValue)}
                />
              </div>

              <div className="mt-5 grid gap-3">
                {chipSet.map((chip, index) => (
                  <div
                    key={`chip-row-${index}`}
                    className="grid min-w-0 gap-3 rounded-[1.15rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] p-4 lg:grid-cols-[76px_minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,1fr)_56px] lg:items-end"
                  >
                    <div className="flex items-center justify-center lg:justify-start">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(255,208,101,0.16)] bg-[rgba(255,255,255,0.03)]">
                        <span
                          className="h-10 w-10 rounded-full border border-[rgba(255,255,255,0.24)]"
                          style={{ backgroundColor: chip.color }}
                        />
                      </div>
                    </div>

                    <Field label="Valor da ficha">
                      <input
                        className={inputClassName}
                        inputMode="numeric"
                        onChange={(event) => updateChipItem(index, "value", event.target.value)}
                        type="number"
                        value={String(chip.value)}
                      />
                    </Field>

                    <Field label="Cor">
                      <select
                        className={inputClassName}
                        onChange={(event) => updateChipItem(index, "color", event.target.value)}
                        value={chip.color}
                      >
                        {chipColorOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Quantidade no kit">
                      <input
                        className={inputClassName}
                        inputMode="numeric"
                        onChange={(event) => updateChipItem(index, "quantity", event.target.value)}
                        type="number"
                        value={String(chip.quantity)}
                      />
                    </Field>

                    <div className="flex items-end">
                      <button
                        className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-[rgba(255,132,92,0.24)] bg-[rgba(255,132,92,0.08)] text-lg font-semibold text-[rgba(255,203,184,0.96)] transition hover:bg-[rgba(255,132,92,0.14)] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={chipSet.length <= 1}
                        onClick={() => handleRemoveChipItem(index)}
                        type="button"
                      >
                        -
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                className={secondaryButtonClassName}
                onClick={handleAddChipItem}
                type="button"
              >
                Adicionar valor de ficha
              </button>
            </article>
          ) : null}

          {activeSection === "stack" ? (
            <article className="rounded-[1.45rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-5">
              <SectionHeader
                title="Calculadora de stack"
                description="A distribuicao base e calculada automaticamente. Se quiser, ajuste a quantidade por jogador em qualquer linha e o total sera recalculado na hora."
              />

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Quantidade de jogadores">
                  <input
                    className={inputClassName}
                    onChange={(event) => setStackPlayers(event.target.value)}
                    value={stackPlayers}
                  />
                </Field>
                <Field label="Stack inicial desejado">
                  <input
                    className={inputClassName}
                    onChange={(event) => setDesiredStack(event.target.value)}
                    value={desiredStack}
                  />
                </Field>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <InfoCard
                  label="Valor total do kit"
                  value={formatNumberDisplay(stackCalculation.totalKitValue)}
                />
                <InfoCard
                  label="Valor usado"
                  value={formatNumberDisplay(stackCalculation.totalUsedValue)}
                />
                <InfoCard
                  label="Saldo do kit"
                  value={`${stackCalculation.balanceValue >= 0 ? "+" : "-"} ${formatNumberDisplay(Math.abs(stackCalculation.balanceValue))}`}
                  tone={
                    stackCalculation.balanceValue > 0
                      ? "success"
                      : stackCalculation.balanceValue < 0
                        ? "danger"
                        : "default"
                  }
                />
                <InfoCard
                  label="Stack final por jogador"
                  value={formatNumberDisplay(stackCalculation.totalPerPlayer)}
                  helper={`${stackCalculation.possible ? "configuracao viavel" : "ajuste necessario"}`}
                />
              </div>

              <div className="mt-5 grid gap-3">
                {stackCalculation.distribution.map((chip) => (
                  <div
                    key={chip.key}
                    className={`grid gap-3 rounded-[1.15rem] border p-4 md:grid-cols-[80px_1fr_1.1fr_1fr_1fr] ${
                      chip.exceedsAvailable
                        ? "border-[rgba(255,132,92,0.24)] bg-[rgba(255,132,92,0.08)]"
                        : "border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)]"
                    }`}
                  >
                    <div className="flex items-center">
                      <span
                        className="h-11 w-11 rounded-full border border-[rgba(255,255,255,0.24)]"
                        style={{ backgroundColor: chip.color }}
                      />
                    </div>
                    <InfoRow label="Valor" value={String(chip.value)} />
                    <Field label="Por jogador">
                      <input
                        className={inputClassName}
                        inputMode="numeric"
                        onChange={(event) => updateStackCount(chip.key, event.target.value)}
                        type="number"
                        value={String(chip.countPerPlayer)}
                      />
                    </Field>
                    <InfoRow label="Total usado" value={String(chip.totalUsed)} />
                    <InfoRow
                      label="Disponivel por jogador"
                      value={`${chip.availablePerPlayer}${chip.exceedsAvailable ? " (excedido)" : ""}`}
                    />
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {activeSection === "premiacao" ? (
            <article className="rounded-[1.45rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-5">
              <SectionHeader
                title="Premiacao anual"
                description="As quatro primeiras colocacoes ficam fixas no bloco principal. Use uma predefinicao pronta ou adicione quantas colocacoes extras precisar."
              />

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <button
                  className={secondaryButtonClassName}
                  onClick={() => handleApplyAwardPreset("four")}
                  type="button"
                >
                  Predefinicao 4 lugares
                </button>
                <button
                  className={secondaryButtonClassName}
                  onClick={() => handleApplyAwardPreset("six")}
                  type="button"
                >
                  Predefinicao 6 lugares
                </button>
                <button
                  className={secondaryButtonClassName}
                  onClick={() => handleApplyAwardPreset("eight")}
                  type="button"
                >
                  Predefinicao 8 lugares
                </button>
              </div>

              <div className="mt-5 grid gap-3">
                {annualAwards.map((award, index) => {
                  const isFixedAward = award.position <= 4;

                  return (
                  <div
                    key={`${award.position}-${index}`}
                    className="grid gap-3 rounded-[1.15rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] p-4 md:grid-cols-[1.15fr_1fr_auto]"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                        Colocacao
                      </p>
                      <div className="mt-2 flex h-11 items-center rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm font-semibold text-[rgba(255,244,214,0.96)]">
                        {award.position}o lugar
                      </div>
                    </div>
                    <Field label="Percentual do pote">
                      <input
                        className={inputClassName}
                        onChange={(event) => updateAnnualAward(index, event.target.value)}
                        value={String(award.percentage)}
                      />
                    </Field>
                    <div className="flex items-end">
                      {isFixedAward ? (
                        <div className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-[rgba(255,208,101,0.1)] bg-[rgba(255,255,255,0.03)] text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(236,225,196,0.44)]">
                          fixo
                        </div>
                      ) : (
                        <button
                          className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-[rgba(255,132,92,0.24)] bg-[rgba(255,132,92,0.08)] text-lg font-semibold text-[rgba(255,203,184,0.96)] transition hover:bg-[rgba(255,132,92,0.14)]"
                          onClick={() => handleRemoveAwardPosition(award.position)}
                          type="button"
                        >
                          -
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>

              <button
                className="mt-4 h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.2)] bg-[rgba(255,183,32,0.12)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.98)] transition hover:bg-[rgba(255,183,32,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleAddAwardPosition}
                type="button"
              >
                +1 colocacao
              </button>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <InfoCard
                  label="Pote anual atual"
                  value={snapshot.financialSummary.annualPot}
                />
                <InfoCard
                  label="Premiados configurados"
                  value={String(annualAwards.length)}
                />
                <InfoCard
                  label="Percentual total"
                  value={`${annualAwards.reduce((total, award) => total + award.percentage, 0)}%`}
                />
              </div>
            </article>
          ) : null}

          {activeSection === "dataset" ? <SHPLCardDatasetSettings /> : null}
        </div>
      </div>

      <div className="mt-6 border-t border-[rgba(255,208,101,0.1)] pt-5">
        <div className="flex justify-end">
          <button
            className={`h-12 rounded-[0.95rem] border px-5 text-sm font-semibold transition ${
              saveStatus === "saved"
                ? "border-[rgba(129,211,120,0.34)] bg-[linear-gradient(180deg,#7fd066_0%,#2f8a3b_100%)] text-[#041b08]"
                : saveStatus === "error"
                  ? "border-[rgba(255,132,92,0.26)] bg-[rgba(255,132,92,0.12)] text-[rgba(255,214,198,0.98)]"
                  : "border-[rgba(255,208,101,0.22)] bg-[linear-gradient(180deg,#ffd54e_0%,#c88807_100%)] text-[#2a1a00]"
            }`}
            onClick={handleSaveSettings}
            type="button"
          >
            {saveStatus === "saved"
              ? "Ajustes salvos"
              : saveStatus === "error"
                ? "Erro ao salvar"
                : "Salvar ajustes"}
          </button>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-[rgba(255,244,214,0.96)]">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[rgba(236,225,196,0.68)]">
        {description}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function InfoCard({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "success" | "danger";
}) {
  const toneClassName =
    tone === "success"
      ? "text-[rgba(167,229,178,0.92)]"
      : tone === "danger"
        ? "text-[rgba(255,184,143,0.96)]"
        : "text-[rgba(255,244,214,0.96)]";

  return (
    <div className="rounded-[1.15rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
        {label}
      </p>
      <p className={`mt-2 text-xl font-semibold ${toneClassName}`}>{value}</p>
      {helper ? (
        <p className="mt-1 text-sm text-[rgba(236,225,196,0.62)]">{helper}</p>
      ) : null}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
        {label}
      </p>
      <p className="mt-1 text-base font-medium text-[rgba(255,244,214,0.96)]">{value}</p>
    </div>
  );
}

function formatCurrencyDisplay(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatNumberDisplay(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

const inputClassName =
  "h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none placeholder:text-[rgba(236,225,196,0.4)]";

const secondaryButtonClassName =
  "mt-5 h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.2)] bg-[rgba(255,183,32,0.12)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.98)] transition hover:bg-[rgba(255,183,32,0.18)]";

const chipButtonClassName =
  "h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm font-medium text-[rgba(255,244,214,0.82)]";

const selectedChipButtonClassName =
  "h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.28)] bg-[rgba(255,183,32,0.12)] px-4 text-sm font-semibold text-[rgba(255,236,184,0.98)]";
