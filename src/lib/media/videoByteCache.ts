type CacheOptions = {
  baseUrl?: string;
  maxBytes?: number;
  maxFileBytes?: number;
  maxEntries?: number;
  request?: typeof fetch;
  createUrl?: (blob: Blob) => string;
  revokeUrl?: (url: string) => void;
};
export type VideoByteLease = { src: string; cached: boolean; release: () => void };

/** Compressed bytes only: this cache never creates or plays a media element. */
export function createVideoByteCache(options: CacheOptions = {}) {
  const maxBytes = options.maxBytes ?? 24 * 1024 * 1024;
  const maxFileBytes = Math.min(options.maxFileBytes ?? 8 * 1024 * 1024, maxBytes);
  const maxEntries = options.maxEntries ?? 5;
  const base = new URL(options.baseUrl ?? document.baseURI);
  const request = options.request ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const createUrl = options.createUrl ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeUrl = options.revokeUrl ?? ((url: string) => URL.revokeObjectURL(url));
  const supported = Boolean(options.createUrl || (typeof URL.createObjectURL === 'function' && typeof URL.revokeObjectURL === 'function'));
  const entries = new Map<string, { blob: Blob; pins: number }>();
  const failed = new Set<string>();
  const leases = new Set<() => void>();
  let bytes = 0;
  let targets: string[] = [];
  let enabled = false;
  let disposed = false;
  let active: { url: string; controller: AbortController } | null = null;

  const key = (src: string) => {
    try {
      const url = new URL(src, base);
      return url.origin === base.origin && /^https?:$/.test(url.protocol) ? url.href : null;
    } catch { return null; }
  };
  const block = (url: string) => {
    failed.add(url);
    if (failed.size > 32) failed.delete(failed.values().next().value!);
  };
  const makeRoom = (reserve: number, extraEntries: number) => {
    for (const [url, entry] of entries) {
      if (bytes + reserve <= maxBytes && entries.size + extraEntries <= maxEntries) break;
      if (entry.pins) continue;
      entries.delete(url); bytes -= entry.blob.size;
    }
    return bytes + reserve <= maxBytes && entries.size + extraEntries <= maxEntries;
  };
  const download = async (job: NonNullable<typeof active>) => {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await request(job.url, { signal: job.controller.signal, credentials: 'same-origin', cache: 'force-cache', redirect: 'error' });
      const size = Number(response.headers.get('content-length') || 0);
      if (response.status !== 200 || !response.headers.get('content-type')?.toLowerCase().startsWith('video/') || size > maxFileBytes || !response.body?.getReader) {
        await response.body?.cancel();
        throw new Error('Media response is not cacheable');
      }
      reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;
      while (true) {
        if (disposed || job.controller.signal.aborted) return;
        const chunk = await reader.read();
        if (chunk.done) break;
        received += chunk.value.byteLength;
        if (received > maxFileBytes) throw new Error('Media exceeds cache file limit');
        chunks.push(chunk.value as BlobPart);
      }
      if (!received || (size > 0 && size !== received)) throw new Error('Incomplete media response');
      if (disposed || job.controller.signal.aborted || !targets.includes(job.url)) return;
      const blob = new Blob(chunks, { type: response.headers.get('content-type')! });
      if (makeRoom(blob.size, 1)) { entries.set(job.url, { blob, pins: 0 }); bytes += blob.size; }
    } catch {
      if (!disposed && !job.controller.signal.aborted) block(job.url);
    } finally {
      try { await reader?.cancel(); } catch { /* Cancellation is best-effort after network failures. */ }
      reader?.releaseLock();
      if (active === job) active = null;
      pump();
    }
  };
  const pump = () => {
    if (!supported || disposed || !enabled || active) return;
    const url = targets.find((candidate) => !entries.has(candidate) && !failed.has(candidate));
    if (!url || !makeRoom(maxFileBytes, 1)) return;
    const job = { url, controller: new AbortController() };
    active = job;
    void download(job);
  };
  return {
    acquire(src: string): VideoByteLease {
      const url = key(src);
      const entry = !disposed && url ? entries.get(url) : undefined;
      if (!entry || !url) return { src, cached: false, release() {} };
      let objectUrl: string;
      try { objectUrl = createUrl(entry.blob); } catch { return { src, cached: false, release() {} }; }
      entries.delete(url); entries.set(url, entry); entry.pins += 1;
      let released = false;
      const release = () => {
        if (released) return;
        released = true; entry.pins -= 1; revokeUrl(objectUrl); leases.delete(release);
      };
      leases.add(release);
      return { src: objectUrl, cached: true, release };
    },
    setTargets(sources: string[]) {
      targets = Array.from(new Set(sources.map(key).filter((url): url is string => Boolean(url)))).slice(0, 3);
      if (active && !targets.includes(active.url)) active.controller.abort();
      pump();
    },
    setEnabled(value: boolean) {
      enabled = value;
      if (!value) active?.controller.abort();
      else pump();
    },
    forget(src: string) {
      const url = key(src); if (!url) return;
      block(url);
      const entry = entries.get(url);
      if (entry && !entry.pins) { entries.delete(url); bytes -= entry.blob.size; }
    },
    stats() { return { entries: entries.size, bytes, fetching: Boolean(active), leases: leases.size }; },
    dispose() {
      disposed = true; enabled = false; targets = []; active?.controller.abort();
      leases.forEach((release) => release());
      entries.clear(); failed.clear(); bytes = 0;
    },
  };
}
