import { describe, expect, it, vi } from 'vitest';
import { createVideoByteCache } from '@/lib/media/videoByteCache';

const media = (length = 4, headers: Record<string, string> = {}) => new Response(new Uint8Array(length), { headers: { 'content-type': 'video/mp4', 'content-length': String(length), ...headers } });
const setup = (request: typeof fetch = vi.fn(async () => media()) as unknown as typeof fetch) => {
  let serial = 0;
  const createUrl = vi.fn(() => `blob:cached-${++serial}`);
  const revokeUrl = vi.fn();
  const cache = createVideoByteCache({ baseUrl: 'https://engui.test/', maxBytes: 12, maxFileBytes: 4, maxEntries: 3, request, createUrl, revokeUrl });
  return { cache, request, createUrl, revokeUrl };
};
const idle = async (cache: ReturnType<typeof createVideoByteCache>) => vi.waitFor(() => expect(cache.stats().fetching).toBe(false));

describe('bounded video byte cache', () => {
  it('retains compressed neighbors, leases only on use and never changes a cache-miss source', async () => {
    const { cache, request, createUrl, revokeUrl } = setup();
    const cold = cache.acquire('/a.mp4');
    expect(cold.src).toBe('/a.mp4');
    cache.setTargets(['/b.mp4', '/a.mp4', '/c.mp4']); cache.setEnabled(true); await idle(cache);
    expect(cache.stats()).toEqual({ entries: 3, bytes: 12, fetching: false, leases: 0 });
    expect(createUrl).not.toHaveBeenCalled();
    expect(cold.src).toBe('/a.mp4');
    const hot = cache.acquire('/a.mp4'); expect(hot.cached).toBe(true);
    cache.setTargets(['/b.mp4', '/a.mp4', '/c.mp4']); await idle(cache);
    expect(request).toHaveBeenCalledTimes(3);
    hot.release(); hot.release(); expect(revokeUrl).toHaveBeenCalledTimes(1);
    cache.dispose(); expect(revokeUrl).toHaveBeenCalledTimes(1);
  });

  it('evicts old bytes within limits without revoking the active source', async () => {
    const { cache, revokeUrl } = setup();
    cache.setTargets(['/a.mp4', '/b.mp4', '/c.mp4']); cache.setEnabled(true); await idle(cache);
    const active = cache.acquire('/a.mp4');
    cache.setTargets(['/d.mp4', '/a.mp4', '/e.mp4']); await idle(cache);
    expect(cache.stats().bytes).toBeLessThanOrEqual(12); expect(cache.stats().entries).toBe(3);
    expect(cache.acquire('/b.mp4').cached).toBe(false);
    expect(revokeUrl).not.toHaveBeenCalled();
    active.release(); expect(revokeUrl).toHaveBeenCalledWith(active.src); cache.dispose();
  });

  it('serializes fetches and discards an obsolete completion even when fetch ignores abort', async () => {
    const requests: { resolve: (response: Response) => void; signal: AbortSignal }[] = [];
    const fetcher = vi.fn((_url, init) => new Promise<Response>((resolve) => requests.push({ resolve, signal: init.signal }))) as unknown as typeof fetch;
    const { cache } = setup(fetcher);
    cache.setTargets(['/a.mp4', '/b.mp4']); cache.setEnabled(true); expect(requests).toHaveLength(1);
    cache.setTargets(['/c.mp4']); expect(requests[0].signal.aborted).toBe(true); expect(requests).toHaveLength(1);
    requests[0].resolve(media()); await vi.waitFor(() => expect(requests).toHaveLength(2));
    expect(cache.acquire('/a.mp4').cached).toBe(false);
    requests[1].resolve(media()); await idle(cache);
    expect(cache.acquire('/c.mp4').cached).toBe(true); cache.dispose();
  });

  it('suspends network work and prevents disposed completions from filling the cache', async () => {
    let resolve!: (response: Response) => void; let signal!: AbortSignal;
    const fetcher = vi.fn((_url, init) => { signal = init.signal; return new Promise<Response>((done) => { resolve = done; }); }) as unknown as typeof fetch;
    const { cache, createUrl } = setup(fetcher);
    cache.setTargets(['/a.mp4']); cache.setEnabled(true); cache.setEnabled(false);
    expect(signal.aborted).toBe(true);
    cache.dispose(); resolve(media()); await idle(cache);
    expect(cache.stats().entries).toBe(0); expect(createUrl).not.toHaveBeenCalled();
  });

  it('skips cross-origin, partial, oversized and truncated media without retry storms', async () => {
    const fetcher = vi.fn(async (input) => {
      if (String(input).endsWith('/partial.mp4')) return new Response('abcd', { status: 206, headers: { 'content-type': 'video/mp4' } });
      if (String(input).endsWith('/huge.mp4')) return media(8);
      return media(2, { 'content-length': '4' });
    }) as unknown as typeof fetch;
    const { cache } = setup(fetcher);
    cache.setTargets(['https://elsewhere.test/video.mp4', '/partial.mp4', '/huge.mp4', '/truncated.mp4']); cache.setEnabled(true); await idle(cache);
    expect(fetcher).toHaveBeenCalledTimes(3); expect(cache.stats().entries).toBe(0);
    cache.setEnabled(true); await idle(cache); expect(fetcher).toHaveBeenCalledTimes(3); cache.dispose();
  });

  it('enforces the byte limit even when content-length is absent', async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array(9), { headers: { 'content-type': 'video/mp4' } })) as unknown as typeof fetch;
    const { cache } = setup(fetcher);
    cache.setTargets(['/unknown.mp4']); cache.setEnabled(true); await idle(cache);
    expect(cache.stats().bytes).toBe(0); expect(cache.acquire('/unknown.mp4').cached).toBe(false); cache.dispose();
  });
});
