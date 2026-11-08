'use client';

import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { ownVideoElement } from '@/lib/media/videoLifecycle';

type ManagedVideoProps = Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'src'> & {
  src?: string;
  onElement?: (element: HTMLVideoElement | null) => void;
};

/** Stable DOM ownership: parent callback changes must not tear down a playing video. */
export function ManagedVideo({ src, autoPlay, onElement, ...props }: ManagedVideoProps) {
  const latest = useRef({ src, autoPlay, onElement });
  latest.current = { src, autoPlay, onElement };
  const owner = useRef<ReturnType<typeof ownVideoElement> | null>(null);
  const setElement = useCallback((element: HTMLVideoElement | null) => {
    if (!element) {
      owner.current?.dispose();
      owner.current = null;
      latest.current.onElement?.(null);
      return;
    }
    owner.current = ownVideoElement(element);
    owner.current.update(latest.current);
    latest.current.onElement?.(element);
  }, []);

  useLayoutEffect(() => {
    owner.current?.update({ src, autoPlay });
  }, [src, autoPlay]);

  return <video {...props} ref={setElement} />;
}
