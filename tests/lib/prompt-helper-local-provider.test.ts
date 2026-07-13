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

    const userMessage = body.messages?.[1]?.content || '';

    expect(systemPrompt).toContain('turn the user\'s rough intent into one polished WAN 2.2 I2V positive prompt');
    expect(systemPrompt).toContain('Treat explicit action, pose-change, gesture, expression, or camera-change requests as intentional direction');
    expect(systemPrompt).toContain('Make the user requested action the primary motion beat');
    expect(systemPrompt).toContain('For commands such as dance, walk, run, sit, kneel, turn around, raise an arm, look back, lean forward, smile, or change pose');
    expect(systemPrompt).toContain('Use the source pose as the opening position');
    expect(systemPrompt).toContain('Layer micro-motion around explicit actions as support');
    expect(systemPrompt).toContain('For vague animation requests such as animate, make alive, add motion, cinematic, or more natural');
    expect(systemPrompt).toContain('When source image context is provided, use it as visual ground truth and identity reference');
    expect(systemPrompt).toContain('Return the final edited positive prompt text only');
    expect(systemPrompt).not.toMatch(/\bAvoid\b|\bDo not\b/);
    expect(userMessage).toContain('Make the user requested action, pose change, gesture, expression change, or camera change the main motion beat');
    expect(userMessage).toContain('Use micro-motion as supporting detail for explicit actions');
    expect(userMessage).not.toMatch(/\bAvoid\b|\bDo not\b/);
  });
});
