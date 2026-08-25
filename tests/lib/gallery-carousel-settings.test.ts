import { describe, expect, it } from 'vitest';

import {
  getActiveGalleryCarouselFlowProfile,
  getDefaultGalleryCarouselSettings,
  normalizeGalleryCarouselFlowSettings,
} from '@/lib/galleryCarouselSettings';

describe('gallery carousel settings', () => {
  it('normalizes Flow settings into a profile-ready structure', () => {
    const settings = normalizeGalleryCarouselFlowSettings({
      activeProfileId: 'default',
      profiles: {
        default: {
          id: 'default',
          name: 'Default',
          orderMode: 'random',
          portraitCycles: 99,
          landscapeCycles: -4,
          imageIntervalSeconds: 13,
        },
      },
    });

    expect(getActiveGalleryCarouselFlowProfile(settings)).toEqual({
      id: 'default',
      name: 'Default',
      orderMode: 'random',
      portraitCycles: 10,
      landscapeCycles: 1,
      imageIntervalSeconds: 10,
    });
  });

  it('includes disabled Flow defaults in the carousel settings payload', () => {
    const settings = getDefaultGalleryCarouselSettings();

    expect(settings.flowMode).toBe(false);
    expect(getActiveGalleryCarouselFlowProfile(settings.flow)).toMatchObject({
      id: 'default',
      orderMode: 'order',
      portraitCycles: 1,
      landscapeCycles: 1,
      imageIntervalSeconds: 5,
    });
  });
});
