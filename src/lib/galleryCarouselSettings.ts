import type { GalleryCarouselRatioFilter } from '@/lib/galleryVideoCarousel';

export type GalleryCarouselSettings = GalleryCarouselRatioFilter & {
  videosEnabled: boolean;
  imagesEnabled: boolean;
  speed: number;
  scrubSpeedMultiplier: number;
};

const STORAGE_KEY_PREFIX = 'engui.gallery.carousel.settings';
const DEFAULT_SPEED = 1;
const DEFAULT_SCRUB_SPEED_MULTIPLIER = 4;

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeGalleryCarouselSettings(value: unknown, fallback: GalleryCarouselSettings): GalleryCarouselSettings {
  const stored = value && typeof value === 'object' ? value as Partial<GalleryCarouselSettings> : {};
  const videosEnabled = typeof stored.videosEnabled === 'boolean' ? stored.videosEnabled : fallback.videosEnabled;
  const imagesEnabled = typeof stored.imagesEnabled === 'boolean' ? stored.imagesEnabled : fallback.imagesEnabled;

  return {
    videosEnabled: videosEnabled || !imagesEnabled,
    imagesEnabled,
    includeLandscape: typeof stored.includeLandscape === 'boolean' ? stored.includeLandscape : fallback.includeLandscape,
    includePortrait: typeof stored.includePortrait === 'boolean' ? stored.includePortrait : fallback.includePortrait,
    speed: clampNumber(stored.speed, fallback.speed, 0.4, 2.4),
    scrubSpeedMultiplier: clampNumber(stored.scrubSpeedMultiplier, fallback.scrubSpeedMultiplier, 2, 10),
  };
}

export function getGalleryCarouselSettingsStorageKey(workspaceId: string | null) {
  return workspaceId ? `${STORAGE_KEY_PREFIX}.${workspaceId}` : null;
}

export function getDefaultGalleryCarouselSettings(overrides: Partial<GalleryCarouselSettings> = {}): GalleryCarouselSettings {
  return normalizeGalleryCarouselSettings(overrides, {
    videosEnabled: true,
    imagesEnabled: false,
    includeLandscape: true,
    includePortrait: true,
    speed: DEFAULT_SPEED,
    scrubSpeedMultiplier: DEFAULT_SCRUB_SPEED_MULTIPLIER,
  });
}

export function readStoredGalleryCarouselSettings(
  workspaceId: string | null,
  fallback: GalleryCarouselSettings = getDefaultGalleryCarouselSettings(),
) {
  const key = getGalleryCarouselSettingsStorageKey(workspaceId);
  if (!key || typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return normalizeGalleryCarouselSettings(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

export function writeStoredGalleryCarouselSettings(workspaceId: string | null, settings: GalleryCarouselSettings) {
  const key = getGalleryCarouselSettingsStorageKey(workspaceId);
  if (!key || typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(normalizeGalleryCarouselSettings(settings, settings)));
  } catch {
    // Ignore browser storage failures.
  }
}
