import { describe, expect, it } from 'vitest';

import { toCharacterSummary } from '@/lib/characters/utils';

function buildRecord(previewStateJson: string) {
  return {
    id: 'character-1',
    name: 'Mira',
    gender: 'female',
    traits: '{}',
    editorState: '{}',
    previewStateJson,
    currentVersionId: 'version-1',
    previewStatusSummary: null,
    createdAt: new Date('2026-05-07T00:00:00.000Z'),
    updatedAt: new Date('2026-05-07T00:00:00.000Z'),
    deletedAt: null,
    _count: { versions: 1 },
  };
}

describe('toCharacterSummary primary preview', () => {
  it('uses full-body reference image as the primary selector thumbnail when available', () => {
    const summary = toCharacterSummary(buildRecord(JSON.stringify({
      portrait: {
        slot: 'portrait',
        status: 'ready',
        jobId: 'portrait-job',
        imageUrl: '/portrait.png',
        previewUrl: '/portrait-preview.png',
        thumbnailUrl: '/portrait-thumb.png',
        error: null,
        promptSnapshot: null,
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
      full_body: {
        slot: 'full_body',
        status: 'ready',
        jobId: 'full-body-job',
        imageUrl: '/full-body.png',
        previewUrl: '/full-body-preview.png',
        thumbnailUrl: '/full-body-thumb.png',
        error: null,
        promptSnapshot: null,
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
    })));

    expect(summary.primaryPreviewImageUrl).toBe('/full-body.png');
    expect(summary.primaryPreviewThumbnailUrl).toBe('/full-body-thumb.png');
  });

  it('falls back to portrait when full-body has no image yet', () => {
    const summary = toCharacterSummary(buildRecord(JSON.stringify({
      portrait: {
        slot: 'portrait',
        status: 'ready',
        jobId: 'portrait-job',
        imageUrl: '/portrait.png',
        previewUrl: '/portrait-preview.png',
        thumbnailUrl: null,
        error: null,
        promptSnapshot: null,
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
      full_body: {
        slot: 'full_body',
        status: 'idle',
        jobId: null,
        imageUrl: null,
        previewUrl: null,
        thumbnailUrl: null,
        error: null,
        promptSnapshot: null,
        updatedAt: null,
      },
    })));

    expect(summary.primaryPreviewImageUrl).toBe('/portrait.png');
    expect(summary.primaryPreviewThumbnailUrl).toBe('/portrait-preview.png');
  });
});
