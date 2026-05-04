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

async function readLocalBinaryDocument(
  documentName: string,
  buildDefault: () => Promise<Buffer> | Buffer,
) {
  const filePath = buildLocalFilePath(documentName);
  await mkdir(path.dirname(filePath), { recursive: true });

  try {
    return await readFile(filePath);
  } catch {
    const defaultValue = await buildDefault();
    await writeFile(filePath, defaultValue);
    return defaultValue;
  }
}

async function writeLocalBinaryDocument(documentName: string, data: Buffer) {
  const filePath = buildLocalFilePath(documentName);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
}

async function readRemoteBinaryDocument(
  documentName: string,
  buildDefault: () => Promise<Buffer> | Buffer,
  contentType: string,
) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return readLocalBinaryDocument(documentName, buildDefault);
  }

  const objectPath = buildRemoteObjectPath(documentName);
  const { data, error } = await supabase.storage.from(defaultBucketName).download(objectPath);

  if (error || !data) {
    const defaultValue = await buildDefault();
    await writeRemoteBinaryDocument(documentName, defaultValue, contentType);
    return defaultValue;
  }

  return Buffer.from(await data.arrayBuffer());
}

async function writeRemoteBinaryDocument(
  documentName: string,
  data: Buffer,
  contentType: string,
) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return writeLocalBinaryDocument(documentName, data);
  }

  const objectPath = buildRemoteObjectPath(documentName);
  const { error } = await supabase.storage.from(defaultBucketName).upload(objectPath, data, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Nao foi possivel salvar ${documentName} no Supabase Storage.`);
  }
}

export async function readServerBinaryDocument(
  documentName: string,
  buildDefault: () => Promise<Buffer> | Buffer,
  contentType = "application/octet-stream",
) {
  if (hasSupabaseServiceRoleEnv) {
    return readRemoteBinaryDocument(documentName, buildDefault, contentType);
  }

  return readLocalBinaryDocument(documentName, buildDefault);
}

export async function writeServerBinaryDocument(
  documentName: string,
  data: Buffer,
  contentType = "application/octet-stream",
) {
  if (hasSupabaseServiceRoleEnv) {
    return writeRemoteBinaryDocument(documentName, data, contentType);
  }

  return writeLocalBinaryDocument(documentName, data);
}
