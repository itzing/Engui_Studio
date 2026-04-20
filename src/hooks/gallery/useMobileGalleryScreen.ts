'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '@/lib/context/StudioContext';

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
  sourceOutputId?: string | null;
  prompt?: string | null;
  addedToGalleryAt: string;
};

type GalleryPageResponse = {
  success: boolean;
  assets?: MobileGalleryAsset[];
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  focus?: {
    assetId: string;
    found: boolean;
    page: number | null;
    indexOnPage: number | null;
    absoluteIndex: number | null;
  };
  error?: string;
};

const PAGE_SIZE = 24;

export function useMobileGalleryScreen() {
  const { activeWorkspaceId, workspaces } = useStudio();
  const effectiveWorkspaceId = activeWorkspaceId || workspaces[0]?.id || null;
  const [assets, setAssets] = useState<MobileGalleryAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [restoreTick, setRestoreTick] = useState(0);
  const loadingPageRef = useRef<number | null>(null);
  const hydratedSelectionRef = useRef(false);

  const storageKey = effectiveWorkspaceId ? `engui.gallery.lastViewed.${effectiveWorkspaceId}` : null;

  const fetchPage = useCallback(async (page: number, options?: { focusAssetId?: string | null }) => {
    if (!effectiveWorkspaceId) return null;

    const search = new URLSearchParams({
      workspaceId: effectiveWorkspaceId,
      limit: String(PAGE_SIZE),
      sort: 'newest',
      page: String(page),
    });

    if (query.trim()) {
      search.set('q', query.trim());
    }
    if (options?.focusAssetId) {
      search.set('focusAssetId', options.focusAssetId);
    }

    const response = await fetch(`/api/gallery/assets?${search.toString()}`, { cache: 'no-store' });
    const data = await response.json() as GalleryPageResponse;
    if (!response.ok || !data.success || !Array.isArray(data.assets) || !data.pagination) {
      throw new Error(data.error || 'Failed to load gallery');
    }
    return data;
  }, [effectiveWorkspaceId, query]);

  const hydrateInitialPage = useCallback(async () => {
    if (!effectiveWorkspaceId) {
      setAssets([]);
      setSelectedAssetId(null);
      hydratedSelectionRef.current = true;
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const savedSelection = !query.trim() && storageKey && typeof window !== 'undefined'
        ? window.localStorage.getItem(storageKey)
        : null;
      const data = await fetchPage(1, { focusAssetId: savedSelection });
      if (!data) return;

      setAssets(data.assets || []);
      setCurrentPage(data.pagination?.page || 1);
      setHasNextPage(Boolean(data.pagination?.hasNextPage));

      const focusedAssetId = data.focus?.found ? data.focus.assetId : null;
      const firstAssetId = data.assets?.[0]?.id || null;
      const nextSelectedAssetId = focusedAssetId || savedSelection || firstAssetId;
      setSelectedAssetId(nextSelectedAssetId);
      hydratedSelectionRef.current = true;
      if (focusedAssetId) {
        setRestoreTick((value) => value + 1);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load gallery');
      setAssets([]);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveWorkspaceId, fetchPage, query, storageKey]);

  useEffect(() => {
    hydratedSelectionRef.current = false;
    void hydrateInitialPage();
  }, [hydrateInitialPage]);

  useEffect(() => {
    if (!storageKey || !selectedAssetId || typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, selectedAssetId);
  }, [selectedAssetId, storageKey]);

  useEffect(() => {
    const handleGalleryAssetChanged = () => {
      void hydrateInitialPage();
    };

    window.addEventListener('galleryAssetChanged', handleGalleryAssetChanged);
    return () => window.removeEventListener('galleryAssetChanged', handleGalleryAssetChanged);
  }, [hydrateInitialPage]);

  const refresh = useCallback(async () => {
    await hydrateInitialPage();
  }, [hydrateInitialPage]);

  const loadNextPage = useCallback(async () => {
    if (!hasNextPage || isLoading || isLoadingMore) return;
    const nextPage = currentPage + 1;
    if (loadingPageRef.current === nextPage) return;

    loadingPageRef.current = nextPage;
    setIsLoadingMore(true);
    try {
      const data = await fetchPage(nextPage);
      if (!data) return;
      setAssets((prev) => {
        const knownIds = new Set(prev.map((asset) => asset.id));
        const appended = (data.assets || []).filter((asset) => !knownIds.has(asset.id));
        return [...prev, ...appended];
      });
      setCurrentPage(data.pagination?.page || nextPage);
      setHasNextPage(Boolean(data.pagination?.hasNextPage));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load more gallery items');
    } finally {
      setIsLoadingMore(false);
      loadingPageRef.current = null;
    }
  }, [currentPage, fetchPage, hasNextPage, isLoading, isLoadingMore]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) || null,
    [assets, selectedAssetId],
  );

  const selectAsset = useCallback((asset: MobileGalleryAsset | null) => {
    setSelectedAssetId(asset?.id || null);
  }, []);

  const openViewer = useCallback((assetId?: string | null) => {
    const resolvedAssetId = assetId || selectedAssetId;
    if (!resolvedAssetId) return;
    const index = assets.findIndex((asset) => asset.id === resolvedAssetId);
    if (index < 0) return;
    setSelectedAssetId(resolvedAssetId);
    setViewerIndex(index);
    setViewerOpen(true);
  }, [assets, selectedAssetId]);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
    setRestoreTick((value) => value + 1);
  }, []);

  const updateViewerIndex = useCallback((index: number) => {
    const asset = assets[index];
    if (!asset) return;
    setViewerIndex(index);
    setSelectedAssetId(asset.id);
  }, [assets]);

  const handleTilePress = useCallback((asset: MobileGalleryAsset) => {
    if (selectedAssetId === asset.id) {
      openViewer(asset.id);
      return;
    }
    setSelectedAssetId(asset.id);
  }, [openViewer, selectedAssetId]);

  const updateAsset = useCallback((assetId: string, updater: (asset: MobileGalleryAsset) => MobileGalleryAsset | null) => {
    setAssets((prev) => prev.map((asset) => asset.id === assetId ? updater(asset) : asset).filter((asset): asset is MobileGalleryAsset => asset !== null));
  }, []);

  const toggleFavorite = useCallback(async (assetId: string) => {
    const asset = assets.find((entry) => entry.id === assetId);
    if (!asset) return false;
    const nextFavorited = !asset.favorited;

    updateAsset(assetId, (current) => ({ ...current, favorited: nextFavorited }));
    try {
      const response = await fetch(`/api/gallery/assets/${assetId}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorited: nextFavorited }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update favorite');
      }
      return nextFavorited;
    } catch (error) {
      updateAsset(assetId, (current) => ({ ...current, favorited: asset.favorited }));
      throw error;
    }
  }, [assets, updateAsset]);

  const toggleTrash = useCallback(async (assetId: string) => {
    const asset = assets.find((entry) => entry.id === assetId);
    if (!asset) return;
    const nextTrashed = !asset.trashed;

    try {
      const response = await fetch(`/api/gallery/assets/${assetId}/trash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: nextTrashed }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update trash state');
      }

      if (nextTrashed) {
        updateAsset(assetId, () => null);
        if (selectedAssetId === assetId) {
          setSelectedAssetId((prev) => {
            if (prev !== assetId) return prev;
            const remaining = assets.filter((entry) => entry.id !== assetId);
            return remaining[0]?.id || null;
          });
        }
      } else {
        updateAsset(assetId, (current) => ({ ...current, trashed: false }));
      }
    } catch (error) {
      throw error;
    }
  }, [assets, selectedAssetId, updateAsset]);

  return {
    assets,
    isLoading,
    isLoadingMore,
    error,
    query,
    setQuery,
    refresh,
    hasNextPage,
    loadNextPage,
    selectedAssetId,
    selectedAsset,
    selectAsset,
    handleTilePress,
    viewerOpen,
    viewerIndex,
    openViewer,
    closeViewer,
    updateViewerIndex,
    toggleFavorite,
    toggleTrash,
    restoreTick,
    workspaceId: effectiveWorkspaceId,
    hydratedSelection: hydratedSelectionRef.current,
  };
}
