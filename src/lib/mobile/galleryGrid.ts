export const MOBILE_GALLERY_COLUMN_COUNT = 3;
export const MOBILE_GALLERY_ROW_FALLBACK_SIZE = 128;

export function getMobileGalleryRowSize(containerWidth: number) {
  return containerWidth > 0
    ? Math.max(1, containerWidth / MOBILE_GALLERY_COLUMN_COUNT)
    : MOBILE_GALLERY_ROW_FALLBACK_SIZE;
}
