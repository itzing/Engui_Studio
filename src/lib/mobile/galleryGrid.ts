export const MOBILE_GALLERY_COLUMN_COUNT = 3;
export const MOBILE_GALLERY_ROW_FALLBACK_SIZE = 128;
export const TABLET_GALLERY_DEFAULT_COLUMN_COUNT = 6;
export const TABLET_GALLERY_MIN_COLUMN_COUNT = 4;
export const TABLET_GALLERY_MAX_COLUMN_COUNT = 10;
export const TABLET_GALLERY_COLUMN_STORAGE_KEY = 'engui.tablet.gallery.columns';

export function normalizeTabletGalleryColumnCount(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseInt(String(value ?? ''), 10);

  if (!Number.isFinite(parsed)) return TABLET_GALLERY_DEFAULT_COLUMN_COUNT;
  return Math.min(
    TABLET_GALLERY_MAX_COLUMN_COUNT,
    Math.max(TABLET_GALLERY_MIN_COLUMN_COUNT, Math.round(parsed)),
  );
}

export function getMobileGalleryRowSize(containerWidth: number, columnCount = MOBILE_GALLERY_COLUMN_COUNT) {
  const safeColumnCount = Number.isFinite(columnCount) && columnCount > 0
    ? columnCount
    : MOBILE_GALLERY_COLUMN_COUNT;

  return containerWidth > 0
    ? Math.max(1, containerWidth / safeColumnCount)
    : MOBILE_GALLERY_ROW_FALLBACK_SIZE;
}
