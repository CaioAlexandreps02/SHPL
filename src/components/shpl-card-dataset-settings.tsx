"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  deleteSavedCardSample,
  getSavedCardSampleBlob,
  listSavedCardSamples,
  replaceSavedCardSampleBlob,
  saveCardSample,
  updateSavedCardSampleLabels,
  type SavedCardSampleSummary,
} from "@/lib/live-lab/browser-card-dataset-store";

const CARD_RANK_OPTIONS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
const CARD_SUIT_OPTIONS = ["copas", "espadas", "ouros", "paus"];

type ExportedCardDatasetSample = {
  id: string;
  fileName: string;
  capturedAt: string;
  boardStage: SavedCardSampleSummary["boardStage"];
  sourceImageName: string | null;
  sourceCardIndex: number;
  sourceCardCount: number;
  width: number;
  height: number;
  confidence: number | null;
  cornerConfidence: number | null;
  rankLabel: string;
  suitLabel: string;
  imageDataUrl: string;
};

type ExportedCardDatasetPayload = {
  version: 1;
  exportedAt: string;
  source: "shpl-live-lab";
  sampleCount: number;
  samples: ExportedCardDatasetSample[];
};

export function SHPLCardDatasetSettings() {
  const datasetImportInputRef = useRef<HTMLInputElement | null>(null);
  const datasetReplaceInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCardSampleUrlRef = useRef("");
  const [savedCardSamples, setSavedCardSamples] = useState<SavedCardSampleSummary[]>([]);
  const [isLoadingSavedCardSamples, setIsLoadingSavedCardSamples] = useState(true);
  const [isImportingCardPhotos, setIsImportingCardPhotos] = useState(false);
  const [isExportingCardDataset, setIsExportingCardDataset] = useState(false);
  const [cardDatasetStatus, setCardDatasetStatus] = useState("");
  const [selectedCardSampleId, setSelectedCardSampleId] = useState("");
  const [selectedCardSampleUrl, setSelectedCardSampleUrl] = useState("");
  const [selectedCardSampleBlobVersion, setSelectedCardSampleBlobVersion] = useState(0);

  const selectedCardSample = useMemo(
    () => savedCardSamples.find((sample) => sample.id === selectedCardSampleId) ?? null,
    [savedCardSamples, selectedCardSampleId],
  );

  const refreshSavedCardSamples = useCallback(async () => {
    try {
      setIsLoadingSavedCardSamples(true);
      const cardSamples = await listSavedCardSamples();
      setSavedCardSamples(cardSamples);

      if (!selectedCardSampleId && cardSamples[0]?.id) {
        setSelectedCardSampleId(cardSamples[0].id);
      } else if (
        selectedCardSampleId &&
        !cardSamples.some((sample) => sample.id === selectedCardSampleId)
      ) {
        setSelectedCardSampleId(cardSamples[0]?.id ?? "");
      }
    } catch {
      setCardDatasetStatus("Nao foi possivel atualizar a base local das cartas.");
    } finally {
      setIsLoadingSavedCardSamples(false);
    }
  }, [selectedCardSampleId]);

  useEffect(() => {
    void refreshSavedCardSamples();
  }, [refreshSavedCardSamples]);

  useEffect(() => {
    return () => {
      if (selectedCardSampleUrlRef.current) {
        URL.revokeObjectURL(selectedCardSampleUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedCardSampleId) {
      if (selectedCardSampleUrlRef.current) {
        URL.revokeObjectURL(selectedCardSampleUrlRef.current);
        selectedCardSampleUrlRef.current = "";
      }
      setSelectedCardSampleUrl("");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const blob = await getSavedCardSampleBlob(selectedCardSampleId);

        if (cancelled) {
          return;
        }

        if (selectedCardSampleUrlRef.current) {
          URL.revokeObjectURL(selectedCardSampleUrlRef.current);
        }

        const nextUrl = blob ? URL.createObjectURL(blob) : "";
        selectedCardSampleUrlRef.current = nextUrl;
        setSelectedCardSampleUrl(nextUrl);
      } catch {
        if (!cancelled) {
          setCardDatasetStatus("Nao foi possivel abrir a amostra da carta.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCardSampleId, selectedCardSampleBlobVersion]);

  async function saveSelectedCardSampleLabels(
    id: string,
    labels: { rankLabel: string | null; suitLabel: string | null },
  ) {
    try {
      await updateSavedCardSampleLabels(id, labels);
      await refreshSavedCardSamples();
    } catch {
      setCardDatasetStatus("Nao foi possivel atualizar os rotulos da carta.");
    }
  }

  async function removeSelectedCardSample() {
    if (!selectedCardSampleId) {
      return;
    }

    try {
      await deleteSavedCardSample(selectedCardSampleId);
      setSelectedCardSampleId("");
      await refreshSavedCardSamples();
      setCardDatasetStatus("Amostra excluida com sucesso.");
    } catch {
      setCardDatasetStatus("Nao foi possivel excluir a amostra da carta.");
    }
  }

  async function handleImportCardPhotoFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    try {
      setCardDatasetStatus("Importando fotos para o dataset...");
      setIsImportingCardPhotos(true);
      const importedSummaries: SavedCardSampleSummary[] = [];

      for (const file of Array.from(fileList)) {
        const image = await loadImageFromFile(file);
        const summary = await saveCardSample({
          blob: file,
          capturedAt: new Date().toISOString(),
          boardStage: "unknown",
          sourceImageName: file.name,
          sourceCardIndex: 1,
          sourceCardCount: 1,
          width: image.naturalWidth,
          height: image.naturalHeight,
          confidence: null,
          cornerConfidence: null,
          rankLabel: null,
          suitLabel: null,
        });

        importedSummaries.push(summary);
      }

      await refreshSavedCardSamples();

      if (importedSummaries[0]?.id) {
        setSelectedCardSampleId(importedSummaries[0].id);
      }

      setCardDatasetStatus(`${importedSummaries.length} amostra(s) importada(s) com sucesso.`);
    } catch {
      setCardDatasetStatus("Nao foi possivel importar as fotos para o dataset.");
    } finally {
      setIsImportingCardPhotos(false);
      if (datasetImportInputRef.current) {
        datasetImportInputRef.current.value = "";
      }
    }
  }

  async function exportLabeledCardDataset() {
    const labeledSamples = savedCardSamples.filter(
      (sample): sample is SavedCardSampleSummary & { rankLabel: string; suitLabel: string } =>
        Boolean(sample.rankLabel && sample.suitLabel),
    );

    if (labeledSamples.length === 0) {
      setCardDatasetStatus("Ainda nao existem cartas rotuladas para exportar.");
      return;
    }

    try {
      setIsExportingCardDataset(true);
      setCardDatasetStatus("Exportando dataset rotulado das cartas...");
      const exportedSamples: ExportedCardDatasetSample[] = [];

      for (const sample of labeledSamples) {
        const blob = await getSavedCardSampleBlob(sample.id);

        if (!blob) {
          continue;
        }

        const extension = resolveImageExtension(blob.type);
        exportedSamples.push({
          id: sample.id,
          fileName: buildCardDatasetFileName(sample, extension),
          capturedAt: sample.capturedAt,
          boardStage: sample.boardStage,
          sourceImageName: sample.sourceImageName,
          sourceCardIndex: sample.sourceCardIndex,
          sourceCardCount: sample.sourceCardCount,
          width: sample.width,
          height: sample.height,
          confidence: sample.confidence,
          cornerConfidence: sample.cornerConfidence,
          rankLabel: sample.rankLabel,
          suitLabel: sample.suitLabel,
          imageDataUrl: await blobToDataUrl(blob),
        });
      }

      const payload: ExportedCardDatasetPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        source: "shpl-live-lab",
        sampleCount: exportedSamples.length,
        samples: exportedSamples,
      };

      const exportBlob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const downloadUrl = URL.createObjectURL(exportBlob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `shpl-live-lab-card-dataset-${formatFileTimestamp(new Date())}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);

      setCardDatasetStatus(
        `${exportedSamples.length} amostra(s) rotulada(s) exportada(s) para treino.`,
      );
    } catch {
      setCardDatasetStatus("Nao foi possivel exportar o dataset das cartas.");
    } finally {
      setIsExportingCardDataset(false);
    }
  }

  function openDatasetImportPicker() {
    datasetImportInputRef.current?.click();
  }

  function openReplaceSelectedCardSamplePicker() {
    datasetReplaceInputRef.current?.click();
  }

  async function handleReplaceSelectedCardSampleFile(fileList: FileList | null) {
    if (!selectedCardSample || !fileList || fileList.length === 0) {
      return;
    }

    const file = fileList[0];

    try {
      setCardDatasetStatus("Substituindo a imagem da amostra selecionada...");
      const image = await loadImageFromFile(file);
      const summary = await replaceSavedCardSampleBlob(selectedCardSample.id, {
        blob: file,
        width: image.naturalWidth,
        height: image.naturalHeight,
        sourceImageName: file.name,
      });

      setSelectedCardSampleUrl("");
      await refreshSavedCardSamples();
      setSelectedCardSampleId(summary.id);
      setSelectedCardSampleBlobVersion((current) => current + 1);
      setCardDatasetStatus("Imagem da amostra substituida com sucesso.");
    } catch {
      setCardDatasetStatus("Nao foi possivel substituir a imagem da amostra.");
    } finally {
      if (datasetReplaceInputRef.current) {
        datasetReplaceInputRef.current.value = "";
      }
    }
  }

  return (
    <article className="rounded-[1.45rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-5">
      <input
        ref={datasetImportInputRef}
        accept="image/*"
        className="hidden"
        multiple
        onChange={(event) => {
          void handleImportCardPhotoFiles(event.target.files);
        }}
        type="file"
      />
      <input
        ref={datasetReplaceInputRef}
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleReplaceSelectedCardSampleFile(event.target.files);
        }}
        type="file"
      />

      <SectionHeader
        title="Dataset local das cartas"
        description="Gerencie a base local das cartas do baralho, ajuste imagens, rotule rank e naipe e exporte o dataset para treino."
      />

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <InfoBadge value={`${savedCardSamples.length} amostra(s)`} />
          <SettingsButton
            label={isImportingCardPhotos ? "Importando fotos..." : "Importar fotos"}
            onClick={openDatasetImportPicker}
            tone="muted"
            disabled={isImportingCardPhotos}
          />
          <SettingsButton
            label={isExportingCardDataset ? "Exportando dataset..." : "Exportar dataset"}
            onClick={() => {
              void exportLabeledCardDataset();
            }}
            tone="muted"
            disabled={isExportingCardDataset || savedCardSamples.length === 0}
          />
        </div>
      </div>

      {cardDatasetStatus ? (
        <div className="mt-4 rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] px-4 py-4 text-sm leading-7 text-[rgba(237,226,197,0.76)]">
          {cardDatasetStatus}
        </div>
      ) : null}

      {isLoadingSavedCardSamples ? (
        <div className="mt-4 rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] px-4 py-4 text-sm leading-7 text-[rgba(237,226,197,0.68)]">
          Carregando a base local das cartas...
        </div>
      ) : savedCardSamples.length === 0 ? (
        <div className="mt-4 rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] px-4 py-4 text-sm leading-7 text-[rgba(237,226,197,0.68)]">
          Assim que voce importar ou cadastrar cartas, elas vao aparecer aqui para rotulagem e revisao.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1">
            {savedCardSamples.map((sample) => (
              <button
                key={sample.id}
                className={`rounded-[1rem] border px-4 py-4 text-left transition ${
                  sample.id === selectedCardSampleId
                    ? "border-[rgba(255,208,101,0.28)] bg-[rgba(255,183,32,0.1)]"
                    : "border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)]"
                }`}
                onClick={() => setSelectedCardSampleId(sample.id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-[rgba(255,239,192,0.96)]">
                    {sample.rankLabel && sample.suitLabel
                      ? `${sample.rankLabel} de ${sample.suitLabel}`
                      : `Carta ${sample.sourceCardIndex}`}
                  </p>
                  <span className="text-[0.68rem] uppercase tracking-[0.18em] text-[rgba(240,227,189,0.48)]">
                    {formatBoardStage(sample.boardStage)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[rgba(237,226,197,0.72)]">
                  {sample.rankLabel && sample.suitLabel
                    ? "Rotulada e pronta para treino."
                    : "Ainda sem rotulagem manual."}
                </p>
                {sample.sourceImageName ? (
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[rgba(240,227,189,0.44)]">
                    {sample.sourceImageName}
                  </p>
                ) : null}
              </button>
            ))}
          </div>

          <div className="rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(7,24,18,0.56)] p-4">
            {selectedCardSample ? (
              <>
                <div className="overflow-hidden rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(0,0,0,0.35)]">
                  {selectedCardSampleUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt="Amostra de carta"
                      className="h-[16rem] w-full object-contain"
                      src={selectedCardSampleUrl}
                    />
                  ) : (
                    <div className="flex h-[16rem] items-center justify-center text-sm text-[rgba(237,226,197,0.62)]">
                      Abrindo recorte da carta...
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Rank">
                    <select
                      className={inputClassName}
                      onChange={(event) => {
                        const nextRank = event.target.value || null;
                        void saveSelectedCardSampleLabels(selectedCardSample.id, {
                          rankLabel: nextRank,
                          suitLabel: selectedCardSample.suitLabel,
                        });
                      }}
                      value={selectedCardSample.rankLabel ?? ""}
                    >
                      <option value="">Nao rotulado</option>
                      {CARD_RANK_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Naipe">
                    <select
                      className={inputClassName}
                      onChange={(event) => {
                        const nextSuit = event.target.value || null;
                        void saveSelectedCardSampleLabels(selectedCardSample.id, {
                          rankLabel: selectedCardSample.rankLabel,
                          suitLabel: nextSuit,
                        });
                      }}
                      value={selectedCardSample.suitLabel ?? ""}
                    >
                      <option value="">Nao rotulado</option>
                      {CARD_SUIT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <InfoRow label="Capturada em" value={formatDateTime(selectedCardSample.capturedAt)} />
                  <InfoRow
                    label="Origem"
                    value={`${formatBoardStage(selectedCardSample.boardStage)} · carta ${selectedCardSample.sourceCardIndex} de ${selectedCardSample.sourceCardCount}`}
                  />
                  <InfoRow
                    label="Arquivo"
                    value={selectedCardSample.sourceImageName ?? "captura ao vivo"}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <SettingsButton
                    label="Substituir imagem"
                    onClick={openReplaceSelectedCardSamplePicker}
                    tone="accent"
                  />
                  <SettingsButton
                    label="Excluir amostra"
                    onClick={() => {
                      void removeSelectedCardSample();
                    }}
                    tone="muted"
                  />
                </div>
              </>
            ) : (
              <div className="text-sm leading-7 text-[rgba(237,226,197,0.68)]">
                Selecione uma amostra salva para revisar o recorte e rotular rank e naipe.
              </div>
            )}
          </div>
        </div>
      )}
    </article>
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

function InfoBadge({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-[0.72rem] font-black uppercase tracking-[0.16em] text-[rgba(255,239,192,0.92)]">
      {value}
    </span>
  );
}

function SettingsButton({
  label,
  onClick,
  tone,
  disabled,
}: {
  label: string;
  onClick: () => void;
  tone: "accent" | "muted";
  disabled?: boolean;
}) {
  const className =
    tone === "accent"
      ? "h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.2)] bg-[rgba(255,183,32,0.12)] px-5 text-sm font-semibold text-[rgba(255,236,184,0.98)] transition hover:bg-[rgba(255,183,32,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
      : "h-11 rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-5 text-sm font-semibold text-[rgba(255,244,214,0.88)] transition hover:bg-[rgba(255,255,255,0.04)] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <button className={className} disabled={disabled} onClick={onClick} type="button">
      {label}
    </button>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatFileTimestamp(value: Date) {
  const year = value.getFullYear().toString();
  const month = (value.getMonth() + 1).toString().padStart(2, "0");
  const day = value.getDate().toString().padStart(2, "0");
  const hour = value.getHours().toString().padStart(2, "0");
  const minute = value.getMinutes().toString().padStart(2, "0");
  const second = value.getSeconds().toString().padStart(2, "0");

  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function resolveImageExtension(mimeType: string) {
  if (mimeType.includes("png")) {
    return "png";
  }

  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return "jpg";
  }

  if (mimeType.includes("webp")) {
    return "webp";
  }

  return "bin";
}

function sanitizeTrainingLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCardDatasetFileName(
  sample: SavedCardSampleSummary & { rankLabel: string; suitLabel: string },
  extension: string,
) {
  const stage = sanitizeTrainingLabel(formatBoardStage(sample.boardStage));
  const rank = sanitizeTrainingLabel(sample.rankLabel);
  const suit = sanitizeTrainingLabel(sample.suitLabel);

  return `${rank}-${suit}-${stage}-${sample.id}.${extension}`;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o blob da carta."));
    reader.readAsDataURL(blob);
  });
}

function formatBoardStage(stage: SavedCardSampleSummary["boardStage"]) {
  if (stage === "preflop") {
    return "Preflop";
  }

  if (stage === "flop") {
    return "Flop";
  }

  if (stage === "turn") {
    return "Turn";
  }

  if (stage === "river") {
    return "River";
  }

  return "Indefinido";
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Nao foi possivel ler a imagem selecionada."));
    };

    image.src = objectUrl;
  });
}

const inputClassName =
  "h-11 w-full rounded-[0.95rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] px-4 text-sm text-[rgba(255,244,214,0.96)] outline-none";
