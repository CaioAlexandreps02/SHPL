import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createServiceRoleSupabaseClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/server";

const defaultBucketName = process.env.SUPABASE_LIVE_STORAGE_BUCKET || "live-hand-clips";
const remotePrefix = "system-state";

function buildLocalFilePath(documentName: string) {
  return path.join(process.cwd(), "data", documentName);
}

function buildRemoteObjectPath(documentName: string) {
  return `${remotePrefix}/${documentName}`;
}

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

async function readLocalDocument(
  documentName: string,
  buildDefault: () => string | Promise<string>,
) {
  const filePath = buildLocalFilePath(documentName);
  await mkdir(path.dirname(filePath), { recursive: true });

  try {
    const raw = await readFile(filePath, "utf8");
    return stripBom(raw);
  } catch {
    return buildDefault();
  }
}

async function writeLocalDocument(documentName: string, data: string) {
  const filePath = buildLocalFilePath(documentName);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data, "utf8");
}

async function readRemoteDocument(
  documentName: string,
  buildDefault: () => string | Promise<string>,
) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return readLocalDocument(documentName, buildDefault);
  }

  const objectPath = buildRemoteObjectPath(documentName);
  const { data, error } = await supabase.storage.from(defaultBucketName).download(objectPath);

  if (error || !data) {
    return readLocalDocument(documentName, buildDefault);
  }

  return stripBom(new TextDecoder("utf-8").decode(await data.arrayBuffer()));
}

async function writeRemoteDocument(documentName: string, data: string) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return writeLocalDocument(documentName, data);
  }

  const payload = Buffer.from(data, "utf8");
  const objectPath = buildRemoteObjectPath(documentName);
  const { error } = await supabase.storage.from(defaultBucketName).upload(objectPath, payload, {
    contentType: "text/plain; charset=utf-8",
    upsert: true,
  });

  if (error) {
    throw new Error(`Nao foi possivel salvar ${documentName} no Supabase Storage.`);
  }
}

async function readRawTextDocument(
  documentName: string,
  buildDefault: () => string | Promise<string>,
) {
  if (hasSupabaseServiceRoleEnv) {
    return readRemoteDocument(documentName, buildDefault);
  }

  return readLocalDocument(documentName, buildDefault);
}

export async function readServerTextDocument(
  documentName: string,
  buildDefault: () => string | Promise<string>,
) {
  const raw = await readRawTextDocument(documentName, buildDefault);
  const { content } = extractVersionAndContent(raw);
  return content;
}

export async function writeServerTextDocument(documentName: string, data: string) {
  if (hasSupabaseServiceRoleEnv) {
    return writeRemoteDocument(documentName, data);
  }

  return writeLocalDocument(documentName, data);
}

const versionPrefix = "[SHPL-LOG-VERSION:";
const versionSuffix = "]\n";

function extractVersionAndContent(raw: string): { version: number; content: string } {
  if (!raw.startsWith(versionPrefix)) {
    return { version: 0, content: raw };
  }

  const closingIndex = raw.indexOf(versionSuffix);
  if (closingIndex === -1) {
    return { version: 0, content: raw };
  }

  const versionStr = raw.slice(versionPrefix.length, closingIndex);
  const version = Number.parseInt(versionStr, 10);

  if (Number.isNaN(version)) {
    return { version: 0, content: raw };
  }

  return {
    version,
    content: raw.slice(closingIndex + versionSuffix.length),
  };
}

function wrapWithVersion(version: number, content: string): string {
  return `${versionPrefix}${version}${versionSuffix}${content}`;
}

export async function appendServerTextDocument(
  documentName: string,
  fragment: string,
  buildDefault: () => string | Promise<string> = () => "",
) {
  const maxRetries = 5;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const raw = await readRawTextDocument(documentName, buildDefault);
    const { version: readVersion, content } = extractVersionAndContent(raw);
    const nextContent = `${content}${fragment}`;
    const nextRaw = wrapWithVersion(readVersion + 1, nextContent);

    await writeServerTextDocument(documentName, nextRaw);

    // Verify the write succeeded with correct version
    const verifyRaw = await readRawTextDocument(documentName, () => nextRaw);
    const { version: verifyVersion } = extractVersionAndContent(verifyRaw);

    if (verifyVersion === readVersion + 1) {
      return nextRaw;
    }

    // Version mismatch — another write happened, retry
    if (attempt === maxRetries) {
      throw new Error(
        `Nao foi possivel gravar ${documentName} apos ${maxRetries + 1} tentativas ` +
          `devido a concorrencia.`
      );
    }
  }

  throw new Error("Unexpected end of retry loop");
}
