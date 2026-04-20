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
    const defaultValue = await buildDefault();
    await writeFile(filePath, defaultValue, "utf8");
    return defaultValue;
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
    const defaultValue = await buildDefault();
    await writeRemoteDocument(documentName, defaultValue);
    return defaultValue;
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

export async function readServerTextDocument(
  documentName: string,
  buildDefault: () => string | Promise<string>,
) {
  if (hasSupabaseServiceRoleEnv) {
    return readRemoteDocument(documentName, buildDefault);
  }

  return readLocalDocument(documentName, buildDefault);
}

export async function writeServerTextDocument(documentName: string, data: string) {
  if (hasSupabaseServiceRoleEnv) {
    return writeRemoteDocument(documentName, data);
  }

  return writeLocalDocument(documentName, data);
}

export async function appendServerTextDocument(
  documentName: string,
  fragment: string,
  buildDefault: () => string | Promise<string> = () => "",
) {
  const currentValue = await readServerTextDocument(documentName, buildDefault);
  const nextValue = `${currentValue}${fragment}`;
  await writeServerTextDocument(documentName, nextValue);
  return nextValue;
}
