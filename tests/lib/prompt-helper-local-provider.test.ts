import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalPromptHelperProvider } from '@/lib/promptHelper/localProvider';

describe('LocalPromptHelperProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the strengthened WAN22 I2V system prompt for the wan22-video profile', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: 'She blinks naturally as her hair moves softly in the breeze. Slow push-in, warm light, cinematic natural motion.',
          },
        },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new LocalPromptHelperProvider({
      baseUrl: 'http://prompt-helper.local',
      model: 'helper-model',
    });

    await provider.improve({
      prompt: 'make her alive',
      negativePrompt: '',
      instruction: 'improve this for i2v',
      modelId: 'wan22',
      helperProfile: 'wan22-video',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || '{}'));
    const systemPrompt = body.messages?.[0]?.content || '';

    expect(systemPrompt).toContain('turn the user\'s rough intent into one polished WAN 2.2 I2V positive prompt');
    expect(systemPrompt).toContain('The source image already carries identity, outfit, visible subject appearance, framing, background, and much of the scene');
    expect(systemPrompt).toContain('One short clip should have one clear action beat');
    expect(systemPrompt).toContain('Prefer believable micro-motion for photo animation');
    expect(systemPrompt).toContain('Use at most one simple camera move');
    expect(systemPrompt).toContain('Treat any source pose as the initial pose only');
    expect(systemPrompt).toContain('When source image context is provided, use it as visual ground truth and identity reference');
    expect(systemPrompt).toContain('Return only the final edited positive prompt text');
  });
});
