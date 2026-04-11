"use client";

import type { BoardStage } from "@/lib/live-lab/board-detection";

export type SavedCardSampleSummary = {
  id: string;
  createdAt: string;
  capturedAt: string;
  boardStage: BoardStage;
  sourceImageName: string | null;
  sourceCardIndex: number;
  sourceCardCount: number;
  width: number;
  height: number;
  confidence: number | null;
  cornerConfidence: number | null;
  rankLabel: string | null;
  suitLabel: string | null;
};

type SavedCardSampleRecord = SavedCardSampleSummary & {
  blob: Blob;
};

const DB_NAME = "shpl-live-lab-card-dataset-db";
const STORE_NAME = "card-samples";
const DB_VERSION = 1;

export async function listSavedCardSamples() {
  const db = await openCardDatasetDb();

  return await new Promise<SavedCardSampleSummary[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const result = (request.result as SavedCardSampleRecord[])
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

export async function saveCardSample(
  input: Omit<SavedCardSampleRecord, "id" | "createdAt"> & { id?: string },
) {
  const db = await openCardDatasetDb();
  const record: SavedCardSampleRecord = {
    ...input,
    id: input.id ?? `card-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
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

export async function getSavedCardSampleBlob(id: string) {
  const db = await openCardDatasetDb();

  return await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result as SavedCardSampleRecord | undefined;
      resolve(result?.blob ?? null);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function updateSavedCardSampleLabels(
  id: string,
  labels: { rankLabel: string | null; suitLabel: string | null },
) {
  const db = await openCardDatasetDb();

  return await new Promise<SavedCardSampleSummary>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const record = getRequest.result as SavedCardSampleRecord | undefined;

      if (!record) {
        reject(new Error("A amostra de carta nao foi encontrada."));
        return;
      }

      const nextRecord: SavedCardSampleRecord = {
        ...record,
        ...labels,
      };
      const putRequest = store.put(nextRecord);

      putRequest.onsuccess = () => {
        const { blob, ...summary } = nextRecord;
        void blob;
        resolve(summary);
      };

      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function replaceSavedCardSampleBlob(
  id: string,
  input: {
    blob: Blob;
    width: number;
    height: number;
    sourceImageName?: string | null;
  },
) {
  const db = await openCardDatasetDb();

  return await new Promise<SavedCardSampleSummary>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const record = getRequest.result as SavedCardSampleRecord | undefined;

      if (!record) {
        reject(new Error("A amostra de carta nao foi encontrada."));
        return;
      }

      const nextRecord: SavedCardSampleRecord = {
        ...record,
        blob: input.blob,
        width: input.width,
        height: input.height,
        sourceImageName: input.sourceImageName ?? record.sourceImageName,
      };
      const putRequest = store.put(nextRecord);

      putRequest.onsuccess = () => {
        const { blob, ...summary } = nextRecord;
        void blob;
        resolve(summary);
      };

      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function deleteSavedCardSample(id: string) {
  const db = await openCardDatasetDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function openCardDatasetDb() {
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
