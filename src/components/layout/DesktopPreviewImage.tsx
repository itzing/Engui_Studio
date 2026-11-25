"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  src: string;
  alt: string;
  className: string;
  workspaceId?: string | null;
};
type LoadState = {
  phase: "loading" | "decoding" | "ready" | "error";
  imageUrl?: string;
  percent: number | null;
};

/** A fresh request owns its image element, so another selection can never retain its pixels. */
function ImageRequest({ src, alt, className, workspaceId, onRetry }: Props & { onRetry: () => void }) {
  const [load, setLoad] = useState<LoadState>({ phase: "loading", percent: null });

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | undefined;
    let request: XMLHttpRequest | undefined;
    const fail = () => {
      if (!disposed) setLoad({ phase: "error", percent: null });
    };
    try {
      const url = new URL(src, window.location.href);
      // External images may be displayable without CORS: keep their native loading path.
      if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) {
        setLoad({ phase: "loading", percent: null, imageUrl: src });
      } else {
        request = new XMLHttpRequest();
        request.open("GET", url.href);
        request.responseType = "blob";
        if (url.pathname.startsWith("/api/") && workspaceId) {
          request.setRequestHeader("X-Workspace-Id", workspaceId);
        }
        request.onprogress = (event) => {
          if (disposed) return;
          const percent = event.lengthComputable && event.total > 0
            ? Math.min(100, Math.floor(event.loaded / event.total * 100)) : null;
          setLoad({ phase: "loading", percent });
        };
        request.onload = () => {
          if (disposed) return;
          if (!request || request.status < 200 || request.status >= 300 || !request.response?.size) {
            fail();
            return;
          }
          try {
            objectUrl = URL.createObjectURL(request.response);
            setLoad({ phase: "decoding", percent: null, imageUrl: objectUrl });
          } catch { fail(); }
        };
        request.onerror = fail;
        request.ontimeout = fail;
        request.send();
      }
    } catch { fail(); }
    return () => {
      disposed = true;
      if (request) {
        request.onload = request.onerror = request.ontimeout = request.onprogress = null;
        request.abort();
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, workspaceId]);

  return <>
    {load.imageUrl && <img
      src={load.imageUrl}
      alt={alt}
      className={className}
      style={{ visibility: load.phase === "ready" ? "visible" : "hidden" }}
      aria-hidden={load.phase !== "ready"}
      draggable={false}
      onLoad={() => setLoad(current => ({ ...current, phase: "ready" }))}
      onError={() => setLoad({ phase: "error", percent: null })}
    />}
    {load.phase === "error" ? (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p role="alert">Could not load image.</p>
        <button type="button" className="rounded-md border border-border px-4 py-2 text-foreground hover:bg-muted/40" onClick={onRetry}>Retry</button>
      </div>
    ) : load.phase !== "ready" ? (
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground"
        role="progressbar" aria-label="Loading image" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={load.percent ?? undefined} aria-valuetext={load.phase === "decoding" ? "Preparing image" : undefined}>
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span>{load.phase === "decoding" ? "Preparing image…" : load.percent === null ? "Loading image…" : `Loading image… ${load.percent}%`}</span>
        {load.percent !== null && <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted/40" aria-hidden="true">
          <div className="h-full bg-primary" style={{ width: `${load.percent}%` }} />
        </div>}
      </div>
    ) : null}
  </>;
}

export function DesktopPreviewImage(props: Props) {
  const [attempt, setAttempt] = useState(0);
  return <ImageRequest key={`${props.workspaceId ?? ""}:${props.src}:${attempt}`} {...props} onRetry={() => setAttempt(value => value + 1)} />;
}
