'use client';

import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Film, Image as ImageIcon, Play, RotateCcw, X } from 'lucide-react';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { GalleryVideoCarousel } from '@/components/workspace/GalleryVideoCarousel';
import { useStudio } from '@/lib/context/StudioContext';
import {
  getDefaultGalleryCarouselSettings,
  readStoredGalleryCarouselSettings,
  writeStoredGalleryCarouselSettings,
  type GalleryCarouselSettings,
} from '@/lib/galleryCarouselSettings';

function readLandscape() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth > window.innerHeight;
}

function useLandscapeOrientation(active: boolean) {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    if (!active) return;

    const update = () => setIsLandscape(readLandscape());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [active]);

  return isLandscape;
}

const VERTICAL_SWIPE_CLOSE_THRESHOLD_PX = 56;
const VERTICAL_SWIPE_DOMINANCE = 1.25;

export default function MobileGalleryCarouselScreen() {
  const { activeWorkspaceId, workspaces } = useStudio();
  const workspaceId = activeWorkspaceId || workspaces[0]?.id || null;
  const [videosEnabled, setVideosEnabled] = useState(true);
  const [imagesEnabled, setImagesEnabled] = useState(false);
  const [includeLandscape, setIncludeLandscape] = useState(true);
  const [includePortrait, setIncludePortrait] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [scrubSpeedMultiplier, setScrubSpeedMultiplier] = useState(4);
  const [started, setStarted] = useState(false);
  const swipeCloseRef = useRef<{ pointerId: number | null; startX: number; startY: number }>({
    pointerId: null,
    startX: 0,
    startY: 0,
  });
  const isLandscape = useLandscapeOrientation(started);

  const speedLabel = useMemo(() => `${speed.toFixed(1)}x`, [speed]);
  const scrubLabel = useMemo(() => `${scrubSpeedMultiplier.toFixed(0)}x`, [scrubSpeedMultiplier]);

  const persistSettings = useCallback((overrides: Partial<GalleryCarouselSettings> = {}) => {
    writeStoredGalleryCarouselSettings(workspaceId, {
      videosEnabled,
      imagesEnabled,
      includeLandscape,
      includePortrait,
      speed,
      scrubSpeedMultiplier,
      ...overrides,
    });
  }, [imagesEnabled, includeLandscape, includePortrait, scrubSpeedMultiplier, speed, videosEnabled, workspaceId]);

  useEffect(() => {
    const storedSettings = readStoredGalleryCarouselSettings(workspaceId, getDefaultGalleryCarouselSettings());
    setVideosEnabled(storedSettings.videosEnabled);
    setImagesEnabled(storedSettings.imagesEnabled);
    setIncludeLandscape(storedSettings.includeLandscape);
    setIncludePortrait(storedSettings.includePortrait);
    setSpeed(storedSettings.speed);
    setScrubSpeedMultiplier(storedSettings.scrubSpeedMultiplier);
  }, [workspaceId]);

  const handleVideosToggle = useCallback((nextEnabled: boolean) => {
    if (!nextEnabled && !imagesEnabled) return;
    setVideosEnabled(nextEnabled);
    persistSettings({ videosEnabled: nextEnabled });
  }, [imagesEnabled, persistSettings]);
  const handleImagesToggle = useCallback((nextEnabled: boolean) => {
    if (!nextEnabled && !videosEnabled) return;
    setImagesEnabled(nextEnabled);
    persistSettings({ imagesEnabled: nextEnabled });
  }, [persistSettings, videosEnabled]);
  const handleLandscapeToggle = useCallback((nextEnabled: boolean) => {
    setIncludeLandscape(nextEnabled);
    persistSettings({ includeLandscape: nextEnabled });
  }, [persistSettings]);
  const handlePortraitToggle = useCallback((nextEnabled: boolean) => {
    setIncludePortrait(nextEnabled);
    persistSettings({ includePortrait: nextEnabled });
  }, [persistSettings]);
  const handleSpeedChange = useCallback((value: number[]) => {
    const nextSpeed = value[0] || 1;
    setSpeed(nextSpeed);
    persistSettings({ speed: nextSpeed });
  }, [persistSettings]);
  const handleScrubSpeedMultiplierChange = useCallback((value: number[]) => {
    const nextScrubSpeedMultiplier = value[0] || 4;
    setScrubSpeedMultiplier(nextScrubSpeedMultiplier);
    persistSettings({ scrubSpeedMultiplier: nextScrubSpeedMultiplier });
  }, [persistSettings]);

  const closePlayer = useCallback(() => {
    swipeCloseRef.current = { pointerId: null, startX: 0, startY: 0 };
    setStarted(false);
  }, []);

  const handleLandscapePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    swipeCloseRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  }, []);

  const handleLandscapePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const swipe = swipeCloseRef.current;
    if (swipe.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absY >= VERTICAL_SWIPE_CLOSE_THRESHOLD_PX && absY > absX * VERTICAL_SWIPE_DOMINANCE) {
      closePlayer();
    }
  }, [closePlayer]);

  const handleLandscapePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (swipeCloseRef.current.pointerId !== event.pointerId) return;
    swipeCloseRef.current = { pointerId: null, startX: 0, startY: 0 };
  }, []);

  return (
    <MobileScreen>
      <MobileHeader
        title="Carousel"
        subtitle="Landscape Gallery playback"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-2">
            <label className={`flex h-12 items-center justify-between rounded-lg border px-3 text-sm transition-colors ${videosEnabled ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100' : 'border-border bg-background/60 text-foreground'}`}>
              <span className="inline-flex items-center gap-2">
                <Film className="h-4 w-4" />
                Videos
              </span>
              <input
                type="checkbox"
                checked={videosEnabled}
                disabled={videosEnabled && !imagesEnabled}
                onChange={(event) => handleVideosToggle(event.currentTarget.checked)}
                className="h-4 w-4 accent-cyan-400"
                aria-label="Include videos"
              />
            </label>
            <label className={`flex h-12 items-center justify-between rounded-lg border px-3 text-sm transition-colors ${imagesEnabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-border bg-background/60 text-foreground'}`}>
              <span className="inline-flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Images
              </span>
              <input
                type="checkbox"
                checked={imagesEnabled}
                disabled={imagesEnabled && !videosEnabled}
                onChange={(event) => handleImagesToggle(event.currentTarget.checked)}
                className="h-4 w-4 accent-emerald-400"
                aria-label="Include image slots"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className={`flex h-12 items-center justify-between rounded-lg border px-3 text-sm transition-colors ${includeLandscape ? 'border-sky-500/40 bg-sky-500/10 text-sky-100' : 'border-border bg-background/60 text-foreground'}`}>
              <span>Landscape</span>
              <input
                type="checkbox"
                checked={includeLandscape}
                onChange={(event) => handleLandscapeToggle(event.currentTarget.checked)}
                className="h-4 w-4 accent-sky-400"
                aria-label="Include landscape assets"
              />
            </label>
            <label className={`flex h-12 items-center justify-between rounded-lg border px-3 text-sm transition-colors ${includePortrait ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-100' : 'border-border bg-background/60 text-foreground'}`}>
              <span>Portrait</span>
              <input
                type="checkbox"
                checked={includePortrait}
                onChange={(event) => handlePortraitToggle(event.currentTarget.checked)}
                className="h-4 w-4 accent-fuchsia-400"
                aria-label="Include portrait assets"
              />
            </label>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Speed</span>
              <span className="tabular-nums text-foreground">{speedLabel}</span>
            </div>
            <Slider
              min={0.4}
              max={2.4}
              step={0.1}
              value={[speed]}
              onValueChange={handleSpeedChange}
            />
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Scrub</span>
              <span className="tabular-nums text-foreground">{scrubLabel}</span>
            </div>
            <Slider
              min={2}
              max={10}
              step={1}
              value={[scrubSpeedMultiplier]}
              onValueChange={handleScrubSpeedMultiplierChange}
            />
          </div>
        </section>

        <div className="mt-auto pb-2">
          <Button
            type="button"
            className="h-12 w-full rounded-lg"
            onClick={() => setStarted(true)}
            disabled={!workspaceId}
          >
            <Play className="mr-2 h-4 w-4" />
            Start
          </Button>
        </div>
      </div>

      {started ? (
        <div
          className="fixed inset-0 z-[90] bg-black text-white"
          data-testid="mobile-gallery-carousel-overlay"
        >
          {isLandscape ? (
            <div
              className="h-full min-h-[100dvh] w-full"
              data-testid="mobile-gallery-carousel-swipe-surface"
              onPointerDown={handleLandscapePointerDown}
              onPointerMove={handleLandscapePointerMove}
              onPointerUp={handleLandscapePointerEnd}
              onPointerCancel={handleLandscapePointerEnd}
            >
              <GalleryVideoCarousel
                workspaceId={workspaceId}
                initialVideosEnabled={videosEnabled}
                initialImagesEnabled={imagesEnabled}
                initialIncludeLandscape={includeLandscape}
                initialIncludePortrait={includePortrait}
                initialSpeed={speed}
                initialScrubSpeedMultiplier={scrubSpeedMultiplier}
                showControls={false}
                enableKeyboardControls={false}
              />
            </div>
          ) : (
            <div className="flex h-full min-h-[100dvh] w-full items-center justify-center p-6">
              <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white">
                  <RotateCcw className="h-7 w-7" />
                </div>
                <div className="text-2xl font-semibold">Поверните телефон</div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 rounded-lg"
                  onClick={closePlayer}
                >
                  <X className="mr-2 h-4 w-4" />
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </MobileScreen>
  );
}
