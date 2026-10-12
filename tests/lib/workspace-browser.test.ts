// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { chooseBrowserWorkspace, currentBrowserWorkspaceId, initializeBrowserWorkspaces, savedWorkspaceId, workspaceFetchFor, workspaceStorage, workspaceStorageKey } from '@/lib/workspaces/client';
import { cleanupOrphanedCreateMedia, getCreateMedia, putCreateMedia, storeCreateFile } from '@/lib/create/createMediaStore';
import { createDefaultUnifiedCreateDraftState } from '@/lib/create/createDraftSchema';
import { loadUnifiedCreateDraftState, saveUnifiedCreateDraftState } from '@/lib/create/createDraftStore';
import { buildVideoSourcePromptCacheKey, writeVideoSourcePromptCache, readVideoSourcePromptCache } from '@/lib/create/videoSourcePromptCache';
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(window, 'indexedDB', { configurable: true, value: new IDBFactory() });
  initializeBrowserWorkspaces('default');
  chooseBrowserWorkspace('default');
});
describe('workspace browser preservation and races', () => {
  it('imports legacy data into Default even when another workspace is selected', () => {
    localStorage.clear();
    chooseBrowserWorkspace('B');
    localStorage.setItem('engui.create.state.v2', JSON.stringify({ legacy: true }));
    initializeBrowserWorkspaces('default');
    expect(workspaceStorage('default')!.getItem('engui.create.state.v2')).toContain('legacy');
    expect(workspaceStorage('B')!.getItem('engui.create.state.v2')).toBeNull();
    expect(currentBrowserWorkspaceId()).toBe('B');
    expect(localStorage.getItem('engui.create.state.v2')).toContain('legacy');
  });
  it('does not overwrite newer Default content during a migration rerun', () => {
    workspaceStorage('default')!.setItem('engui.create.state.v2', 'new');
    localStorage.setItem('engui.create.state.v2', 'old');
    initializeBrowserWorkspaces('default');
    expect(workspaceStorage('default')!.getItem('engui.create.state.v2')).toBe('new');
  });
  it('keeps tab selection when the browser-wide last selection changes', () => {
    chooseBrowserWorkspace('A');
    localStorage.setItem('activeWorkspaceId', 'B');
    expect(savedWorkspaceId()).toBe('A');
    expect(currentBrowserWorkspaceId()).toBe('A');
  });
  it('saves a delayed A draft into A after switching to B', () => {
    chooseBrowserWorkspace('A');
    const draft = createDefaultUnifiedCreateDraftState();
    chooseBrowserWorkspace('B');
    saveUnifiedCreateDraftState(draft);
    expect(workspaceStorage('A')!.getItem('engui.create.state.v2')).toBeTruthy();
    expect(workspaceStorage('B')!.getItem('engui.create.state.v2')).toBeNull();
  });
  it('rejects late responses and old-component requests after switching', async () => {
    chooseBrowserWorkspace('A');
    let resolve!: (r: Response) => void;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(r => { resolve = r; }));
    const request = workspaceFetchFor('A')('/api/jobs');
    chooseBrowserWorkspace('B');
    resolve(new Response(JSON.stringify({ owner: 'A' })));
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await expect(workspaceFetchFor('A')('/api/jobs')).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('scopes attachments and GC across all persisted drafts', async () => {
    const blob = new Blob(['fixture'], { type: 'text/plain' });
    chooseBrowserWorkspace('A');
    await putCreateMedia({ mediaId: 'A-kept', blob, createdAt: 1, updatedAt: 1 });
    await putCreateMedia({ mediaId: 'A-orphan', blob, createdAt: 1, updatedAt: 1 });
    const a = { ...createDefaultUnifiedCreateDraftState(), attachment: { kind: 'idb-media', mediaId: 'A-kept' } };
    workspaceStorage('A')!.setItem('engui.create.state.v2', JSON.stringify(a));
    chooseBrowserWorkspace('B');
    await putCreateMedia({ mediaId: 'B-kept', blob, createdAt: 1, updatedAt: 1 });
    const b = { ...createDefaultUnifiedCreateDraftState(), attachment: { kind: 'idb-media', mediaId: 'B-kept' } };
    workspaceStorage('B')!.setItem('engui.create.state.v2', JSON.stringify(b));
    expect(await getCreateMedia('A-kept')).toBeNull();
    chooseBrowserWorkspace('A');
    expect(await cleanupOrphanedCreateMedia(a)).toEqual(['A-orphan']);
    expect(await getCreateMedia('A-kept')).not.toBeNull();
    chooseBrowserWorkspace('B');
    expect(await getCreateMedia('B-kept')).not.toBeNull();
  });
  it('suspends destructive media cleanup while any saved draft is unreadable', async () => {
    chooseBrowserWorkspace('A');
    await putCreateMedia({ mediaId: 'unknown-ref', blob: new Blob(['x']), createdAt: 1, updatedAt: 1 });
    localStorage.setItem(workspaceStorageKey('engui.create.state.v2', 'B'), '{broken');
    expect(await cleanupOrphanedCreateMedia(createDefaultUnifiedCreateDraftState())).toEqual([]);
    expect(await getCreateMedia('unknown-ref')).not.toBeNull();
  });
});

it('rejects an old file selection callback after workspace switch', async () => {
  chooseBrowserWorkspace('B');
  await expect(storeCreateFile(new File(['x'], 'test.png'), 'A')).rejects.toMatchObject({ name: 'AbortError' });
});
it('keeps delayed extracted prompt cache writes with the captured owner', async () => {
  chooseBrowserWorkspace('A');
  const file = new File(['pixels'], 'test.png');
  const key = await buildVideoSourcePromptCacheKey(file, 'wan22');
  chooseBrowserWorkspace('B');
  writeVideoSourcePromptCache({ ...key, prompt: 'fixture source prompt' });
  expect(readVideoSourcePromptCache(key.key)).toBeNull();
  expect(readVideoSourcePromptCache(key.key, 'A')).toBe('fixture source prompt');
});
