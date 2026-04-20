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

type LoadedGalleryPage = {
  page: number;
  assets: MobileGalleryAsset[];
};

const PAGE_SIZE = 24;

export function useMobileGalleryScreen() {
  const { activeWorkspaceId, workspaces } = useStudio();
  const effectiveWorkspaceId = activeWorkspaceId || workspaces[0]?.id || null;
  const [pages, setPages] = useState<Record<number, LoadedGalleryPage>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [lowestPage, setLowestPage] = useState(1);
  const [highestPage, setHighestPage] = useState(1);
  const [restoreTick, setRestoreTick] = useState(0);
  const [restoreIndex, setRestoreIndex] = useState<number | null>(null);
  const loadingPagesRef = useRef<Set<number>>(new Set());
  const hydratedSelectionRef = useRef(false);

  const storageKey = effectiveWorkspaceId ? `engui.gallery.lastViewed.${effectiveWorkspaceId}` : null;

  const sortedPageNumbers = useMemo(() => Object.keys(pages).map(Number).sort((a, b) => a - b), [pages]);
  const assets = useMemo(() => sortedPageNumbers.flatMap((page) => pages[page]?.assets || []), [pages, sortedPageNumbers]);

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

  const mergePage = useCallback((pageNumber: number, pageAssets: MobileGalleryAsset[]) => {
    setPages((prev) => ({
      ...prev,
      [pageNumber]: {
        page: pageNumber,
        assets: pageAssets,
      },
    }));
  }, []);

  const loadSinglePage = useCallback(async (pageNumber: number, options?: { focusAssetId?: string | null }) => {
    if (loadingPagesRef.current.has(pageNumber)) return null;
    loadingPagesRef.current.add(pageNumber);
    try {
      return await fetchPage(pageNumber, options);
    } finally {
      loadingPagesRef.current.delete(pageNumber);
    }
  }, [fetchPage]);

  const hydrateInitialWindow = useCallback(async () => {
    if (!effectiveWorkspaceId) {
      setPages({});
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

      const focusData = await loadSinglePage(1, { focusAssetId: savedSelection });
      if (!focusData) return;

      const focusPage = focusData.pagination?.page || 1;
      const requests: Promise<GalleryPageResponse | null>[] = [];
      const pageWindow = new Set<number>([focusPage]);
      if (focusData.pagination?.hasPrevPage && focusPage > 1) pageWindow.add(focusPage - 1);
      if (focusData.pagination?.hasNextPage) pageWindow.add(focusPage + 1);

      for (const pageNumber of Array.from(pageWindow).sort((a, b) => a - b)) {
        if (pageNumber === focusPage) {
          requests.push(Promise.resolve(focusData));
        } else {
          requests.push(loadSinglePage(pageNumber));
        }
      }

      const loaded = (await Promise.all(requests)).filter((entry): entry is GalleryPageResponse => !!entry);
      const nextPages: Record<number, LoadedGalleryPage> = {};
      let localHasPrevPage = Boolean(focusData.pagination?.hasPrevPage);
      let localHasNextPage = Boolean(focusData.pagination?.hasNextPage);
      let localLowestPage = focusPage;
      let localHighestPage = focusPage;

      for (const result of loaded) {
        const pageNumber = result.pagination?.page || focusPage;
        nextPages[pageNumber] = {
          page: pageNumber,
          assets: result.assets || [],
        };
        localHasPrevPage = localHasPrevPage || Boolean(result.pagination?.hasPrevPage);
        localHasNextPage = localHasNextPage || Boolean(result.pagination?.hasNextPage);
        localLowestPage = Math.min(localLowestPage, pageNumber);
        localHighestPage = Math.max(localHighestPage, pageNumber);
      }

      setPages(nextPages);
      setLowestPage(localLowestPage);
      setHighestPage(localHighestPage);
      setHasPrevPage(localHasPrevPage && localLowestPage > 1);
      setHasNextPage(localHasNextPage);

      const focusedAssetId = focusData.focus?.found ? focusData.focus.assetId : null;
      const firstPageAssets = nextPages[localLowestPage]?.assets || [];
      const firstAssetId = firstPageAssets[0]?.id || null;
      const nextSelectedAssetId = focusedAssetId || savedSelection || firstAssetId;
      setSelectedAssetId(nextSelectedAssetId);
      hydratedSelectionRef.current = true;

      if (focusedAssetId) {
        const assembledAssets = Object.keys(nextPages).map(Number).sort((a, b) => a - b).flatMap((page) => nextPages[page].assets);
        const focusedIndex = assembledAssets.findIndex((asset) => asset.id === focusedAssetId);
        setRestoreIndex(focusedIndex >= 0 ? focusedIndex : null);
        setRestoreTick((value) => value + 1);
      } else {
        setRestoreIndex(null);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load gallery');
      setPages({});
    } finally {
      setIsLoading(false);
    }
  }, [effectiveWorkspaceId, loadSinglePage, query, storageKey]);

  useEffect(() => {
    hydratedSelectionRef.current = false;
    void hydrateInitialWindow();
  }, [hydrateInitialWindow]);

  useEffect(() => {
    if (!storageKey || !selectedAssetId || typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, selectedAssetId);
  }, [selectedAssetId, storageKey]);

  useEffect(() => {
    const handleGalleryAssetChanged = () => {
      void hydrateInitialWindow();
    };

    window.addEventListener('galleryAssetChanged', handleGalleryAssetChanged);
    return () => window.removeEventListener('galleryAssetChanged', handleGalleryAssetChanged);
  }, [hydrateInitialWindow]);

  const refresh = useCallback(async () => {
    await hydrateInitialWindow();
  }, [hydrateInitialWindow]);

  const loadNextPage = useCallback(async () => {
    if (!hasNextPage || isLoading || isLoadingMore) return;
    const nextPage = highestPage + 1;
    if (loadingPagesRef.current.has(nextPage)) return;

    setIsLoadingMore(true);
    try {
      const data = await loadSinglePage(nextPage);
      if (!data) return;
      const resolvedPage = data.pagination?.page || nextPage;
      mergePage(resolvedPage, data.assets || []);
      setHighestPage((prev) => Math.max(prev, resolvedPage));
      setHasNextPage(Boolean(data.pagination?.hasNextPage));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load more gallery items');
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasNextPage, highestPage, isLoading, isLoadingMore, loadSinglePage, mergePage]);

  const loadPreviousPage = useCallback(async () => {
    if (!hasPrevPage || isLoading || isLoadingMore) return;
    const nextPage = lowestPage - 1;
    if (nextPage < 1 || loadingPagesRef.current.has(nextPage)) return;

    setIsLoadingMore(true);
    try {
      const data = await loadSinglePage(nextPage);
      if (!data) return;
      const resolvedPage = data.pagination?.page || nextPage;
      mergePage(resolvedPage, data.assets || []);
      setLowestPage((prev) => Math.min(prev, resolvedPage));
      setHasPrevPage(Boolean(data.pagination?.hasPrevPage) && resolvedPage > 1);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load previous gallery items');
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasPrevPage, isLoading, isLoadingMore, loadSinglePage, lowestPage, mergePage]);

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
    setRestoreIndex(assets.findIndex((asset) => asset.id === selectedAssetId));
    setRestoreTick((value) => value + 1);
  }, [assets, selectedAssetId]);

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
    setPages((prev) => {
      const next: Record<number, LoadedGalleryPage> = {};
      for (const [pageKey, pageData] of Object.entries(prev)) {
        next[Number(pageKey)] = {
          ...pageData,
          assets: pageData.assets.map((asset) => asset.id === assetId ? updater(asset) : asset).filter((asset): asset is MobileGalleryAsset => asset !== null),
        };
      }
      return next;
    });
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
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to update favorite');
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

    const response = await fetch(`/api/gallery/assets/${assetId}/trash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: nextTrashed }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Failed to update trash state');

    if (nextTrashed) {
      updateAsset(assetId, () => null);
      if (selectedAssetId === assetId) {
        const remaining = assets.filter((entry) => entry.id !== assetId);
        setSelectedAssetId(remaining[0]?.id || null);
      }
    } else {
      updateAsset(assetId, (current) => ({ ...current, trashed: false }));
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
    hasPrevPage,
    loadNextPage,
    loadPreviousPage,
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
    restoreIndex,
    workspaceId: effectiveWorkspaceId,
    hydratedSelection: hydratedSelectionRef.current,
  };
}
