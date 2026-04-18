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

async function readLocalDocument<T>(documentName: string, buildDefault: () => T | Promise<T>) {
  const filePath = buildLocalFilePath(documentName);
  await mkdir(path.dirname(filePath), { recursive: true });

  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(stripBom(raw)) as T;
  } catch {
    const defaultValue = await buildDefault();
    await writeFile(filePath, JSON.stringify(defaultValue, null, 2), "utf8");
    return defaultValue;
  }
}

async function writeLocalDocument<T>(documentName: string, data: T) {
  const filePath = buildLocalFilePath(documentName);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function readRemoteDocument<T>(documentName: string, buildDefault: () => T | Promise<T>) {
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

  const raw = new TextDecoder("utf-8").decode(await data.arrayBuffer());
  return JSON.parse(stripBom(raw)) as T;
}

async function writeRemoteDocument<T>(documentName: string, data: T) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return writeLocalDocument(documentName, data);
  }

  const payload = Buffer.from(JSON.stringify(data, null, 2), "utf8");
  const objectPath = buildRemoteObjectPath(documentName);
  const { error } = await supabase.storage.from(defaultBucketName).upload(objectPath, payload, {
    contentType: "application/json; charset=utf-8",
    upsert: true,
  });

  if (error) {
    throw new Error(`Nao foi possivel salvar ${documentName} no Supabase Storage.`);
  }
}

export async function readServerJsonDocument<T>(
  documentName: string,
  buildDefault: () => T | Promise<T>
) {
  if (hasSupabaseServiceRoleEnv) {
    return readRemoteDocument(documentName, buildDefault);
  }

  return readLocalDocument(documentName, buildDefault);
}

export async function writeServerJsonDocument<T>(documentName: string, data: T) {
  if (hasSupabaseServiceRoleEnv) {
    return writeRemoteDocument(documentName, data);
  }

  return writeLocalDocument(documentName, data);
}
