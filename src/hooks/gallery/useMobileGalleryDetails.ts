'use client';

import { useCallback, useEffect, useState } from 'react';

export type MobileGalleryDetail = {
  id: string;
  workspaceId: string;
  type: 'image' | 'video' | 'audio';
  originalUrl: string;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  favorited: boolean;
  trashed: boolean;
  userTags: string[];
  autoTags: string[];
  sourceJobId?: string | null;
  sourceOutputId?: string | null;
  derivativeStatus?: string;
  enrichmentStatus?: string;
  prompt?: string | null;
  modelId?: string | null;
  addedToGalleryAt: string;
  updatedAt?: string;
};

export function useMobileGalleryDetails(assetId: string) {
  const [asset, setAsset] = useState<MobileGalleryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAsset = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`/api/gallery/assets/${assetId}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success || !data.asset) {
        throw new Error(data.error || 'Failed to load gallery asset');
      }
      setAsset(data.asset);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load gallery asset');
      setAsset(null);
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    setIsLoading(true);
    void fetchAsset();
  }, [fetchAsset]);

  return {
    asset,
    isLoading,
    error,
    refresh: fetchAsset,
    setAsset,
  };
}
