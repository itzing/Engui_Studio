'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EyeOff, Film, Image as ImageIcon, Loader2, Pause, Play, RefreshCw, Shuffle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  buildGalleryCarouselFeed,
  matchesGalleryCarouselRatioFilter,
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
  prompt?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  aspectRatio?: string | null;
  addedToGalleryAt: string;
};

type GalleryCarouselResponse = {
  success: boolean;
  assets?: GalleryCarouselAsset[];
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    hasNextPage: boolean;
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
  startX: number;
  lastX: number;
  hasDragged: boolean;
};

const PAGE_LIMIT = 100;
const DEFAULT_VIDEO_RATIO = 9 / 16;
const DEFAULT_IMAGE_RATIO = 1;
const BASE_SPEED_PX_PER_SECOND = 90;
const DRAG_START_THRESHOLD_PX = 4;
const DEFAULT_KEYBOARD_SCRUB_SPEED_MULTIPLIER = 4;
const MIN_KEYBOARD_SCRUB_SPEED_MULTIPLIER = 2;
const MAX_KEYBOARD_SCRUB_SPEED_MULTIPLIER = 10;
const EDGE_OVERLAP_PX = 2;
const SLOT_TRIM_BUFFER_STAGE_RATIO = 1.5;

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

function buildSlotSize(entry: GalleryCarouselFeedItem<GalleryCarouselAsset, GalleryCarouselAsset>, stage: { width: number; height: number }, measuredRatios: Record<string, number>) {
  const ratio = readFeedEntryRatio(entry, measuredRatios);
  return getFullHeightGalleryCarouselSlotSize(ratio, stage.height);
}

async function fetchAllGalleryAssets(workspaceId: string, type: 'image' | 'video') {
  const assets: GalleryCarouselAsset[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const search = new URLSearchParams({
      workspaceId,
      page: String(page),
      limit: String(PAGE_LIMIT),
      sort: 'newest',
      bucket: 'all',
      type,
    });
    const response = await fetch(`/api/gallery/assets?${search.toString()}`, { cache: 'no-store' });
    const data = await response.json() as GalleryCarouselResponse;
    if (!response.ok || !data.success || !Array.isArray(data.assets) || !data.pagination) {
      throw new Error(data.error || `Failed to load gallery ${type}s`);
    }

    assets.push(...data.assets.filter((asset) => asset.type === type));
    hasNextPage = Boolean(data.pagination.hasNextPage);
    page += 1;
  }

  return assets;
}

function shouldIgnoreKeyboardShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  if (['button', 'input', 'select', 'textarea'].includes(tagName)) return true;
  return Boolean(target.closest('[role="slider"], [contenteditable="true"]'));
}

type GalleryVideoCarouselProps = {
  workspaceId: string | null;
  onClose?: () => void;
  initialVideosEnabled?: boolean;
  initialImagesEnabled?: boolean;
  initialIncludeLandscape?: boolean;
  initialIncludePortrait?: boolean;
  initialSpeed?: number;
  initialScrubSpeedMultiplier?: number;
  showControls?: boolean;
  enableKeyboardControls?: boolean;
};

export function GalleryVideoCarousel({
  workspaceId,
  onClose,
  initialVideosEnabled = true,
  initialImagesEnabled = false,
  initialIncludeLandscape = true,
  initialIncludePortrait = true,
  initialSpeed = 1,
  initialScrubSpeedMultiplier = DEFAULT_KEYBOARD_SCRUB_SPEED_MULTIPLIER,
  showControls = true,
  enableKeyboardControls = true,
}: GalleryVideoCarouselProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({});
  const stageSizeRef = useRef({ width: 1280, height: 720 });
  const activeSlotsRef = useRef<CarouselSlot[]>([]);
  const feedRef = useRef<Array<GalleryCarouselFeedItem<GalleryCarouselAsset, GalleryCarouselAsset>>>([]);
  const sourceVideosRef = useRef<GalleryCarouselAsset[]>([]);
  const sourceImagesRef = useRef<GalleryCarouselAsset[]>([]);
  const nextIndexRef = useRef(0);
  const lastFrameTimestampRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const slotCounterRef = useRef(0);
  const pausedRef = useRef(false);
  const speedRef = useRef(initialSpeed);
  const scrubSpeedMultiplierRef = useRef(initialScrubSpeedMultiplier);
  const videosEnabledRef = useRef(true);
  const imagesEnabledRef = useRef(false);
  const ratioFilterRef = useRef<GalleryCarouselRatioFilter>({
    includeLandscape: initialIncludeLandscape,
    includePortrait: initialIncludePortrait,
  });
  const measuredRatiosRef = useRef<Record<string, number>>({});
  const dragStateRef = useRef<DragState>({ pointerId: null, startX: 0, lastX: 0, hasDragged: false });
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
  const [includeLandscape, setIncludeLandscape] = useState(initialIncludeLandscape);
  const [includePortrait, setIncludePortrait] = useState(initialIncludePortrait);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedEnded, setFeedEnded] = useState(false);
  const [measuredRatios, setMeasuredRatios] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isUiHidden, setIsUiHidden] = useState(false);

  const remainingCount = Math.max(0, feedRef.current.length - nextIndex);
  const visibleCount = activeSlots.length;
  const totalVideoCount = sourceVideos.length;
  const totalImageCount = sourceImages.length;
  const totalMediaCount = totalVideoCount + totalImageCount;
  const visibleImageSlotCount = activeSlots.filter((slot) => slot.kind === 'images').length;

  const resetPlayback = useCallback((videos: GalleryCarouselAsset[], images: GalleryCarouselAsset[], includeVideos: boolean, includeImages: boolean) => {
    const feed = buildGalleryCarouselFeed(videos, { images, includeVideos, includeImages });
    feedRef.current = feed;
    activeSlotsRef.current = [];
    nextIndexRef.current = 0;
    slotCounterRef.current += 1;
    setActiveSlots([]);
    setNextIndex(0);
    setFeedEnded(feed.length === 0);
    pausedRef.current = false;
    setPaused(false);
  }, []);

  const loadAssets = useCallback(async (includeVideos: boolean, includeImages: boolean, ratioFilter: GalleryCarouselRatioFilter) => {
    if (!workspaceId) {
      setSourceVideos([]);
      setSourceImages([]);
      sourceVideosRef.current = [];
      sourceImagesRef.current = [];
      resetPlayback([], [], includeVideos, includeImages);
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
    try {
      const [videos, images] = await Promise.all([
        includeVideos ? fetchAllGalleryAssets(workspaceId, 'video') : Promise.resolve([]),
        includeImages ? fetchAllGalleryAssets(workspaceId, 'image') : Promise.resolve([]),
      ]);
      const filteredVideos = videos.filter((asset) => matchesGalleryCarouselRatioFilter(asset, ratioFilter, DEFAULT_VIDEO_RATIO));
      const filteredImages = images.filter((asset) => matchesGalleryCarouselRatioFilter(asset, ratioFilter, DEFAULT_IMAGE_RATIO));
      sourceVideosRef.current = filteredVideos;
      sourceImagesRef.current = filteredImages;
      setSourceVideos(filteredVideos);
      setSourceImages(filteredImages);
      resetPlayback(filteredVideos, filteredImages, includeVideos, includeImages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load gallery feed');
      sourceVideosRef.current = [];
      sourceImagesRef.current = [];
      setSourceVideos([]);
      setSourceImages([]);
      resetPlayback([], [], includeVideos, includeImages);
    } finally {
      setIsLoading(false);
    }
  }, [resetPlayback, workspaceId]);

  useEffect(() => {
    const nextRatioFilter = {
      includeLandscape: initialIncludeLandscape,
      includePortrait: initialIncludePortrait,
    };
    videosEnabledRef.current = initialVideosEnabled;
    setVideosEnabled(initialVideosEnabled);
    imagesEnabledRef.current = initialImagesEnabled;
    setImagesEnabled(initialImagesEnabled);
    ratioFilterRef.current = nextRatioFilter;
    setIncludeLandscape(initialIncludeLandscape);
    setIncludePortrait(initialIncludePortrait);
    speedRef.current = initialSpeed;
    setSpeed(initialSpeed);
    scrubSpeedMultiplierRef.current = initialScrubSpeedMultiplier;
    setScrubSpeedMultiplier(initialScrubSpeedMultiplier);
    void loadAssets(initialVideosEnabled, initialImagesEnabled, nextRatioFilter);
  }, [initialImagesEnabled, initialIncludeLandscape, initialIncludePortrait, initialScrubSpeedMultiplier, initialSpeed, initialVideosEnabled, loadAssets]);

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
    measuredRatiosRef.current = measuredRatios;
  }, [measuredRatios]);

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

  const spawnNext = useCallback(() => {
    const stage = stageSizeRef.current;
    const feed = feedRef.current;
    const activeSlots = activeSlotsRef.current;
    const nextFeedIndex = activeSlots.length > 0 ? activeSlots[activeSlots.length - 1].feedIndex + 1 : nextIndexRef.current;
    if (stage.width <= 0 || stage.height <= 0 || nextFeedIndex >= feed.length) return;

    const entry = feed[nextFeedIndex];
    const size = buildSlotSize(entry, stage, measuredRatiosRef.current);
    const trailingSlot = activeSlots[activeSlots.length - 1] || null;
    nextIndexRef.current = Math.max(nextIndexRef.current, nextFeedIndex + 1);
    const slot: CarouselSlot = {
      kind: entry.kind,
      feedIndex: nextFeedIndex,
      instanceId: `${entry.id}-${slotCounterRef.current}-${nextFeedIndex}`,
      entry,
      x: getAdjacentGalleryCarouselSlotX(trailingSlot?.x ?? null, size.width),
      y: size.y,
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

    const size = buildSlotSize(entry, stage, measuredRatiosRef.current);
    const slot: CarouselSlot = {
      kind: entry.kind,
      feedIndex: previousFeedIndex,
      instanceId: `${entry.id}-${slotCounterRef.current}-${previousFeedIndex}`,
      entry,
      x: oldestSlot.x + oldestSlot.width - EDGE_OVERLAP_PX,
      y: size.y,
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
    if (nextFeedIndex >= feedRef.current.length) return;
    if (activeSlots.length === 0) {
      spawnNext();
      return;
    }

    const newestSlot = activeSlots[activeSlots.length - 1];
    if (shouldSpawnAdjacentGalleryCarouselSlot(newestSlot.x)) {
      spawnNext();
    }
  }, [spawnNext]);

  const maybeSpawnPrevious = useCallback(() => {
    const activeSlots = activeSlotsRef.current;
    if (activeSlots.length === 0) {
      spawnNext();
      return;
    }

    const oldestSlot = activeSlots[0];
    if (oldestSlot.feedIndex <= 0) return;

    const stage = stageSizeRef.current;
    if (oldestSlot.x + oldestSlot.width <= stage.width + EDGE_OVERLAP_PX) {
      spawnPrevious();
    }
  }, [spawnNext, spawnPrevious]);

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
    const buffer = Math.max(stage.width * SLOT_TRIM_BUFFER_STAGE_RATIO, stage.height);
    const previousSlots = activeSlotsRef.current;
    const nextSlots = previousSlots.filter((slot) => (
      slot.x < stage.width + slot.width + buffer
      && slot.x + slot.width > -buffer
    ));
    if (nextSlots.length > 0 || previousSlots.length === 0 || !preserveAnchor) {
      activeSlotsRef.current = nextSlots;
      return;
    }

    const viewportCenter = stage.width / 2;
    activeSlotsRef.current = [
      previousSlots.reduce((closestSlot, slot) => {
        const closestDistance = Math.abs(closestSlot.x + closestSlot.width / 2 - viewportCenter);
        const slotDistance = Math.abs(slot.x + slot.width / 2 - viewportCenter);
        return slotDistance < closestDistance ? slot : closestSlot;
      }, previousSlots[0]),
    ];
  }, []);

  const setMovementPaused = useCallback((nextPaused: boolean) => {
    pausedRef.current = nextPaused;
    setPaused(nextPaused);
  }, []);

  const revealControls = useCallback(() => {
    if (!showControls) return;
    setIsUiHidden((current) => current ? false : current);
  }, [showControls]);

  const manualScrubTape = useCallback((deltaX: number) => {
    if (!Number.isFinite(deltaX) || deltaX === 0 || isLoading || totalMediaCount === 0) return;
    if (activeSlotsRef.current.length === 0) {
      spawnNext();
    }
    if (activeSlotsRef.current.length === 0) return;

    activeSlotsRef.current = activeSlotsRef.current.map((slot) => ({
      ...slot,
      x: slot.x + deltaX,
    }));

    fillAdjacentSlots(deltaX > 0 ? 1 : -1);
    trimDistantSlots(true);

    setFeedEnded(false);
    setActiveSlots(activeSlotsRef.current);
  }, [fillAdjacentSlots, isLoading, spawnNext, totalMediaCount, trimDistantSlots]);

  const pauseAndScrubTape = useCallback((deltaX: number) => {
    setMovementPaused(true);
    manualScrubTape(deltaX);
  }, [manualScrubTape, setMovementPaused]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (isLoading || totalMediaCount === 0 || (event.pointerType === 'mouse' && event.button !== 0)) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      hasDragged: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [isLoading, totalMediaCount]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    const totalDelta = event.clientX - dragState.startX;
    if (!dragState.hasDragged && Math.abs(totalDelta) < DRAG_START_THRESHOLD_PX) return;

    const deltaX = event.clientX - dragState.lastX;
    dragState.hasDragged = true;
    dragState.lastX = event.clientX;
    setIsDragging(true);
    pauseAndScrubTape(deltaX);
    event.preventDefault();
  }, [pauseAndScrubTape]);

  const finishPointerDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    if (dragState.hasDragged) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    dragStateRef.current = { pointerId: null, startX: 0, lastX: 0, hasDragged: false };
    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  useEffect(() => {
    const frame = (timestamp: number) => {
      const lastTimestamp = lastFrameTimestampRef.current ?? timestamp;
      const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - lastTimestamp) / 1000));
      lastFrameTimestampRef.current = timestamp;
      const keyboardScrubDirection = keyboardScrubDirectionRef.current;
      const isKeyboardScrubbing = keyboardScrubDirection !== 0;

      if (feedRef.current.length > 0) {
        if (!pausedRef.current || isKeyboardScrubbing) {
          fillAdjacentSlots(keyboardScrubDirection < 0 ? -1 : 1);
        }
        const distance = isKeyboardScrubbing
          ? keyboardScrubDirection * deltaSeconds * BASE_SPEED_PX_PER_SECOND * speedRef.current * scrubSpeedMultiplierRef.current
          : pausedRef.current ? 0 : deltaSeconds * BASE_SPEED_PX_PER_SECOND * speedRef.current;
        let didCycleImages = false;
        activeSlotsRef.current = activeSlotsRef.current
          .map((slot) => {
            if (slot.kind !== 'images' || slot.entry.kind !== 'images' || slot.entry.images.length <= 1) {
              return { ...slot, x: slot.x + distance };
            }
            const imageCycleMs = (slot.imageCycleMs || 0) + deltaSeconds * 1000;
            didCycleImages = true;
            return {
              ...slot,
              x: slot.x + distance,
              imageCycleMs,
              activeImageIndex: Math.floor(imageCycleMs / 1000) % slot.entry.images.length,
            };
          });
        if (distance !== 0) {
          fillAdjacentSlots(distance < 0 ? -1 : 1);
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
      const isHideControlsShortcut = event.key.toLowerCase() === 'h';
      if (event.code !== 'Space' && event.key !== ' ' && event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && !isHideControlsShortcut) return;
      if (shouldIgnoreKeyboardShortcutTarget(event.target)) return;

      if (isHideControlsShortcut) {
        event.preventDefault();
        setIsUiHidden((current) => !current);
        return;
      }

      if (isLoading || totalMediaCount === 0) return;

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        keyboardScrubDirectionRef.current = event.key === 'ArrowRight' ? 1 : -1;
        return;
      }

      event.preventDefault();
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
  }, [enableKeyboardControls, isLoading, totalMediaCount]);

  useEffect(() => {
    const videos = Object.values(videoRefs.current);
    for (const video of videos) {
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      const result = video.play();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
    }
  }, [activeSlots]);

  useEffect(() => {
    if (activeSlotsRef.current.length === 0) return;
    const stage = stageSizeRef.current;
    activeSlotsRef.current = activeSlotsRef.current.map((slot) => {
      const size = buildSlotSize(slot.entry, stage, measuredRatios);
      return { ...slot, width: size.width, height: size.height, y: size.y };
    });
    setActiveSlots(activeSlotsRef.current);
  }, [measuredRatios]);

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
    if (totalMediaCount === 0) return 'No selected gallery media';
    if (feedEnded) return 'End of feed';
    if (paused) return 'Movement paused';
    if (imagesEnabled) return `${visibleCount} slots · ${remainingCount} queued · ${visibleImageSlotCount} image slots`;
    return `${visibleCount} playing · ${remainingCount} queued`;
  }, [error, feedEnded, imagesEnabled, isLoading, paused, remainingCount, totalMediaCount, visibleCount, visibleImageSlotCount]);

  const handleVideosToggle = useCallback((nextEnabled: boolean) => {
    if (!nextEnabled && !imagesEnabledRef.current) return;
    setVideosEnabled(nextEnabled);
    videosEnabledRef.current = nextEnabled;
    void loadAssets(nextEnabled, imagesEnabledRef.current, ratioFilterRef.current);
  }, [loadAssets]);

  const handleImagesToggle = useCallback((nextEnabled: boolean) => {
    if (!nextEnabled && !videosEnabledRef.current) return;
    setImagesEnabled(nextEnabled);
    imagesEnabledRef.current = nextEnabled;
    void loadAssets(videosEnabledRef.current, nextEnabled, ratioFilterRef.current);
  }, [loadAssets]);

  const handleRatioToggle = useCallback((orientation: 'landscape' | 'portrait', nextEnabled: boolean) => {
    const nextRatioFilter = {
      ...ratioFilterRef.current,
      [orientation === 'landscape' ? 'includeLandscape' : 'includePortrait']: nextEnabled,
    };
    ratioFilterRef.current = nextRatioFilter;
    setIncludeLandscape(nextRatioFilter.includeLandscape);
    setIncludePortrait(nextRatioFilter.includePortrait);
    void loadAssets(videosEnabledRef.current, imagesEnabledRef.current, nextRatioFilter);
  }, [loadAssets]);

  return (
    <div
      className="relative h-full min-h-[100dvh] overflow-hidden bg-black"
      onPointerMove={revealControls}
    >
      {showControls ? (
        <div
          className={`absolute left-0 right-0 top-0 z-20 flex min-h-12 items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-4 py-2 backdrop-blur-md transition-opacity duration-150 ${isUiHidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
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
          <div className="flex w-[220px] items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="text-xs text-white/55">Speed</span>
            <Slider
              min={0.4}
              max={2.4}
              step={0.1}
              value={[speed]}
              onValueChange={(value) => setSpeed(value[0] || 1)}
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
              onValueChange={(value) => setScrubSpeedMultiplier(value[0] || DEFAULT_KEYBOARD_SCRUB_SPEED_MULTIPLIER)}
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
              setIsUiHidden(true);
            }}
            aria-label="Hide carousel controls"
            title="Hide carousel controls"
          >
            <EyeOff className="mr-2 h-4 w-4" />
            Hide UI
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-md border border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              resetPlayback(sourceVideosRef.current, sourceImagesRef.current, videosEnabledRef.current, imagesEnabledRef.current);
            }}
            disabled={isLoading || feedRef.current.length === 0}
          >
            <Shuffle className="mr-2 h-4 w-4" />
            Shuffle
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md border border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              void loadAssets(videosEnabledRef.current, imagesEnabledRef.current, ratioFilterRef.current);
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
      ) : null}

      <div
        ref={stageRef}
        data-testid="gallery-video-carousel"
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
          setPaused((value) => {
            const next = !value;
            pausedRef.current = next;
            return next;
          });
        }}
      >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.6),transparent_12%,transparent_88%,rgba(0,0,0,0.6))]" />

          {activeSlots.map((slot) => (
            <div
              key={slot.instanceId}
              className="absolute overflow-hidden rounded-md border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
              style={{
                width: `${slot.width}px`,
                height: `${slot.height}px`,
                transform: `translate3d(${slot.x}px, ${slot.y}px, 0)`,
              }}
            >
              {slot.entry.kind === 'video' ? (
                <video
                  ref={(node) => {
                    if (node) {
                      videoRefs.current[slot.instanceId] = node;
                    } else {
                      delete videoRefs.current[slot.instanceId];
                    }
                  }}
                  src={slot.entry.asset.previewUrl || slot.entry.asset.originalUrl}
                  poster={slot.entry.asset.thumbnailUrl || undefined}
                  muted
                  loop
                  autoPlay
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(event) => handleMetadata(slot.entry.asset, event.currentTarget)}
                  className="h-full w-full object-cover"
                />
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
          ))}

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
              <div className="rounded-md border border-dashed border-white/15 px-5 py-4 text-sm text-white/55">No selected gallery media in this workspace.</div>
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
                    resetPlayback(sourceVideosRef.current, sourceImagesRef.current, videosEnabledRef.current, imagesEnabledRef.current);
                  }}
                >
                  <Shuffle className="mr-2 h-4 w-4" />
                  Shuffle again
                </Button>
              </div>
            </div>
          ) : showControls && !paused && !isUiHidden ? (
            <div className="pointer-events-none absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/45 px-3 py-2 text-xs text-white/55">
              <Play className="h-3.5 w-3.5" />
              {videosEnabled && imagesEnabled
                ? `${totalVideoCount} videos · ${totalImageCount} images`
                : videosEnabled
                  ? `${totalVideoCount} videos`
                  : `${totalImageCount} images`}
            </div>
          ) : null}
      </div>
    </div>
  );
}
