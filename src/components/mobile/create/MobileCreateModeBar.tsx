'use client';

import Link from 'next/link';
import { Settings2 } from 'lucide-react';
import { PhotoIcon, VideoCameraIcon, MicrophoneIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';
import type { CreateMode } from '@/lib/createDrafts';
import { cn } from '@/lib/utils';

const items: Array<{ id: CreateMode; label: string; icon: React.ElementType }> = [
  { id: 'image', label: 'Image', icon: PhotoIcon },
  { id: 'video', label: 'Video', icon: VideoCameraIcon },
  { id: 'tts', label: 'Audio', icon: MicrophoneIcon },
  { id: 'music', label: 'Music', icon: MusicalNoteIcon },
];

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
        <div className="flex items-center gap-2">
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
                  'inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors',
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
  );
}
