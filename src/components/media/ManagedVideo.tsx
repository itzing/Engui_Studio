'use client';

import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { ownVideoElement } from '@/lib/media/videoLifecycle';
import { createVideoPrefetch } from '@/lib/media/videoPrefetch';

type ManagedVideoProps = Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'src'> & {
  src?: string;
  prefetchUrls?: readonly string[];
  prefetchScope?: string;
  onElement?: (element: HTMLVideoElement | null) => void;
};

/** Stable DOM ownership: parent callback changes must not tear down a playing video. */
export function ManagedVideo({ src, autoPlay, onElement, prefetchUrls, prefetchScope, onError, ...props }: ManagedVideoProps) {
  const latest = useRef({ src, autoPlay, onElement, prefetchUrls, prefetchScope });
  latest.current = { src, autoPlay, onElement, prefetchUrls, prefetchScope };
  const owner = useRef<ReturnType<typeof ownVideoElement> | null>(null);
  const prefetch = useRef<ReturnType<typeof createVideoPrefetch> | null>(null);
  const setElement = useCallback((element: HTMLVideoElement | null) => {
    if (!element) {
      owner.current?.dispose();
      prefetch.current?.dispose();
      prefetch.current = null;
      owner.current = null;
      latest.current.onElement?.(null);
      return;
    }
    owner.current = ownVideoElement(element);
    prefetch.current = createVideoPrefetch(element, owner.current);
    prefetch.current.update(latest.current);
    latest.current.onElement?.(element);
  }, []);

  useLayoutEffect(() => {
    prefetch.current?.update({ src, autoPlay, prefetchUrls, prefetchScope });
  }, [src, autoPlay, prefetchUrls, prefetchScope]);

  return <video {...props} data-media-source={src} ref={setElement} onError={(event) => {
    if (!prefetch.current?.fallback()) onError?.(event);
  }} />;
}
