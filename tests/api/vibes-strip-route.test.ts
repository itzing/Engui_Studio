import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const { getSettings, ensureHelperMode } = vi.hoisted(() => ({ getSettings: vi.fn(), ensureHelperMode: vi.fn() }));
vi.mock('@/lib/settingsService', () => ({ default: class { getSettings = getSettings; } }));
vi.mock('@/lib/helperMode', () => ({ ensureHelperMode }));
vi.mock('@/lib/workspaces/route', () => ({ withWorkspaceRoute: (handler: unknown) => handler }));
import { POST } from '@/app/api/vibes/strip/route';
const fetchMock = vi.fn();
const req = (prompt: string) => new Request('http://localhost/api/vibes/strip', { method: 'POST', body: JSON.stringify({ prompt }) }) as any;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock);
  getSettings.mockResolvedValue({ settings: { promptHelper: { provider: 'local', local: { baseUrl: 'http://helper', model: 'text' } } } });
});
afterEach(() => vi.unstubAllGlobals());
it('uses the text helper and returns only a validated final result', async () => {
  fetchMock.mockResolvedValue(Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"prompt":"A red chair."}' } }] }));
  const response = await POST(req('Moody lighting. A red chair.'));
  expect(await response.json()).toEqual({ success: true, prompt: 'A red chair.' });
  expect(ensureHelperMode).toHaveBeenCalledWith('text');
  const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(payload.messages[0].content).toContain('body geometry');
  expect(JSON.parse(payload.messages[1].content).prompt).toBe('Moody lighting. A red chair.');
});
it.each([
  [{ choices: [{ finish_reason: 'length', message: { content: '{"prompt":"Chair"}' } }] }, 'truncated'],
  [{ choices: [{ message: { reasoning_content: '{"prompt":"Chair"}' } }] }, 'no cleanup'],
  [{ choices: [{ message: { content: '{"prompt":""}' } }] }, 'empty'],
])('rejects unusable provider output without heuristic replacement', async (data, error) => {
  fetchMock.mockResolvedValue(Response.json(data));
  const response = await POST(req('A chair in moody light'));
  expect(response.status).toBe(502);
  expect((await response.json()).error).toContain(error);
});
it('rejects empty input and missing configuration without making inference calls', async () => {
  expect((await POST(req(' '))).status).toBe(400);
  getSettings.mockResolvedValue({ settings: { promptHelper: { provider: 'disabled' } } });
  expect((await POST(req('Chair'))).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
it('handles provider failures without altering the prompt', async () => {
  fetchMock.mockResolvedValue(new Response('', { status: 503 }));
  const response = await POST(req('Chair'));
  expect(response.status).toBe(502); expect((await response.json()).success).toBe(false);
});
