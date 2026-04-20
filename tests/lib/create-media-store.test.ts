import { describe, expect, it } from 'vitest';
import { normalizeImageDraftForModel } from '@/lib/create/imageDraft';

describe('image draft media refs', () => {
  it('drops persisted local refs when the target model hides image inputs', () => {
    const snapshot = normalizeImageDraftForModel('flux-krea', {
      parameterValues: {
        use_controlnet: true,
      },
      previewUrl: 'blob:http://localhost/local-1',
      inputs: {
        primary: {
          kind: 'idb-media',
          mediaId: 'media-1',
          fileName: 'input.png',
          mimeType: 'image/png',
          size: 10,
          lastModified: 123,
        },
      },
    });

    expect(snapshot.previewUrl).toBe('');
    expect(snapshot.inputs?.primary).toBeNull();
  });

  it('preserves persisted local refs when the target model still exposes image input', () => {
    const snapshot = normalizeImageDraftForModel('z-image', {
      parameterValues: {
        use_controlnet: true,
      },
      previewUrl: 'blob:http://localhost/local-1',
      inputs: {
        primary: {
          kind: 'idb-media',
          mediaId: 'media-1',
          fileName: 'input.png',
          mimeType: 'image/png',
          size: 10,
          lastModified: 123,
        },
      },
    });

    expect(snapshot.inputs?.primary).toMatchObject({
      kind: 'idb-media',
      mediaId: 'media-1',
    });
  });
});
