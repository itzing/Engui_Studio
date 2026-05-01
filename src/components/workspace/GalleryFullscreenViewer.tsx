'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import type { ZoomRef } from 'yet-another-react-lightbox/plugins/zoom';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import { ArrowRight, Heart, HeartOff, Info, Loader2, Play, Repeat, Shuffle, Square, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type GalleryViewerBucket = 'common' | 'draft' | 'upscale';

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

type SlideshowMode = 'stop' | 'loop' | 'random';

type ViewerSlide = {
  src: string;
  alt: string;
  type?: 'image' | 'video' | 'audio';
  poster?: string;
};

function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, index));
}

export function GalleryFullscreenViewer({
  open,
  items,
  currentIndex,
  onIndexChange,
  onClose,
  onOpenInfo,
  onToggleFavorite,
  renderHeaderActions,
  renderFooterActions,
}: GalleryFullscreenViewerProps) {
  const previousOpenRef = useRef(false);
  const singleTapTimeoutRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ time: number; itemId: string | null }>({ time: 0, itemId: null });
  const overlayTimeoutRef = useRef<number | null>(null);
  const slideshowTimeoutRef = useRef<number | null>(null);
  const mobileGestureStartRef = useRef<{ x: number; y: number } | null>(null);
  const zoomRef = useRef<ZoomRef | null>(null);

  const [isDesktop, setIsDesktop] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [favoriteOverlay, setFavoriteOverlay] = useState<'added' | 'removed' | null>(null);
  const [currentImageLoaded, setCurrentImageLoaded] = useState(false);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [slideshowMode, setSlideshowMode] = useState<SlideshowMode>('stop');
  const [slideshowIntervalSeconds, setSlideshowIntervalSeconds] = useState(4);
  const [intervalDraft, setIntervalDraft] = useState('4');
  const [isIntervalPopoverOpen, setIsIntervalPopoverOpen] = useState(false);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(false);
  const [slideshowCountdownSeconds, setSlideshowCountdownSeconds] = useState<number | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);

  const safeIndex = useMemo(() => clampIndex(currentIndex, items.length), [currentIndex, items.length]);
  const currentItem = useMemo(() => items[safeIndex] || null, [items, safeIndex]);
  const slideshowEnabled = isDesktop && items.length > 1;

  const slides = useMemo<ViewerSlide[]>(() => items.map((item) => ({
    src: item.url,
    alt: 'Gallery fullscreen preview',
    type: item.type ?? 'image',
  })), [items]);

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
    window.localStorage.setItem('engui.galleryViewer.slideshowIntervalSeconds', String(slideshowIntervalSeconds));
  }, [slideshowIntervalSeconds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('engui.galleryViewer.slideshowMode', slideshowMode);
  }, [slideshowMode]);

  useEffect(() => {
    if (open && !previousOpenRef.current) {
      setShowControls(true);
    }

    if (!open) {
      setCurrentImageLoaded(false);
      setImageNaturalSize(null);
      setIsSlideshowPlaying(false);
      setIsIntervalPopoverOpen(false);
      setSlideshowCountdownSeconds(null);
      setCurrentZoom(1);
    }

    previousOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || !currentItem) {
      setCurrentImageLoaded(false);
      setImageNaturalSize(null);
      return;
    }

    if (currentItem.type && currentItem.type !== 'image') {
      setCurrentImageLoaded(true);
      setImageNaturalSize(null);
      return;
    }

    let cancelled = false;
    const image = new window.Image();
    setCurrentImageLoaded(false);
    setImageNaturalSize(null);

    image.onload = () => {
      if (cancelled) return;
      setCurrentImageLoaded(true);
      setImageNaturalSize({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = () => {
      if (cancelled) return;
      setCurrentImageLoaded(true);
      setImageNaturalSize(null);
    };

    image.src = currentItem.url;

    return () => {
      cancelled = true;
    };
  }, [currentItem, open]);

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

  const scheduleOverlayAutohide = useCallback(() => {
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
    }
    overlayTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
      setIsIntervalPopoverOpen(false);
      overlayTimeoutRef.current = null;
    }, 3000);
  }, []);

  const stopSlideshow = useCallback(() => {
    setIsSlideshowPlaying(false);
    setShowControls(true);
    setSlideshowCountdownSeconds(null);
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = null;
    }
  }, []);

  const startSlideshow = useCallback(() => {
    if (!slideshowEnabled) return;
    setIsSlideshowPlaying(true);
    setShowControls(false);
    setIsIntervalPopoverOpen(false);
  }, [slideshowEnabled]);

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
  }, [currentItem, onToggleFavorite, triggerFavoriteOverlay]);

  const handleViewerClick = useCallback(() => {
    const now = Date.now();
    const isDoubleTap = currentItem?.id && lastTapRef.current.itemId === currentItem.id && (now - lastTapRef.current.time) < 280;

    if (isDoubleTap) {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      lastTapRef.current = { time: 0, itemId: null };
      return;
    }

    lastTapRef.current = { time: now, itemId: currentItem?.id || null };
    singleTapTimeoutRef.current = window.setTimeout(() => {
      if (isSlideshowPlaying) {
        setShowControls(true);
        scheduleOverlayAutohide();
      } else {
        setShowControls((value) => !value);
      }
      singleTapTimeoutRef.current = null;
    }, 280);
  }, [currentItem?.id, isSlideshowPlaying, scheduleOverlayAutohide]);

  const goToPrevious = useCallback(() => {
    if (items.length <= 1) return;
    onIndexChange(safeIndex <= 0 ? items.length - 1 : safeIndex - 1);
  }, [items.length, onIndexChange, safeIndex]);

  const goToNext = useCallback(() => {
    if (items.length <= 1) return;
    onIndexChange(safeIndex >= items.length - 1 ? 0 : safeIndex + 1);
  }, [items.length, onIndexChange, safeIndex]);

  const handleMobileGestureStart = useCallback((event: React.TouchEvent) => {
    if (isDesktop) return;
    if (currentZoom > 1.0001) {
      mobileGestureStartRef.current = null;
      return;
    }
    if (event.touches.length !== 1) {
      mobileGestureStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    if (!touch) return;
    mobileGestureStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [currentZoom, isDesktop]);

  const handleMobileGestureEnd = useCallback((event: React.TouchEvent) => {
    if (isDesktop) return;
    if (currentZoom > 1.0001) {
      mobileGestureStartRef.current = null;
      return;
    }
    if (event.changedTouches.length !== 1) {
      mobileGestureStartRef.current = null;
      return;
    }
    const start = mobileGestureStartRef.current;
    mobileGestureStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    if (deltaX <= -40) {
      goToNext();
      return;
    }

    if (deltaX >= 40) {
      goToPrevious();
    }
  }, [currentZoom, goToNext, goToPrevious, isDesktop]);

  const getNextSlideshowIndex = useCallback(() => {
    if (items.length <= 1) return safeIndex;

    if (slideshowMode === 'random') {
      const candidates = items.map((_, index) => index).filter((index) => index !== safeIndex);
      if (candidates.length === 0) return safeIndex;
      return candidates[Math.floor(Math.random() * candidates.length)] ?? safeIndex;
    }

    if (safeIndex >= items.length - 1) {
      if (slideshowMode === 'loop') return 0;
      return -1;
    }

    return safeIndex + 1;
  }, [items, safeIndex, slideshowMode]);

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
      if (nextIndex < 0 || nextIndex === safeIndex) {
        setIsSlideshowPlaying(false);
        setShowControls(true);
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
  }, [currentImageLoaded, getNextSlideshowIndex, isSlideshowPlaying, onIndexChange, open, safeIndex, slideshowEnabled, slideshowIntervalSeconds]);

  const canMarkUpscale = currentItem?.type === 'image'
    && !!imageNaturalSize
    && Math.max(imageNaturalSize.width, imageNaturalSize.height) > 2000;
  const SlideshowModeIcon = slideshowMode === 'stop' ? ArrowRight : slideshowMode === 'loop' ? Repeat : Shuffle;

  if (!open || !currentItem) {
    return null;
  }

  return (
    <>
      <style jsx global>{`
        .engui-yarl-root {
          --yarl__color_backdrop: rgba(0, 0, 0, 1);
          --yarl__slide_image_border: 0px;
          --yarl__slide_title_color: #fff;
        }

        .engui-yarl-root .yarl__toolbar,
        .engui-yarl-root .yarl__navigation_prev,
        .engui-yarl-root .yarl__navigation_next {
          display: none;
        }

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

      <Lightbox
        open={open}
        close={() => {
          stopSlideshow();
          onClose();
        }}
        index={safeIndex}
        slides={slides as never}
        plugins={[Zoom]}
        className="engui-yarl-root"
        carousel={{
          finite: false,
          preload: 2,
          padding: isDesktop ? '16px' : '0px',
          spacing: isDesktop ? '16px' : '0px',
          imageFit: 'contain',
          imageProps: { draggable: false },
        }}
        animation={{
          fade: 180,
          swipe: 0,
          navigation: 0,
          easing: {
            fade: 'ease',
            swipe: 'ease-out',
            navigation: 'ease-out',
          },
        }}
        controller={{
          closeOnBackdropClick: false,
          closeOnPullDown: true,
          closeOnPullUp: false,
          disableSwipeNavigation: true,
          touchAction: 'none',
        }}
        zoom={{
          ref: zoomRef,
          maxZoomPixelRatio: 1,
          doubleClickMaxStops: 1,
          pinchZoomV4: true,
          scrollToZoom: false,
        }}
        labels={{
          Lightbox: 'Fullscreen gallery viewer',
        }}
        on={{
          view: ({ index }) => {
            setCurrentZoom(1);
            if (index !== currentIndex) {
              onIndexChange(index);
            }
          },
          click: () => {
            handleViewerClick();
          },
          zoom: ({ zoom }) => {
            setCurrentZoom(zoom);
          },
        }}
        render={{
          buttonClose: () => null,
          buttonNext: () => null,
          buttonPrev: () => null,
          slide: ({ slide }) => {
            const customSlide = slide as unknown as ViewerSlide;

            if (customSlide.type === 'video') {
              return (
                <video
                  src={customSlide.src}
                  className="max-h-full max-w-full object-contain"
                  controls
                  playsInline
                  preload="metadata"
                />
              );
            }

            if (customSlide.type === 'audio') {
              return (
                <div className="flex h-full w-full items-center justify-center px-6">
                  <audio src={customSlide.src} controls preload="metadata" className="w-full max-w-xl" />
                </div>
              );
            }

            return undefined;
          },
          slideContainer: ({ children }) => (
            <div className="h-full w-full" onTouchStart={handleMobileGestureStart} onTouchEnd={handleMobileGestureEnd}>
              {children}
            </div>
          ),
          controls: () => (
            <>
              {!isDesktop && !currentImageLoaded ? (
                <div
                  key={currentItem.id}
                  className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2"
                  style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
                  aria-label="Loading image"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white border border-white/10">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              ) : null}

              {isDesktop && items.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="absolute inset-y-0 left-0 z-10 hidden w-[20%] min-w-20 bg-transparent sm:block"
                    aria-label="Previous image"
                    onClick={(event) => {
                      event.stopPropagation();
                      goToPrevious();
                    }}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 z-10 hidden w-[20%] min-w-20 bg-transparent sm:block"
                    aria-label="Next image"
                    onClick={(event) => {
                      event.stopPropagation();
                      goToNext();
                    }}
                  />
                </>
              ) : null}

              {favoriteOverlay ? (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                  <div className="gallery-favorite-pulse absolute rounded-full bg-white/10" style={{ width: '33vw', height: '33vw', maxWidth: 220, maxHeight: 220 }} />
                  <div className={`flex items-center justify-center ${favoriteOverlay === 'added' ? 'gallery-heart-pop-added' : 'gallery-heart-pop-removed'}`}>
                    {favoriteOverlay === 'added' ? (
                      <Heart className="text-pink-500 drop-shadow-[0_0_30px_rgba(236,72,153,0.75)]" style={{ width: '33vw', height: '33vw', maxWidth: 220, maxHeight: 220 }} fill="currentColor" strokeWidth={1.5} />
                    ) : (
                      <HeartOff className="text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.45)]" style={{ width: '33vw', height: '33vw', maxWidth: 220, maxHeight: 220 }} strokeWidth={1.75} />
                    )}
                  </div>
                </div>
              ) : null}

              {showControls ? (
                <>
                  {(onOpenInfo || renderHeaderActions) && currentItem?.id ? (
                    <div className="absolute left-3 top-0 z-20 flex items-center gap-2" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
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
                      {onToggleFavorite ? (
                        <Button
                          size="icon"
                          variant="secondary"
                          className={`h-10 w-10 rounded-full border ${currentItem.favorited ? 'bg-pink-500/25 hover:bg-pink-500/35 text-pink-200 border-pink-400/40' : 'bg-black/70 hover:bg-black/85 text-white border-white/10'}`}
                          onClick={() => void handleFavoriteToggle()}
                          aria-label={currentItem.favorited ? 'Unfavorite item' : 'Favorite item'}
                          title={currentItem.favorited ? 'Unfavorite' : 'Favorite'}
                        >
                          <Heart className={`w-5 h-5 ${currentItem.favorited ? 'fill-current' : ''}`} />
                        </Button>
                      ) : null}
                      {renderHeaderActions ? renderHeaderActions(currentItem.id) : null}
                    </div>
                  ) : null}

                  <div className="absolute right-3 top-0 z-20" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-10 w-10 rounded-full bg-black/70 hover:bg-black/85 text-white border border-white/10"
                      onClick={() => {
                        stopSlideshow();
                        onClose();
                      }}
                      aria-label="Close viewer"
                      title="Close"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </>
              ) : null}

              {slideshowEnabled ? (
                <div className="pointer-events-none absolute left-3 z-20" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.2rem)' }}>
                  <div className="rounded px-2 py-1 text-[11px] leading-none text-white/75 bg-black/45 border border-white/10">
                    {isSlideshowPlaying
                      ? (currentImageLoaded ? `loaded, next in ${slideshowCountdownSeconds ?? slideshowIntervalSeconds}s` : 'loading...')
                      : (currentImageLoaded ? 'loaded' : 'loading...')}
                  </div>
                </div>
              ) : null}

              {showControls && slideshowEnabled ? (
                <div className="absolute left-3 z-20 flex flex-col items-start gap-2" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
                  <div className="relative flex flex-col items-center gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 rounded-full bg-black/70 hover:bg-black/85 text-white border border-white/10"
                      onClick={() => setSlideshowMode((value) => value === 'stop' ? 'loop' : value === 'loop' ? 'random' : 'stop')}
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

              {showControls && renderFooterActions ? (
                <div className="absolute right-3 z-20 flex items-center gap-2" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
                  {renderFooterActions(currentItem, { canMarkUpscale })}
                </div>
              ) : null}
            </>
          ),
        }}
      />
    </>
  );
}
