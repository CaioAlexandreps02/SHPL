"use client";

export type SavedHandClipSummary = {
  id: string;
  title: string;
  createdAt: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  sizeBytes: number;
  mimeType: string;
  startTrigger: string;
  endTrigger: string;
  transcriptLog: string[];
  linkedStageId?: string | null;
  linkedStageTitle?: string | null;
  linkedMatchLabel?: string | null;
  linkedBlindLabel?: string | null;
};

type SavedHandClipRecord = SavedHandClipSummary & {
  blob: Blob;
};

const DB_NAME = "shpl-live-lab-video-db-v2";
const STORE_NAME = "hand-clips";
const DB_VERSION = 2;

export async function listSavedHandClips() {
  const db = await openVideoDb();

  return await new Promise<SavedHandClipSummary[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const result = (request.result as SavedHandClipRecord[])
        .map((record) => {
          const { blob, ...summary } = record;
          void blob;
          return summary;
        })
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      resolve(result);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveHandClip(
  input: Omit<SavedHandClipRecord, "id" | "createdAt"> & { id?: string },
) {
  const db = await openVideoDb();
  const record: SavedHandClipRecord = {
    ...input,
    id: input.id ?? `hand-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  const { blob, ...summary } = record;
  void blob;
  return summary;
}

export async function getSavedHandClipBlob(id: string) {
  const db = await openVideoDb();

  return await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result as SavedHandClipRecord | undefined;
      resolve(result?.blob ?? null);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function deleteSavedHandClip(id: string) {
  const db = await openVideoDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function openVideoDb() {
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
