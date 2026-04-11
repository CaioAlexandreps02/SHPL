import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

export type CardClassifierPrediction = {
  rankGuess: string | null;
  suitGuess: string | null;
  rankConfidence: number | null;
  suitConfidence: number | null;
  combinedConfidence: number | null;
  rotation?: number | null;
  label: string | null;
};

export type CardClassifierStatus = {
  available: boolean;
  rankModelPath: string | null;
  suitModelPath: string | null;
  scriptPath: string;
  note: string;
};

const trainingRoot = path.join(process.cwd(), "experimental", "live-lab", "training");
const scriptPath = path.join(trainingRoot, "predict_cards.py");
const rankModelPath = path.join(trainingRoot, "models", "rank-model.joblib");
const suitModelPath = path.join(trainingRoot, "models", "suit-model.joblib");

export async function getCardClassifierStatus(): Promise<CardClassifierStatus> {
  const hasScript = await pathExists(scriptPath);
  const hasRankModel = await pathExists(rankModelPath);
  const hasSuitModel = await pathExists(suitModelPath);
  const available = hasScript && hasRankModel && hasSuitModel;

  return {
    available,
    rankModelPath: hasRankModel ? rankModelPath : null,
    suitModelPath: hasSuitModel ? suitModelPath : null,
    scriptPath,
    note: available
      ? "Classificador local de cartas pronto para inferencia."
      : "Ainda faltam o script de inferencia e/ou os modelos treinados de rank e naipe.",
  };
}

export async function classifyCardImages(images: string[]) {
  const status = await getCardClassifierStatus();

  if (!status.available || !status.rankModelPath || !status.suitModelPath) {
    throw new Error(
      "Classificador de cartas indisponivel. Gere os modelos em experimental/live-lab/training/models.",
    );
  }

  const stdout = await runPythonJsonProcess("python", [
    scriptPath,
    "--rank-model",
    status.rankModelPath,
    "--suit-model",
    status.suitModelPath,
  ], {
    images,
  });

  const parsed = JSON.parse(stdout) as {
    predictions?: CardClassifierPrediction[];
    rankModelPath?: string;
    suitModelPath?: string;
  };

  return {
    predictions: parsed.predictions ?? [],
    rankModelPath: parsed.rankModelPath ?? status.rankModelPath,
    suitModelPath: parsed.suitModelPath ?? status.suitModelPath,
  };
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function runPythonJsonProcess(command: string, args: string[], payload: object) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        LOKY_MAX_CPU_COUNT: process.env.LOKY_MAX_CPU_COUNT ?? "1",
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error(stderr || `Processo Python finalizou com codigo ${code}.`));
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
