'use client';

import type { UnifiedCreateDraftState } from '@/lib/create/createDraftSchema';

export const CREATE_MEDIA_DB_NAME = 'engui-create-media';
export const CREATE_MEDIA_DB_VERSION = 1;
export const CREATE_MEDIA_STORE_NAME = 'draft-media';

export type StoredCreateMedia = {
  mediaId: string;
  blob: Blob;
  fileName?: string;
  mimeType?: string;
  size?: number;
  lastModified?: number;
  createdAt: number;
  updatedAt: number;
};

function getIndexedDb(): IDBFactory | null {
  if (typeof window === 'undefined') return null;
  return window.indexedDB || null;
}

async function openCreateMediaDb(): Promise<IDBDatabase | null> {
  const indexedDb = getIndexedDb();
  if (!indexedDb) return null;

  return await new Promise((resolve, reject) => {
    const request = indexedDb.open(CREATE_MEDIA_DB_NAME, CREATE_MEDIA_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CREATE_MEDIA_STORE_NAME)) {
        db.createObjectStore(CREATE_MEDIA_STORE_NAME, { keyPath: 'mediaId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open create media store'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | void | null> {
  const db = await openCreateMediaDb();
  if (!db) return null;

  return await new Promise((resolve, reject) => {
    const tx = db.transaction(CREATE_MEDIA_STORE_NAME, mode);
    const store = tx.objectStore(CREATE_MEDIA_STORE_NAME);
    const request = fn(store);

    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    } else {
      tx.oncomplete = () => resolve(null);
    }

    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

export async function putCreateMedia(entry: StoredCreateMedia): Promise<boolean> {
  const result = await withStore('readwrite', (store) => store.put(entry));
  return result !== null;
}

export async function getCreateMedia(mediaId: string): Promise<StoredCreateMedia | null> {
  const result = await withStore<StoredCreateMedia | undefined>('readonly', (store) => store.get(mediaId));
  return (result as StoredCreateMedia | undefined | null) || null;
}

export async function deleteCreateMedia(mediaId: string): Promise<boolean> {
  const result = await withStore('readwrite', (store) => store.delete(mediaId));
  return result !== null;
}

export async function listCreateMediaIds(): Promise<string[]> {
  const db = await openCreateMediaDb();
  if (!db) return [];

  return await new Promise((resolve, reject) => {
    const tx = db.transaction(CREATE_MEDIA_STORE_NAME, 'readonly');
    const store = tx.objectStore(CREATE_MEDIA_STORE_NAME);
    const request = store.getAllKeys();
    request.onsuccess = () => resolve((request.result || []).map((key) => String(key)));
    request.onerror = () => reject(request.error || new Error('Failed to list create media ids'));
  });
}

export function collectReferencedMediaIds(state: UnifiedCreateDraftState): string[] {
  const ids = new Set<string>();

  for (const workflow of Object.values(state.workflows)) {
    for (const envelope of Object.values(workflow.drafts || {})) {
      const draft = envelope?.draft as any;
      if (!draft || typeof draft !== 'object') continue;
      const inputs = draft.inputs;
      if (!inputs || typeof inputs !== 'object') continue;

      for (const value of Object.values(inputs)) {
        if (value && typeof value === 'object' && (value as any).kind === 'idb-media' && typeof (value as any).mediaId === 'string') {
          ids.add((value as any).mediaId);
        }
      }
    }
  }

  return Array.from(ids);
}

export async function cleanupOrphanedCreateMedia(state: UnifiedCreateDraftState): Promise<string[]> {
  const referenced = new Set(collectReferencedMediaIds(state));
  const existing = await listCreateMediaIds();
  const deleted: string[] = [];

  for (const mediaId of existing) {
    if (!referenced.has(mediaId)) {
      const ok = await deleteCreateMedia(mediaId);
      if (ok) deleted.push(mediaId);
    }
  }

  return deleted;
}
