'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Settings2 } from 'lucide-react';
import { PhotoIcon, VideoCameraIcon, MicrophoneIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';
import type { CreateMode } from '@/lib/createDrafts';
import { cn } from '@/lib/utils';

const items: Array<{ id: CreateMode; label: string; icon: React.ElementType }> = [
  { id: 'image', label: 'Image', icon: PhotoIcon },
  { id: 'video', label: 'Video', icon: VideoCameraIcon },
  { id: 'tts', label: 'Audio', icon: MicrophoneIcon },
  { id: 'music', label: 'Music', icon: MusicalNoteIcon },
];

function RunPodBalanceBadge() {
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const refreshBalance = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/runpod/balance', {
        cache: 'no-store',
        signal,
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || typeof data.formattedBalance !== 'string') {
        setBalance(null);
        return;
      }

      setBalance(data.formattedBalance);
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        setBalance(null);
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setHasLoaded(true);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refreshBalance(controller.signal);
    return () => controller.abort();
  }, [refreshBalance]);

  const label = balance ?? (hasLoaded ? '—' : '$…');

  return (
    <button
      type="button"
      onClick={() => void refreshBalance()}
      disabled={isLoading}
      aria-label="Refresh RunPod balance"
      title="Tap to refresh RunPod balance"
      className="inline-flex h-10 min-w-[4.75rem] items-center justify-center rounded-full border border-border/60 bg-background px-3 text-sm font-semibold tabular-nums text-foreground transition-colors hover:bg-accent disabled:cursor-wait disabled:opacity-80"
    >
      {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
      <span>{label}</span>
    </button>
  );
}

export default function MobileCreateModeBar({
  activeMode,
  onModeChange,
}: {
  activeMode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeMode;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onModeChange(item.id)}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors',
                  isActive
                    ? 'border-primary/50 bg-primary/12 text-primary'
                    : 'border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <RunPodBalanceBadge />
          <Link
            href="/m/create/advanced"
            aria-label="Advanced settings"
            title="Advanced settings"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Settings2 className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
