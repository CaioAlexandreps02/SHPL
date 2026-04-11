import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { getStoredPlayers } from "@/lib/data/demo-admin-store";

type WhisperStatus = {
  available: boolean;
  binaryPath: string | null;
  modelPath: string | null;
  expectedRoot: string;
  note: string;
  detectedModelName: string | null;
};

type WhisperTranscriptionResult = {
  text: string;
  modelPath: string;
  binaryPath: string;
};

const whisperRoot = path.join(process.cwd(), "experimental", "live-lab", "whisper.cpp");
const modelCandidates = [
  "ggml-small.bin",
  "ggml-base.bin",
  "ggml-tiny.bin",
];
const binaryCandidates = [
  path.join(whisperRoot, "Win32", "Release", "whisper-cli.exe"),
  path.join(whisperRoot, "Win32", "Release", "whisper-cli"),
  path.join(whisperRoot, "Release", "whisper-cli.exe"),
  path.join(whisperRoot, "Release", "whisper-cli"),
  path.join(whisperRoot, "build", "bin", "Release", "whisper-cli.exe"),
  path.join(whisperRoot, "build", "bin", "whisper-cli.exe"),
  path.join(whisperRoot, "build", "bin", "Release", "whisper-cli"),
  path.join(whisperRoot, "build", "bin", "whisper-cli"),
];

export async function getWhisperStatus(): Promise<WhisperStatus> {
  const binaryPath = await findExistingPath(binaryCandidates);
  const modelPath = await findExistingPath(
    modelCandidates.map((modelName) => path.join(whisperRoot, "models", modelName)),
  );

  const available = Boolean(binaryPath && modelPath);

  return {
    available,
    binaryPath,
    modelPath,
    expectedRoot: whisperRoot,
    detectedModelName: modelPath ? path.basename(modelPath) : null,
    note: available
      ? modelPath?.includes("ggml-small")
        ? "Motor local detectado com modelo small, melhor para testes de precisao."
        : "Motor local detectado. Para mais precisao, o recomendado e usar o modelo small."
      : "Ainda faltam o whisper-cli e/ou um modelo ggml dentro da pasta experimental/live-lab/whisper.cpp.",
  };
}

export async function transcribeWaveBuffer(buffer: Buffer): Promise<WhisperTranscriptionResult> {
  const status = await getWhisperStatus();

  if (!status.available || !status.binaryPath || !status.modelPath) {
    throw new Error(
      "Motor local indisponivel. Instale o whisper.cpp e um modelo ggml em experimental/live-lab/whisper.cpp.",
    );
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shpl-live-lab-"));
  const inputPath = path.join(tempDir, "input.wav");
  const outputBase = path.join(tempDir, "result");
  const prompt = await buildPokerPrompt();

  try {
    await fs.writeFile(inputPath, buffer);

    await runProcess(status.binaryPath, [
      "--model",
      status.modelPath,
      "--file",
      inputPath,
      "--language",
      "pt",
      "--no-timestamps",
      "--output-json",
      "--output-file",
      outputBase,
      "--threads",
      "4",
      "--beam-size",
      "5",
      "--best-of",
      "5",
      "--temperature",
      "0",
      "--prompt",
      prompt,
      "--no-prints",
    ]);

    const outputJsonPath = `${outputBase}.json`;
    const outputJson = await fs.readFile(outputJsonPath, "utf-8");
    const parsed = JSON.parse(outputJson) as {
      text?: string;
      transcription?: Array<{ text?: string }>;
    };
    const extractedText = parsed.transcription?.map((item) => item.text?.trim() ?? "").join(" ").trim();

    return {
      text: normalizePokerTranscript(extractedText || (parsed.text ?? "").trim()),
      modelPath: status.modelPath,
      binaryPath: status.binaryPath,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function findExistingPath(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

async function buildPokerPrompt() {
  const storedPlayers = await getStoredPlayers();
  const playerTerms = storedPlayers
    .flatMap((player) => [player.nickname, player.fullName])
    .map((value) => value.trim())
    .filter(Boolean);

  const pokerTerms = [
    "poker",
    "mesa",
    "fichas",
    "all in",
    "buy in",
    "blind",
    "small blind",
    "big blind",
    "ante",
    "dealer",
    "check",
    "call",
    "raise",
    "fold",
    "flop",
    "turn",
    "river",
    "showdown",
    "pot",
    "carta",
    "copas",
    "espadas",
    "paus",
    "ouros",
    "nova mao",
    "nova partida",
    "encerrar mao",
    "encerrar partida",
    "fim da mao",
    "fim da partida",
    "mao encerrada",
    "partida encerrada",
  ];

  return `Contexto: mesa de poker em portugues do Brasil. Priorize nomes e termos exatamente assim: ${[
    ...new Set([...playerTerms, ...pokerTerms]),
  ].join(", ")}. Se ouvir um comando de controle, prefira transcrever literalmente como nova partida ou encerrar partida.`;
}

function normalizePokerTranscript(text: string) {
  return text
    .replace(/\bbaim\b/gi, "buy in")
    .replace(/\bbaiin\b/gi, "buy in")
    .replace(/\bbuyin\b/gi, "buy in")
    .replace(/\bflopi\b/gi, "flop")
    .replace(/\bflopy\b/gi, "flop")
    .replace(/\btorn\b/gi, "turn")
    .replace(/\bturm\b/gi, "turn")
    .replace(/\briveri\b/gi, "river")
    .replace(/\ballin\b/gi, "all in")
    .replace(/\bsmallblind\b/gi, "small blind")
    .replace(/\bbigblind\b/gi, "big blind")
    .replace(/\s+/g, " ")
    .trim();
}

async function runProcess(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `whisper-cli finalizou com codigo ${code}.`));
    });
  });
}
