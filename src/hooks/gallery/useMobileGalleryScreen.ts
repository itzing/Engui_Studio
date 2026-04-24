'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '@/lib/context/StudioContext';

export type GallerySemanticFilter = 'all' | 'common' | 'draft' | 'upscale';

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
  bucket?: 'common' | 'draft' | 'upscale';
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
  startIndex: number;
  assets: MobileGalleryAsset[];
};

const PAGE_SIZE = 24;
const TYPE_FILTERS = ['image', 'video', 'audio'] as const;
type MediaFilter = typeof TYPE_FILTERS[number];

export function useMobileGalleryScreen() {
  const { activeWorkspaceId, workspaces } = useStudio();
  const effectiveWorkspaceId = activeWorkspaceId || workspaces[0]?.id || null;
  const [loadedPages, setLoadedPages] = useState<Record<number, LoadedGalleryPage>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<MediaFilter[]>(['image', 'video', 'audio']);
  const [semanticFilter, setSemanticFilter] = useState<GallerySemanticFilter>('common');
  const [showTrashed, setShowTrashed] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAbsoluteIndex, setSelectedAbsoluteIndex] = useState<number | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [restoreTick, setRestoreTick] = useState(0);
  const [restoreAbsoluteIndex, setRestoreAbsoluteIndex] = useState<number | null>(null);
  const loadingPagesRef = useRef<Set<number>>(new Set());
  const hydratedSelectionRef = useRef(false);

  const storageKey = effectiveWorkspaceId ? `engui.gallery.lastViewed.${effectiveWorkspaceId}` : null;

  const loadedAssets = useMemo(() => {
    const entries = Object.values(loadedPages)
      .sort((a, b) => a.startIndex - b.startIndex)
      .flatMap((page) => page.assets.map((asset, index) => ({ asset, absoluteIndex: page.startIndex + index })));

    const seen = new Set<number>();
    return entries.filter((entry) => {
      if (seen.has(entry.absoluteIndex)) return false;
      seen.add(entry.absoluteIndex);
      return true;
    });
  }, [loadedPages]);

  const itemsByAbsoluteIndex = useMemo(() => {
    const next: Record<number, MobileGalleryAsset> = {};
    for (const entry of loadedAssets) {
      next[entry.absoluteIndex] = entry.asset;
    }
    return next;
  }, [loadedAssets]);

  const assetIndexMap = useMemo(() => {
    const next: Record<string, number> = {};
    for (const entry of loadedAssets) {
      next[entry.asset.id] = entry.absoluteIndex;
    }
    return next;
  }, [loadedAssets]);

  const loadedViewerItems = useMemo(
    () => loadedAssets.map((entry) => ({
      id: entry.asset.id,
      url: entry.asset.originalUrl,
      favorited: entry.asset.favorited,
      absoluteIndex: entry.absoluteIndex,
    })),
    [loadedAssets],
  );

  const fetchPage = useCallback(async (page: number, options?: { focusAssetId?: string | null }) => {
    if (!effectiveWorkspaceId) return null;

    const search = new URLSearchParams({
      workspaceId: effectiveWorkspaceId,
      limit: String(PAGE_SIZE),
      sort: 'newest',
      page: String(page),
      includeTrashed: showTrashed ? 'true' : 'false',
      onlyTrashed: showTrashed ? 'true' : 'false',
      favoritesOnly: favoritesOnly ? 'true' : 'false',
      bucket: semanticFilter,
      type: selectedFilters.length === TYPE_FILTERS.length ? 'all' : selectedFilters.join(','),
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
  }, [effectiveWorkspaceId, favoritesOnly, query, selectedFilters, semanticFilter, showTrashed]);

  const mergePage = useCallback((pageNumber: number, data: GalleryPageResponse) => {
    if (!data.pagination) return;
    const startIndex = (pageNumber - 1) * data.pagination.limit;
    setLoadedPages((prev) => ({
      ...prev,
      [pageNumber]: {
        page: pageNumber,
        startIndex,
        assets: data.assets || [],
      },
    }));
    setTotalCount(data.pagination.totalCount);
  }, []);

  const loadPage = useCallback(async (pageNumber: number, options?: { focusAssetId?: string | null }) => {
    if (pageNumber < 1 || loadingPagesRef.current.has(pageNumber)) return null;
    loadingPagesRef.current.add(pageNumber);
    try {
      const data = await fetchPage(pageNumber, options);
      if (data?.pagination) {
        mergePage(data.pagination.page || pageNumber, data);
      }
      return data;
    } finally {
      loadingPagesRef.current.delete(pageNumber);
    }
  }, [fetchPage, mergePage]);

  const hydrateInitialState = useCallback(async () => {
    if (!effectiveWorkspaceId) {
      setLoadedPages({});
      setTotalCount(0);
      setSelectedAssetId(null);
      setSelectedAbsoluteIndex(null);
      hydratedSelectionRef.current = true;
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const savedSelection = !query.trim() && storageKey && typeof window !== 'undefined'
        ? window.localStorage.getItem(storageKey)
        : null;

      setLoadedPages({});
      const focusData = await loadPage(1);
      if (!focusData?.pagination) return;

      const basePage = focusData.pagination.page;
      const pagesToLoad = new Set<number>([basePage]);
      if (basePage * focusData.pagination.limit < focusData.pagination.totalCount) pagesToLoad.add(basePage + 1);

      await Promise.all(
        Array.from(pagesToLoad)
          .filter((page) => page !== focusData.pagination?.page)
          .map((page) => loadPage(page)),
      );

      const firstPageAssetIds = new Set((focusData.assets || []).map((asset) => asset.id));
      const fallbackAssetId = (focusData.assets || [])[0]?.id || null;
      const selectedId = savedSelection && firstPageAssetIds.has(savedSelection) ? savedSelection : fallbackAssetId;
      const selectedIndex = selectedId && typeof assetIndexMap[selectedId] === 'number'
        ? assetIndexMap[selectedId]
        : (focusData.assets || []).length > 0 ? 0 : null;

      setSelectedAssetId(selectedId);
      setSelectedAbsoluteIndex(selectedIndex);
      setRestoreAbsoluteIndex(null);

      hydratedSelectionRef.current = true;
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load gallery');
      setLoadedPages({});
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveWorkspaceId, loadPage, query, storageKey]);

  useEffect(() => {
    hydratedSelectionRef.current = false;
    void hydrateInitialState();
  }, [hydrateInitialState]);

  const toggleMediaFilter = useCallback((filter: 'all' | MediaFilter) => {
    setSelectedFilters((prev) => {
      if (filter === 'all') {
        return [...TYPE_FILTERS];
      }
      if (prev.includes(filter)) {
        const next = prev.filter((entry) => entry !== filter);
        return next.length > 0 ? next : [...TYPE_FILTERS];
      }
      return [...prev, filter];
    });
  }, []);

  const toggleGalleryFavorites = useCallback(() => {
    setFavoritesOnly((prev) => !prev);
  }, []);

  const toggleGalleryTrash = useCallback(() => {
    setShowTrashed((prev) => !prev);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !effectiveWorkspaceId) return;
    const key = `engui.mobile.gallery.semanticFilter.${effectiveWorkspaceId}`;
    const saved = window.localStorage.getItem(key);
    if (saved === 'all' || saved === 'common' || saved === 'draft' || saved === 'upscale') {
      setSemanticFilter(saved);
    }
  }, [effectiveWorkspaceId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !effectiveWorkspaceId) return;
    window.localStorage.setItem(`engui.mobile.gallery.semanticFilter.${effectiveWorkspaceId}`, semanticFilter);
  }, [effectiveWorkspaceId, semanticFilter]);

  useEffect(() => {
    if (!storageKey || !selectedAssetId || typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, selectedAssetId);
  }, [selectedAssetId, storageKey]);

  useEffect(() => {
    const handleGalleryAssetChanged = () => {
      void hydrateInitialState();
    };

    window.addEventListener('galleryAssetChanged', handleGalleryAssetChanged);
    return () => window.removeEventListener('galleryAssetChanged', handleGalleryAssetChanged);
  }, [hydrateInitialState]);

  const ensureRangeLoaded = useCallback(async (startIndex: number, endIndex: number) => {
    if (totalCount <= 0) return;
    const safeStart = Math.max(0, startIndex);
    const safeEnd = Math.min(totalCount - 1, endIndex);
    if (safeEnd < safeStart) return;

    const firstPage = Math.floor(safeStart / PAGE_SIZE) + 1;
    const lastPage = Math.floor(safeEnd / PAGE_SIZE) + 1;
    const missingPages: number[] = [];

    for (let page = firstPage; page <= lastPage; page += 1) {
      if (!loadedPages[page] && !loadingPagesRef.current.has(page)) {
        missingPages.push(page);
      }
    }

    if (missingPages.length === 0) return;

    setIsLoadingMore(true);
    try {
      await Promise.all(missingPages.map((page) => loadPage(page)));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load gallery range');
    } finally {
      setIsLoadingMore(false);
    }
  }, [loadPage, loadedPages, totalCount]);

  const refresh = useCallback(async () => {
    await hydrateInitialState();
  }, [hydrateInitialState]);

  const selectedAsset = useMemo(
    () => (selectedAbsoluteIndex !== null ? itemsByAbsoluteIndex[selectedAbsoluteIndex] || null : null),
    [itemsByAbsoluteIndex, selectedAbsoluteIndex],
  );

  const selectAsset = useCallback((asset: MobileGalleryAsset | null, absoluteIndex?: number | null) => {
    setSelectedAssetId(asset?.id || null);
    setSelectedAbsoluteIndex(typeof absoluteIndex === 'number' ? absoluteIndex : asset ? assetIndexMap[asset.id] ?? null : null);
  }, [assetIndexMap]);

  const openViewer = useCallback((assetId?: string | null) => {
    const resolvedAssetId = assetId || selectedAssetId;
    if (!resolvedAssetId) return;
    const index = loadedViewerItems.findIndex((asset) => asset.id === resolvedAssetId);
    if (index < 0) return;
    setSelectedAssetId(resolvedAssetId);
    setSelectedAbsoluteIndex(loadedViewerItems[index]?.absoluteIndex ?? null);
    setViewerIndex(index);
    setViewerOpen(true);
  }, [loadedViewerItems, selectedAssetId]);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
    if (selectedAbsoluteIndex !== null) {
      setRestoreAbsoluteIndex(selectedAbsoluteIndex);
      setRestoreTick((value) => value + 1);
    }
  }, [selectedAbsoluteIndex]);

  const updateViewerIndex = useCallback((index: number) => {
    const asset = loadedViewerItems[index];
    if (!asset) return;
    setViewerIndex(index);
    setSelectedAssetId(asset.id);
    setSelectedAbsoluteIndex(asset.absoluteIndex);
  }, [loadedViewerItems]);

  const handleTilePress = useCallback((asset: MobileGalleryAsset, absoluteIndex: number) => {
    if (selectedAssetId === asset.id) {
      openViewer(asset.id);
      return;
    }
    setSelectedAssetId(asset.id);
    setSelectedAbsoluteIndex(absoluteIndex);
  }, [openViewer, selectedAssetId]);

  const updateLoadedAsset = useCallback((assetId: string, updater: (asset: MobileGalleryAsset) => MobileGalleryAsset | null) => {
    setLoadedPages((prev) => {
      const next: Record<number, LoadedGalleryPage> = {};
      for (const [pageKey, pageData] of Object.entries(prev)) {
        next[Number(pageKey)] = {
          ...pageData,
          assets: pageData.assets
            .map((asset) => (asset.id === assetId ? updater(asset) : asset))
            .filter((asset): asset is MobileGalleryAsset => asset !== null),
        };
      }
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(async (assetId: string) => {
    const absoluteIndex = assetIndexMap[assetId];
    const asset = typeof absoluteIndex === 'number' ? itemsByAbsoluteIndex[absoluteIndex] : null;
    if (!asset) return false;
    const nextFavorited = !asset.favorited;

    updateLoadedAsset(assetId, (current) => ({ ...current, favorited: nextFavorited }));
    try {
      const response = await fetch(`/api/gallery/assets/${assetId}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorited: nextFavorited }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to update favorite');
      return nextFavorited;
    } catch (fetchError) {
      updateLoadedAsset(assetId, (current) => ({ ...current, favorited: asset.favorited }));
      throw fetchError;
    }
  }, [assetIndexMap, itemsByAbsoluteIndex, updateLoadedAsset]);

  const updateBucket = useCallback(async (assetId: string, bucket: GallerySemanticFilter) => {
    if (bucket !== 'common' && bucket !== 'draft' && bucket !== 'upscale') return false;
    const absoluteIndex = assetIndexMap[assetId];
    const asset = typeof absoluteIndex === 'number' ? itemsByAbsoluteIndex[absoluteIndex] : null;
    if (!asset || asset.bucket === bucket) return false;

    const response = await fetch(`/api/gallery/assets/${assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Failed to update bucket');

    updateLoadedAsset(assetId, (current) => ({ ...current, bucket }));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('galleryAssetChanged', {
        detail: { workspaceId: asset.workspaceId, assetId, reason: 'updated' }
      }));
    }
    return true;
  }, [assetIndexMap, itemsByAbsoluteIndex, updateLoadedAsset]);

  const toggleTrash = useCallback(async (assetId: string) => {
    const absoluteIndex = assetIndexMap[assetId];
    const asset = typeof absoluteIndex === 'number' ? itemsByAbsoluteIndex[absoluteIndex] : null;
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
      updateLoadedAsset(assetId, () => null);
      if (selectedAssetId === assetId) {
        setSelectedAssetId(null);
        setSelectedAbsoluteIndex(null);
      }
    } else {
      updateLoadedAsset(assetId, (current) => ({ ...current, trashed: false }));
    }
  }, [assetIndexMap, itemsByAbsoluteIndex, selectedAssetId, updateLoadedAsset]);

  return {
    totalCount,
    pageSize: PAGE_SIZE,
    itemsByAbsoluteIndex,
    loadedAssets,
    loadedViewerItems,
    isLoading,
    isLoadingMore,
    error,
    query,
    setQuery,
    selectedFilters,
    semanticFilter,
    setSemanticFilter,
    showTrashed,
    favoritesOnly,
    toggleMediaFilter,
    toggleGalleryFavorites,
    toggleGalleryTrash,
    refresh,
    ensureRangeLoaded,
    selectedAssetId,
    selectedAbsoluteIndex,
    selectedAsset,
    selectAsset,
    handleTilePress,
    viewerOpen,
    viewerIndex,
    openViewer,
    closeViewer,
    updateViewerIndex,
    toggleFavorite,
    updateBucket,
    toggleTrash,
    restoreTick,
    restoreAbsoluteIndex,
    workspaceId: effectiveWorkspaceId,
    hydratedSelection: hydratedSelectionRef.current,
  };
}
