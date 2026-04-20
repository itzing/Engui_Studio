import { describe, expect, it } from 'vitest';
import { normalizeImageDraftForModel } from '@/lib/create/imageDraft';

describe('normalizeImageDraftForModel', () => {
  it('drops incompatible params and hidden image refs when switching to flux-krea', () => {
    const snapshot = normalizeImageDraftForModel('flux-krea', {
      prompt: 'portrait',
      parameterValues: {
        use_controlnet: true,
        width: 1536,
        height: 1024,
        cfg: 7,
      },
      previewUrl: 'https://example.com/input.png',
      previewUrl2: 'https://example.com/input-2.png',
      selectedSceneId: 'scene-1',
    });

    expect(snapshot.prompt).toBe('portrait');
    expect(snapshot.parameterValues).toMatchObject({ width: 1536, height: 1024 });
    expect(snapshot.parameterValues).not.toHaveProperty('use_controlnet');
    expect(snapshot.previewUrl).toBe('');
    expect(snapshot.previewUrl2).toBe('');
    expect(snapshot.selectedSceneId).toBe('scene-1');
  });

  it('keeps controlnet input when the target model still supports it', () => {
    const snapshot = normalizeImageDraftForModel('z-image', {
      parameterValues: {
        use_controlnet: true,
        width: 1024,
        height: 1024,
      },
      previewUrl: 'https://example.com/control.png',
    });

    expect(snapshot.parameterValues).toMatchObject({ use_controlnet: true, width: 1024, height: 1024 });
    expect(snapshot.previewUrl).toBe('https://example.com/control.png');
  });
});
