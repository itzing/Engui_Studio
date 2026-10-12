const TAB_KEY = 'engui.workspace.tab.id';
const DEFAULT_KEY = 'engui.workspace.protected-default';
let activeId: string | null | undefined;
let requests = new AbortController();
export function savedWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  const tab = window.sessionStorage.getItem(TAB_KEY);
  return tab !== null ? (tab === '-' ? null : tab) : window.localStorage.getItem('activeWorkspaceId');
}
export function hasSavedWorkspaceChoice(): boolean {
  return typeof window !== 'undefined' && (window.sessionStorage.getItem(TAB_KEY) !== null || window.localStorage.getItem('activeWorkspaceId') !== null);
}
export function currentBrowserWorkspaceId(): string | null {
  if (activeId === undefined) activeId = savedWorkspaceId();
  return activeId;
}
export function protectedDefaultId(): string | null {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(DEFAULT_KEY);
}
export function workspaceStorageKey(key: string, workspaceId: string): string {
  return `engui.workspace.${encodeURIComponent(workspaceId)}.${key}`;
}
export function chooseBrowserWorkspace(id: string | null): void {
  requests.abort();
  requests = new AbortController();
  activeId = id;
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(TAB_KEY, id || '-');
  if (id) window.localStorage.setItem('activeWorkspaceId', id);
}
export const LEGACY_CONTENT_KEYS = [
  'elevenlabs_favorite_voices', 'elevenlabs_voice_samples', 'engui:prompt-helper:instruction', 'engui:video-prompt-helper:empty-prompt', 'engui:video-prompt-helper:instruction',
  'engui.mobile.library.semanticFilter', 'engui.mobile.library.search', 'engui.mobile.library.viewer',
  'engui.create.state.v2', 'engui.create.state.v1', 'engui.create.video.presets.v1',
  'engui:wan22-video:source-image-prompt-cache:v1', 'engui:prompt-constructor:reuse-draft',
  'engui:prompt-helper:instruction', 'engui.mobile.pending-preview',
];
export function initializeBrowserWorkspaces(defaultId: string): void {
  if (typeof window === 'undefined') return;
  const storage = window.localStorage;
  storage.setItem(DEFAULT_KEY, defaultId);
  for (const key of LEGACY_CONTENT_KEYS) {
    const marker = workspaceStorageKey('legacy-import.' + key, defaultId);
    if (storage.getItem(marker)) continue;
    const raw = storage.getItem(key);
    const destination = workspaceStorageKey(key, defaultId);
    if (raw !== null && storage.getItem(destination) === null) {
      storage.setItem(destination, raw);
      if (storage.getItem(destination) !== raw) throw new Error('Workspace draft migration could not be verified.');
    }
    storage.setItem(marker, '1');
  }
}
export function workspaceStorage(id = currentBrowserWorkspaceId()): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  if (!id || typeof window === 'undefined') return null;
  return {
    getItem: (key) => window.localStorage.getItem(workspaceStorageKey(key, id)),
    setItem: (key, value) => window.localStorage.setItem(workspaceStorageKey(key, id), value),
    removeItem: (key) => window.localStorage.removeItem(workspaceStorageKey(key, id)),
  };
}
export function isWorkspaceAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
function changed(): never { throw new DOMException('The workspace changed. Retry in the selected workspace.', 'AbortError'); }
function isGlobalApi(path: string): boolean {
  if (path.startsWith('/api/s3-storage/loras')) return false;
  return /^\/api\/(settings|workspaces|local-model|internal-systemctl|s3-storage|runpod)(\/|\?|$)/.test(path)
    || (path.startsWith('/api/elevenlabs/') && !path.startsWith('/api/elevenlabs/generate'));
}
export async function workspaceFetch(input: RequestInfo | URL, init?: RequestInit, boundWorkspace?: string | null): Promise<Response> {
  if (typeof window === 'undefined') return globalThis.fetch(input, init);
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/') || isGlobalApi(url.pathname)) {
    return globalThis.fetch(input, init);
  }
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  let explicit = headers.get('x-workspace-id') || url.searchParams.get('workspaceId');
  if (!explicit && typeof init?.body === 'string' && headers.get('content-type')?.includes('application/json')) {
    try { const data = JSON.parse(init.body); if (typeof data.workspaceId === 'string') explicit = data.workspaceId; } catch { /* Server validates malformed JSON. */ }
  }
  const id = boundWorkspace !== undefined ? boundWorkspace : explicit || currentBrowserWorkspaceId();
  if (!id) throw new Error('Choose a workspace first.');
  if (currentBrowserWorkspaceId() !== id || (explicit && explicit !== id)) changed();
  headers.set('x-workspace-id', id);
  const controller = new AbortController();
  const signals = [requests.signal, init?.signal, input instanceof Request ? input.signal : undefined].filter(Boolean) as AbortSignal[];
  const abort = () => controller.abort();
  signals.forEach((signal) => { if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true }); });
  try {
    const response = await globalThis.fetch(input, { ...init, headers, signal: controller.signal });
    if (currentBrowserWorkspaceId() !== id) changed();
    const bytes = await response.arrayBuffer();
    if (currentBrowserWorkspaceId() !== id) changed();
    return new Response([204, 205, 304].includes(response.status) ? null : bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
  } finally { signals.forEach((signal) => signal.removeEventListener('abort', abort)); }
}
export function workspaceFetchFor(id: string | null) {
  return (input: RequestInfo | URL, init?: RequestInit) => workspaceFetch(input, init, id);
}

export async function reconcileDeletedWorkspaces(ids: string[]): Promise<void> {
  if (typeof window === 'undefined') return;
  const storage = window.localStorage;
  for (const id of ids) {
    if (!id || id === protectedDefaultId()) continue;
    const marker = 'engui.workspace.deleted.' + id;
    if (storage.getItem(marker)) continue;
    const prefix = workspaceStorageKey('', id);
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(Boolean) as string[];
    for (const key of keys) {
      if (key.startsWith(prefix) || (key.startsWith('engui.gallery.') && key.endsWith('.' + id))) storage.removeItem(key);
    }
    const { purgeDeletedWorkspaceMedia } = await import('@/lib/create/createMediaStore');
    if (await purgeDeletedWorkspaceMedia(id)) storage.setItem(marker, '1');
  }
}
