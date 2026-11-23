/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
vi.mock('@/lib/i18n/context', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/workspaces/useWorkspaceFetch', () => ({ useWorkspaceFetch: () => globalThis.fetch }));
import { LoRAManagementDialog } from '@/components/lora/LoRAManagementDialog';

class Xhr {
  static all: Xhr[] = [];
  upload: { onprogress: ((e: ProgressEvent) => void) | null; onload: (() => void) | null } = { onprogress: null, onload: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  status = 200;
  responseText = '{"eTag":"part-etag"}';
  url = '';
  aborted = false;
  constructor() { Xhr.all.push(this); }
  open(_method: string, url: string) { this.url = url; }
  setRequestHeader() {}
  send() {}
  abort() { this.aborted = true; this.onabort?.(); }
  getResponseHeader() { return 'part-etag'; }
  progress(loaded: number, total = 5) { this.upload.onprogress?.({ loaded, total, lengthComputable: true } as ProgressEvent); }
  done() { this.onload?.(); }
}
const reply = (body: unknown) => ({ ok: true, json: async () => body } as Response);
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { resolve, promise }; };
const init = (id = 'one') => reply({ success: true, uploadId: id, volume: 'models', key: `loras/${id}`, partSize: 5 });
let fetchMock: Mock<(url: string, options?: RequestInit) => Promise<Response>>;
const flush = async () => { await act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); }); };
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); await flush(); };
const start = async (names = ['one.safetensors']) => {
  fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: names.map(name => new File(['0123456789'], name)) } });
  await flush();
};
const calls = (path: string) => fetchMock.mock.calls.filter(([url]) => url === path).map(([url, options]) => [url, options || {}] as const);
const cancel = async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); await flush(); };
const mount = () => render(React.createElement(LoRAManagementDialog, { open: true, onOpenChange: vi.fn(), workspaceId: 'test-workspace' }));
beforeEach(() => {
  vi.useFakeTimers(); Xhr.all = [];
  vi.stubGlobal('XMLHttpRequest', Xhr);
  fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith('/api/lora?')) return reply({ success: true, loras: [] });
    if (url === '/api/lora/uploads') return reply({ uploads: [] });
    if (url === '/api/lora/multipart/init') return init();
    if (url === '/api/lora/multipart/abort') return reply({ success: true });
    if (url === '/api/lora/multipart/finalize') return reply({ success: true });
    throw new Error('Unexpected route: ' + url);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('LoRA cancellation and stalled part recovery', () => {
  it('releases the file picker and aborts XHR immediately even if remote cleanup hangs', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, options?: RequestInit) => url.endsWith('/abort') ? new Promise(() => {}) : original(url, options));
    mount(); await start(); expect(Xhr.all).toHaveLength(1);
    const button = screen.getByRole('button', { name: 'Cancel' });
    expect(button.closest('div[role=button]')?.className).not.toContain('pointer-events-none');
    await cancel();
    expect(Xhr.all[0].aborted).toBe(true);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect((document.querySelector('input[type=file]') as HTMLInputElement).disabled).toBe(false);
    expect(calls('/api/lora/multipart/abort')).toHaveLength(1);
    expect(calls('/api/lora/multipart/abort')[0][1].signal).toBeTruthy();
  });
  it('does not start the remaining files after cancellation', async () => {
    mount(); await start(['one.safetensors', 'two.safetensors']); await cancel(); await advance(5000);
    expect(calls('/api/lora/multipart/init')).toHaveLength(1);
    expect(Xhr.all).toHaveLength(1);
    expect(calls('/api/lora/multipart/finalize')).toHaveLength(0);
  });
  it('cleans up late initialization after Cancel without starting any part', async () => {
    const pending = deferred<Response>(); const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, options?: RequestInit) => url.endsWith('/init') ? pending.promise : original(url, options));
    mount(); await start(); await cancel();
    expect(Xhr.all).toHaveLength(0);
    pending.resolve(init('late')); await flush();
    expect(Xhr.all).toHaveLength(0);
    expect(JSON.parse(String(calls('/api/lora/multipart/abort')[0][1].body)).uploadId).toBe('late');
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
  it('does not let old initialization or cleanup reset a new upload', async () => {
    const pending = deferred<Response>(); const original = fetchMock.getMockImplementation()!; let initialized = 0;
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith('/init')) return ++initialized === 1 ? pending.promise : Promise.resolve(init('two'));
      return original(url, options);
    });
    mount(); await start(); await cancel(); await start(['two.safetensors']);
    pending.resolve(init('one')); await flush();
    expect(Xhr.all).toHaveLength(1); expect(Xhr.all[0].url).toContain('uploadId=two');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByText('two.safetensors')).toBeTruthy();
    expect(JSON.parse(String(calls('/api/lora/multipart/abort')[0][1].body)).uploadId).toBe('one');
  });
  it('retries only the stalled part, leaving already completed parts alone', async () => {
    mount(); await start(); act(() => Xhr.all[0].done()); await flush();
    expect(Xhr.all).toHaveLength(2);
    await advance(60_000); expect(Xhr.all[1].aborted).toBe(true);
    await advance(1000); expect(Xhr.all).toHaveLength(3);
    expect(Xhr.all[2].url).toBe(Xhr.all[1].url); expect(Xhr.all[2].url).toContain('partNumber=2');
    act(() => Xhr.all[2].done()); await flush();
    const parts = JSON.parse(String(calls('/api/lora/multipart/finalize')[0][1].body)).parts;
    expect(parts.map((p: { partNumber: number }) => p.partNumber)).toEqual([1, 2]);
  });
  it('allows a slow upload with continuing byte progress beyond the inactivity deadline', async () => {
    mount(); await start();
    for (let i = 1; i <= 4; i++) { await advance(50_000); act(() => Xhr.all[0].progress(i)); }
    expect(Xhr.all).toHaveLength(1); expect(Xhr.all[0].aborted).toBe(false);
    act(() => Xhr.all[0].done()); await flush(); expect(Xhr.all).toHaveLength(2);
  });
  it('does not keep a stalled request alive with duplicate progress values', async () => {
    mount(); await start(); act(() => Xhr.all[0].progress(1));
    await advance(40_000); act(() => Xhr.all[0].progress(1)); await advance(20_000);
    expect(Xhr.all[0].aborted).toBe(true);
  });
  it('also bounds server acknowledgment after the browser finishes sending bytes', async () => {
    mount(); await start(); act(() => Xhr.all[0].progress(5));
    await advance(119_000); expect(Xhr.all[0].aborted).toBe(false);
    await advance(1000); expect(Xhr.all[0].aborted).toBe(true);
    await advance(1000); expect(Xhr.all).toHaveLength(2); expect(Xhr.all[1].url).toBe(Xhr.all[0].url);
  });
  it('stops after three stalled attempts, reports failure and never finalizes a partial file', async () => {
    mount(); await start(); await advance(60_000); await advance(1000);
    await advance(60_000); await advance(2000); await advance(60_000);
    expect(Xhr.all).toHaveLength(3);
    expect(calls('/api/lora/multipart/abort')).toHaveLength(1);
    expect(calls('/api/lora/multipart/finalize')).toHaveLength(0);
    expect(screen.getByText(/Upload failed: Part 1 upload timed out/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
  it('cancels during backoff without starting the next retry', async () => {
    mount(); await start(); await advance(60_000); await cancel(); await advance(10_000);
    expect(Xhr.all).toHaveLength(1); expect(calls('/api/lora/multipart/finalize')).toHaveLength(0);
  });
  it('ignores late responses and progress from an aborted request', async () => {
    mount(); await start(); const old = Xhr.all[0]; const lateLoad = old.onload!; const lateProgress = old.upload.onprogress!;
    await cancel(); await start(['new.safetensors']);
    act(() => { lateProgress({ loaded: 5, total: 5, lengthComputable: true } as ProgressEvent); lateLoad(); }); await flush();
    expect(screen.getByText('0%')).toBeTruthy(); expect(calls('/api/lora/multipart/finalize')).toHaveLength(0);
    expect(screen.getByText('new.safetensors')).toBeTruthy();
  });
  it('does not let a late finalization clear a new upload after cancellation', async () => {
    const pending = deferred<Response>(); const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, options?: RequestInit) => url.endsWith('/finalize') ? pending.promise : original(url, options));
    mount(); await start(); act(() => Xhr.all[0].done()); await flush(); act(() => Xhr.all[1].done()); await flush();
    expect(calls('/api/lora/multipart/finalize')).toHaveLength(1);
    await cancel(); await start(['new.safetensors']); pending.resolve(reply({ success: true })); await flush();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy(); expect(screen.getByText('new.safetensors')).toBeTruthy();
    expect(screen.getByText('0%')).toBeTruthy();
  });
  it('keeps activation keys away from the background video editor shortcuts', async () => {
    mount(); await start(); const shortcut = vi.fn(); document.addEventListener('keydown', shortcut);
    try {
      const button = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.keyDown(button, { key: ' ' }); fireEvent.keyDown(button, { key: 'Enter' });
      expect(shortcut).not.toHaveBeenCalled();
    } finally { document.removeEventListener('keydown', shortcut); }
  });

});
