'use client';

import React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Play, RotateCcw, X } from 'lucide-react';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { GalleryVideoCarousel } from '@/components/workspace/GalleryVideoCarousel';
import { useStudio } from '@/lib/context/StudioContext';

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

export default function MobileGalleryCarouselScreen() {
  const { activeWorkspaceId, workspaces } = useStudio();
  const workspaceId = activeWorkspaceId || workspaces[0]?.id || null;
  const [imagesEnabled, setImagesEnabled] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [scrubSpeedMultiplier, setScrubSpeedMultiplier] = useState(4);
  const [started, setStarted] = useState(false);
  const isLandscape = useLandscapeOrientation(started);

  const speedLabel = useMemo(() => `${speed.toFixed(1)}x`, [speed]);
  const scrubLabel = useMemo(() => `${scrubSpeedMultiplier.toFixed(0)}x`, [scrubSpeedMultiplier]);

  const closePlayer = useCallback(() => {
    setStarted(false);
  }, []);

  return (
    <MobileScreen>
      <MobileHeader
        title="Carousel"
        subtitle="Landscape Gallery playback"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <label className={`flex h-12 items-center justify-between rounded-lg border px-3 text-sm transition-colors ${imagesEnabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-border bg-background/60 text-foreground'}`}>
            <span className="inline-flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Images
            </span>
            <input
              type="checkbox"
              checked={imagesEnabled}
              onChange={(event) => setImagesEnabled(event.currentTarget.checked)}
              className="h-4 w-4 accent-emerald-400"
              aria-label="Include image slots"
            />
          </label>

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
              onValueChange={(value) => setSpeed(value[0] || 1)}
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
              onValueChange={(value) => setScrubSpeedMultiplier(value[0] || 4)}
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
            <>
              <GalleryVideoCarousel
                workspaceId={workspaceId}
                initialImagesEnabled={imagesEnabled}
                initialSpeed={speed}
                initialScrubSpeedMultiplier={scrubSpeedMultiplier}
                showControls={false}
                enableKeyboardControls={false}
              />
              <button
                type="button"
                onClick={closePlayer}
                className="absolute right-[max(env(safe-area-inset-right,0px),0.75rem)] top-[max(env(safe-area-inset-top,0px),0.75rem)] z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/85 backdrop-blur"
                aria-label="Close carousel"
                title="Close carousel"
              >
                <X className="h-5 w-5" />
              </button>
            </>
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
