import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSettings, mockEnsureHelperMode } = vi.hoisted(() => ({
  mockGetSettings: vi.fn(),
  mockEnsureHelperMode: vi.fn(),
}));

vi.mock('@/lib/settingsService', () => ({
  default: class MockSettingsService {
    getSettings = mockGetSettings;
  },
}));

vi.mock('@/lib/helperMode', () => ({
  ensureHelperMode: mockEnsureHelperMode,
}));

import { POST } from '@/app/api/local-model/ask/route';

function request(body: unknown) {
  return new Request('http://localhost/api/local-model/ask', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0];
}

describe('POST /api/local-model/ask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureHelperMode.mockResolvedValue(undefined);
    mockGetSettings.mockResolvedValue({
      settings: {
        promptHelper: {
          provider: 'local',
          local: {
            baseUrl: 'http://127.0.0.1:8012/',
            model: 'helper-model.gguf',
            apiKey: '',
          },
        },
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          finish_reason: 'stop',
          message: { content: 'Plain answer' },
        }],
      }),
    })));
  });

  it('sends one stateless request to the configured local text helper', async () => {
    const response = await POST(request({ prompt: 'Explain this' }));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe('Plain answer');
    expect(mockEnsureHelperMode).toHaveBeenCalledWith('text');
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8012/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      body: expect.any(String),
    }));

    const fetchCalls = vi.mocked(fetch).mock.calls;
    const body = JSON.parse(fetchCalls[0][1]?.body as string);
    expect(body.model).toBe('helper-model.gguf');
    expect(body.stream).toBe(false);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Explain this' });
  });

  it('rejects an empty request before switching helper mode', async () => {
    const response = await POST(request({ prompt: '   ' }));
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toBe('Request is required');
    expect(mockEnsureHelperMode).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
