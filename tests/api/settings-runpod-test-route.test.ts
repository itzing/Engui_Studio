import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/workspaces/route', () => ({
  withWorkspaceRoute: (handler: (request: Request) => Promise<Response>) => handler,
}));
vi.mock('@/lib/settingsService', () => ({ default: class SettingsService {} }));
vi.mock('@/lib/elevenlabsService', () => ({ default: class ElevenLabsService {} }));

import { POST } from '@/app/api/settings/test/route';

const fetchMock = vi.fn();

function request(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/settings/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: 'runpod',
      apiKey: 'test-only-key',
      endpointId: 'endpoint-123',
      ...overrides,
    }),
  });
}

describe('RunPod settings connection check', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('checks health without creating work, even when no workers are running', async () => {
    fetchMock.mockResolvedValue(Response.json({
      jobs: { inQueue: 0, inProgress: 0 },
      workers: { idle: 0, running: 0, ready: 0 },
    }));
    const response = await POST(request({ apiKey: '  test-only-key  ', endpointId: ' endpoint-123 ' }));
    expect(await response.json()).toMatchObject({
      success: true,
      message: 'RunPod endpoint is reachable.',
      statusCode: 200,
      endpoint: 'endpoint-123',
      responseTime: expect.any(Number),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.runpod.ai/v2/endpoint-123/health');
    expect(options).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer test-only-key' },
      cache: 'no-store',
      redirect: 'error',
      signal: expect.any(AbortSignal),
    });
    expect(options).not.toHaveProperty('body');
  });

  it.each([
    { apiKey: '' }, { apiKey: '  ' }, { apiKey: null }, { apiKey: 123 },
    { endpointId: '' }, { endpointId: '  ' }, { endpointId: null }, { endpointId: {} },
  ])('rejects missing or invalid credentials without contacting RunPod: %j', async (overrides) => {
    const response = await POST(request(overrides));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'API key and endpoint ID are required' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'authentication failed'],
    [403, 'access denied'],
    [404, 'endpoint not found'],
    [429, 'rate limit'],
    [500, 'HTTP 500'],
    [502, 'HTTP 502'],
  ])('preserves HTTP %s and reports failure even for non-JSON upstream bodies', async (status, message) => {
    fetchMock.mockResolvedValue(new Response('<html>provider error</html>', { status: Number(status) }));
    const response = await POST(request());
    const result = await response.json();
    expect(result).toMatchObject({
      success: false, statusCode: status, endpoint: 'endpoint-123', responseTime: expect.any(Number),
    });
    expect(result.message).toContain(message);
    expect(JSON.stringify(result)).not.toContain('<html>');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bounds a stalled health request to ten seconds and returns measured elapsed time', async () => {
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal);
    let currentTime = 1000;
    const now = vi.spyOn(Date, 'now').mockImplementation(() => currentTime);
    fetchMock.mockImplementation(async () => {
      currentTime = 11000;
      throw new DOMException('The operation timed out', 'TimeoutError');
    });
    try {
      const response = await POST(request());
      expect(timeout).toHaveBeenCalledWith(10000);
      expect(fetchMock.mock.calls[0][1].signal).toBe(signal);
      expect(await response.json()).toMatchObject({
        success: false, statusCode: 0, responseTime: 10000,
        message: 'RunPod health check timed out after 10 seconds. Try again later.',
      });
    } finally {
      timeout.mockRestore();
      now.mockRestore();
    }
  });

  it('reports network errors without exposing exception details or credentials', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed with test-only-key'));
    const response = await POST(request());
    const result = await response.json();
    expect(result).toMatchObject({ success: false, statusCode: 0, responseTime: expect.any(Number) });
    expect(result.message).toContain('Unable to reach RunPod');
    expect(JSON.stringify(result)).not.toContain('test-only-key');
  });

  it('keeps a supplied endpoint ID within one URL path component', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    await POST(request({ endpointId: 'x/run?input=test' }));
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.runpod.ai/v2/x%2Frun%3Finput%3Dtest/health');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });
});
