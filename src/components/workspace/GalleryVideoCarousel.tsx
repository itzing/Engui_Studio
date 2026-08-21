'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, Film, Heart, Image as ImageIcon, Loader2, Pause, Play, RefreshCw, Share2, Shuffle, Type, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { persistCreateReuseDraft } from '@/lib/create/persistCreateReuseDraft';
import { shareGalleryAsset } from '@/lib/galleryShare';
import {
  getDefaultGalleryCarouselSettings,
  readStoredGalleryCarouselSettings,
  writeStoredGalleryCarouselSettings,
  type GalleryCarouselSettings,
} from '@/lib/galleryCarouselSettings';
import {
  type GalleryCarouselFeedItem,
  type GalleryCarouselRatioFilter,
  getAdjacentGalleryCarouselSlotX,
  getFullHeightGalleryCarouselSlotSize,
  readGalleryCarouselAssetRatio,
  shouldSpawnAdjacentGalleryCarouselSlot,
} from '@/lib/galleryVideoCarousel';

type GalleryCarouselAsset = {
  id: string;
  workspaceId: string;
  type: 'image' | 'video' | 'audio';
  originalUrl: string;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  derivativeStatus?: string | null;
  prompt?: string | null;
  modelId?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  aspectRatio?: string | null;
  favorited?: boolean;
  addedToGalleryAt: string;
};

type CarouselFeedWindowPagination = {
  totalCount: number;
  anchorIndex: number | null;
  hasBefore: boolean;
  hasAfter: boolean;
  beforeCursor: number | null;
  afterCursor: number | null;
};

type CarouselFeedWindowResponse = {
  success: boolean;
  seed?: string;
  previous?: Array<GalleryCarouselFeedItem<GalleryCarouselAsset, GalleryCarouselAsset>>;
  current?: GalleryCarouselFeedItem<GalleryCarouselAsset, GalleryCarouselAsset> | null;
  next?: Array<GalleryCarouselFeedItem<GalleryCarouselAsset, GalleryCarouselAsset>>;
  pagination?: CarouselFeedWindowPagination;
  counts?: {
    videos: number;
    images: number;
    total: number;
  };
  error?: string;
};

type CarouselSlot = {
  kind: 'video' | 'images';
  feedIndex: number;
  instanceId: string;
  entry: GalleryCarouselFeedItem<GalleryCarouselAsset, GalleryCarouselAsset>;
  x: number;
  y: number;
  width: number;
  height: number;
  imageCycleMs?: number;
  activeImageIndex?: number;
};

type DragState = {
  pointerId: number | null;
  startMain: number;
  lastMain: number;
  hasDragged: boolean;
};

type CarouselMovementAxis = 'horizontal' | 'vertical';
type CarouselFeedSource = 'galleryOrder' | 'shuffle';
type ResetFeedOptions = {
  pause?: boolean;
  seedNeighborCount?: number;
};
type GalleryOrderFilter = {
  bucket?: 'all' | 'common' | 'draft' | 'upscale';
  query?: string;
  includeTrashed?: boolean;
  onlyTrashed?: boolean;
  favoritesOnly?: boolean;
};

const DEFAULT_VIDEO_RATIO = 9 / 16;
const DEFAULT_IMAGE_RATIO = 1;
const BASE_SPEED_PX_PER_SECOND = 90;
const DRAG_START_THRESHOLD_PX = 4;
const TIKTOK_SWIPE_THRESHOLD_PX = 56;
const DEFAULT_KEYBOARD_SCRUB_SPEED_MULTIPLIER = 4;
const MIN_KEYBOARD_SCRUB_SPEED_MULTIPLIER = 2;
const MAX_KEYBOARD_SCRUB_SPEED_MULTIPLIER = 10;
const EDGE_OVERLAP_PX = 2;
const HORIZONTAL_SLOT_TRIM_BUFFER_STAGE_RATIO = 1.5;
const VERTICAL_SLOT_TRIM_BUFFER_STAGE_RATIO = 0.2;
const VERTICAL_SLOT_TRIM_BUFFER_MIN_PX = 120;
const DEFAULT_INITIAL_NEIGHBOR_COUNT = 1;
const TIKTOK_NEIGHBOR_COUNT = 5;
const TIKTOK_SNAP_ANIMATION_MS = 180;
const GALLERY_VIEW_INITIAL_NEIGHBOR_COUNT = 3;
const GALLERY_VIEW_WINDOW_SIDE_LIMIT = 12;
const GALLERY_VIEW_PREFETCH_LIMIT = 24;
const SHUFFLE_WINDOW_SIDE_LIMIT = 12;
const SHUFFLE_PREFETCH_LIMIT = 24;

function createCarouselShuffleSeed() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readVideoAssetRatio(asset: GalleryCarouselAsset, measuredRatios: Record<string, number>) {
  const measured = measuredRatios[asset.id];
  if (Number.isFinite(measured) && measured > 0) return measured;
  return readGalleryCarouselAssetRatio(asset, DEFAULT_VIDEO_RATIO);
}

function readFeedEntryRatio(entry: GalleryCarouselFeedItem<GalleryCarouselAsset, GalleryCarouselAsset>, measuredRatios: Record<string, number>) {
  return entry.kind === 'video'
    ? readVideoAssetRatio(entry.asset, measuredRatios)
    : (Number.isFinite(entry.aspectRatio) && entry.aspectRatio > 0 ? entry.aspectRatio : DEFAULT_IMAGE_RATIO);
}

function buildSlotSize(entry: GalleryCarouselFeedItem<GalleryCarouselAsset, GalleryCarouselAsset>, stage: { width: number; height: number }, measuredRatios: Record<string, number>, movementAxis: CarouselMovementAxis) {
  const ratio = readFeedEntryRatio(entry, measuredRatios);
  if (movementAxis === 'vertical') {
    const width = Math.max(1, stage.width);
    const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : DEFAULT_VIDEO_RATIO;
    const height = Math.max(1, width / safeRatio);
    return {
      width,
      height,
      x: 0,
      y: Math.max(0, stage.height - height),
    };
  }
  return {
    ...getFullHeightGalleryCarouselSlotSize(ratio, stage.height),
    x: 0,
  };
}

function buildTikTokSlotSize(stage: { width: number; height: number }) {
  return {
    width: Math.max(1, stage.width),
    height: Math.max(1, stage.height),
    x: 0,
    y: 0,
  };
}

function getSlotTrimBuffer(stage: { width: number; height: number }, isVertical: boolean) {
  if (isVertical) {
    return Math.max(stage.height * VERTICAL_SLOT_TRIM_BUFFER_STAGE_RATIO, VERTICAL_SLOT_TRIM_BUFFER_MIN_PX);
  }
  return Math.max(stage.width * HORIZONTAL_SLOT_TRIM_BUFFER_STAGE_RATIO, stage.height);
}

async function fetchCarouselFeedWindow(
  workspaceId: string,
  options: {
    source: CarouselFeedSource;
    direction: 'around' | 'before' | 'after';
    cursor?: number | null;
    anchorAssetId?: string | null;
    seed?: string | null;
    includeVideos: boolean;
    includeImages: boolean;
    ratioFilter: GalleryCarouselRatioFilter;
    onlyFavorites: boolean;
    before: number;
    after: number;
    galleryOrderFilter?: GalleryOrderFilter;
  },
) {
  const search = new URLSearchParams({
    workspaceId,
    source: options.source,
    direction: options.direction,
    includeVideos: String(options.includeVideos),
    includeImages: String(options.includeImages),
    includeLandscape: String(options.ratioFilter.includeLandscape),
    includePortrait: String(options.ratioFilter.includePortrait),
    favoritesOnly: String(options.onlyFavorites || Boolean(options.galleryOrderFilter?.favoritesOnly)),
    before: String(options.before),
    after: String(options.after),
    sort: 'newest',
  });
  if (options.seed) {
    search.set('seed', options.seed);
  }
  if (options.cursor !== undefined && options.cursor !== null) {
    search.set('cursor', String(options.cursor));
  }
  if (options.anchorAssetId) {
    search.set('anchorAssetId', options.anchorAssetId);
  }
  if (options.galleryOrderFilter?.bucket) {
    search.set('bucket', options.galleryOrderFilter.bucket);
  }
  if (options.galleryOrderFilter?.query?.trim()) {
    search.set('q', options.galleryOrderFilter.query.trim());
  }
  if (options.galleryOrderFilter?.includeTrashed) {
    search.set('includeTrashed', 'true');
  }
  if (options.galleryOrderFilter?.onlyTrashed) {
    search.set('onlyTrashed', 'true');
  }

  const response = await fetch(`/api/carousel/feed-window?${search.toString()}`, { cache: 'no-store' });
  const data = await response.json() as CarouselFeedWindowResponse;
  if (!response.ok || !data.success || !data.pagination) {
    throw new Error(data.error || 'Failed to load carousel feed window');
  }

  return data;
}

function shouldIgnoreKeyboardShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  if (['button', 'input', 'select', 'textarea'].includes(tagName)) return true;
  return Boolean(target.closest('[role="slider"], [contenteditable="true"]'));
}

function readVideoLoadProgress(video: HTMLVideoElement) {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0 || video.buffered.length === 0) return 0;
  let bufferedEnd = 0;
  for (let index = 0; index < video.buffered.length; index += 1) {
    bufferedEnd = Math.max(bufferedEnd, video.buffered.end(index));
  }
  return Math.min(1, Math.max(0, bufferedEnd / duration));
}

function readTikTokVideoPosterUrl(asset: GalleryCarouselAsset) {
  if (asset.type !== 'video') return null;
  const thumbnailUrl = asset.thumbnailUrl?.trim();
  if (!thumbnailUrl || thumbnailUrl === asset.originalUrl || thumbnailUrl === asset.previewUrl) return null;
  return thumbnailUrl;
}

function shouldBackfillTikTokVideoPoster(asset: GalleryCarouselAsset) {
  if (asset.type !== 'video') return false;
  return !readTikTokVideoPosterUrl(asset) || asset.derivativeStatus === 'pending' || asset.derivativeStatus === 'processing';
}

type GalleryVideoCarouselProps = {
  workspaceId: string | null;
  onClose?: () => void;
  initialVideosEnabled?: boolean;
  initialImagesEnabled?: boolean;
  initialIncludeLandscape?: boolean;
  initialIncludePortrait?: boolean;
  initialOnlyFavorites?: boolean;
  initialSpeed?: number;
  initialScrubSpeedMultiplier?: number;
  showControls?: boolean;
  enableKeyboardControls?: boolean;
  movementAxis?: CarouselMovementAxis;
  initialGalleryViewEnabled?: boolean;
  initialTiktokMode?: boolean;
  currentGalleryAssetId?: string | null;
  galleryOrderFilter?: GalleryOrderFilter;
};

export function GalleryVideoCarousel({
  workspaceId,
  onClose,
  initialVideosEnabled = true,
  initialImagesEnabled = false,
  initialIncludeLandscape = true,
  initialIncludePortrait = true,
  initialOnlyFavorites = false,
  initialSpeed = 1,
  initialScrubSpeedMultiplier = DEFAULT_KEYBOARD_SCRUB_SPEED_MULTIPLIER,
  showControls = true,
  enableKeyboardControls = true,
  movementAxis = 'horizontal',
  initialGalleryViewEnabled = false,
  initialTiktokMode = false,
  currentGalleryAssetId = null,
  galleryOrderFilter,
}: GalleryVideoCarouselProps) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({});
  const preloadRequestedVideoInstanceIdsRef = useRef<Set<string>>(new Set());
  const playRequestedVideoInstanceIdsRef = useRef<Set<string>>(new Set());
  const playInteractionRetryVideoInstanceIdsRef = useRef<Set<string>>(new Set());
  const tiktokPosterBackfillRequestedAssetIdsRef = useRef<Set<string>>(new Set());
  const userPlaybackInteractionRef = useRef(false);
  const stageSizeRef = useRef({ width: 1280, height: 720 });
  const activeSlotsRef = useRef<CarouselSlot[]>([]);
  const feedRef = useRef<Array<GalleryCarouselFeedItem<GalleryCarouselAsset, GalleryCarouselAsset>>>([]);
  const carouselWindowPaginationRef = useRef<CarouselFeedWindowPagination | null>(null);
  const carouselShuffleSeedRef = useRef<string | null>(null);
  const isLoadingBeforeWindowRef = useRef(false);
  const isLoadingAfterWindowRef = useRef(false);
  const nextIndexRef = useRef(0);
  const lastFrameTimestampRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const slotCounterRef = useRef(0);
  const pausedRef = useRef(false);
  const speedRef = useRef(initialSpeed);
  const scrubSpeedMultiplierRef = useRef(initialScrubSpeedMultiplier);
  const videosEnabledRef = useRef(true);
  const imagesEnabledRef = useRef(false);
  const galleryViewEnabledRef = useRef(initialGalleryViewEnabled);
  const onlyFavoritesRef = useRef(initialOnlyFavorites);
  const tiktokModeRef = useRef(initialTiktokMode);
  const tiktokSnapAnimationTimeoutRef = useRef<number | null>(null);
  const isTiktokSnapAnimatingRef = useRef(false);
  const ratioFilterRef = useRef<GalleryCarouselRatioFilter>({
    includeLandscape: initialIncludeLandscape,
    includePortrait: initialIncludePortrait,
  });
  const measuredRatiosRef = useRef<Record<string, number>>({});
  const movementAxisRef = useRef<CarouselMovementAxis>(movementAxis);
  const dragStateRef = useRef<DragState>({ pointerId: null, startMain: 0, lastMain: 0, hasDragged: false });
  const keyboardScrubDirectionRef = useRef<0 | -1 | 1>(0);
  const suppressClickRef = useRef(false);
  const [sourceVideos, setSourceVideos] = useState<GalleryCarouselAsset[]>([]);
  const [sourceImages, setSourceImages] = useState<GalleryCarouselAsset[]>([]);
  const [activeSlots, setActiveSlots] = useState<CarouselSlot[]>([]);
  const [nextIndex, setNextIndex] = useState(0);
  const [speed, setSpeed] = useState(initialSpeed);
  const [scrubSpeedMultiplier, setScrubSpeedMultiplier] = useState(initialScrubSpeedMultiplier);
  const [paused, setPaused] = useState(false);
  const [videosEnabled, setVideosEnabled] = useState(initialVideosEnabled);
  const [imagesEnabled, setImagesEnabled] = useState(initialImagesEnabled);
  const [galleryViewEnabled, setGalleryViewEnabled] = useState(initialGalleryViewEnabled);
  const [onlyFavorites, setOnlyFavorites] = useState(initialOnlyFavorites);
  const [includeLandscape, setIncludeLandscape] = useState(initialIncludeLandscape);
  const [includePortrait, setIncludePortrait] = useState(initialIncludePortrait);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingWindow, setIsLoadingWindow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedEnded, setFeedEnded] = useState(false);
  const [measuredRatios, setMeasuredRatios] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isTiktokSnapAnimating, setIsTiktokSnapAnimating] = useState(false);
  const [videoReadyInstanceIds, setVideoReadyInstanceIds] = useState<Set<string>>(() => new Set());
  const [videoLoadProgress, setVideoLoadProgress] = useState<Record<string, number>>({});
  const [isUiHidden, setIsUiHidden] = useState(showControls);
  const [areTikTokActionControlsVisible, setAreTikTokActionControlsVisible] = useState(false);
  const [activeTikTokActionAssetId, setActiveTikTokActionAssetId] = useState<string | null>(null);

  const remainingCount = Math.max(0, feedRef.current.length - nextIndex);
  const visibleCount = activeSlots.length;
  const totalVideoCount = sourceVideos.length;
  const totalImageCount = sourceImages.length;
  const totalMediaCount = totalVideoCount + totalImageCount;
  const visibleImageSlotCount = activeSlots.filter((slot) => slot.kind === 'images').length;

  useEffect(() => {
    movementAxisRef.current = movementAxis;
  }, [movementAxis]);

  const resetFeed = useCallback((feed: Array<GalleryCarouselFeedItem<GalleryCarouselAsset, GalleryCarouselAsset>>, startIndex = 0, options: ResetFeedOptions = {}) => {
    const safeStartIndex = Math.min(Math.max(0, Math.floor(startIndex)), Math.max(0, feed.length - 1));
    const stage = stageSizeRef.current;
    const slotSeed = slotCounterRef.current + 1;
    const seedNeighborCount = tiktokModeRef.current
      ? TIKTOK_NEIGHBOR_COUNT
      : Math.max(DEFAULT_INITIAL_NEIGHBOR_COUNT, Math.floor(options.seedNeighborCount ?? DEFAULT_INITIAL_NEIGHBOR_COUNT));
    const buildSlot = (
      entry: GalleryCarouselFeedItem<GalleryCarouselAsset, GalleryCarouselAsset>,
      feedIndex: number,
      x: number,
      y: number,
      width: number,
      height: number,
    ): CarouselSlot => ({
      kind: entry.kind,
      feedIndex,
      instanceId: tiktokModeRef.current ? `tiktok-${entry.id}` : `${entry.id}-${slotSeed}-${feedIndex}`,
      entry,
      x,
      y,
      width,
      height,
      imageCycleMs: entry.kind === 'images' ? 0 : undefined,
      activeImageIndex: entry.kind === 'images' ? 0 : undefined,
    });
    const currentEntry = feed[safeStartIndex];
    const currentSize = currentEntry
      ? tiktokModeRef.current
        ? buildTikTokSlotSize(stage)
        : buildSlotSize(currentEntry, stage, measuredRatiosRef.current, movementAxisRef.current)
      : null;
    const currentSlot: CarouselSlot | null = currentEntry && currentSize
      ? buildSlot(currentEntry, safeStartIndex, currentSize.x, currentSize.y, currentSize.width, currentSize.height)
      : null;
    const seededSlots: CarouselSlot[] = currentSlot ? [currentSlot] : [];
    let firstSeededSlot = currentSlot;
    let lastSeededSlot = currentSlot;
    for (let offset = 1; offset <= seedNeighborCount; offset += 1) {
      const previousEntry = firstSeededSlot ? feed[safeStartIndex - offset] : null;
      const previousSize = previousEntry
        ? tiktokModeRef.current
          ? buildTikTokSlotSize(stage)
          : buildSlotSize(previousEntry, stage, measuredRatiosRef.current, movementAxisRef.current)
        : null;
      if (previousEntry && previousSize && firstSeededSlot) {
        const previousSlot = buildSlot(
          previousEntry,
          safeStartIndex - offset,
          movementAxisRef.current === 'vertical' ? previousSize.x : firstSeededSlot.x + firstSeededSlot.width - EDGE_OVERLAP_PX,
          movementAxisRef.current === 'vertical'
            ? firstSeededSlot.y - previousSize.height + (tiktokModeRef.current ? 0 : EDGE_OVERLAP_PX)
            : previousSize.y,
          previousSize.width,
          previousSize.height,
        );
        seededSlots.unshift(previousSlot);
        firstSeededSlot = previousSlot;
      }

      const nextEntry = lastSeededSlot ? feed[safeStartIndex + offset] : null;
      const nextSize = nextEntry
        ? tiktokModeRef.current
          ? buildTikTokSlotSize(stage)
          : buildSlotSize(nextEntry, stage, measuredRatiosRef.current, movementAxisRef.current)
        : null;
      if (nextEntry && nextSize && lastSeededSlot) {
        const nextSlot = buildSlot(
          nextEntry,
          safeStartIndex + offset,
          movementAxisRef.current === 'vertical' ? nextSize.x : lastSeededSlot.x - nextSize.width + EDGE_OVERLAP_PX,
          movementAxisRef.current === 'vertical'
            ? lastSeededSlot.y + lastSeededSlot.height - (tiktokModeRef.current ? 0 : EDGE_OVERLAP_PX)
            : nextSize.y,
          nextSize.width,
          nextSize.height,
        );
        seededSlots.push(nextSlot);
        lastSeededSlot = nextSlot;
      }
    }
    const nextPaused = tiktokModeRef.current || Boolean(options.pause);
    feedRef.current = feed;
    activeSlotsRef.current = seededSlots;
    nextIndexRef.current = seededSlots.length > 0 ? seededSlots[seededSlots.length - 1].feedIndex + 1 : safeStartIndex;
    slotCounterRef.current = slotSeed;
    if (!tiktokModeRef.current) {
      setVideoReadyInstanceIds(new Set());
    }
    setActiveSlots(seededSlots);
    setNextIndex(nextIndexRef.current);
    setFeedEnded(feed.length === 0);
    pausedRef.current = nextPaused;
    setPaused(nextPaused);
  }, []);

  const loadAssets = useCallback(async (includeVideos: boolean, includeImages: boolean, ratioFilter: GalleryCarouselRatioFilter, onlyFavoritedAssets: boolean, useGalleryView: boolean) => {
    if (!workspaceId) {
      setSourceVideos([]);
      setSourceImages([]);
      carouselWindowPaginationRef.current = null;
      carouselShuffleSeedRef.current = null;
      resetFeed([], 0);
      return;
    }

    setIsLoading(true);
    setError(null);
    feedRef.current = [];
    activeSlotsRef.current = [];
    nextIndexRef.current = 0;
    setActiveSlots([]);
    setNextIndex(0);
    setFeedEnded(false);
    carouselWindowPaginationRef.current = null;
    try {
      const source: CarouselFeedSource = useGalleryView ? 'galleryOrder' : 'shuffle';
      const shuffleSeed = useGalleryView ? null : createCarouselShuffleSeed();
      const windowData = await fetchCarouselFeedWindow(workspaceId, {
        source,
        direction: 'around',
        anchorAssetId: useGalleryView ? currentGalleryAssetId : null,
        seed: shuffleSeed,
        includeVideos,
        includeImages,
        ratioFilter,
        onlyFavorites: onlyFavoritedAssets,
        before: useGalleryView ? GALLERY_VIEW_WINDOW_SIDE_LIMIT : SHUFFLE_WINDOW_SIDE_LIMIT,
        after: useGalleryView ? GALLERY_VIEW_WINDOW_SIDE_LIMIT : SHUFFLE_WINDOW_SIDE_LIMIT,
        galleryOrderFilter,
      });
      const feed = [
        ...(windowData.previous || []),
        ...(windowData.current ? [windowData.current] : []),
        ...(windowData.next || []),
      ];
      carouselWindowPaginationRef.current = windowData.pagination || null;
      carouselShuffleSeedRef.current = useGalleryView ? null : (windowData.seed || shuffleSeed);
      setSourceVideos(Array.from({ length: windowData.counts?.videos || 0 }, (_, index) => ({
        id: `carousel-video-count-${index}`,
        workspaceId,
        type: 'video' as const,
        originalUrl: '',
        derivativeStatus: null,
        addedToGalleryAt: '',
      })));
      setSourceImages(Array.from({ length: windowData.counts?.images || 0 }, (_, index) => ({
        id: `carousel-image-count-${index}`,
        workspaceId,
        type: 'image' as const,
        originalUrl: '',
        addedToGalleryAt: '',
      })));
      resetFeed(feed, windowData.previous?.length || 0, {
        pause: useGalleryView,
        seedNeighborCount: useGalleryView ? GALLERY_VIEW_INITIAL_NEIGHBOR_COUNT : undefined,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load gallery feed');
      carouselWindowPaginationRef.current = null;
      carouselShuffleSeedRef.current = null;
      setSourceVideos([]);
      setSourceImages([]);
      resetFeed([], 0);
    } finally {
      setIsLoading(false);
    }
  }, [currentGalleryAssetId, galleryOrderFilter, resetFeed, workspaceId]);

  const persistSettings = useCallback((overrides: Partial<GalleryCarouselSettings> = {}) => {
    writeStoredGalleryCarouselSettings(workspaceId, {
      videosEnabled: videosEnabledRef.current,
      imagesEnabled: imagesEnabledRef.current,
      galleryViewEnabled: galleryViewEnabledRef.current,
      onlyFavorites: onlyFavoritesRef.current,
      tiktokMode: tiktokModeRef.current,
      includeLandscape: ratioFilterRef.current.includeLandscape,
      includePortrait: ratioFilterRef.current.includePortrait,
      speed: speedRef.current,
      scrubSpeedMultiplier: scrubSpeedMultiplierRef.current,
      ...overrides,
    });
  }, [workspaceId]);

  useEffect(() => {
    const storedSettings = readStoredGalleryCarouselSettings(workspaceId, getDefaultGalleryCarouselSettings({
      videosEnabled: initialVideosEnabled,
      imagesEnabled: initialImagesEnabled,
      galleryViewEnabled: initialGalleryViewEnabled,
      tiktokMode: initialTiktokMode,
      includeLandscape: initialIncludeLandscape,
      includePortrait: initialIncludePortrait,
      onlyFavorites: initialOnlyFavorites,
      speed: initialSpeed,
      scrubSpeedMultiplier: initialScrubSpeedMultiplier,
    }));
    const effectiveSettings = initialTiktokMode
      ? {
          ...storedSettings,
          tiktokMode: true,
          videosEnabled: true,
          imagesEnabled: false,
          includeLandscape: false,
          includePortrait: true,
        }
      : storedSettings;
    const nextRatioFilter = {
      includeLandscape: effectiveSettings.includeLandscape,
      includePortrait: effectiveSettings.includePortrait,
    };
    videosEnabledRef.current = effectiveSettings.videosEnabled;
    setVideosEnabled(effectiveSettings.videosEnabled);
    imagesEnabledRef.current = effectiveSettings.imagesEnabled;
    setImagesEnabled(effectiveSettings.imagesEnabled);
    galleryViewEnabledRef.current = effectiveSettings.galleryViewEnabled;
    setGalleryViewEnabled(effectiveSettings.galleryViewEnabled);
    onlyFavoritesRef.current = effectiveSettings.onlyFavorites;
    setOnlyFavorites(effectiveSettings.onlyFavorites);
    tiktokModeRef.current = effectiveSettings.tiktokMode;
    ratioFilterRef.current = nextRatioFilter;
    setIncludeLandscape(effectiveSettings.includeLandscape);
    setIncludePortrait(effectiveSettings.includePortrait);
    speedRef.current = effectiveSettings.speed;
    setSpeed(effectiveSettings.speed);
    scrubSpeedMultiplierRef.current = effectiveSettings.scrubSpeedMultiplier;
    setScrubSpeedMultiplier(effectiveSettings.scrubSpeedMultiplier);
    void loadAssets(effectiveSettings.videosEnabled, effectiveSettings.imagesEnabled, nextRatioFilter, effectiveSettings.onlyFavorites, effectiveSettings.galleryViewEnabled);
  }, [initialGalleryViewEnabled, initialImagesEnabled, initialIncludeLandscape, initialIncludePortrait, initialOnlyFavorites, initialScrubSpeedMultiplier, initialSpeed, initialTiktokMode, initialVideosEnabled, loadAssets, workspaceId]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    scrubSpeedMultiplierRef.current = scrubSpeedMultiplier;
  }, [scrubSpeedMultiplier]);

  useEffect(() => {
    imagesEnabledRef.current = imagesEnabled;
  }, [imagesEnabled]);

  useEffect(() => {
    onlyFavoritesRef.current = onlyFavorites;
  }, [onlyFavorites]);

  useEffect(() => {
    measuredRatiosRef.current = measuredRatios;
  }, [measuredRatios]);

  const extendCarouselFeedWindow = useCallback(async (direction: 'before' | 'after') => {
    if (!workspaceId) return;
    const pagination = carouselWindowPaginationRef.current;
    if (!pagination) return;
    const source: CarouselFeedSource = galleryViewEnabledRef.current ? 'galleryOrder' : 'shuffle';
    const shuffleSeed = source === 'shuffle' ? carouselShuffleSeedRef.current : null;
    if (source === 'shuffle' && !shuffleSeed) return;
    if (direction === 'before') {
      if (!pagination.hasBefore || pagination.beforeCursor === null || isLoadingBeforeWindowRef.current) return;
      isLoadingBeforeWindowRef.current = true;
    } else {
      if (!pagination.hasAfter || pagination.afterCursor === null || isLoadingAfterWindowRef.current) return;
      isLoadingAfterWindowRef.current = true;
    }

    setIsLoadingWindow(true);
    try {
      const windowData = await fetchCarouselFeedWindow(workspaceId, {
        source,
        direction,
        cursor: direction === 'before' ? pagination.beforeCursor : pagination.afterCursor,
        anchorAssetId: source === 'galleryOrder' ? currentGalleryAssetId : null,
        seed: shuffleSeed,
        includeVideos: videosEnabledRef.current,
        includeImages: imagesEnabledRef.current,
        ratioFilter: ratioFilterRef.current,
        onlyFavorites: onlyFavoritesRef.current,
        before: direction === 'before' ? (source === 'galleryOrder' ? GALLERY_VIEW_PREFETCH_LIMIT : SHUFFLE_PREFETCH_LIMIT) : 0,
        after: direction === 'after' ? (source === 'galleryOrder' ? GALLERY_VIEW_PREFETCH_LIMIT : SHUFFLE_PREFETCH_LIMIT) : 0,
        galleryOrderFilter,
      });
      const nextItems = [
        ...(windowData.previous || []),
        ...(windowData.current ? [windowData.current] : []),
        ...(windowData.next || []),
      ];
      const mergedPagination = windowData.pagination
        ? direction === 'before'
          ? {
              ...windowData.pagination,
              hasAfter: pagination.hasAfter,
              afterCursor: pagination.afterCursor,
            }
          : {
              ...windowData.pagination,
              hasBefore: pagination.hasBefore,
              beforeCursor: pagination.beforeCursor,
            }
        : pagination;
      if (nextItems.length === 0) {
        carouselWindowPaginationRef.current = mergedPagination;
        return;
      }

      const existingIds = new Set(feedRef.current.map((entry) => entry.id));
      const newItems = nextItems.filter((entry) => !existingIds.has(entry.id));
      if (newItems.length === 0) {
        carouselWindowPaginationRef.current = mergedPagination;
        return;
      }

      if (direction === 'before') {
        feedRef.current = [...newItems, ...feedRef.current];
        nextIndexRef.current += newItems.length;
        activeSlotsRef.current = activeSlotsRef.current.map((slot) => ({
          ...slot,
          feedIndex: slot.feedIndex + newItems.length,
        }));
        setNextIndex(nextIndexRef.current);
        setActiveSlots(activeSlotsRef.current);
      } else {
        feedRef.current = [...feedRef.current, ...newItems];
      }
      carouselWindowPaginationRef.current = mergedPagination;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load carousel feed window');
    } finally {
      if (direction === 'before') {
        isLoadingBeforeWindowRef.current = false;
      } else {
        isLoadingAfterWindowRef.current = false;
      }
      setIsLoadingWindow(isLoadingBeforeWindowRef.current || isLoadingAfterWindowRef.current);
    }
  }, [currentGalleryAssetId, galleryOrderFilter, workspaceId]);

  const hideTikTokActionControls = useCallback(() => {
    setAreTikTokActionControlsVisible(false);
    setActiveTikTokActionAssetId(null);
  }, []);

  const showTikTokFeedIndex = useCallback((targetFeedIndex: number) => {
    const feed = feedRef.current;
    if (!tiktokModeRef.current || feed.length === 0) return;

    const safeIndex = Math.min(Math.max(0, targetFeedIndex), feed.length - 1);
    hideTikTokActionControls();
    resetFeed(feed, safeIndex, { pause: true, seedNeighborCount: TIKTOK_NEIGHBOR_COUNT });

    if (safeIndex >= feed.length - 2) {
      void extendCarouselFeedWindow('after');
    }
    if (safeIndex <= 1) {
      void extendCarouselFeedWindow('before');
    }
  }, [extendCarouselFeedWindow, hideTikTokActionControls, resetFeed]);

  const getCurrentTikTokSlot = useCallback(() => {
    const slots = activeSlotsRef.current;
    if (slots.length === 0) return null;
    return slots.reduce((closestSlot, slot) => {
      return Math.abs(slot.y) < Math.abs(closestSlot.y) ? slot : closestSlot;
    }, slots[0]);
  }, []);

  const alignTikTokSlots = useCallback((currentFeedIndex: number, currentOffset = 0) => {
    const stage = stageSizeRef.current;
    activeSlotsRef.current = activeSlotsRef.current.map((slot) => ({
      ...slot,
      x: 0,
      y: (slot.feedIndex - currentFeedIndex) * stage.height + currentOffset,
      width: stage.width,
      height: stage.height,
    }));
    setActiveSlots(activeSlotsRef.current);
  }, []);

  const animateTikTokSnap = useCallback((currentFeedIndex: number, currentOffset: number, nextFeedIndex: number | null) => {
    if (tiktokSnapAnimationTimeoutRef.current !== null) {
      window.clearTimeout(tiktokSnapAnimationTimeoutRef.current);
    }
    isTiktokSnapAnimatingRef.current = true;
    setIsTiktokSnapAnimating(true);
    alignTikTokSlots(currentFeedIndex, currentOffset);
    tiktokSnapAnimationTimeoutRef.current = window.setTimeout(() => {
      isTiktokSnapAnimatingRef.current = false;
      setIsTiktokSnapAnimating(false);
      tiktokSnapAnimationTimeoutRef.current = null;
      if (nextFeedIndex !== null) {
        showTikTokFeedIndex(nextFeedIndex);
      } else {
        alignTikTokSlots(currentFeedIndex, 0);
      }
    }, TIKTOK_SNAP_ANIMATION_MS);
  }, [alignTikTokSlots, showTikTokFeedIndex]);

  const scrubTikTokSlots = useCallback((deltaMain: number) => {
    const currentSlot = getCurrentTikTokSlot();
    if (!currentSlot || !Number.isFinite(deltaMain) || deltaMain === 0 || isTiktokSnapAnimatingRef.current) return;

    const stage = stageSizeRef.current;
    const slots = activeSlotsRef.current;
    const hasPrevious = slots.some((slot) => slot.feedIndex === currentSlot.feedIndex - 1);
    const hasNext = slots.some((slot) => slot.feedIndex === currentSlot.feedIndex + 1);
    const minOffset = hasNext ? -stage.height : 0;
    const maxOffset = hasPrevious ? stage.height : 0;
    const nextOffset = Math.min(maxOffset, Math.max(minOffset, currentSlot.y + deltaMain));
    alignTikTokSlots(currentSlot.feedIndex, nextOffset);

    if (currentSlot.feedIndex >= feedRef.current.length - 2) {
      void extendCarouselFeedWindow('after');
    }
    if (currentSlot.feedIndex <= 1) {
      void extendCarouselFeedWindow('before');
    }
  }, [alignTikTokSlots, extendCarouselFeedWindow, getCurrentTikTokSlot]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        stageSizeRef.current = { width: rect.width, height: rect.height };
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (tiktokSnapAnimationTimeoutRef.current !== null) {
        window.clearTimeout(tiktokSnapAnimationTimeoutRef.current);
      }
    };
  }, []);

  const spawnNext = useCallback(() => {
    const stage = stageSizeRef.current;
    const feed = feedRef.current;
    const activeSlots = activeSlotsRef.current;
    const nextFeedIndex = activeSlots.length > 0 ? activeSlots[activeSlots.length - 1].feedIndex + 1 : nextIndexRef.current;
    if (stage.width <= 0 || stage.height <= 0 || nextFeedIndex >= feed.length) return;

    const entry = feed[nextFeedIndex];
    const size = buildSlotSize(entry, stage, measuredRatiosRef.current, movementAxisRef.current);
    const trailingSlot = activeSlots[activeSlots.length - 1] || null;
    nextIndexRef.current = Math.max(nextIndexRef.current, nextFeedIndex + 1);
    const x = movementAxisRef.current === 'vertical'
      ? size.x
      : getAdjacentGalleryCarouselSlotX(trailingSlot?.x ?? null, size.width);
    const y = movementAxisRef.current === 'vertical'
      ? (trailingSlot ? trailingSlot.y + trailingSlot.height - EDGE_OVERLAP_PX : size.y)
      : size.y;
    const slot: CarouselSlot = {
      kind: entry.kind,
      feedIndex: nextFeedIndex,
      instanceId: `${entry.id}-${slotCounterRef.current}-${nextFeedIndex}`,
      entry,
      x,
      y,
      width: size.width,
      height: size.height,
      imageCycleMs: entry.kind === 'images' ? 0 : undefined,
      activeImageIndex: entry.kind === 'images' ? 0 : undefined,
    };
    activeSlotsRef.current = [...activeSlotsRef.current, slot];
    setNextIndex(nextIndexRef.current);
    setActiveSlots(activeSlotsRef.current);
  }, []);

  const spawnPrevious = useCallback(() => {
    const stage = stageSizeRef.current;
    const activeSlots = activeSlotsRef.current;
    if (stage.width <= 0 || stage.height <= 0 || activeSlots.length === 0) return;

    const oldestSlot = activeSlots[0];
    const previousFeedIndex = oldestSlot.feedIndex - 1;
    if (previousFeedIndex < 0) return;

    const entry = feedRef.current[previousFeedIndex];
    if (!entry) return;

    const size = buildSlotSize(entry, stage, measuredRatiosRef.current, movementAxisRef.current);
    const slot: CarouselSlot = {
      kind: entry.kind,
      feedIndex: previousFeedIndex,
      instanceId: `${entry.id}-${slotCounterRef.current}-${previousFeedIndex}`,
      entry,
      x: movementAxisRef.current === 'vertical' ? size.x : oldestSlot.x + oldestSlot.width - EDGE_OVERLAP_PX,
      y: movementAxisRef.current === 'vertical' ? oldestSlot.y - size.height + EDGE_OVERLAP_PX : size.y,
      width: size.width,
      height: size.height,
      imageCycleMs: entry.kind === 'images' ? 0 : undefined,
      activeImageIndex: entry.kind === 'images' ? 0 : undefined,
    };
    activeSlotsRef.current = [slot, ...activeSlots];
    setActiveSlots(activeSlotsRef.current);
  }, []);

  const maybeSpawnNext = useCallback(() => {
    const activeSlots = activeSlotsRef.current;
    const nextFeedIndex = activeSlots.length > 0 ? activeSlots[activeSlots.length - 1].feedIndex + 1 : nextIndexRef.current;
    if (nextFeedIndex >= feedRef.current.length) {
      void extendCarouselFeedWindow('after');
      return;
    }
    if (activeSlots.length === 0) {
      spawnNext();
      return;
    }

    const stage = stageSizeRef.current;
    const newestSlot = activeSlots[activeSlots.length - 1];
    const shouldSpawn = movementAxisRef.current === 'vertical'
      ? newestSlot.y + newestSlot.height <= stage.height + EDGE_OVERLAP_PX
      : shouldSpawnAdjacentGalleryCarouselSlot(newestSlot.x);
    if (shouldSpawn) {
      spawnNext();
    }
  }, [extendCarouselFeedWindow, spawnNext]);

  const maybeSpawnPrevious = useCallback(() => {
    const activeSlots = activeSlotsRef.current;
    if (activeSlots.length === 0) {
      spawnNext();
      return;
    }

    const oldestSlot = activeSlots[0];
    if (oldestSlot.feedIndex <= 0) {
      void extendCarouselFeedWindow('before');
      return;
    }

    const stage = stageSizeRef.current;
    const shouldSpawn = movementAxisRef.current === 'vertical'
      ? oldestSlot.y >= -EDGE_OVERLAP_PX
      : oldestSlot.x + oldestSlot.width <= stage.width + EDGE_OVERLAP_PX;
    if (shouldSpawn) {
      spawnPrevious();
    }
  }, [extendCarouselFeedWindow, spawnNext, spawnPrevious]);

  const fillAdjacentSlots = useCallback((direction: -1 | 1) => {
    if (activeSlotsRef.current.length === 0) {
      spawnNext();
    }

    let spawnGuard = 0;
    while (direction > 0 && spawnGuard < 64) {
      const beforeCount = activeSlotsRef.current.length;
      maybeSpawnNext();
      if (activeSlotsRef.current.length === beforeCount) break;
      spawnGuard += 1;
    }

    spawnGuard = 0;
    while (direction < 0 && spawnGuard < 64) {
      const beforeCount = activeSlotsRef.current.length;
      maybeSpawnPrevious();
      if (activeSlotsRef.current.length === beforeCount) break;
      spawnGuard += 1;
    }
  }, [maybeSpawnNext, maybeSpawnPrevious, spawnNext]);

  const trimDistantSlots = useCallback((preserveAnchor: boolean) => {
    const stage = stageSizeRef.current;
    const isVertical = movementAxisRef.current === 'vertical';
    const buffer = getSlotTrimBuffer(stage, isVertical);
    const previousSlots = activeSlotsRef.current;
    const nextSlots = previousSlots.filter((slot) => {
      if (isVertical) {
        return slot.y < stage.height + slot.height + buffer
          && slot.y + slot.height > -buffer;
      }
      return slot.x < stage.width + slot.width + buffer
        && slot.x + slot.width > -buffer;
    });
    if (nextSlots.length > 0 || previousSlots.length === 0 || !preserveAnchor) {
      activeSlotsRef.current = nextSlots;
      return;
    }

    const viewportCenter = (isVertical ? stage.height : stage.width) / 2;
    activeSlotsRef.current = [
      previousSlots.reduce((closestSlot, slot) => {
        const closestDistance = Math.abs((isVertical ? closestSlot.y + closestSlot.height / 2 : closestSlot.x + closestSlot.width / 2) - viewportCenter);
        const slotDistance = Math.abs((isVertical ? slot.y + slot.height / 2 : slot.x + slot.width / 2) - viewportCenter);
        return slotDistance < closestDistance ? slot : closestSlot;
      }, previousSlots[0]),
    ];
  }, []);

  const setMovementPaused = useCallback((nextPaused: boolean) => {
    pausedRef.current = nextPaused;
    setPaused(nextPaused);
  }, []);

  const hideControls = useCallback(() => {
    setIsUiHidden(true);
  }, []);

  const revealControls = useCallback(() => {
    if (!showControls) return;
    setIsUiHidden((current) => current ? false : current);
  }, [showControls]);

  const toggleTikTokActionControls = useCallback(() => {
    const currentSlot = getCurrentTikTokSlot();
    const currentAsset = currentSlot?.entry.kind === 'video' ? currentSlot.entry.asset : null;
    if (!currentAsset) {
      hideTikTokActionControls();
      return;
    }
    setAreTikTokActionControlsVisible((visible) => {
      const isSameAsset = activeTikTokActionAssetId === currentAsset.id;
      const nextVisible = !(visible && isSameAsset);
      setActiveTikTokActionAssetId(nextVisible ? currentAsset.id : null);
      return nextVisible;
    });
  }, [activeTikTokActionAssetId, getCurrentTikTokSlot, hideTikTokActionControls]);

  const updateFeedAsset = useCallback((assetId: string, updater: (asset: GalleryCarouselAsset) => GalleryCarouselAsset) => {
    const mergeEntry = (entry: GalleryCarouselFeedItem<GalleryCarouselAsset, GalleryCarouselAsset>) => entry.kind === 'video'
      ? { ...entry, asset: entry.asset.id === assetId ? updater(entry.asset) : entry.asset }
      : { ...entry, images: entry.images.map((asset) => asset.id === assetId ? updater(asset) : asset) };
    feedRef.current = feedRef.current.map(mergeEntry);
    activeSlotsRef.current = activeSlotsRef.current.map((slot) => ({
      ...slot,
      entry: mergeEntry(slot.entry),
    }));
    setActiveSlots(activeSlotsRef.current);
  }, []);

  const handleTikTokFavoriteToggle = useCallback(async (asset: GalleryCarouselAsset) => {
    const nextFavorited = !asset.favorited;
    updateFeedAsset(asset.id, (current) => ({ ...current, favorited: nextFavorited }));
    try {
      const response = await fetch(`/api/gallery/assets/${asset.id}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorited: nextFavorited }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to update favorite');
    } catch {
      updateFeedAsset(asset.id, (current) => ({ ...current, favorited: asset.favorited }));
    }
  }, [updateFeedAsset]);

  const handleTikTokShare = useCallback(async (asset: GalleryCarouselAsset) => {
    if (asset.type !== 'image' && asset.type !== 'video') return;
    try {
      await shareGalleryAsset({
        id: asset.id,
        type: asset.type,
        originalUrl: asset.originalUrl,
        title: asset.prompt || `Gallery ${asset.type}`,
      });
    } catch {
      // Sharing can be unavailable or cancelled by the browser; keep the TikTok overlay open.
    }
  }, []);

  const handleTikTokReuse = useCallback(async (asset: GalleryCarouselAsset, action: 'txt2img' | 'img2vid' | 'txt2vid') => {
    const response = await fetch(`/api/gallery/assets/${asset.id}/reuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await response.json();
    if (response.ok && data.success && data.payload) {
      persistCreateReuseDraft(data.payload);
      router.push('/m/create');
    }
  }, [router]);

  const requestVideoPlayback = useCallback((instanceId: string, video: HTMLVideoElement, forceInteractionRetry = false) => {
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    const alreadyRequested = playRequestedVideoInstanceIdsRef.current.has(instanceId);
    const alreadyRetriedAfterInteraction = playInteractionRetryVideoInstanceIdsRef.current.has(instanceId);
    if (!tiktokModeRef.current && alreadyRequested && (!forceInteractionRetry || alreadyRetriedAfterInteraction)) return;
    if (alreadyRequested && !video.paused && (!forceInteractionRetry || alreadyRetriedAfterInteraction)) return;

    playRequestedVideoInstanceIdsRef.current.add(instanceId);
    if (forceInteractionRetry) {
      playInteractionRetryVideoInstanceIdsRef.current.add(instanceId);
    }
    const result = video.play();
    if (result && typeof result.catch === 'function') {
      void result.catch(() => {
        playRequestedVideoInstanceIdsRef.current.delete(instanceId);
        playInteractionRetryVideoInstanceIdsRef.current.delete(instanceId);
      });
    }
  }, []);

  const markVideoReady = useCallback((instanceId: string) => {
    setVideoReadyInstanceIds((current) => {
      if (current.has(instanceId)) return current;
      const next = new Set(current);
      next.add(instanceId);
      return next;
    });
  }, []);

  const updateVideoLoadProgress = useCallback((instanceId: string, video: HTMLVideoElement) => {
    const nextProgress = readVideoLoadProgress(video);
    setVideoLoadProgress((current) => {
      if (Math.abs((current[instanceId] || 0) - nextProgress) < 0.01) return current;
      return { ...current, [instanceId]: nextProgress };
    });
  }, []);

  const clearVideoInstanceState = useCallback((instanceIds: Iterable<string>) => {
    const ids = Array.from(instanceIds);
    if (ids.length === 0) return;
    ids.forEach((instanceId) => {
      preloadRequestedVideoInstanceIdsRef.current.delete(instanceId);
      playRequestedVideoInstanceIdsRef.current.delete(instanceId);
      playInteractionRetryVideoInstanceIdsRef.current.delete(instanceId);
    });
    setVideoReadyInstanceIds((current) => {
      if (!ids.some((instanceId) => current.has(instanceId))) return current;
      const next = new Set(current);
      ids.forEach((instanceId) => next.delete(instanceId));
      return next;
    });
    setVideoLoadProgress((current) => {
      if (!ids.some((instanceId) => Object.prototype.hasOwnProperty.call(current, instanceId))) return current;
      const next = { ...current };
      ids.forEach((instanceId) => {
        delete next[instanceId];
      });
      return next;
    });
  }, []);

  const requestTikTokPosterBackfill = useCallback((assetIds: string[]) => {
    if (!workspaceId || assetIds.length === 0) return;
    const requestedIds = assetIds.filter((assetId) => {
      if (tiktokPosterBackfillRequestedAssetIdsRef.current.has(assetId)) return false;
      tiktokPosterBackfillRequestedAssetIdsRef.current.add(assetId);
      return true;
    });
    if (requestedIds.length === 0) return;

    void fetch('/api/gallery/assets/derivatives/backfill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, limit: requestedIds.length, assetIds: requestedIds }),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ results?: Array<{ id: string; derivativeStatus?: string | null; thumbnailUrl?: string | null; previewUrl?: string | null }> }>;
      })
      .then((data) => {
        const results = data?.results || [];
        if (results.length === 0) return;
        const updates = new Map(results.map((result) => [result.id, result]));
        const mergeAsset = (asset: GalleryCarouselAsset) => {
          const update = updates.get(asset.id);
          if (!update) return asset;
          return {
            ...asset,
            thumbnailUrl: update.thumbnailUrl ?? asset.thumbnailUrl,
            previewUrl: update.previewUrl ?? asset.previewUrl,
            derivativeStatus: update.derivativeStatus ?? asset.derivativeStatus,
          };
        };
        const mergeEntry = (entry: GalleryCarouselFeedItem<GalleryCarouselAsset, GalleryCarouselAsset>) => entry.kind === 'video'
          ? { ...entry, asset: mergeAsset(entry.asset) }
          : { ...entry, images: entry.images.map(mergeAsset) };
        feedRef.current = feedRef.current.map(mergeEntry);
        activeSlotsRef.current = activeSlotsRef.current.map((slot) => ({
          ...slot,
          entry: mergeEntry(slot.entry),
        }));
        setActiveSlots(activeSlotsRef.current);
      })
      .catch(() => {
        requestedIds.forEach((assetId) => tiktokPosterBackfillRequestedAssetIdsRef.current.delete(assetId));
      });
  }, [workspaceId]);

  const retryMountedVideoPlayback = useCallback(() => {
    const currentTikTokSlot = tiktokModeRef.current ? getCurrentTikTokSlot() : null;
    Object.entries(videoRefs.current).forEach(([instanceId, video]) => {
      const shouldPlay = !tiktokModeRef.current || currentTikTokSlot?.instanceId === instanceId;
      if (shouldPlay && (video.paused || video.readyState > 0)) {
        requestVideoPlayback(instanceId, video, true);
      } else if (tiktokModeRef.current) {
        video.pause();
      }
    });
  }, [getCurrentTikTokSlot, requestVideoPlayback]);

  const reconcileTikTokWindow = useCallback((slots: CarouselSlot[]) => {
    if (!tiktokModeRef.current) return;
    const currentSlot = getCurrentTikTokSlot();
    if (!currentSlot) return;

    const allowedInstanceIds = new Set(
      slots
        .filter((slot) => Math.abs(slot.feedIndex - currentSlot.feedIndex) <= TIKTOK_NEIGHBOR_COUNT)
        .map((slot) => slot.instanceId),
    );
    const posterOnlyInstanceIds = slots
      .filter((slot) => Math.abs(slot.feedIndex - currentSlot.feedIndex) > 1)
      .map((slot) => slot.instanceId);
    clearVideoInstanceState(posterOnlyInstanceIds);
    Object.entries(videoRefs.current).forEach(([instanceId, video]) => {
      const slot = slots.find((candidate) => candidate.instanceId === instanceId);
      const distanceFromCurrent = slot ? Math.abs(slot.feedIndex - currentSlot.feedIndex) : Number.POSITIVE_INFINITY;
      if (!allowedInstanceIds.has(instanceId) || distanceFromCurrent > 1) {
        video.pause();
        video.removeAttribute('src');
        try {
          video.load();
        } catch {
          // Ignore cleanup failures; removing the ref is enough for React to release the node.
        }
        delete videoRefs.current[instanceId];
        clearVideoInstanceState([instanceId]);
        return;
      }

      video.preload = 'auto';
      if (video.readyState === 0 && !preloadRequestedVideoInstanceIdsRef.current.has(instanceId)) {
        preloadRequestedVideoInstanceIdsRef.current.add(instanceId);
        try {
          video.load();
        } catch {
          // Browsers may refuse explicit preload in constrained environments; the preload hint still applies.
        }
      }
    });

    const missingPosterAssetIds = slots
      .filter((slot) => slot.entry.kind === 'video')
      .filter((slot) => Math.abs(slot.feedIndex - currentSlot.feedIndex) <= TIKTOK_NEIGHBOR_COUNT)
      .map((slot) => slot.entry.kind === 'video' ? slot.entry.asset : null)
      .filter((asset): asset is GalleryCarouselAsset => Boolean(asset))
      .filter(shouldBackfillTikTokVideoPoster)
      .map((asset) => asset.id);
    requestTikTokPosterBackfill(Array.from(new Set(missingPosterAssetIds)));
  }, [clearVideoInstanceState, getCurrentTikTokSlot, requestTikTokPosterBackfill]);

  const unlockVideoPlayback = useCallback(() => {
    userPlaybackInteractionRef.current = true;
    retryMountedVideoPlayback();
  }, [retryMountedVideoPlayback]);

  useEffect(() => {
    if (!tiktokModeRef.current) return;
    activeSlots.forEach((slot) => {
      const video = videoRefs.current[slot.instanceId];
      if (!video) return;
      if (Math.abs(slot.y) < 1) {
        requestVideoPlayback(slot.instanceId, video);
      } else {
        video.pause();
      }
    });
  }, [activeSlots, requestVideoPlayback]);

  useEffect(() => {
    if (!tiktokModeRef.current) return;
    reconcileTikTokWindow(activeSlots);
  }, [activeSlots, reconcileTikTokWindow]);

  const manualScrubTape = useCallback((deltaMain: number) => {
    if (!Number.isFinite(deltaMain) || deltaMain === 0 || isLoading || totalMediaCount === 0) return;
    if (activeSlotsRef.current.length === 0) {
      spawnNext();
    }
    if (activeSlotsRef.current.length === 0) return;

    activeSlotsRef.current = activeSlotsRef.current.map((slot) => ({
      ...slot,
      x: movementAxisRef.current === 'vertical' ? slot.x : slot.x + deltaMain,
      y: movementAxisRef.current === 'vertical' ? slot.y + deltaMain : slot.y,
    }));

    fillAdjacentSlots(movementAxisRef.current === 'vertical' ? (deltaMain < 0 ? 1 : -1) : (deltaMain > 0 ? 1 : -1));
    trimDistantSlots(true);

    setFeedEnded(false);
    setActiveSlots(activeSlotsRef.current);
  }, [fillAdjacentSlots, isLoading, spawnNext, totalMediaCount, trimDistantSlots]);

  const pauseAndScrubTape = useCallback((deltaMain: number) => {
    setMovementPaused(true);
    manualScrubTape(deltaMain);
  }, [manualScrubTape, setMovementPaused]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (isLoading || totalMediaCount === 0 || (event.pointerType === 'mouse' && event.button !== 0)) return;
    unlockVideoPlayback();
    const pointerMain = movementAxisRef.current === 'vertical' ? event.clientY : event.clientX;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startMain: pointerMain,
      lastMain: pointerMain,
      hasDragged: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [isLoading, totalMediaCount, unlockVideoPlayback]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    const pointerMain = movementAxisRef.current === 'vertical' ? event.clientY : event.clientX;
    const totalDelta = pointerMain - dragState.startMain;
    if (!dragState.hasDragged && Math.abs(totalDelta) < DRAG_START_THRESHOLD_PX) return;

    const deltaMain = pointerMain - dragState.lastMain;
    dragState.hasDragged = true;
    dragState.lastMain = pointerMain;
    setIsDragging(true);
    if (tiktokModeRef.current) {
      hideTikTokActionControls();
      scrubTikTokSlots(deltaMain);
      event.preventDefault();
      return;
    }
    pauseAndScrubTape(deltaMain);
    event.preventDefault();
  }, [hideTikTokActionControls, pauseAndScrubTape, scrubTikTokSlots]);

  const finishPointerDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    if (dragState.hasDragged) {
      suppressClickRef.current = true;
      if (tiktokModeRef.current) {
        const currentSlot = getCurrentTikTokSlot();
        if (currentSlot) {
          const slots = activeSlotsRef.current;
          const hasPrevious = slots.some((slot) => slot.feedIndex === currentSlot.feedIndex - 1);
          const hasNext = slots.some((slot) => slot.feedIndex === currentSlot.feedIndex + 1);
          const targetDirection = currentSlot.y < 0 ? 1 : -1;
          const canMove = targetDirection > 0 ? hasNext : hasPrevious;
          if (canMove && Math.abs(currentSlot.y) >= TIKTOK_SWIPE_THRESHOLD_PX) {
            animateTikTokSnap(
              currentSlot.feedIndex,
              targetDirection > 0 ? -stageSizeRef.current.height : stageSizeRef.current.height,
              currentSlot.feedIndex + targetDirection,
            );
          } else {
            animateTikTokSnap(currentSlot.feedIndex, 0, null);
          }
        }
      }
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    dragStateRef.current = { pointerId: null, startMain: 0, lastMain: 0, hasDragged: false };
    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, [animateTikTokSnap, getCurrentTikTokSlot]);

  useEffect(() => {
    const frame = (timestamp: number) => {
      const lastTimestamp = lastFrameTimestampRef.current ?? timestamp;
      const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - lastTimestamp) / 1000));
      lastFrameTimestampRef.current = timestamp;
      const keyboardScrubDirection = keyboardScrubDirectionRef.current;
      const isKeyboardScrubbing = keyboardScrubDirection !== 0;

      if (feedRef.current.length > 0) {
        if (tiktokModeRef.current) {
          rafRef.current = window.requestAnimationFrame(frame);
          return;
        }
        if (!pausedRef.current || isKeyboardScrubbing) {
          fillAdjacentSlots(keyboardScrubDirection < 0 ? -1 : 1);
        }
        const horizontalDistance = isKeyboardScrubbing
          ? keyboardScrubDirection * deltaSeconds * BASE_SPEED_PX_PER_SECOND * speedRef.current * scrubSpeedMultiplierRef.current
          : pausedRef.current ? 0 : deltaSeconds * BASE_SPEED_PX_PER_SECOND * speedRef.current;
        const distance = movementAxisRef.current === 'vertical' && !isKeyboardScrubbing ? -horizontalDistance : horizontalDistance;
        let didCycleImages = false;
        activeSlotsRef.current = activeSlotsRef.current
          .map((slot) => {
            if (slot.kind !== 'images' || slot.entry.kind !== 'images' || slot.entry.images.length <= 1) {
              return {
                ...slot,
                x: movementAxisRef.current === 'vertical' ? slot.x : slot.x + distance,
                y: movementAxisRef.current === 'vertical' ? slot.y + distance : slot.y,
              };
            }
            const imageCycleMs = (slot.imageCycleMs || 0) + deltaSeconds * 1000;
            didCycleImages = true;
            return {
              ...slot,
              x: movementAxisRef.current === 'vertical' ? slot.x : slot.x + distance,
              y: movementAxisRef.current === 'vertical' ? slot.y + distance : slot.y,
              imageCycleMs,
              activeImageIndex: Math.floor(imageCycleMs / 1000) % slot.entry.images.length,
            };
          });
        if (distance !== 0) {
          fillAdjacentSlots(movementAxisRef.current === 'vertical' ? (distance < 0 ? 1 : -1) : (distance < 0 ? -1 : 1));
          trimDistantSlots(isKeyboardScrubbing);
        }

        if (!pausedRef.current || isKeyboardScrubbing || didCycleImages) {
          setActiveSlots(activeSlotsRef.current);
        }

        if (!pausedRef.current && !isKeyboardScrubbing && nextIndexRef.current >= feedRef.current.length && activeSlotsRef.current.length === 0) {
          setFeedEnded(true);
        }
      }

      rafRef.current = window.requestAnimationFrame(frame);
    };

    rafRef.current = window.requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [fillAdjacentSlots, trimDistantSlots]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enableKeyboardControls) return;
      if (event.code !== 'Space' && event.key !== ' ' && event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (shouldIgnoreKeyboardShortcutTarget(event.target)) return;

      if (isLoading || totalMediaCount === 0) return;

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        keyboardScrubDirectionRef.current = event.key === 'ArrowRight' ? 1 : -1;
        return;
      }

      event.preventDefault();
      unlockVideoPlayback();
      setPaused((current) => {
        const next = !current;
        pausedRef.current = next;
        return next;
      });
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && keyboardScrubDirectionRef.current === -1) {
        keyboardScrubDirectionRef.current = 0;
      }
      if (event.key === 'ArrowRight' && keyboardScrubDirectionRef.current === 1) {
        keyboardScrubDirectionRef.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enableKeyboardControls, isLoading, totalMediaCount, unlockVideoPlayback]);

  useEffect(() => {
    if (activeSlotsRef.current.length === 0) return;
    const stage = stageSizeRef.current;
    activeSlotsRef.current = activeSlotsRef.current.map((slot) => {
      const size = tiktokModeRef.current
        ? buildTikTokSlotSize(stage)
        : buildSlotSize(slot.entry, stage, measuredRatios, movementAxisRef.current);
      return { ...slot, width: size.width, height: size.height, x: movementAxisRef.current === 'vertical' ? size.x : slot.x, y: movementAxisRef.current === 'vertical' ? slot.y : size.y };
    });
    setActiveSlots(activeSlotsRef.current);
  }, [measuredRatios]);

  useEffect(() => {
    const activeInstanceIds = new Set(activeSlots.map((slot) => slot.instanceId));
    const inactiveInstanceIds: string[] = [];
    Object.entries(videoRefs.current).forEach(([instanceId, video]) => {
      if (!activeInstanceIds.has(instanceId)) {
        video.pause();
        video.removeAttribute('src');
        try {
          video.load();
        } catch {
          // Ignore cleanup failures; removing the ref is enough for React to release the node.
        }
        delete videoRefs.current[instanceId];
        inactiveInstanceIds.push(instanceId);
      }
    });
    clearVideoInstanceState([
      ...inactiveInstanceIds,
      ...Array.from(playRequestedVideoInstanceIdsRef.current).filter((instanceId) => !activeInstanceIds.has(instanceId)),
      ...Array.from(playInteractionRetryVideoInstanceIdsRef.current).filter((instanceId) => !activeInstanceIds.has(instanceId)),
      ...Array.from(preloadRequestedVideoInstanceIdsRef.current).filter((instanceId) => !activeInstanceIds.has(instanceId)),
      ...Array.from(videoReadyInstanceIds).filter((instanceId) => !activeInstanceIds.has(instanceId)),
      ...Object.keys(videoLoadProgress).filter((instanceId) => !activeInstanceIds.has(instanceId)),
    ]);
    if (userPlaybackInteractionRef.current) {
      retryMountedVideoPlayback();
    }
  }, [activeSlots, clearVideoInstanceState, retryMountedVideoPlayback, videoLoadProgress, videoReadyInstanceIds]);

  const handleMetadata = useCallback((asset: GalleryCarouselAsset, video: HTMLVideoElement) => {
    if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
    const ratio = video.videoWidth / video.videoHeight;
    setMeasuredRatios((current) => {
      if (Math.abs((current[asset.id] || 0) - ratio) < 0.001) return current;
      return { ...current, [asset.id]: ratio };
    });
  }, []);

  const statusLabel = useMemo(() => {
    if (isLoading) return 'Loading carousel feed';
    if (error) return 'Unable to load feed';
    if (totalMediaCount === 0) return onlyFavorites ? 'No selected favorite gallery media' : 'No selected gallery media';
    if (feedEnded) return 'End of feed';
    if (paused) return 'Movement paused';
    if (isLoadingWindow) return 'Loading nearby carousel media';
    if (imagesEnabled) return `${visibleCount} slots · ${remainingCount} queued · ${visibleImageSlotCount} image slots`;
    return `${visibleCount} playing · ${remainingCount} queued`;
  }, [error, feedEnded, imagesEnabled, isLoading, isLoadingWindow, onlyFavorites, paused, remainingCount, totalMediaCount, visibleCount, visibleImageSlotCount]);
  const activeTikTokActionSlot = useMemo(() => {
    if (!tiktokModeRef.current || !areTikTokActionControlsVisible || activeSlots.length === 0) return null;
    const centeredSlot = activeSlots.reduce((closestSlot, slot) => {
      return Math.abs(slot.y) < Math.abs(closestSlot.y) ? slot : closestSlot;
    }, activeSlots[0]);
    if (centeredSlot.entry.kind !== 'video') return null;
    if (activeTikTokActionAssetId && centeredSlot.entry.asset.id !== activeTikTokActionAssetId) return null;
    return centeredSlot;
  }, [activeSlots, activeTikTokActionAssetId, areTikTokActionControlsVisible]);
  const activeTikTokActionAsset = activeTikTokActionSlot?.entry.kind === 'video' ? activeTikTokActionSlot.entry.asset : null;
  const canReuseTikTokToImage = activeTikTokActionAsset?.modelId === 'wan22' || activeTikTokActionAsset?.modelId === 'wan22-t2v';
  const canReuseTikTokToI2V = activeTikTokActionAsset?.modelId === 'wan22';
  const canReuseTikTokToT2V = activeTikTokActionAsset?.modelId === 'wan22-t2v';

  const handleVideosToggle = useCallback((nextEnabled: boolean) => {
    if (!nextEnabled && !imagesEnabledRef.current) return;
    setVideosEnabled(nextEnabled);
    videosEnabledRef.current = nextEnabled;
    persistSettings({ videosEnabled: nextEnabled });
    void loadAssets(nextEnabled, imagesEnabledRef.current, ratioFilterRef.current, onlyFavoritesRef.current, galleryViewEnabledRef.current);
  }, [loadAssets, persistSettings]);

  const handleImagesToggle = useCallback((nextEnabled: boolean) => {
    if (!nextEnabled && !videosEnabledRef.current) return;
    setImagesEnabled(nextEnabled);
    imagesEnabledRef.current = nextEnabled;
    persistSettings({ imagesEnabled: nextEnabled });
    void loadAssets(videosEnabledRef.current, nextEnabled, ratioFilterRef.current, onlyFavoritesRef.current, galleryViewEnabledRef.current);
  }, [loadAssets, persistSettings]);

  const handleGalleryViewToggle = useCallback((nextEnabled: boolean) => {
    setGalleryViewEnabled(nextEnabled);
    galleryViewEnabledRef.current = nextEnabled;
    persistSettings({ galleryViewEnabled: nextEnabled });
    void loadAssets(videosEnabledRef.current, imagesEnabledRef.current, ratioFilterRef.current, onlyFavoritesRef.current, nextEnabled);
  }, [loadAssets, persistSettings]);

  const handleOnlyFavoritesToggle = useCallback((nextEnabled: boolean) => {
    setOnlyFavorites(nextEnabled);
    onlyFavoritesRef.current = nextEnabled;
    persistSettings({ onlyFavorites: nextEnabled });
    void loadAssets(videosEnabledRef.current, imagesEnabledRef.current, ratioFilterRef.current, nextEnabled, galleryViewEnabledRef.current);
  }, [loadAssets, persistSettings]);

  const handleRatioToggle = useCallback((orientation: 'landscape' | 'portrait', nextEnabled: boolean) => {
    const nextRatioFilter = {
      ...ratioFilterRef.current,
      [orientation === 'landscape' ? 'includeLandscape' : 'includePortrait']: nextEnabled,
    };
    ratioFilterRef.current = nextRatioFilter;
    setIncludeLandscape(nextRatioFilter.includeLandscape);
    setIncludePortrait(nextRatioFilter.includePortrait);
    persistSettings(nextRatioFilter);
    void loadAssets(videosEnabledRef.current, imagesEnabledRef.current, nextRatioFilter, onlyFavoritesRef.current, galleryViewEnabledRef.current);
  }, [loadAssets, persistSettings]);

  const handleSpeedChange = useCallback((value: number[]) => {
    const nextSpeed = value[0] || 1;
    speedRef.current = nextSpeed;
    setSpeed(nextSpeed);
    persistSettings({ speed: nextSpeed });
  }, [persistSettings]);

  const handleScrubSpeedMultiplierChange = useCallback((value: number[]) => {
    const nextScrubSpeedMultiplier = value[0] || DEFAULT_KEYBOARD_SCRUB_SPEED_MULTIPLIER;
    scrubSpeedMultiplierRef.current = nextScrubSpeedMultiplier;
    setScrubSpeedMultiplier(nextScrubSpeedMultiplier);
    persistSettings({ scrubSpeedMultiplier: nextScrubSpeedMultiplier });
  }, [persistSettings]);

  return (
    <div
      className="relative h-full min-h-[100dvh] overflow-hidden bg-black"
    >
      {showControls ? (
        <div
          className="absolute left-0 right-0 top-0 z-20 min-h-20 pb-3"
          data-testid="gallery-carousel-controls-hover-area"
          onPointerEnter={revealControls}
          onPointerLeave={hideControls}
        >
        <div
          className={`flex min-h-12 items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-4 py-2 backdrop-blur-md transition-opacity duration-150 ${isUiHidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
          data-testid="gallery-carousel-controls"
        >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-white">Video Carousel</div>
            {paused ? (
              <div
                className="inline-flex h-6 items-center gap-1.5 rounded-md border border-amber-300/25 bg-amber-400/10 px-2 text-xs font-medium text-amber-100"
                data-testid="gallery-carousel-pause-indicator"
              >
                <Pause className="h-3.5 w-3.5" />
                Paused
              </div>
            ) : null}
          </div>
          <div className="truncate text-xs text-white/45">{statusLabel}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label
            className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs transition-colors ${videosEnabled ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-white/60'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={videosEnabled}
              disabled={isLoading || (videosEnabled && !imagesEnabled)}
              onChange={(event) => handleVideosToggle(event.currentTarget.checked)}
              className="h-3.5 w-3.5 accent-cyan-400"
              aria-label="Include videos"
            />
            <Film className="h-4 w-4" />
            Videos
          </label>
          <label
            className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs transition-colors ${imagesEnabled ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/[0.03] text-white/60'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={imagesEnabled}
              disabled={isLoading || (imagesEnabled && !videosEnabled)}
              onChange={(event) => handleImagesToggle(event.currentTarget.checked)}
              className="h-3.5 w-3.5 accent-emerald-400"
              aria-label="Include image slots"
            />
            <ImageIcon className="h-4 w-4" />
            Images
          </label>
          <label
            className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs transition-colors ${galleryViewEnabled ? 'border-violet-400/35 bg-violet-500/10 text-violet-100' : 'border-white/10 bg-white/[0.03] text-white/60'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={galleryViewEnabled}
              disabled={isLoading}
              onChange={(event) => handleGalleryViewToggle(event.currentTarget.checked)}
              className="h-3.5 w-3.5 accent-violet-400"
              aria-label="Gallery View"
            />
            Gallery View
          </label>
          <label
            className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs transition-colors ${includeLandscape ? 'border-sky-400/35 bg-sky-500/10 text-sky-100' : 'border-white/10 bg-white/[0.03] text-white/60'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={includeLandscape}
              disabled={isLoading}
              onChange={(event) => handleRatioToggle('landscape', event.currentTarget.checked)}
              className="h-3.5 w-3.5 accent-sky-400"
              aria-label="Include landscape assets"
            />
            Landscape
          </label>
          <label
            className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs transition-colors ${includePortrait ? 'border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-100' : 'border-white/10 bg-white/[0.03] text-white/60'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={includePortrait}
              disabled={isLoading}
              onChange={(event) => handleRatioToggle('portrait', event.currentTarget.checked)}
              className="h-3.5 w-3.5 accent-fuchsia-400"
              aria-label="Include portrait assets"
            />
            Portrait
          </label>
          <label
            className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs transition-colors ${onlyFavorites ? 'border-rose-400/35 bg-rose-500/10 text-rose-100' : 'border-white/10 bg-white/[0.03] text-white/60'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={onlyFavorites}
              disabled={isLoading}
              onChange={(event) => handleOnlyFavoritesToggle(event.currentTarget.checked)}
              className="h-3.5 w-3.5 accent-rose-400"
              aria-label="Only favorites"
            />
            <Heart className={`h-4 w-4 ${onlyFavorites ? 'fill-current' : ''}`} />
            Only favorites
          </label>
          <div className="flex w-[220px] items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="text-xs text-white/55">Speed</span>
            <Slider
              min={0.4}
              max={2.4}
              step={0.1}
              value={[speed]}
              onValueChange={handleSpeedChange}
              onClick={(event) => event.stopPropagation()}
            />
            <span className="w-8 text-right text-xs tabular-nums text-white/55">{speed.toFixed(1)}x</span>
          </div>
          <div className="flex w-[190px] items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="text-xs text-white/55">Scrub</span>
            <Slider
              min={MIN_KEYBOARD_SCRUB_SPEED_MULTIPLIER}
              max={MAX_KEYBOARD_SCRUB_SPEED_MULTIPLIER}
              step={1}
              value={[scrubSpeedMultiplier]}
              onValueChange={handleScrubSpeedMultiplierChange}
              onClick={(event) => event.stopPropagation()}
            />
            <span className="w-9 text-right text-xs tabular-nums text-white/55">{scrubSpeedMultiplier.toFixed(0)}x</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-md border border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              if (galleryViewEnabledRef.current) {
                void loadAssets(videosEnabledRef.current, imagesEnabledRef.current, ratioFilterRef.current, onlyFavoritesRef.current, true);
                return;
              }
              void loadAssets(videosEnabledRef.current, imagesEnabledRef.current, ratioFilterRef.current, onlyFavoritesRef.current, false);
            }}
            disabled={isLoading || feedRef.current.length === 0}
          >
            {galleryViewEnabled ? <RefreshCw className="mr-2 h-4 w-4" /> : <Shuffle className="mr-2 h-4 w-4" />}
            {galleryViewEnabled ? 'Restart' : 'Shuffle'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md border border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              void loadAssets(videosEnabledRef.current, imagesEnabledRef.current, ratioFilterRef.current, onlyFavoritesRef.current, galleryViewEnabledRef.current);
            }}
            disabled={isLoading}
            aria-label="Refresh video feed"
            title="Refresh video feed"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {onClose ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md border border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
              aria-label="Close video carousel"
              title="Close video carousel"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        </div>
        </div>
      ) : null}

      <div
        ref={stageRef}
        data-testid="gallery-video-carousel"
        tabIndex={-1}
        className={`relative h-full min-h-[100dvh] w-full touch-none select-none overflow-hidden bg-neutral-950 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={finishPointerDrag}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          if (isLoading || totalMediaCount === 0) return;
          unlockVideoPlayback();
          if (tiktokModeRef.current) {
            toggleTikTokActionControls();
            return;
          }
          setPaused((value) => {
            const next = !value;
            pausedRef.current = next;
            return next;
          });
        }}
      >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.6),transparent_12%,transparent_88%,rgba(0,0,0,0.6))]" />

          {activeSlots.map((slot) => {
            const currentTikTokFeedIndex = tiktokModeRef.current
              ? activeSlots.reduce((closestSlot, candidate) => {
                  return Math.abs(candidate.y) < Math.abs(closestSlot.y) ? candidate : closestSlot;
                }, activeSlots[0]).feedIndex
              : null;
            const isTikTokSlot = tiktokModeRef.current;
            const isTikTokCurrentSlot = !isTikTokSlot || Math.abs(slot.y) < 1;
            const tiktokDistanceFromCurrent = currentTikTokFeedIndex === null ? 0 : Math.abs(slot.feedIndex - currentTikTokFeedIndex);
            const shouldRenderVideo = !isTikTokSlot || tiktokDistanceFromCurrent <= 1;
            const isVideoReady = videoReadyInstanceIds.has(slot.instanceId);
            const posterUrl = slot.entry.kind === 'video'
              ? (isTikTokSlot ? readTikTokVideoPosterUrl(slot.entry.asset) : slot.entry.asset.thumbnailUrl || null)
              : null;
            const shouldShowPosterLayer = isTikTokSlot && Boolean(posterUrl) && (!shouldRenderVideo || !isVideoReady);
            const shouldShowLoadingSpinner = isTikTokSlot && shouldRenderVideo && !isVideoReady;
            const loadProgress = Math.max(0.08, Math.min(0.98, videoLoadProgress[slot.instanceId] || 0));
            return (
            <div
              key={slot.instanceId}
              className={`absolute overflow-hidden bg-black ${tiktokModeRef.current ? '' : 'rounded-md border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.45)]'}`}
              style={{
                width: `${slot.width}px`,
                height: `${slot.height}px`,
                transform: `translate3d(${slot.x}px, ${slot.y}px, 0)`,
                transition: isTikTokSlot && isTiktokSnapAnimating ? `transform ${TIKTOK_SNAP_ANIMATION_MS}ms ease-out` : undefined,
              }}
            >
              {slot.entry.kind === 'video' ? (
                <>
                  {shouldRenderVideo ? (
                    <video
                      ref={(node) => {
                        if (node) {
                          videoRefs.current[slot.instanceId] = node;
                          if (isTikTokSlot && node.preload !== 'auto') {
                            node.preload = 'auto';
                          }
                          if (isTikTokSlot && node.readyState === 0 && !preloadRequestedVideoInstanceIdsRef.current.has(slot.instanceId)) {
                            preloadRequestedVideoInstanceIdsRef.current.add(slot.instanceId);
                            try {
                              node.load();
                            } catch {
                              // Browsers may refuse explicit preload in constrained environments; the preload hint still applies.
                            }
                          }
                          if (isTikTokCurrentSlot || !isTikTokSlot) {
                            requestVideoPlayback(slot.instanceId, node);
                          }
                        } else {
                          delete videoRefs.current[slot.instanceId];
                        }
                      }}
                      src={slot.entry.asset.previewUrl || slot.entry.asset.originalUrl}
                      poster={posterUrl || undefined}
                      muted
                      loop
                      autoPlay={isTikTokCurrentSlot || !isTikTokSlot}
                      playsInline
                      preload={isTikTokSlot ? 'auto' : 'metadata'}
                      onLoadedMetadata={(event) => {
                        if (slot.entry.kind !== 'video') return;
                        handleMetadata(slot.entry.asset, event.currentTarget);
                        updateVideoLoadProgress(slot.instanceId, event.currentTarget);
                        if (isTikTokCurrentSlot || !isTikTokSlot) {
                          requestVideoPlayback(slot.instanceId, event.currentTarget);
                        }
                      }}
                      onProgress={(event) => updateVideoLoadProgress(slot.instanceId, event.currentTarget)}
                      onCanPlay={(event) => {
                        updateVideoLoadProgress(slot.instanceId, event.currentTarget);
                        markVideoReady(slot.instanceId);
                        if (isTikTokCurrentSlot || !isTikTokSlot) {
                          requestVideoPlayback(slot.instanceId, event.currentTarget);
                        }
                      }}
                      onLoadedData={(event) => {
                        updateVideoLoadProgress(slot.instanceId, event.currentTarget);
                        markVideoReady(slot.instanceId);
                        if (isTikTokCurrentSlot || !isTikTokSlot) {
                          requestVideoPlayback(slot.instanceId, event.currentTarget);
                        }
                      }}
                      className={`h-full w-full ${isTikTokSlot ? 'object-contain' : 'object-cover'} ${isTikTokSlot && !isVideoReady ? 'opacity-0' : ''}`}
                    />
                  ) : null}
                  {shouldShowPosterLayer && posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={posterUrl}
                      alt=""
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-10 h-full w-full object-contain"
                      draggable={false}
                      data-testid="gallery-tiktok-video-poster"
                    />
                  ) : null}
                  {shouldShowLoadingSpinner ? (
                    <div
                      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/15"
                      data-testid="gallery-tiktok-video-loading"
                    >
                      <div
                        className="relative h-12 w-12 rounded-full shadow-[0_0_28px_rgba(0,0,0,0.45)]"
                        style={{ background: `conic-gradient(rgba(255,255,255,0.92) ${Math.round(loadProgress * 360)}deg, rgba(255,255,255,0.22) 0deg)` }}
                        data-progress={loadProgress.toFixed(2)}
                        data-testid="gallery-tiktok-video-progress"
                      >
                        <div className="absolute inset-1.5 rounded-full bg-black/70 backdrop-blur-sm" />
                        <div className="absolute inset-[1.1rem] rounded-full bg-white/90" />
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (() => {
                const image = slot.entry.images[Math.min(slot.activeImageIndex || 0, slot.entry.images.length - 1)];
                if (!image) return null;
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.previewUrl || image.originalUrl}
                    alt={image.prompt || image.id}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                );
              })()}
            </div>
            );
          })}

          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/70 px-4 py-3 text-sm text-white/65">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading carousel feed...
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-md rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">{error}</div>
            </div>
          ) : totalMediaCount === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="rounded-md border border-dashed border-white/15 px-5 py-4 text-sm text-white/55">
                {onlyFavorites ? 'No selected favorite gallery media in this workspace.' : 'No selected gallery media in this workspace.'}
              </div>
            </div>
          ) : feedEnded ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 rounded-md border border-white/10 bg-black/70 px-5 py-4 text-sm text-white/70">
                <span>End of feed</span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 rounded-md"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (galleryViewEnabledRef.current) {
                      void loadAssets(videosEnabledRef.current, imagesEnabledRef.current, ratioFilterRef.current, onlyFavoritesRef.current, true);
                      return;
                    }
                    void loadAssets(videosEnabledRef.current, imagesEnabledRef.current, ratioFilterRef.current, onlyFavoritesRef.current, false);
                  }}
                >
                  {galleryViewEnabled ? <RefreshCw className="mr-2 h-4 w-4" /> : <Shuffle className="mr-2 h-4 w-4" />}
                  {galleryViewEnabled ? 'Restart' : 'Shuffle again'}
                </Button>
              </div>
            </div>
          ) : showControls && !paused ? (
            <div className="pointer-events-none absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/45 px-3 py-2 text-xs text-white/55">
              <Play className="h-3.5 w-3.5" />
              {videosEnabled && imagesEnabled
                ? `${totalVideoCount} videos · ${totalImageCount} images`
                : videosEnabled
                  ? `${totalVideoCount} videos`
                  : `${totalImageCount} images`}
            </div>
          ) : null}
          {activeTikTokActionAsset ? (
            <div
              className="absolute right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-3"
              data-testid="gallery-tiktok-action-controls"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className={`flex h-12 w-12 items-center justify-center rounded-full border text-white shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md transition-colors ${activeTikTokActionAsset.favorited ? 'border-pink-300/55 bg-pink-500/35' : 'border-white/15 bg-black/55 hover:bg-black/75'}`}
                aria-label={activeTikTokActionAsset.favorited ? 'Remove from favorites' : 'Add to favorites'}
                title={activeTikTokActionAsset.favorited ? 'Remove from favorites' : 'Add to favorites'}
                onClick={() => void handleTikTokFavoriteToggle(activeTikTokActionAsset)}
              >
                <Heart className={`h-5 w-5 ${activeTikTokActionAsset.favorited ? 'fill-current' : ''}`} />
              </button>
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md transition-colors hover:bg-black/75"
                aria-label="Share"
                title="Share"
                onClick={() => void handleTikTokShare(activeTikTokActionAsset)}
              >
                <Share2 className="h-5 w-5" />
              </button>
              {canReuseTikTokToImage ? (
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md transition-colors hover:bg-black/75"
                  aria-label="To txt2img"
                  title="To txt2img"
                  onClick={() => void handleTikTokReuse(activeTikTokActionAsset, 'txt2img')}
                >
                  <Type className="h-5 w-5" />
                </button>
              ) : null}
              {canReuseTikTokToI2V ? (
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md transition-colors hover:bg-black/75"
                  aria-label="To img2vid"
                  title="To img2vid"
                  onClick={() => void handleTikTokReuse(activeTikTokActionAsset, 'img2vid')}
                >
                  <Clapperboard className="h-5 w-5" />
                </button>
              ) : null}
              {canReuseTikTokToT2V ? (
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md transition-colors hover:bg-black/75"
                  aria-label="To T2V"
                  title="To T2V"
                  onClick={() => void handleTikTokReuse(activeTikTokActionAsset, 'txt2vid')}
                >
                  <Film className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          ) : null}
      </div>
    </div>
  );
}
