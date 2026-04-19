'use client';

import React, { useCallback, useEffect, useState } from 'react';

export function JobCardImageThumbnail({
  thumbnailUrl,
  resultUrl,
  alt,
}: {
  thumbnailUrl?: string;
  resultUrl?: string;
  alt: string;
}) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(thumbnailUrl || resultUrl || null);

  useEffect(() => {
    setResolvedSrc(thumbnailUrl || resultUrl || null);
  }, [thumbnailUrl, resultUrl]);

  const handleError = useCallback(() => {
    setResolvedSrc((current) => {
      if (resultUrl && current && current !== resultUrl) {
        return resultUrl;
      }
      return null;
    });
  }, [resultUrl]);

  if (!resolvedSrc) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20">
        <span className="text-amber-500 text-[10px]" title="Preview missing">?</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className="w-full h-full object-cover"
      loading="lazy"
      decoding="async"
      onError={handleError}
    />
  );
}
