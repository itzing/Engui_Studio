'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart, HeartOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type GalleryFullscreenViewerItem = {
  id: string;
  url: string;
  favorited?: boolean;
};

interface GalleryFullscreenViewerProps {
  open: boolean;
  items: GalleryFullscreenViewerItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onToggleFavorite?: (itemId: string) => Promise<boolean | void>;
}

export function GalleryFullscreenViewer({ open, items, currentIndex, onIndexChange, onClose, onToggleFavorite }: GalleryFullscreenViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const previousOpenRef = useRef(false);
  const singleTapTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; itemId: string | null }>({ time: 0, itemId: null });
  const overlayTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [showCloseButton, setShowCloseButton] = useState(true);
  const [favoriteOverlay, setFavoriteOverlay] = useState<'added' | 'removed' | null>(null);
  const currentItem = useMemo(() => items[currentIndex] || null, [items, currentIndex]);
  const previousItem = useMemo(() => items[currentIndex - 1] || null, [items, currentIndex]);
  const nextItem = useMemo(() => items[currentIndex + 1] || null, [items, currentIndex]);

  const goPrevious = useCallback(() => {
    if (currentIndex <= 0) return;
    onIndexChange(currentIndex - 1);
  }, [currentIndex, onIndexChange]);

  const goNext = useCallback(() => {
    if (currentIndex >= items.length - 1) return;
    onIndexChange(currentIndex + 1);
  }, [currentIndex, items.length, onIndexChange]);

  const runSingleTapAction = useCallback((ratio: number) => {
    if (ratio <= 0.3) {
      goPrevious();
      return;
    }

    if (ratio >= 0.7) {
      goNext();
      return;
    }

    setShowCloseButton((value) => !value);
  }, [goNext, goPrevious]);

  const triggerFavoriteOverlay = useCallback((mode: 'added' | 'removed') => {
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
    }
    setFavoriteOverlay(mode);
    overlayTimeoutRef.current = window.setTimeout(() => {
      setFavoriteOverlay(null);
      overlayTimeoutRef.current = null;
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

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const ratio = rect.width > 0 ? x / rect.width : 0.5;
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
      runSingleTapAction(ratio);
      singleTapTimeoutRef.current = null;
    }, 280);
  }, [currentItem?.id, handleFavoriteToggle, runSingleTapAction]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (open && !previousOpenRef.current) {
      setShowCloseButton(true);
      containerRef.current?.focus();
    }

    if (open) {
      [previousItem?.url, nextItem?.url]
        .filter((url): url is string => typeof url === 'string' && url.length > 0)
        .forEach((url) => {
          const image = new window.Image();
          image.src = url;
        });
    }

    previousOpenRef.current = open;
  }, [nextItem?.url, open, previousItem?.url]);

  useEffect(() => {
    return () => {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
    };
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;

    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

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
  }, [goNext, goPrevious]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
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
  }, [goNext, goPrevious, onClose]);

  if (!open || !currentItem) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-black touch-manipulation"
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen gallery viewer"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {showCloseButton && (
        <div className="absolute top-3 right-3 z-10">
          <Button
            size="icon"
            variant="secondary"
            className="h-10 w-10 rounded-full bg-black/70 hover:bg-black/85 text-white border border-white/10"
            onClick={onClose}
            aria-label="Close viewer"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4" onClick={handleViewerClick} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {favoriteOverlay && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex items-center justify-center animate-in zoom-in-50 fade-in duration-200">
              {favoriteOverlay === 'added' ? (
                <Heart className="text-pink-500 drop-shadow-[0_0_30px_rgba(236,72,153,0.6)]" style={{ width: '33vw', height: '33vw', maxWidth: 220, maxHeight: 220 }} fill="currentColor" strokeWidth={1.5} />
              ) : (
                <HeartOff className="text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.35)]" style={{ width: '33vw', height: '33vw', maxWidth: 220, maxHeight: 220 }} strokeWidth={1.75} />
              )}
            </div>
          </div>
        )}
        <img
          src={currentItem.url}
          alt="Gallery fullscreen preview"
          className="max-w-full max-h-full object-contain select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}
