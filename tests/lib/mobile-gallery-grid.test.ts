import { describe, expect, it } from 'vitest';
import {
  MOBILE_GALLERY_COLUMN_COUNT,
  MOBILE_GALLERY_ROW_FALLBACK_SIZE,
  TABLET_GALLERY_DEFAULT_COLUMN_COUNT,
  TABLET_GALLERY_MAX_COLUMN_COUNT,
  TABLET_GALLERY_MIN_COLUMN_COUNT,
  getMobileGalleryRowSize,
  normalizeTabletGalleryColumnCount,
} from '@/lib/mobile/galleryGrid';

describe('mobile gallery grid sizing', () => {
  it('uses the container width to match square tile row height', () => {
    expect(MOBILE_GALLERY_COLUMN_COUNT).toBe(3);
    expect(getMobileGalleryRowSize(1024)).toBeCloseTo(1024 / 3);
  });

  it('supports tablet column counts for wider gallery layouts', () => {
    expect(getMobileGalleryRowSize(1024, 6)).toBeCloseTo(1024 / 6);
  });

  it('falls back before the scroll container is measured', () => {
    expect(getMobileGalleryRowSize(0)).toBe(MOBILE_GALLERY_ROW_FALLBACK_SIZE);
  });

  it('normalizes tablet column counts to the desktop-style range', () => {
    expect(normalizeTabletGalleryColumnCount('bad')).toBe(TABLET_GALLERY_DEFAULT_COLUMN_COUNT);
    expect(normalizeTabletGalleryColumnCount(2)).toBe(TABLET_GALLERY_MIN_COLUMN_COUNT);
    expect(normalizeTabletGalleryColumnCount(99)).toBe(TABLET_GALLERY_MAX_COLUMN_COUNT);
    expect(normalizeTabletGalleryColumnCount(7.4)).toBe(7);
  });
});
