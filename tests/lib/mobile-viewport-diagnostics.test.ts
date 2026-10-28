import { describe, expect, it, vi, afterEach } from 'vitest';
import { sanitizeViewportSample, VIEWPORT_DIAGNOSTICS_UNTIL } from '@/lib/mobile/viewportDiagnostics';

describe('temporary viewport diagnostic data', () => {
  it('retains only allowlisted finite geometry and enum labels', () => {
    expect(sanitizeViewportSample({
      page: 'test-page', event: 'focusout', screen: 'prompt',
      prompt: 'must not be retained', inputValue: 'must not be retained',
      metrics: { innerHeight: 844.1234, scrollY: 80, navPaddingBottom: 34, secret: 'must not be retained', visualHeight: Infinity, outerHeight: 100000000 },
    })).toEqual({ page: 'test-page', event: 'focusout', screen: 'prompt', metrics: { innerHeight: 844.12, scrollY: 80, navPaddingBottom: 34 } });
  });
  it('rejects arbitrary text in label fields and empty metrics', () => {
    expect(sanitizeViewportSample({ page: '/private/url', event: 'focusout', screen: 'prompt', metrics: { innerHeight: 844 } })).toBeNull();
    expect(sanitizeViewportSample({ page: 'test', event: 'arbitrary text', screen: 'prompt', metrics: { innerHeight: 844 } })).toBeNull();
    expect(sanitizeViewportSample({ page: 'test', event: 'resize', screen: 'private route', metrics: { innerHeight: 844 } })).toBeNull();
    expect(sanitizeViewportSample({ page: 'test', event: 'resize', screen: 'prompt', metrics: { secret: 'value' } })).toBeNull();
  });
});

vi.mock('node:fs/promises', () => ({ appendFile: vi.fn().mockResolvedValue(undefined), stat: vi.fn().mockResolvedValue({ size: 0 }) }));
import { appendFile, stat } from 'node:fs/promises';
import { POST } from '@/app/api/diagnostics/mobile-viewport/route';
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('temporary viewport diagnostic endpoint', () => {
  it('writes a sanitized record to a private file, without echoing it', async () => {
    const response = await POST(new Request('http://localhost/api/diagnostics/mobile-viewport', { method: 'POST', body: JSON.stringify({ page: 'test', event: 'resize', screen: 'create', metrics: { innerHeight: 844 }, prompt: 'private' }) }));
    expect(response.status).toBe(204);
    const call = vi.mocked(appendFile).mock.calls.at(-1)!;
    expect(JSON.parse(call[1] as string)).toEqual({ at: expect.any(Number), page: 'test', event: 'resize', screen: 'create', metrics: { innerHeight: 844 } });
    expect(call[2]).toEqual({ mode: 0o600 });
  });
  it('stops collection at the shared expiry', async () => {
    vi.useFakeTimers(); vi.setSystemTime(VIEWPORT_DIAGNOSTICS_UNTIL + 1);
    expect((await POST(new Request('http://localhost/test', { method: 'POST', body: '{}' }))).status).toBe(204);
    expect(appendFile).not.toHaveBeenCalled();
  });
  it('bounds the file and rejects cross-site or oversized payloads', async () => {
    expect((await POST(new Request('http://localhost/test', { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } }))).status).toBe(403);
    expect((await POST(new Request('http://localhost/test', { method: 'POST', body: 'x'.repeat(8193) }))).status).toBe(413);
    vi.mocked(stat).mockResolvedValueOnce({ size: 262144 } as Awaited<ReturnType<typeof stat>>);
    expect((await POST(new Request('http://localhost/test', { method: 'POST', body: JSON.stringify({ page: 'test', event: 'resize', screen: 'create', metrics: { innerHeight: 844 } }) }))).status).toBe(429);
    expect(appendFile).not.toHaveBeenCalled();
  });
});
