import { describe, expect, it } from 'vitest';

import { aspectRatioFromDimensions, resolveGalleryCarouselDimensions, shuffleGalleryVideoFeed } from '@/lib/galleryVideoCarousel';

describe('gallery video carousel helpers', () => {
  it('reduces media dimensions to a stable aspect ratio label', () => {
    expect(aspectRatioFromDimensions(1280, 720)).toBe('16:9');
    expect(aspectRatioFromDimensions(720, 1280)).toBe('9:16');
  });

  it('resolves dimensions from gallery generation snapshots', () => {
    expect(resolveGalleryCarouselDimensions({ outputVideoMetadata: { width: 832, height: 1216 } })).toMatchObject({
      mediaWidth: 832,
      mediaHeight: 1216,
      aspectRatio: '13:19',
    });
    expect(resolveGalleryCarouselDimensions({ width: '1280', height: '720' })).toMatchObject({
      mediaWidth: 1280,
      mediaHeight: 720,
      aspectRatio: '16:9',
    });
  });

  it('shuffles without dropping or duplicating assets', () => {
    const assets = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const randomValues = [0.1, 0.9, 0.2];
    const shuffled = shuffleGalleryVideoFeed(assets, () => randomValues.shift() ?? 0.5);

    expect(shuffled).not.toBe(assets);
    expect(new Set(shuffled.map((asset) => asset.id))).toEqual(new Set(['a', 'b', 'c', 'd']));
    expect(shuffled).toHaveLength(assets.length);
  });
});
