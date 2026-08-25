import type { GalleryCarouselRatioFilter } from '@/lib/galleryVideoCarousel';

export type GalleryCarouselSettings = GalleryCarouselRatioFilter & {
  videosEnabled: boolean;
  imagesEnabled: boolean;
  galleryViewEnabled: boolean;
  onlyFavorites: boolean;
  tiktokMode: boolean;
  flowMode: boolean;
  speed: number;
  scrubSpeedMultiplier: number;
  flow: GalleryCarouselFlowSettings;
};

export type GalleryCarouselFlowOrderMode = 'order' | 'random';

export type GalleryCarouselFlowProfileSettings = {
  id: string;
  name: string;
  orderMode: GalleryCarouselFlowOrderMode;
  portraitCycles: number;
  landscapeCycles: number;
  imageIntervalSeconds: number;
};

export type GalleryCarouselFlowSettings = {
  activeProfileId: string;
  profiles: Record<string, GalleryCarouselFlowProfileSettings>;
};

const STORAGE_KEY_PREFIX = 'engui.gallery.carousel.settings';
const DEFAULT_SPEED = 1;
const DEFAULT_SCRUB_SPEED_MULTIPLIER = 4;
const DEFAULT_FLOW_PROFILE_ID = 'default';

export const GALLERY_CAROUSEL_DEFAULT_FLOW_PROFILE: GalleryCarouselFlowProfileSettings = {
  id: DEFAULT_FLOW_PROFILE_ID,
  name: 'Default',
  orderMode: 'order',
  portraitCycles: 1,
  landscapeCycles: 1,
  imageIntervalSeconds: 5,
};

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  return Math.round(clampNumber(value, fallback, min, max));
}

function normalizeGalleryCarouselFlowProfile(
  value: unknown,
  fallback: GalleryCarouselFlowProfileSettings = GALLERY_CAROUSEL_DEFAULT_FLOW_PROFILE,
): GalleryCarouselFlowProfileSettings {
  const stored = value && typeof value === 'object' ? value as Partial<GalleryCarouselFlowProfileSettings> : {};
  const id = typeof stored.id === 'string' && stored.id.trim().length > 0 ? stored.id.trim() : fallback.id;
  return {
    id,
    name: typeof stored.name === 'string' && stored.name.trim().length > 0 ? stored.name.trim() : fallback.name,
    orderMode: stored.orderMode === 'random' ? 'random' : stored.orderMode === 'order' ? 'order' : fallback.orderMode,
    portraitCycles: clampInteger(stored.portraitCycles, fallback.portraitCycles, 1, 10),
    landscapeCycles: clampInteger(stored.landscapeCycles, fallback.landscapeCycles, 1, 10),
    imageIntervalSeconds: clampInteger(stored.imageIntervalSeconds, fallback.imageIntervalSeconds, 5, 10),
  };
}

export function normalizeGalleryCarouselFlowSettings(
  value: unknown,
  fallback: GalleryCarouselFlowSettings = {
    activeProfileId: DEFAULT_FLOW_PROFILE_ID,
    profiles: { [DEFAULT_FLOW_PROFILE_ID]: GALLERY_CAROUSEL_DEFAULT_FLOW_PROFILE },
  },
): GalleryCarouselFlowSettings {
  const stored = value && typeof value === 'object' ? value as Partial<GalleryCarouselFlowSettings> : {};
  const fallbackActiveProfile = fallback.profiles[fallback.activeProfileId] || GALLERY_CAROUSEL_DEFAULT_FLOW_PROFILE;
  const storedProfiles = stored.profiles && typeof stored.profiles === 'object' ? stored.profiles : {};
  const profiles = Object.entries(storedProfiles).reduce<Record<string, GalleryCarouselFlowProfileSettings>>((acc, [profileId, profile]) => {
    const fallbackProfile = fallback.profiles[profileId] || { ...fallbackActiveProfile, id: profileId };
    const profileRecord = profile && typeof profile === 'object' ? profile as object : {};
    const normalizedProfile = normalizeGalleryCarouselFlowProfile({ ...profileRecord, id: profileId }, fallbackProfile);
    acc[normalizedProfile.id] = normalizedProfile;
    return acc;
  }, {});

  if (Object.keys(profiles).length === 0) {
    Object.entries(fallback.profiles).forEach(([profileId, profile]) => {
      profiles[profileId] = normalizeGalleryCarouselFlowProfile(profile, GALLERY_CAROUSEL_DEFAULT_FLOW_PROFILE);
    });
  }
  if (!profiles[DEFAULT_FLOW_PROFILE_ID]) {
    profiles[DEFAULT_FLOW_PROFILE_ID] = GALLERY_CAROUSEL_DEFAULT_FLOW_PROFILE;
  }

  const activeProfileId = typeof stored.activeProfileId === 'string' && profiles[stored.activeProfileId]
    ? stored.activeProfileId
    : fallback.activeProfileId && profiles[fallback.activeProfileId]
      ? fallback.activeProfileId
      : DEFAULT_FLOW_PROFILE_ID;

  return {
    activeProfileId,
    profiles,
  };
}

export function getActiveGalleryCarouselFlowProfile(flow: GalleryCarouselFlowSettings) {
  return flow.profiles[flow.activeProfileId] || flow.profiles[DEFAULT_FLOW_PROFILE_ID] || GALLERY_CAROUSEL_DEFAULT_FLOW_PROFILE;
}

function normalizeGalleryCarouselSettings(value: unknown, fallback: GalleryCarouselSettings): GalleryCarouselSettings {
  const stored = value && typeof value === 'object' ? value as Partial<GalleryCarouselSettings> : {};
  const videosEnabled = typeof stored.videosEnabled === 'boolean' ? stored.videosEnabled : fallback.videosEnabled;
  const imagesEnabled = typeof stored.imagesEnabled === 'boolean' ? stored.imagesEnabled : fallback.imagesEnabled;

  return {
    videosEnabled: videosEnabled || !imagesEnabled,
    imagesEnabled,
    galleryViewEnabled: typeof stored.galleryViewEnabled === 'boolean' ? stored.galleryViewEnabled : fallback.galleryViewEnabled,
    onlyFavorites: typeof stored.onlyFavorites === 'boolean' ? stored.onlyFavorites : fallback.onlyFavorites,
    tiktokMode: typeof stored.tiktokMode === 'boolean' ? stored.tiktokMode : fallback.tiktokMode,
    flowMode: typeof stored.flowMode === 'boolean' ? stored.flowMode : fallback.flowMode,
    includeLandscape: typeof stored.includeLandscape === 'boolean' ? stored.includeLandscape : fallback.includeLandscape,
    includePortrait: typeof stored.includePortrait === 'boolean' ? stored.includePortrait : fallback.includePortrait,
    speed: clampNumber(stored.speed, fallback.speed, 0.4, 2.4),
    scrubSpeedMultiplier: clampNumber(stored.scrubSpeedMultiplier, fallback.scrubSpeedMultiplier, 2, 10),
    flow: normalizeGalleryCarouselFlowSettings(stored.flow, fallback.flow),
  };
}

export function getGalleryCarouselSettingsStorageKey(workspaceId: string | null) {
  return workspaceId ? `${STORAGE_KEY_PREFIX}.${workspaceId}` : null;
}

export function getDefaultGalleryCarouselSettings(overrides: Partial<GalleryCarouselSettings> = {}): GalleryCarouselSettings {
  return normalizeGalleryCarouselSettings(overrides, {
    videosEnabled: true,
    imagesEnabled: false,
    galleryViewEnabled: false,
    onlyFavorites: false,
    tiktokMode: false,
    flowMode: false,
    includeLandscape: true,
    includePortrait: true,
    speed: DEFAULT_SPEED,
    scrubSpeedMultiplier: DEFAULT_SCRUB_SPEED_MULTIPLIER,
    flow: {
      activeProfileId: DEFAULT_FLOW_PROFILE_ID,
      profiles: {
        [DEFAULT_FLOW_PROFILE_ID]: GALLERY_CAROUSEL_DEFAULT_FLOW_PROFILE,
      },
    },
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

export function writeStoredGalleryCarouselSettings(workspaceId: string | null, settings: Partial<GalleryCarouselSettings>) {
  const key = getGalleryCarouselSettingsStorageKey(workspaceId);
  if (!key || typeof window === 'undefined') return;

  try {
    const raw = window.localStorage.getItem(key);
    const previous = raw
      ? normalizeGalleryCarouselSettings(JSON.parse(raw), getDefaultGalleryCarouselSettings())
      : getDefaultGalleryCarouselSettings();
    window.localStorage.setItem(key, JSON.stringify(normalizeGalleryCarouselSettings(settings, previous)));
  } catch {
    // Ignore browser storage failures.
  }
}
