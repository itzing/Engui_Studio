'use client';

import type { CreateMediaRef, UnifiedCreateDraftState } from '@/lib/create/createDraftSchema';
import { currentBrowserWorkspaceId, protectedDefaultId } from '@/lib/workspaces/client';

export const CREATE_MEDIA_DB_NAME = 'engui-create-media';
export const CREATE_MEDIA_DB_VERSION = 2;
export const CREATE_MEDIA_STORE_NAME = 'draft-media';
export type StoredCreateMedia = {
  mediaId: string; workspaceId?: string; blob: Blob; fileName?: string;
  mimeType?: string; size?: number; lastModified?: number; createdAt: number; updatedAt: number;
};
const ownerOf = (entry: StoredCreateMedia) => entry.workspaceId || protectedDefaultId();
async function openCreateMediaDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return null;
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(CREATE_MEDIA_DB_NAME, CREATE_MEDIA_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(CREATE_MEDIA_STORE_NAME)
        ? request.transaction!.objectStore(CREATE_MEDIA_STORE_NAME)
        : db.createObjectStore(CREATE_MEDIA_STORE_NAME, { keyPath: 'mediaId' });
      if (!store.indexNames.contains('workspaceId')) store.createIndex('workspaceId', 'workspaceId');
      const defaultId = protectedDefaultId();
      if (defaultId) {
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const current = cursor.result;
          if (!current) return;
          if (!current.value.workspaceId) current.update({ ...current.value, workspaceId: defaultId });
          current.continue();
        };
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error || new Error('Could not open draft media.'));
    request.onblocked = () => reject(new Error('Close another Engui tab to upgrade draft media safely.'));
  });
}
async function withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await openCreateMediaDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CREATE_MEDIA_STORE_NAME, mode);
    let result: T;
    const request = operation(tx.objectStore(CREATE_MEDIA_STORE_NAME));
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || request.error || new Error('Draft media transaction failed.')); };
  });
}
async function allEntries(): Promise<StoredCreateMedia[]> {
  return (await withStore('readonly', (store) => store.getAll()) as StoredCreateMedia[] | null) || [];
}
export async function putCreateMedia(entry: StoredCreateMedia): Promise<boolean> {
  const workspaceId = entry.workspaceId || currentBrowserWorkspaceId();
  if (!workspaceId || workspaceId !== currentBrowserWorkspaceId()) throw new Error('Draft media requires its active owner workspace.');
  const existing = await withStore('readonly', (store) => store.get(entry.mediaId)) as StoredCreateMedia | undefined;
  if (existing && ownerOf(existing) !== workspaceId) throw new Error('Draft media belongs to another workspace.');
  return (await withStore('readwrite', (store) => store.put({ ...entry, workspaceId }))) !== null;
}
export async function getCreateMedia(mediaId: string): Promise<StoredCreateMedia | null> {
  const entry = await withStore('readonly', (store) => store.get(mediaId)) as StoredCreateMedia | undefined;
  return entry && ownerOf(entry) === currentBrowserWorkspaceId() ? entry : null;
}
export async function deleteCreateMedia(mediaId: string): Promise<boolean> {
  const owner = currentBrowserWorkspaceId();
  const entry = await getCreateMedia(mediaId);
  if (!entry || !owner || owner !== currentBrowserWorkspaceId()) return false;
  return (await withStore('readwrite', (store) => store.delete(mediaId))) !== null;
}
export async function listCreateMediaIds(): Promise<string[]> {
  return (await allEntries()).filter((entry) => ownerOf(entry) === currentBrowserWorkspaceId()).map((entry) => entry.mediaId);
}
export function collectReferencedMediaIds(state: UnifiedCreateDraftState): string[] {
  const ids = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if ((value as any).kind === 'idb-media' && typeof (value as any).mediaId === 'string') ids.add((value as any).mediaId);
    Object.values(value).forEach(visit);
  };
  visit(state);
  return [...ids];
}
function allReferencedMediaIds(state?: UnifiedCreateDraftState): Set<string> | null {
  const ids = new Set(state ? collectReferencedMediaIds(state) : []);
  if (typeof window === 'undefined' || !protectedDefaultId()) return null;
  // Retained legacy/recovery drafts are included until deliberately retired.
  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index);
    if (!key || !key.includes('engui.create.state.v')) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try { collectReferencedMediaIds(JSON.parse(raw)).forEach((id) => ids.add(id)); }
    catch { return null; }
  }
  return ids;
}
export async function cleanupOrphanedCreateMedia(state: UnifiedCreateDraftState): Promise<string[]> {
  const owner = state.workspaceId || currentBrowserWorkspaceId();
  if (!owner || owner !== currentBrowserWorkspaceId()) return [];
  const referenced = allReferencedMediaIds(state);
  if (!referenced) return [];
  const entries = await allEntries();
  const deleted: string[] = [];
  for (const entry of entries) {
    if (currentBrowserWorkspaceId() !== owner) break;
    if (ownerOf(entry) === owner && !referenced.has(entry.mediaId) && await deleteCreateMedia(entry.mediaId)) deleted.push(entry.mediaId);
  }
  return deleted;
}
export async function purgeDeletedWorkspaceMedia(workspaceId: string): Promise<boolean> {
  if (workspaceId === protectedDefaultId()) throw new Error('Cannot purge Default workspace.');
  const referenced = allReferencedMediaIds();
  if (!referenced) return false;
  for (const entry of await allEntries()) {
    if (ownerOf(entry) === workspaceId && !referenced.has(entry.mediaId)) await withStore('readwrite', (store) => store.delete(entry.mediaId));
  }
  return true;
}
export async function storeCreateFile(file: File, workspaceId = currentBrowserWorkspaceId()): Promise<CreateMediaRef | null> {
  if (!workspaceId) return null;
  if (workspaceId !== currentBrowserWorkspaceId()) throw new DOMException('Workspace changed.', 'AbortError');
  const mediaId = globalThis.crypto?.randomUUID?.() || `media-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = Date.now();
  const ok = await putCreateMedia({ mediaId, workspaceId, blob: file, fileName: file.name, mimeType: file.type, size: file.size, lastModified: file.lastModified, createdAt: now, updatedAt: now });
  return ok ? { kind: 'idb-media', mediaId, fileName: file.name, mimeType: file.type, size: file.size, lastModified: file.lastModified } : null;
}
export async function resolveCreateMediaRefToFile(ref?: CreateMediaRef | null): Promise<File | null> {
  if (ref?.kind !== 'idb-media') return null;
  const entry = await getCreateMedia(ref.mediaId);
  return entry ? new File([entry.blob], entry.fileName || 'media', { type: entry.mimeType || entry.blob.type || 'application/octet-stream', lastModified: entry.lastModified }) : null;
}
