"use client";

import { useMemo, useState } from "react";

import type { RegulationDocument } from "@/lib/data/shpl-regulation-store";

type RegulationTab = {
  id: string;
  label: string;
  description: string;
  sectionIds: string[];
};

const regulationTabs: RegulationTab[] = [
  {
    id: "visao-geral",
    label: "Visao geral",
    description: "Base do campeonato, participantes e encontros.",
    sectionIds: [
      "disposicoes-gerais",
      "modalidade-do-jogo",
      "participacao",
      "local-dos-encontros",
    ],
  },
  {
    id: "etapas-premiacao",
    label: "Etapas e premiacao",
    description: "Buy-in, encontros e formato de cada etapa.",
    sectionIds: ["buyin-premiacao", "formato-dos-encontros"],
  },
  {
    id: "estrutura-do-jogo",
    label: "Estrutura do jogo",
    description: "Blinds, botao, ordem de acao e showdown.",
    sectionIds: ["stack-e-blinds", "botao-e-ordem", "showdown"],
  },
  {
    id: "ranking",
    label: "Ranking e desempate",
    description: "Pontuacao, criterios de etapa e acumulado anual.",
    sectionIds: [
      "desempate-da-etapa",
      "pontuacao-ranking-anual",
      "saida-antecipada",
      "ranking-anual-desempate",
    ],
  },
  {
    id: "mesa-final",
    label: "Mesa final",
    description: "Classificacao, estrutura final e premiacao anual.",
    sectionIds: ["classificacao-mesa-final", "mesa-final", "premiacao-anual", "disposicoes-finais"],
  },
  {
    id: "tudo",
    label: "Tudo",
    description: "Regulamento completo em uma unica visualizacao.",
    sectionIds: [],
  },
];

export function SHPLRegulationPage({
  canEdit,
  document,
}: {
  canEdit: boolean;
  document: RegulationDocument;
}) {
  const [activeTabId, setActiveTabId] = useState("visao-geral");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draft, setDraft] = useState(document);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  const activeTab = regulationTabs.find((tab) => tab.id === activeTabId) ?? regulationTabs[0];
  const visibleSections = useMemo(() => {
    if (activeTab.id === "tudo") {
      return document.sections;
    }

    const sectionIdSet = new Set(activeTab.sectionIds);
    return document.sections.filter((section) => sectionIdSet.has(section.id));
  }, [activeTab, document.sections]);

  async function handleSaveDocument() {
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const response = await fetch("/api/shpl-admin/regulation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const data = (await response.json()) as { error?: string; document?: RegulationDocument };

      if (!response.ok || !data.document) {
        throw new Error(data.error || "Nao foi possivel salvar o regulamento.");
      }

      setSaveMessage("Regulamento atualizado com sucesso.");
      setDraft(data.document);
      window.location.reload();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Nao foi possivel salvar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePdfUpload(file: File | null) {
    if (!file) {
      return;
    }

    setIsUploadingPdf(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/shpl-admin/regulation/pdf", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel atualizar o PDF.");
      }

      setSaveMessage("PDF oficial atualizado com sucesso.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Nao foi possivel enviar o PDF.");
    } finally {
      setIsUploadingPdf(false);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[1.8rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.28)] md:p-6">
        <div className="flex flex-col gap-5 border-b border-[rgba(255,208,101,0.1)] pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[rgba(236,225,196,0.68)]">
              {document.versionLabel}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[rgba(255,244,214,0.96)] md:text-4xl">
              {document.title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.74)]">{document.subtitle}</p>
            <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.64)]">{document.intro}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex items-center justify-center rounded-[1rem] border border-[rgba(255,208,101,0.24)] bg-[rgba(255,183,32,0.12)] px-4 py-3 text-sm font-semibold text-[rgba(255,236,184,0.98)] transition hover:bg-[rgba(255,183,32,0.18)]"
              download={document.pdfFileName}
              href="/api/shpl-regulation/pdf"
            >
              Baixar PDF oficial
            </a>
            {canEdit ? (
              <button
                className="inline-flex items-center justify-center rounded-[1rem] border border-[rgba(255,208,101,0.18)] bg-white/[0.04] px-4 py-3 text-sm font-semibold text-[rgba(255,244,214,0.96)] transition hover:bg-white/[0.08]"
                onClick={() => setIsEditorOpen((current) => !current)}
                type="button"
              >
                {isEditorOpen ? "Fechar edicao" : "Editar regulamento"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[rgba(255,208,101,0.14)] bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.64)]">
            Atualizado em {document.updatedAtLabel}
          </span>
          <span className="rounded-full border border-[rgba(255,208,101,0.14)] bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.64)]">
            Visualizacao publica
          </span>
        </div>
      </section>

      {canEdit && isEditorOpen ? (
        <section className="rounded-[1.8rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(10,37,27,0.94),rgba(6,21,16,0.98))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.28)] md:p-6">
          <div className="border-b border-[rgba(255,208,101,0.1)] pb-5">
            <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[rgba(236,225,196,0.68)]">
              Painel administrativo
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
              Editar regulamento
            </h2>
            <p className="mt-3 text-sm leading-6 text-[rgba(236,225,196,0.74)]">
              Aqui voce atualiza o texto exibido no sistema e pode trocar o PDF oficial. O download sempre usa o PDF oficial atual.
            </p>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[rgba(255,244,214,0.92)]">Titulo</span>
              <input
                className="rounded-[1rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgba(255,244,214,0.96)] outline-none"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                value={draft.title}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[rgba(255,244,214,0.92)]">Subtitulo</span>
              <textarea
                className="min-h-[96px] rounded-[1rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgba(255,244,214,0.96)] outline-none"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, subtitle: event.target.value }))
                }
                value={draft.subtitle}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[rgba(255,244,214,0.92)]">Versao</span>
                <input
                  className="rounded-[1rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgba(255,244,214,0.96)] outline-none"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, versionLabel: event.target.value }))
                  }
                  value={draft.versionLabel}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[rgba(255,244,214,0.92)]">Atualizado em</span>
                <input
                  className="rounded-[1rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgba(255,244,214,0.96)] outline-none"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, updatedAtLabel: event.target.value }))
                  }
                  value={draft.updatedAtLabel}
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[rgba(255,244,214,0.92)]">Introducao</span>
              <textarea
                className="min-h-[120px] rounded-[1rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgba(255,244,214,0.96)] outline-none"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, intro: event.target.value }))
                }
                value={draft.intro}
              />
            </label>

            <div className="grid gap-4">
              {draft.sections.map((section, index) => (
                <article
                  key={section.id}
                  className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4"
                >
                  <div className="grid gap-3">
                    <div className="grid gap-3 md:grid-cols-[90px_1fr]">
                      <label className="grid gap-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.58)]">
                          Numero
                        </span>
                        <input
                          className="rounded-[0.9rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[rgba(255,244,214,0.96)] outline-none"
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              sections: current.sections.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, number: event.target.value } : item,
                              ),
                            }))
                          }
                          value={section.number}
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.58)]">
                          Titulo da secao
                        </span>
                        <input
                          className="rounded-[0.9rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[rgba(255,244,214,0.96)] outline-none"
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              sections: current.sections.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, title: event.target.value } : item,
                              ),
                            }))
                          }
                          value={section.title}
                        />
                      </label>
                    </div>

                    <label className="grid gap-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.58)]">
                        Resumo
                      </span>
                      <input
                        className="rounded-[0.9rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[rgba(255,244,214,0.96)] outline-none"
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            sections: current.sections.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, summary: event.target.value } : item,
                            ),
                          }))
                        }
                        value={section.summary}
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.58)]">
                        Conteudo
                      </span>
                      <textarea
                        className="min-h-[170px] rounded-[0.9rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-sm text-[rgba(255,244,214,0.96)] outline-none"
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            sections: current.sections.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    paragraphs: event.target.value
                                      .split(/\n{2,}/)
                                      .map((paragraph) => paragraph.trim())
                                      .filter(Boolean),
                                  }
                                : item,
                            ),
                          }))
                        }
                        value={section.paragraphs.join("\n\n")}
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>

            <div className="grid gap-3 rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4">
              <p className="text-sm font-semibold text-[rgba(255,244,214,0.96)]">PDF oficial para download</p>
              <p className="text-sm leading-6 text-[rgba(236,225,196,0.68)]">
                Se voce quiser manter a mesma diagramacao do documento original, troque o PDF oficial aqui. O download do sistema sempre usa esse arquivo.
              </p>
              <input
                accept="application/pdf"
                className="text-sm text-[rgba(255,244,214,0.92)] file:mr-4 file:rounded-[0.9rem] file:border-0 file:bg-[rgba(255,183,32,0.14)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[rgba(255,236,184,0.98)]"
                disabled={isUploadingPdf}
                onChange={(event) => handlePdfUpload(event.target.files?.[0] ?? null)}
                type="file"
              />
            </div>

            {saveMessage ? (
              <p className="text-sm font-medium text-[rgba(164,230,179,0.92)]">{saveMessage}</p>
            ) : null}
            {saveError ? (
              <p className="text-sm font-medium text-[rgba(255,179,167,0.92)]">{saveError}</p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex items-center justify-center rounded-[1rem] border border-[rgba(255,208,101,0.24)] bg-[rgba(255,183,32,0.12)] px-4 py-3 text-sm font-semibold text-[rgba(255,236,184,0.98)] transition hover:bg-[rgba(255,183,32,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving}
                onClick={handleSaveDocument}
                type="button"
              >
                {isSaving ? "Salvando..." : "Salvar regulamento"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.8rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.92),rgba(7,24,18,0.98))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.28)] md:p-6">
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {regulationTabs.map((tab) => {
              const isActive = tab.id === activeTab.id;
              return (
                <button
                  key={tab.id}
                  className={`rounded-[1rem] border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-[rgba(255,208,101,0.52)] bg-[rgba(255,183,32,0.12)] text-[rgba(255,236,184,0.98)]"
                      : "border-[rgba(255,208,101,0.12)] bg-white/[0.03] text-[rgba(248,242,225,0.88)] hover:bg-white/[0.06]"
                  }`}
                  onClick={() => setActiveTabId(tab.id)}
                  type="button"
                >
                  <p className="text-sm font-semibold">{tab.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[rgba(236,225,196,0.68)]">{tab.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {visibleSections.map((section) => (
            <article
              id={section.id}
              key={section.id}
              className="rounded-[1.35rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-5"
            >
              <div className="flex flex-col gap-3 border-b border-[rgba(255,208,101,0.1)] pb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-[rgba(255,208,101,0.18)] bg-[rgba(255,183,32,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(255,236,184,0.98)]">
                    Secao {section.number}
                  </span>
                  <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.58)]">
                    {section.summary}
                  </span>
                </div>
                <h2 className="text-2xl font-semibold text-[rgba(255,244,214,0.96)]">{section.title}</h2>
              </div>

              <div className="mt-4 grid gap-4">
                {section.paragraphs.map((paragraph, index) => (
                  <p
                    key={`${section.id}-${index}`}
                    className="text-sm leading-7 text-[rgba(236,225,196,0.82)]"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
