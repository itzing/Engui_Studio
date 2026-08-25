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
          slotActivationSeconds: 13,
        },
      },
    });

    expect(getActiveGalleryCarouselFlowProfile(settings)).toEqual({
      id: 'default',
      name: 'Default',
      orderMode: 'random',
      portraitCycles: 10,
      landscapeCycles: 1,
      slotActivationSeconds: 10,
    });
  });

  it('migrates legacy Flow image interval into the next-slot activation setting', () => {
    const settings = normalizeGalleryCarouselFlowSettings({
      activeProfileId: 'default',
      profiles: {
        default: {
          id: 'default',
          name: 'Default',
          orderMode: 'order',
          portraitCycles: 1,
          landscapeCycles: 1,
          imageIntervalSeconds: 2,
        },
      },
    });

    expect(getActiveGalleryCarouselFlowProfile(settings).slotActivationSeconds).toBe(3);
  });

  it('includes disabled Flow defaults in the carousel settings payload', () => {
    const settings = getDefaultGalleryCarouselSettings();

    expect(settings.flowMode).toBe(false);
    expect(getActiveGalleryCarouselFlowProfile(settings.flow)).toMatchObject({
      id: 'default',
      orderMode: 'order',
      portraitCycles: 1,
      landscapeCycles: 1,
      slotActivationSeconds: 5,
    });
  });
});
