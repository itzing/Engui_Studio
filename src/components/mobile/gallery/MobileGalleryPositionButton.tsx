'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { Bookmark, BookmarkX, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MobileGalleryPositionButton({
  action, disabled, workspaceId, onActivate, onClearAway,
}: {
  action: 'save' | 'clear' | 'return';
  disabled: boolean;
  workspaceId: string | null;
  onActivate: () => void;
  onClearAway: () => void;
}) {
  const press = useRef<{ pointerId: number; x: number; y: number; timer: number } | null>(null);
  const suppressClick = useRef(false);
  const cancelPress = useCallback(() => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  }, []);
  const cancelGesture = useCallback(() => {
    if (press.current) suppressClick.current = true;
    cancelPress();
  }, [cancelPress]);

  useEffect(() => () => cancelGesture(), [action, disabled, workspaceId, cancelGesture]);

  const label = action === 'save' ? 'Save position' : action === 'clear' ? 'Clear position' : 'Return to position';
  const Icon = action === 'save' ? Bookmark : action === 'clear' ? BookmarkX : Undo2;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`h-11 w-11 shrink-0 select-none touch-manipulation rounded border ${action === 'save'
        ? 'border-border/40 text-muted-foreground'
        : 'border-blue-500/40 bg-blue-500/10 text-blue-400'}`}
      style={{ WebkitTouchCallout: 'none' }}
      aria-label={label}
      aria-description={action === 'return' ? 'Touch and hold to clear the saved position.' : undefined}
      title={action === 'return' ? 'Return to position (hold to clear)' : label}
      disabled={disabled}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return;
        cancelPress();
        suppressClick.current = false;
        if (disabled || action !== 'return') return;
        const timer = window.setTimeout(() => {
          // Consume the release click even though clearing changes this button to Save.
          suppressClick.current = true;
          onClearAway();
        }, 600);
        press.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, timer };
      }}
      onPointerMove={event => {
        const active = press.current;
        if (active?.pointerId === event.pointerId && Math.hypot(event.clientX - active.x, event.clientY - active.y) > 10) {
          cancelGesture();
        }
      }}
      onPointerUp={event => {
        if (press.current?.pointerId === event.pointerId) cancelPress();
      }}
      onPointerCancel={cancelGesture}
      onPointerLeave={cancelGesture}
      onContextMenu={event => event.preventDefault()}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          cancelPress();
          suppressClick.current = false;
        }
      }}
      onClick={event => {
        if (suppressClick.current) {
          event.preventDefault();
          suppressClick.current = false;
          return;
        }
        onActivate();
      }}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </Button>
  );
}
