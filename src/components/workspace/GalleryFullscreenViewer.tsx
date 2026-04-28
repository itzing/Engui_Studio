'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Heart, HeartOff, Info, Loader2, Play, Repeat, Shuffle, Square, X } from 'lucide-react';

export type GalleryViewerBucket = 'common' | 'draft' | 'upscale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type GalleryFullscreenViewerItem = {
  id: string;
  url: string;
  favorited?: boolean;
  type?: 'image' | 'video' | 'audio';
  bucket?: GalleryViewerBucket;
};

interface GalleryFullscreenViewerProps {
  open: boolean;
  items: GalleryFullscreenViewerItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onOpenInfo?: (itemId: string) => void;
  onToggleFavorite?: (itemId: string) => Promise<boolean | void>;
  renderHeaderActions?: (itemId: string) => React.ReactNode;
  renderFooterActions?: (item: GalleryFullscreenViewerItem, meta: { canMarkUpscale: boolean }) => React.ReactNode;
}

type Point = { x: number; y: number };
type PanOffset = { x: number; y: number };
type GestureMode = 'swipe' | 'pan' | 'pinch' | null;

type SwipeGesture = {
  mode: 'swipe';
  startX: number;
  startY: number;
};

type PanGesture = {
  mode: 'pan';
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type PinchGesture = {
  mode: 'pinch';
  startDistance: number;
  startScale: number;
  startPanX: number;
  startPanY: number;
  startMidpoint: Point;
};

type GestureState = SwipeGesture | PanGesture | PinchGesture | null;
type SlideshowMode = 'stop' | 'loop' | 'random';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const RESET_ZOOM_THRESHOLD = 1.02;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getTouchDistance(first: Touch, second: Touch): number {
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function getTouchMidpoint(first: Touch, second: Touch): Point {
  return {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  };
}

export function GalleryFullscreenViewer({ open, items, currentIndex, onIndexChange, onClose, onOpenInfo, onToggleFavorite, renderHeaderActions, renderFooterActions }: GalleryFullscreenViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerSurfaceRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const gestureRef = useRef<GestureState>(null);
  const suppressClickRef = useRef(false);
  const previousOpenRef = useRef(false);
  const singleTapTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; itemId: string | null }>({ time: 0, itemId: null });
  const overlayTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const slideshowTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const zoomScaleRef = useRef(1);
  const panOffsetRef = useRef<PanOffset>({ x: 0, y: 0 });
  const [showCloseButton, setShowCloseButton] = useState(true);
  const [favoriteOverlay, setFavoriteOverlay] = useState<'added' | 'removed' | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const [gestureMode, setGestureMode] = useState<GestureMode>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [currentImageLoaded, setCurrentImageLoaded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [slideshowMode, setSlideshowMode] = useState<SlideshowMode>('stop');
  const [slideshowIntervalSeconds, setSlideshowIntervalSeconds] = useState(4);
  const [intervalDraft, setIntervalDraft] = useState('4');
  const [isIntervalPopoverOpen, setIsIntervalPopoverOpen] = useState(false);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(false);
  const [slideshowCountdownSeconds, setSlideshowCountdownSeconds] = useState<number | null>(null);
  const currentItem = useMemo(() => items[currentIndex] || null, [items, currentIndex]);
  const previousItem = useMemo(() => items[currentIndex - 1] || null, [items, currentIndex]);
  const nextItem = useMemo(() => items[currentIndex + 1] || null, [items, currentIndex]);
  const slideshowEnabled = isDesktop && items.length > 1;

  const clampPanOffset = useCallback((nextOffset: PanOffset, scale: number): PanOffset => {
    if (scale <= MIN_ZOOM) {
      return { x: 0, y: 0 };
    }

    const viewer = viewerSurfaceRef.current;
    const image = imageRef.current;
    if (!viewer || !image) {
      return nextOffset;
    }

    const baseWidth = image.clientWidth;
    const baseHeight = image.clientHeight;
    if (!baseWidth || !baseHeight) {
      return nextOffset;
    }

    const maxX = Math.max(0, (baseWidth * scale - viewer.clientWidth) / 2);
    const maxY = Math.max(0, (baseHeight * scale - viewer.clientHeight) / 2);

    return {
      x: clamp(nextOffset.x, -maxX, maxX),
      y: clamp(nextOffset.y, -maxY, maxY),
    };
  }, []);

  const applyZoomState = useCallback((nextScale: number, nextOffset: PanOffset) => {
    const normalizedScale = nextScale <= RESET_ZOOM_THRESHOLD ? MIN_ZOOM : clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
    const normalizedOffset = normalizedScale === MIN_ZOOM ? { x: 0, y: 0 } : clampPanOffset(nextOffset, normalizedScale);

    zoomScaleRef.current = normalizedScale;
    panOffsetRef.current = normalizedOffset;
    setZoomScale(normalizedScale);
    setPanOffset(normalizedOffset);
  }, [clampPanOffset]);

  const resetZoomState = useCallback(() => {
    applyZoomState(MIN_ZOOM, { x: 0, y: 0 });
    gestureRef.current = null;
    setGestureMode(null);
  }, [applyZoomState]);

  const goPrevious = useCallback(() => {
    if (currentIndex <= 0) return;
    resetZoomState();
    onIndexChange(currentIndex - 1);
  }, [currentIndex, onIndexChange, resetZoomState]);

  const goNext = useCallback(() => {
    if (currentIndex >= items.length - 1) return;
    resetZoomState();
    onIndexChange(currentIndex + 1);
  }, [currentIndex, items.length, onIndexChange, resetZoomState]);

  const scheduleOverlayAutohide = useCallback(() => {
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
    }
    overlayTimeoutRef.current = window.setTimeout(() => {
      setShowCloseButton(false);
      setIsIntervalPopoverOpen(false);
      overlayTimeoutRef.current = null;
    }, 3000);
  }, []);

  const runSingleTapAction = useCallback(() => {
    if (isSlideshowPlaying) {
      setShowCloseButton(true);
      scheduleOverlayAutohide();
      return;
    }
    setShowCloseButton((value) => !value);
  }, [isSlideshowPlaying, scheduleOverlayAutohide]);

  const triggerFavoriteOverlay = useCallback((mode: 'added' | 'removed') => {
    setFavoriteOverlay(mode);
    window.setTimeout(() => {
      setFavoriteOverlay(null);
    }, 650);
  }, []);

  const handleFavoriteToggle = useCallback(async () => {
    if (!currentItem?.id || !onToggleFavorite) return;
    const wasFavorited = !!currentItem.favorited;
    const result = await onToggleFavorite(currentItem.id);
    const nextFavorited = typeof result === 'boolean' ? result : !wasFavorited;
    triggerFavoriteOverlay(nextFavorited ? 'added' : 'removed');
  }, [currentItem?.favorited, currentItem?.id, onToggleFavorite, triggerFavoriteOverlay]);

  const handleViewerClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    const now = Date.now();
    const isDoubleTap = currentItem?.id && lastTapRef.current.itemId === currentItem.id && (now - lastTapRef.current.time) < 280;

    if (isDoubleTap) {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      lastTapRef.current = { time: 0, itemId: null };
      void handleFavoriteToggle();
      return;
    }

    lastTapRef.current = { time: now, itemId: currentItem?.id || null };
    singleTapTimeoutRef.current = window.setTimeout(() => {
      runSingleTapAction();
      singleTapTimeoutRef.current = null;
    }, 280);
  }, [currentItem?.id, handleFavoriteToggle, runSingleTapAction]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsDesktop(window.innerWidth >= 640);

    const storedInterval = window.localStorage.getItem('engui.galleryViewer.slideshowIntervalSeconds');
    const parsedInterval = Number.parseInt(storedInterval || '', 10);
    if (Number.isFinite(parsedInterval) && parsedInterval >= 1 && parsedInterval <= 60) {
      setSlideshowIntervalSeconds(parsedInterval);
      setIntervalDraft(String(parsedInterval));
    }

    const storedMode = window.localStorage.getItem('engui.galleryViewer.slideshowMode');
    if (storedMode === 'stop' || storedMode === 'loop' || storedMode === 'random') {
      setSlideshowMode(storedMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (open && !previousOpenRef.current) {
      setShowCloseButton(true);
      containerRef.current?.focus();
    }

    if (open && currentImageLoaded) {
      [previousItem?.url, nextItem?.url]
        .filter((url): url is string => typeof url === 'string' && url.length > 0)
        .forEach((url) => {
          const image = new window.Image();
          image.src = url;
        });
    }

    if (!open) {
      setCurrentImageLoaded(false);
    }

    previousOpenRef.current = open;
  }, [currentImageLoaded, nextItem?.url, open, previousItem?.url]);

  useEffect(() => {
    if (!open) {
      resetZoomState();
      setImageNaturalSize(null);
      setCurrentImageLoaded(false);
      return;
    }

    resetZoomState();
    setImageNaturalSize(null);
    setCurrentImageLoaded(false);
  }, [currentItem?.id, open, resetZoomState]);


  useEffect(() => {
    return () => {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
      if (slideshowTimeoutRef.current) {
        clearTimeout(slideshowTimeoutRef.current);
      }
    };
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length >= 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      if (!first || !second) return;
      gestureRef.current = {
        mode: 'pinch',
        startDistance: getTouchDistance(first, second),
        startScale: zoomScaleRef.current,
        startPanX: panOffsetRef.current.x,
        startPanY: panOffsetRef.current.y,
        startMidpoint: getTouchMidpoint(first, second),
      };
      suppressClickRef.current = true;
      setGestureMode('pinch');
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;

    if (zoomScaleRef.current > MIN_ZOOM + 0.01) {
      gestureRef.current = {
        mode: 'pan',
        startX: touch.clientX,
        startY: touch.clientY,
        originX: panOffsetRef.current.x,
        originY: panOffsetRef.current.y,
      };
      setGestureMode('pan');
      return;
    }

    gestureRef.current = {
      mode: 'swipe',
      startX: touch.clientX,
      startY: touch.clientY,
    };
    setGestureMode('swipe');
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.mode === 'pinch') {
      const first = event.touches[0];
      const second = event.touches[1];
      if (!first || !second) return;

      event.preventDefault();

      const currentDistance = getTouchDistance(first, second);
      if (!currentDistance || !gesture.startDistance) return;

      const nextScale = clamp(gesture.startScale * (currentDistance / gesture.startDistance), MIN_ZOOM, MAX_ZOOM);
      const midpoint = getTouchMidpoint(first, second);
      const surfaceRect = viewerSurfaceRef.current?.getBoundingClientRect();
      const surfaceCenterX = surfaceRect ? surfaceRect.left + surfaceRect.width / 2 : midpoint.x;
      const surfaceCenterY = surfaceRect ? surfaceRect.top + surfaceRect.height / 2 : midpoint.y;
      const scaleRatio = nextScale / gesture.startScale;
      const deltaMidX = midpoint.x - gesture.startMidpoint.x;
      const deltaMidY = midpoint.y - gesture.startMidpoint.y;
      const relativeMidX = gesture.startMidpoint.x - surfaceCenterX;
      const relativeMidY = gesture.startMidpoint.y - surfaceCenterY;

      applyZoomState(nextScale, {
        x: deltaMidX + relativeMidX * (1 - scaleRatio) + gesture.startPanX * scaleRatio,
        y: deltaMidY + relativeMidY * (1 - scaleRatio) + gesture.startPanY * scaleRatio,
      });
      return;
    }

    if (gesture.mode === 'pan') {
      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;
      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        suppressClickRef.current = true;
      }

      event.preventDefault();
      applyZoomState(zoomScaleRef.current, {
        x: gesture.originX + deltaX,
        y: gesture.originY + deltaY,
      });
    }
  }, [applyZoomState]);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.mode === 'pinch') {
      gestureRef.current = null;
      setGestureMode(null);
      if (zoomScaleRef.current <= RESET_ZOOM_THRESHOLD) {
        resetZoomState();
      }
      return;
    }

    if (gesture.mode === 'pan') {
      gestureRef.current = null;
      setGestureMode(null);
      if (zoomScaleRef.current <= RESET_ZOOM_THRESHOLD) {
        resetZoomState();
      }
      return;
    }

    gestureRef.current = null;
    setGestureMode(null);

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;

    if (Math.abs(deltaY) >= 60 && Math.abs(deltaY) > Math.abs(deltaX)) {
      suppressClickRef.current = true;
      onClose();
      return;
    }

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) {
      suppressClickRef.current = false;
      return;
    }

    suppressClickRef.current = true;

    if (deltaX > 0) {
      goPrevious();
      return;
    }

    goNext();
  }, [goNext, goPrevious, onClose, resetZoomState]);

  const handleTouchCancel = useCallback(() => {
    gestureRef.current = null;
    setGestureMode(null);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('engui.galleryViewer.slideshowIntervalSeconds', String(slideshowIntervalSeconds));
  }, [slideshowIntervalSeconds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('engui.galleryViewer.slideshowMode', slideshowMode);
  }, [slideshowMode]);

  useEffect(() => {
    if (!open) {
      setIsSlideshowPlaying(false);
      setIsIntervalPopoverOpen(false);
      setSlideshowCountdownSeconds(null);
      return;
    }

    if (!slideshowEnabled) {
      setIsSlideshowPlaying(false);
    }

    if (!isSlideshowPlaying) {
      setSlideshowCountdownSeconds(null);
    }
  }, [open, slideshowEnabled]);

  const getNextSlideshowIndex = useCallback(() => {
    if (items.length <= 1) return currentIndex;

    if (slideshowMode === 'random') {
      const candidates = items.map((_, index) => index).filter((index) => index !== currentIndex);
      if (candidates.length === 0) return currentIndex;
      return candidates[Math.floor(Math.random() * candidates.length)] ?? currentIndex;
    }

    if (currentIndex >= items.length - 1) {
      if (slideshowMode === 'loop') return 0;
      return -1;
    }

    return currentIndex + 1;
  }, [currentIndex, items, slideshowMode]);

  useEffect(() => {
    if (slideshowTimeoutRef.current) {
      clearTimeout(slideshowTimeoutRef.current);
      slideshowTimeoutRef.current = null;
    }

    if (!open || !isSlideshowPlaying || !currentImageLoaded || !slideshowEnabled) {
      setSlideshowCountdownSeconds(null);
      return;
    }

    setSlideshowCountdownSeconds(slideshowIntervalSeconds);
    const countdownInterval = window.setInterval(() => {
      setSlideshowCountdownSeconds((value) => {
        if (value === null) return null;
        return value <= 1 ? 0 : value - 1;
      });
    }, 1000);

    slideshowTimeoutRef.current = window.setTimeout(() => {
      window.clearInterval(countdownInterval);
      setSlideshowCountdownSeconds(null);
      const nextIndex = getNextSlideshowIndex();
      if (nextIndex < 0 || nextIndex === currentIndex) {
        setIsSlideshowPlaying(false);
        setShowCloseButton(true);
        return;
      }
      onIndexChange(nextIndex);
    }, slideshowIntervalSeconds * 1000);

    return () => {
      window.clearInterval(countdownInterval);
      if (slideshowTimeoutRef.current) {
        clearTimeout(slideshowTimeoutRef.current);
        slideshowTimeoutRef.current = null;
      }
    };
  }, [currentImageLoaded, currentIndex, getNextSlideshowIndex, isSlideshowPlaying, onIndexChange, open, slideshowEnabled, slideshowIntervalSeconds]);

  const cycleSlideshowMode = useCallback(() => {
    setSlideshowMode((value) => value === 'stop' ? 'loop' : value === 'loop' ? 'random' : 'stop');
  }, []);

  const startSlideshow = useCallback(() => {
    if (!slideshowEnabled) return;
    setIsSlideshowPlaying(true);
    setShowCloseButton(false);
    setIsIntervalPopoverOpen(false);
  }, [slideshowEnabled]);

  const stopSlideshow = useCallback(() => {
    setIsSlideshowPlaying(false);
    setShowCloseButton(true);
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = null;
    }
  }, []);

  const commitIntervalDraft = useCallback(() => {
    const parsed = Number.parseInt(intervalDraft.trim(), 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 60) {
      setSlideshowIntervalSeconds(parsed);
      setIntervalDraft(String(parsed));
    } else {
      setIntervalDraft(String(slideshowIntervalSeconds));
    }
    setIsIntervalPopoverOpen(false);
  }, [intervalDraft, slideshowIntervalSeconds]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      stopSlideshow();
      onClose();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goPrevious();
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goNext();
    }
  }, [goNext, goPrevious, onClose, stopSlideshow]);

  if (!open || !currentItem) {
    return null;
  }

  const canMarkUpscale = currentItem?.type === 'image'
    && !!imageNaturalSize
    && Math.max(imageNaturalSize.width, imageNaturalSize.height) > 2000;
  const SlideshowModeIcon = slideshowMode === 'stop' ? ArrowRight : slideshowMode === 'loop' ? Repeat : Shuffle;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen gallery viewer"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {!isDesktop && !currentImageLoaded ? (
        <div
          key={currentItem.id}
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          aria-label="Loading image"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white border border-white/10">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        </div>
      ) : null}

      {showCloseButton && (
        <>
          {(onOpenInfo || renderHeaderActions) && currentItem?.id && (
            <div className="absolute left-3 z-10 flex items-center gap-2" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
              {onOpenInfo ? (
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-10 w-10 rounded-full bg-black/70 hover:bg-black/85 text-white border border-white/10"
                  onClick={() => onOpenInfo(currentItem.id)}
                  aria-label="Open gallery item info"
                  title="Info"
                >
                  <Info className="w-5 h-5" />
                </Button>
              ) : null}
              {renderHeaderActions ? renderHeaderActions(currentItem.id) : null}
            </div>
          )}
          <div className="absolute right-3 z-10" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
            <Button
              size="icon"
              variant="secondary"
              className="h-10 w-10 rounded-full bg-black/70 hover:bg-black/85 text-white border border-white/10"
              onClick={() => {
                stopSlideshow();
                onClose();
              }}
              aria-label="Close viewer"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </>
      )}

      {slideshowEnabled ? (
        <div className="absolute left-3 z-10 pointer-events-none" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.2rem)' }}>
          <div className="rounded px-2 py-1 text-[11px] leading-none text-white/75 bg-black/45 border border-white/10">
            {isSlideshowPlaying
              ? (currentImageLoaded ? `loaded, next in ${slideshowCountdownSeconds ?? slideshowIntervalSeconds}s` : 'loading...')
              : (currentImageLoaded ? 'loaded' : 'loading...')}
          </div>
        </div>
      ) : null}

      {showCloseButton && slideshowEnabled ? (
        <div className="absolute left-3 z-10 flex flex-col items-start gap-2" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
          <div className="relative flex flex-col items-center gap-2">
            <Button
              size="icon"
              variant="secondary"
              className="h-9 w-9 rounded-full bg-black/70 hover:bg-black/85 text-white border border-white/10"
              onClick={cycleSlideshowMode}
              aria-label={`Slideshow mode: ${slideshowMode}`}
              title={slideshowMode === 'stop' ? 'Stop at end' : slideshowMode === 'loop' ? 'Loop' : 'Random'}
            >
              <SlideshowModeIcon className="w-4 h-4" />
            </Button>
            <button
              type="button"
              className="text-xs text-white/85 hover:text-white rounded px-2 py-1 bg-black/55 border border-white/10"
              onClick={() => {
                setIntervalDraft(String(slideshowIntervalSeconds));
                setIsIntervalPopoverOpen((value) => !value);
              }}
            >
              {slideshowIntervalSeconds}s
            </button>
            {isIntervalPopoverOpen ? (
              <div className="absolute bottom-full left-0 mb-2 w-28 rounded-lg border border-white/10 bg-black/85 p-2 shadow-xl">
                <Input
                  value={intervalDraft}
                  onChange={(event) => setIntervalDraft(event.target.value)}
                  onBlur={commitIntervalDraft}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitIntervalDraft();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setIntervalDraft(String(slideshowIntervalSeconds));
                      setIsIntervalPopoverOpen(false);
                    }
                  }}
                  inputMode="numeric"
                  className="h-8 border-white/10 bg-white/5 text-sm text-white"
                  autoFocus
                />
              </div>
            ) : null}
            <Button
              size="icon"
              variant="secondary"
              className="h-10 w-10 rounded-full bg-black/70 hover:bg-black/85 text-white border border-white/10"
              onClick={isSlideshowPlaying ? stopSlideshow : startSlideshow}
              aria-label={isSlideshowPlaying ? 'Stop slideshow' : 'Start slideshow'}
              title={isSlideshowPlaying ? 'Stop slideshow' : 'Start slideshow'}
            >
              {isSlideshowPlaying ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>
          </div>
        </div>
      ) : null}

      {showCloseButton && renderFooterActions ? (
        <div className="absolute right-3 z-10 flex items-center gap-2" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
          {renderFooterActions(currentItem, { canMarkUpscale })}
        </div>
      ) : null}

      <div
        ref={viewerSurfaceRef}
        className="absolute inset-0 flex items-center justify-center overflow-hidden pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] sm:p-4 touch-none"
        onClick={handleViewerClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {favoriteOverlay && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="gallery-favorite-pulse absolute rounded-full bg-white/10" style={{ width: '33vw', height: '33vw', maxWidth: 220, maxHeight: 220 }} />
            <div className={`flex items-center justify-center ${favoriteOverlay === 'added' ? 'gallery-heart-pop-added' : 'gallery-heart-pop-removed'}`}>
              {favoriteOverlay === 'added' ? (
                <Heart className="text-pink-500 drop-shadow-[0_0_30px_rgba(236,72,153,0.75)]" style={{ width: '33vw', height: '33vw', maxWidth: 220, maxHeight: 220 }} fill="currentColor" strokeWidth={1.5} />
              ) : (
                <HeartOff className="text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.45)]" style={{ width: '33vw', height: '33vw', maxWidth: 220, maxHeight: 220 }} strokeWidth={1.75} />
              )}
            </div>
          </div>
        )}
        <style jsx>{`
          .gallery-heart-pop-added {
            animation: gallery-heart-pop-added 560ms cubic-bezier(0.22, 1.3, 0.36, 1) forwards;
          }

          .gallery-heart-pop-removed {
            animation: gallery-heart-pop-removed 560ms cubic-bezier(0.22, 1.15, 0.36, 1) forwards;
          }

          .gallery-favorite-pulse {
            animation: gallery-favorite-pulse 420ms ease-out forwards;
          }

          @keyframes gallery-heart-pop-added {
            0% { transform: scale(0.45); opacity: 0; }
            35% { transform: scale(1.18); opacity: 1; }
            55% { transform: scale(0.92); opacity: 1; }
            75% { transform: scale(1.03); opacity: 0.95; }
            100% { transform: scale(1); opacity: 0; }
          }

          @keyframes gallery-heart-pop-removed {
            0% { transform: scale(0.55); opacity: 0; }
            35% { transform: scale(1.1); opacity: 1; }
            60% { transform: scale(0.96); opacity: 0.95; }
            100% { transform: scale(0.9); opacity: 0; }
          }

          @keyframes gallery-favorite-pulse {
            0% { transform: scale(0.45); opacity: 0; }
            35% { transform: scale(1); opacity: 0.22; }
            100% { transform: scale(1.28); opacity: 0; }
          }
        `}</style>
        <img
          ref={imageRef}
          src={currentItem.url}
          alt="Gallery fullscreen preview"
          className="max-w-full max-h-full object-contain select-none will-change-transform"
          draggable={false}
          onLoad={(event) => {
            setImageNaturalSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            });
            setCurrentImageLoaded(true);
            applyZoomState(zoomScaleRef.current, panOffsetRef.current);
          }}
          style={{
            transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomScale})`,
            transformOrigin: 'center center',
            transition: gestureMode ? 'none' : 'transform 180ms ease-out',
          }}
        />
      </div>
    </div>
  );
}
