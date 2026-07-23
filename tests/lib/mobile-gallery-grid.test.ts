import { describe, expect, it } from 'vitest';
import {
  MOBILE_GALLERY_COLUMN_COUNT,
  MOBILE_GALLERY_ROW_FALLBACK_SIZE,
  getMobileGalleryRowSize,
} from '@/lib/mobile/galleryGrid';

describe('mobile gallery grid sizing', () => {
  it('uses the container width to match square tile row height', () => {
    expect(MOBILE_GALLERY_COLUMN_COUNT).toBe(3);
    expect(getMobileGalleryRowSize(1024)).toBeCloseTo(1024 / 3);
  });

  it('falls back before the scroll container is measured', () => {
    expect(getMobileGalleryRowSize(0)).toBe(MOBILE_GALLERY_ROW_FALLBACK_SIZE);
  });
});
