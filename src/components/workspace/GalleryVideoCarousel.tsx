'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Pause, Play, RefreshCw, Shuffle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  buildGalleryCarouselFeed,
  type GalleryCarouselFeedItem,
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
  instanceId: string;
  entry: GalleryCarouselFeedItem<GalleryCarouselAsset, GalleryCarouselAsset>;
  x: number;
  y: number;
  width: number;
  height: number;
  imageCycleMs?: number;
  activeImageIndex?: number;
};

const PAGE_LIMIT = 100;
const DEFAULT_VIDEO_RATIO = 9 / 16;
const DEFAULT_IMAGE_RATIO = 1;
const BASE_SPEED_PX_PER_SECOND = 90;

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

export function GalleryVideoCarousel({ workspaceId, onClose }: { workspaceId: string | null; onClose?: () => void }) {
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
  const speedRef = useRef(1);
  const imagesEnabledRef = useRef(false);
  const measuredRatiosRef = useRef<Record<string, number>>({});
  const [sourceVideos, setSourceVideos] = useState<GalleryCarouselAsset[]>([]);
  const [sourceImages, setSourceImages] = useState<GalleryCarouselAsset[]>([]);
  const [activeSlots, setActiveSlots] = useState<CarouselSlot[]>([]);
  const [nextIndex, setNextIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [imagesEnabled, setImagesEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedEnded, setFeedEnded] = useState(false);
  const [measuredRatios, setMeasuredRatios] = useState<Record<string, number>>({});

  const remainingCount = Math.max(0, feedRef.current.length - nextIndex);
  const visibleCount = activeSlots.length;
  const totalCount = sourceVideos.length;
  const totalImageCount = sourceImages.length;
  const visibleImageSlotCount = activeSlots.filter((slot) => slot.kind === 'images').length;

  const resetPlayback = useCallback((videos: GalleryCarouselAsset[], images: GalleryCarouselAsset[], includeImages: boolean) => {
    const feed = buildGalleryCarouselFeed(videos, { images, includeImages });
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

  const loadAssets = useCallback(async (includeImages: boolean) => {
    if (!workspaceId) {
      setSourceVideos([]);
      setSourceImages([]);
      sourceVideosRef.current = [];
      sourceImagesRef.current = [];
      resetPlayback([], [], includeImages);
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
        fetchAllGalleryAssets(workspaceId, 'video'),
        includeImages ? fetchAllGalleryAssets(workspaceId, 'image') : Promise.resolve([]),
      ]);
      sourceVideosRef.current = videos;
      sourceImagesRef.current = images;
      setSourceVideos(videos);
      setSourceImages(images);
      resetPlayback(videos, images, includeImages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load gallery feed');
      sourceVideosRef.current = [];
      sourceImagesRef.current = [];
      setSourceVideos([]);
      setSourceImages([]);
      resetPlayback([], [], includeImages);
    } finally {
      setIsLoading(false);
    }
  }, [resetPlayback, workspaceId]);

  useEffect(() => {
    imagesEnabledRef.current = false;
    setImagesEnabled(false);
    void loadAssets(false);
  }, [loadAssets]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

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
    if (stage.width <= 0 || stage.height <= 0 || nextIndexRef.current >= feed.length) return;

    const entry = feed[nextIndexRef.current];
    const size = buildSlotSize(entry, stage, measuredRatiosRef.current);
    const trailingSlot = activeSlotsRef.current[activeSlotsRef.current.length - 1] || null;
    nextIndexRef.current += 1;
    const slot: CarouselSlot = {
      kind: entry.kind,
      instanceId: `${entry.id}-${slotCounterRef.current}-${nextIndexRef.current}`,
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

  const maybeSpawnNext = useCallback(() => {
    if (nextIndexRef.current >= feedRef.current.length) return;
    const activeSlots = activeSlotsRef.current;
    if (activeSlots.length === 0) {
      spawnNext();
      return;
    }

    const newestSlot = activeSlots[activeSlots.length - 1];
    if (shouldSpawnAdjacentGalleryCarouselSlot(newestSlot.x)) {
      spawnNext();
    }
  }, [spawnNext]);

  useEffect(() => {
    const frame = (timestamp: number) => {
      const lastTimestamp = lastFrameTimestampRef.current ?? timestamp;
      const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - lastTimestamp) / 1000));
      lastFrameTimestampRef.current = timestamp;

      if (feedRef.current.length > 0) {
        if (!pausedRef.current) {
          maybeSpawnNext();
        }
        const distance = pausedRef.current ? 0 : deltaSeconds * BASE_SPEED_PX_PER_SECOND * speedRef.current;
        const stage = stageSizeRef.current;
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
          })
          .filter((slot) => pausedRef.current || slot.x < stage.width + slot.width + 24);

        if (!pausedRef.current || didCycleImages) {
          setActiveSlots(activeSlotsRef.current);
        }

        if (!pausedRef.current && nextIndexRef.current >= feedRef.current.length && activeSlotsRef.current.length === 0) {
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
  }, [maybeSpawnNext]);

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
    if (totalCount === 0) return 'No gallery videos';
    if (feedEnded) return 'End of feed';
    if (paused) return 'Paused';
    if (imagesEnabled) return `${visibleCount} slots · ${remainingCount} queued · ${visibleImageSlotCount} image slots`;
    return `${visibleCount} playing · ${remainingCount} queued`;
  }, [error, feedEnded, imagesEnabled, isLoading, paused, remainingCount, totalCount, visibleCount, visibleImageSlotCount]);

  const handleImagesToggle = useCallback((nextEnabled: boolean) => {
    setImagesEnabled(nextEnabled);
    imagesEnabledRef.current = nextEnabled;
    void loadAssets(nextEnabled);
  }, [loadAssets]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">Video Carousel</div>
          <div className="truncate text-xs text-white/45">{statusLabel}</div>
        </div>
        <div className="flex items-center gap-3">
          <label
            className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs transition-colors ${imagesEnabled ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/[0.03] text-white/60'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={imagesEnabled}
              disabled={isLoading}
              onChange={(event) => handleImagesToggle(event.currentTarget.checked)}
              className="h-3.5 w-3.5 accent-emerald-400"
              aria-label="Include image slots"
            />
            <ImageIcon className="h-4 w-4" />
            Images
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
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-md border border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              resetPlayback(sourceVideosRef.current, sourceImagesRef.current, imagesEnabledRef.current);
            }}
            disabled={isLoading || sourceVideosRef.current.length === 0}
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
              void loadAssets(imagesEnabledRef.current);
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

      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div
          ref={stageRef}
          data-testid="gallery-video-carousel"
          className="relative aspect-video max-h-full w-full overflow-hidden rounded-md border border-white/10 bg-neutral-950 shadow-2xl"
          onClick={() => {
            if (isLoading || totalCount === 0) return;
            setPaused((value) => !value);
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
          ) : totalCount === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="rounded-md border border-dashed border-white/15 px-5 py-4 text-sm text-white/55">No gallery videos in this workspace.</div>
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
                    resetPlayback(sourceVideosRef.current, sourceImagesRef.current, imagesEnabledRef.current);
                  }}
                >
                  <Shuffle className="mr-2 h-4 w-4" />
                  Shuffle again
                </Button>
              </div>
            </div>
          ) : paused ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/60 px-4 py-3 text-sm text-white/75">
                <Pause className="h-4 w-4" />
                Paused
              </div>
            </div>
          ) : (
            <div className="pointer-events-none absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/45 px-3 py-2 text-xs text-white/55">
              <Play className="h-3.5 w-3.5" />
              {imagesEnabled ? `${totalCount} videos · ${totalImageCount} images` : `${totalCount} videos`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
