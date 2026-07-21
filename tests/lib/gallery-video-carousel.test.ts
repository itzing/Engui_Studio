import { describe, expect, it } from 'vitest';

import {
  aspectRatioFromDimensions,
  buildGalleryCarouselFeed,
  buildGalleryCarouselImageSlots,
  getGalleryCarouselAssetOrientation,
  getAdjacentGalleryCarouselSlotX,
  getFullHeightGalleryCarouselSlotSize,
  matchesGalleryCarouselRatioFilter,
  resolveGalleryCarouselDimensions,
  shouldSpawnAdjacentGalleryCarouselSlot,
  shuffleGalleryVideoFeed,
} from '@/lib/galleryVideoCarousel';

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

  it('matches assets against landscape and portrait ratio filters', () => {
    const landscape = { id: 'landscape', mediaWidth: 1280, mediaHeight: 720 };
    const portrait = { id: 'portrait', mediaWidth: 720, mediaHeight: 1280 };
    const square = { id: 'square', mediaWidth: 1024, mediaHeight: 1024 };

    expect(getGalleryCarouselAssetOrientation(landscape)).toBe('landscape');
    expect(getGalleryCarouselAssetOrientation(portrait)).toBe('portrait');
    expect(getGalleryCarouselAssetOrientation(square)).toBe('landscape');
    expect(matchesGalleryCarouselRatioFilter(landscape, { includeLandscape: true, includePortrait: false })).toBe(true);
    expect(matchesGalleryCarouselRatioFilter(portrait, { includeLandscape: true, includePortrait: false })).toBe(false);
    expect(matchesGalleryCarouselRatioFilter(portrait, { includeLandscape: false, includePortrait: true })).toBe(true);
    expect(matchesGalleryCarouselRatioFilter(landscape, { includeLandscape: false, includePortrait: true })).toBe(false);
    expect(matchesGalleryCarouselRatioFilter(landscape, { includeLandscape: false, includePortrait: false })).toBe(false);
  });

  it('shuffles without dropping or duplicating assets', () => {
    const assets = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const randomValues = [0.1, 0.9, 0.2];
    const shuffled = shuffleGalleryVideoFeed(assets, () => randomValues.shift() ?? 0.5);

    expect(shuffled).not.toBe(assets);
    expect(new Set(shuffled.map((asset) => asset.id))).toEqual(new Set(['a', 'b', 'c', 'd']));
    expect(shuffled).toHaveLength(assets.length);
  });

  it('builds a mixed feed with one image slot after every two videos', () => {
    const videos = [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }, { id: 'v4' }, { id: 'v5' }];
    const images = Array.from({ length: 10 }, (_, index) => ({
      id: `image-${index + 1}`,
      mediaWidth: 720,
      mediaHeight: 1280,
    }));

    const feed = buildGalleryCarouselFeed(videos, {
      includeImages: true,
      images,
      random: () => 0.99,
    });

    expect(feed.map((entry) => entry.kind)).toEqual(['video', 'video', 'images', 'video', 'video', 'images', 'video']);
    expect(feed.filter((entry) => entry.kind === 'images')).toHaveLength(2);
    expect(feed.filter((entry) => entry.kind === 'images').every((entry) => entry.kind === 'images' && entry.images.length === 5)).toBe(true);
  });

  it('preselects image slot groups by similar media shape', () => {
    const images = [
      { id: 'portrait-1', mediaWidth: 720, mediaHeight: 1280 },
      { id: 'portrait-2', mediaWidth: 768, mediaHeight: 1344 },
      { id: 'portrait-3', mediaWidth: 832, mediaHeight: 1216 },
      { id: 'portrait-4', mediaWidth: 704, mediaHeight: 1280 },
      { id: 'portrait-5', mediaWidth: 768, mediaHeight: 1280 },
      { id: 'landscape-1', mediaWidth: 1280, mediaHeight: 720 },
    ];

    const slots = buildGalleryCarouselImageSlots(images, 1, () => 0.99);

    expect(slots).toHaveLength(1);
    expect(slots[0].images.map((image) => image.id)).toEqual([
      'portrait-1',
      'portrait-4',
      'portrait-2',
      'portrait-5',
      'portrait-3',
    ]);
    expect(slots[0].aspectRatio).toBeLessThan(1);
  });

  it('places consecutive carousel slots edge-to-edge without a fixed black gap', () => {
    expect(getAdjacentGalleryCarouselSlotX(null, 360)).toBe(0);
    expect(getAdjacentGalleryCarouselSlotX(0, 360)).toBe(-358);
    expect(getAdjacentGalleryCarouselSlotX(14, 640)).toBe(-624);
    expect(shouldSpawnAdjacentGalleryCarouselSlot(-3)).toBe(false);
    expect(shouldSpawnAdjacentGalleryCarouselSlot(-2)).toBe(true);
    expect(shouldSpawnAdjacentGalleryCarouselSlot(0)).toBe(true);
  });

  it('scales carousel slots to full scene height while preserving aspect ratio', () => {
    expect(getFullHeightGalleryCarouselSlotSize(16 / 9, 720)).toEqual({
      width: 1280,
      height: 720,
      y: 0,
    });
    expect(getFullHeightGalleryCarouselSlotSize(9 / 16, 720)).toEqual({
      width: 405,
      height: 720,
      y: 0,
    });
    expect(getFullHeightGalleryCarouselSlotSize(0, 720)).toEqual({
      width: 405,
      height: 720,
      y: 0,
    });
  });
});
