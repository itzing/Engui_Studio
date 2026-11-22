'use client';

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ManagedVideo, type ManagedVideoProps } from './ManagedVideo';
import { observeVideoRecovery, type VideoPlaybackIssue } from '@/lib/media/videoRecovery';
import { retryVideoPlayback } from '@/lib/media/videoLifecycle';
import { getVideoDiagnosticReport } from '@/lib/media/videoDiagnostics';

/** Gallery/Jobs recovery UI; the underlying owned video stays mounted across retries. */
export function RecoverableVideo(props: ManagedVideoProps) {
  const latest = useRef(props); latest.current = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recovery = useRef<ReturnType<typeof observeVideoRecovery> | null>(null);
  const [issue, setIssue] = useState<VideoPlaybackIssue | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const setElement = useCallback((video: HTMLVideoElement | null) => {
    recovery.current?.dispose(); recovery.current = null;
    videoRef.current = video;
    if (video) {
      recovery.current = observeVideoRecovery(video, setIssue);
      recovery.current.update(latest.current.src, Boolean(latest.current.autoPlay));
    }
    latest.current.onElement?.(video);
  }, []);
  useLayoutEffect(() => {
    recovery.current?.update(props.src, Boolean(props.autoPlay));
    setCopyState('idle'); setCopyFallback(null);
  }, [props.src, props.autoPlay]);

  const retry = () => {
    const video = videoRef.current;
    if (!video) return;
    recovery.current?.retry(); setCopyState('idle'); setCopyFallback(null);
    retryVideoPlayback(video);
  };
  const copyDiagnostics = async () => {
    const text = JSON.stringify(getVideoDiagnosticReport(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      // In insecure/permission-restricted browsers offer ordinary text selection instead.
      setCopyFallback(text);
    }
  };
  return <>
    <ManagedVideo {...props} onElement={setElement} />
    {issue ? (
      <div
        className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 p-6"
        data-testid="video-recovery"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
      >
        <div className="w-full max-w-xs rounded-xl border border-white/20 bg-black/85 p-4 text-center text-white shadow-xl">
          <p role="status" className="mb-3 text-sm">{issue === 'timeout' ? 'Video is not responding.' : 'Video could not start.'}</p>
          <button type="button" onClick={retry} className="min-h-11 rounded-full border border-white/30 px-6 py-2 text-sm font-medium">Retry</button>
          <button type="button" onClick={() => { void copyDiagnostics(); }} className="mt-2 block min-h-11 w-full text-xs text-white/70">
            {copyState === 'copied' ? 'Diagnostics copied' : 'Copy diagnostics'}
          </button>
          {copyFallback ? <textarea
            aria-label="Video diagnostics — select and copy"
            readOnly value={copyFallback}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 h-24 w-full rounded border border-white/20 bg-black p-2 text-xs text-white"
          /> : null}
        </div>
      </div>
    ) : null}
  </>;
}
