"use client";

export type SavedTranscriptSummary = {
  id: string;
  title: string;
  createdAt: string;
  startedAt: string;
  endedAt: string;
  lineCount: number;
  content: string;
  linkedStageId?: string | null;
  linkedStageTitle?: string | null;
  linkedMatchLabel?: string | null;
  linkedBlindLabel?: string | null;
};

const DB_NAME = "shpl-live-lab-transcript-db-v2";
const STORE_NAME = "session-transcripts";
const DB_VERSION = 2;

export async function listSavedTranscripts() {
  const db = await openTranscriptDb();

  return await new Promise<SavedTranscriptSummary[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const result = (request.result as SavedTranscriptSummary[]).sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      );
      resolve(result);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveSessionTranscript(input: Omit<SavedTranscriptSummary, "id" | "createdAt">) {
  const db = await openTranscriptDb();
  const record: SavedTranscriptSummary = {
    ...input,
    id: `session-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  return record;
}

function openTranscriptDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
