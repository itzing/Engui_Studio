'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Pause, Play, RefreshCw, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  getAdjacentGalleryCarouselSlotX,
  getFullHeightGalleryCarouselSlotSize,
  shouldSpawnAdjacentGalleryCarouselSlot,
  shuffleGalleryVideoFeed,
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
  instanceId: string;
  asset: GalleryCarouselAsset;
  x: number;
  y: number;
  width: number;
  height: number;
};

const PAGE_LIMIT = 100;
const DEFAULT_VIDEO_RATIO = 9 / 16;
const BASE_SPEED_PX_PER_SECOND = 90;

function readAssetRatio(asset: GalleryCarouselAsset, measuredRatios: Record<string, number>) {
  const measured = measuredRatios[asset.id];
  if (Number.isFinite(measured) && measured > 0) return measured;
  if (asset.mediaWidth && asset.mediaHeight && asset.mediaWidth > 0 && asset.mediaHeight > 0) {
    return asset.mediaWidth / asset.mediaHeight;
  }
  return DEFAULT_VIDEO_RATIO;
}

function buildSlotSize(asset: GalleryCarouselAsset, stage: { width: number; height: number }, measuredRatios: Record<string, number>) {
  const ratio = readAssetRatio(asset, measuredRatios);
  return getFullHeightGalleryCarouselSlotSize(ratio, stage.height);
}

async function fetchAllGalleryVideos(workspaceId: string) {
  const videos: GalleryCarouselAsset[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const search = new URLSearchParams({
      workspaceId,
      page: String(page),
      limit: String(PAGE_LIMIT),
      sort: 'newest',
      bucket: 'all',
      type: 'video',
    });
    const response = await fetch(`/api/gallery/assets?${search.toString()}`, { cache: 'no-store' });
    const data = await response.json() as GalleryCarouselResponse;
    if (!response.ok || !data.success || !Array.isArray(data.assets) || !data.pagination) {
      throw new Error(data.error || 'Failed to load gallery videos');
    }

    videos.push(...data.assets.filter((asset) => asset.type === 'video'));
    hasNextPage = Boolean(data.pagination.hasNextPage);
    page += 1;
  }

  return videos;
}

export function GalleryVideoCarousel({ workspaceId }: { workspaceId: string | null }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({});
  const stageSizeRef = useRef({ width: 1280, height: 720 });
  const activeSlotsRef = useRef<CarouselSlot[]>([]);
  const feedRef = useRef<GalleryCarouselAsset[]>([]);
  const sourceVideosRef = useRef<GalleryCarouselAsset[]>([]);
  const nextIndexRef = useRef(0);
  const lastFrameTimestampRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const slotCounterRef = useRef(0);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const measuredRatiosRef = useRef<Record<string, number>>({});
  const [sourceVideos, setSourceVideos] = useState<GalleryCarouselAsset[]>([]);
  const [activeSlots, setActiveSlots] = useState<CarouselSlot[]>([]);
  const [nextIndex, setNextIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedEnded, setFeedEnded] = useState(false);
  const [measuredRatios, setMeasuredRatios] = useState<Record<string, number>>({});

  const remainingCount = Math.max(0, feedRef.current.length - nextIndex);
  const visibleCount = activeSlots.length;
  const totalCount = sourceVideos.length;

  const resetPlayback = useCallback((videos: GalleryCarouselAsset[]) => {
    const feed = shuffleGalleryVideoFeed(videos);
    feedRef.current = feed;
    activeSlotsRef.current = [];
    nextIndexRef.current = 0;
    slotCounterRef.current += 1;
    setActiveSlots([]);
    setNextIndex(0);
    setFeedEnded(feed.length === 0);
    setPaused(false);
  }, []);

  const loadVideos = useCallback(async () => {
    if (!workspaceId) {
      setSourceVideos([]);
      sourceVideosRef.current = [];
      resetPlayback([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const videos = await fetchAllGalleryVideos(workspaceId);
      sourceVideosRef.current = videos;
      setSourceVideos(videos);
      resetPlayback(videos);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load gallery videos');
      sourceVideosRef.current = [];
      setSourceVideos([]);
      resetPlayback([]);
    } finally {
      setIsLoading(false);
    }
  }, [resetPlayback, workspaceId]);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

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

    const asset = feed[nextIndexRef.current];
    const size = buildSlotSize(asset, stage, measuredRatiosRef.current);
    const trailingSlot = activeSlotsRef.current[activeSlotsRef.current.length - 1] || null;
    nextIndexRef.current += 1;
    const slot: CarouselSlot = {
      instanceId: `${asset.id}-${slotCounterRef.current}-${nextIndexRef.current}`,
      asset,
      x: getAdjacentGalleryCarouselSlotX(trailingSlot?.x ?? null, size.width),
      y: size.y,
      width: size.width,
      height: size.height,
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

      if (!pausedRef.current && feedRef.current.length > 0) {
        maybeSpawnNext();
        const distance = deltaSeconds * BASE_SPEED_PX_PER_SECOND * speedRef.current;
        const stage = stageSizeRef.current;
        activeSlotsRef.current = activeSlotsRef.current
          .map((slot) => ({ ...slot, x: slot.x + distance }))
          .filter((slot) => slot.x < stage.width + slot.width + 24);

        setActiveSlots(activeSlotsRef.current);

        if (nextIndexRef.current >= feedRef.current.length && activeSlotsRef.current.length === 0) {
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
      if (paused) {
        video.pause();
      } else {
        const result = video.play();
        if (result && typeof result.catch === 'function') {
          result.catch(() => {});
        }
      }
    }
  }, [activeSlots, paused]);

  useEffect(() => {
    if (activeSlotsRef.current.length === 0) return;
    const stage = stageSizeRef.current;
    activeSlotsRef.current = activeSlotsRef.current.map((slot) => {
      const size = buildSlotSize(slot.asset, stage, measuredRatios);
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
    if (isLoading) return 'Loading video feed';
    if (error) return 'Unable to load videos';
    if (totalCount === 0) return 'No gallery videos';
    if (feedEnded) return 'End of feed';
    if (paused) return 'Paused';
    return `${visibleCount} playing · ${remainingCount} queued`;
  }, [error, feedEnded, isLoading, paused, remainingCount, totalCount, visibleCount]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">Video Carousel</div>
          <div className="truncate text-xs text-white/45">{statusLabel}</div>
        </div>
        <div className="flex items-center gap-3">
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
              resetPlayback(sourceVideosRef.current);
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
              void loadVideos();
            }}
            disabled={isLoading}
            aria-label="Refresh video feed"
            title="Refresh video feed"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
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
              <video
                ref={(node) => {
                  if (node) {
                    videoRefs.current[slot.instanceId] = node;
                  } else {
                    delete videoRefs.current[slot.instanceId];
                  }
                }}
                src={slot.asset.previewUrl || slot.asset.originalUrl}
                poster={slot.asset.thumbnailUrl || undefined}
                muted
                loop
                autoPlay
                playsInline
                preload="metadata"
                onLoadedMetadata={(event) => handleMetadata(slot.asset, event.currentTarget)}
                className="h-full w-full object-cover"
              />
            </div>
          ))}

          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/70 px-4 py-3 text-sm text-white/65">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading video feed...
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
                    resetPlayback(sourceVideosRef.current);
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
              {totalCount} videos
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
