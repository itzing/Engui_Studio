'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStudio } from '@/lib/context/StudioContext';
import { buildGalleryPreviewItem } from '@/lib/mobile/mobilePreview';

export type MobileGalleryAsset = {
  id: string;
  workspaceId: string;
  type: 'image' | 'video' | 'audio';
  originalUrl: string;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  favorited: boolean;
  trashed: boolean;
  userTags?: string[];
  autoTags?: string[];
  sourceJobId?: string | null;
  prompt?: string | null;
  addedToGalleryAt: string;
};

export function useMobileGalleryScreen() {
  const { activeWorkspaceId, workspaces } = useStudio();
  const effectiveWorkspaceId = activeWorkspaceId || workspaces[0]?.id || null;
  const [assets, setAssets] = useState<MobileGalleryAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const fetchAssets = useCallback(async () => {
    if (!effectiveWorkspaceId) {
      setAssets([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const search = new URLSearchParams({
        workspaceId: effectiveWorkspaceId,
        limit: '60',
        sort: 'newest',
      });
      if (query.trim()) {
        search.set('q', query.trim());
      }
      const response = await fetch(`/api/gallery/assets?${search.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.assets)) {
        throw new Error(data.error || 'Failed to load gallery');
      }
      setAssets(data.assets);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load gallery');
      setAssets([]);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveWorkspaceId, query]);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  const groupedAssets = useMemo(() => ({
    images: assets.filter((asset) => asset.type === 'image'),
    videos: assets.filter((asset) => asset.type === 'video'),
    audio: assets.filter((asset) => asset.type === 'audio'),
  }), [assets]);

  return {
    assets,
    groupedAssets,
    isLoading,
    error,
    query,
    setQuery,
    refresh: fetchAssets,
    workspaceId: effectiveWorkspaceId,
    buildPreview: buildGalleryPreviewItem,
  };
}
