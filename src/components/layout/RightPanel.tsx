'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useStudio, Job, Workspace } from '@/lib/context/StudioContext';
import { getModelById } from '@/lib/models/modelConfig';
import { JobDetailsDialog } from '@/components/workspace/JobDetailsDialog';
import { GalleryAssetDialog } from '@/components/workspace/GalleryAssetDialog';
import { GalleryFullscreenViewer } from '@/components/workspace/GalleryFullscreenViewer';
import { JobCardImageThumbnail } from '@/components/layout/JobCardImageThumbnail';
import { Search, RefreshCw, Info, ChevronDown, Plus, Trash2, FolderPlus, Check, X, Image as ImageIcon, Video, AudioLines, Heart, PenSquare, Sparkles } from 'lucide-react';
import type { GalleryViewerBucket } from '@/components/workspace/GalleryFullscreenViewer';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PropertiesPanel } from '@/components/video-editor/PropertiesPanel';
import { VirtuosoGrid, VirtuosoGridHandle } from 'react-virtuoso';

type GallerySemanticFilter = 'all' | 'common' | 'draft' | 'upscale';

type GalleryAsset = {
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
    derivativeStatus?: string;
    enrichmentStatus?: string;
    prompt?: string | null;
    addedToGalleryAt: string;
    updatedAt?: string;
};

type GalleryPageData = {
    page: number;
    assets: GalleryAsset[];
    imagesHydrated: boolean;
};

type GalleryFetchResult = {
    assets: GalleryAsset[];
    page: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    totalCount: number;
    focus?: {
        assetId: string;
        found: boolean;
        page: number | null;
        indexOnPage: number | null;
        absoluteIndex: number | null;
    };
};

type GalleryGridItem = {
    asset: GalleryAsset;
    pageNumber: number;
    imagesHydrated: boolean;
};

const TYPE_FILTERS = ['image', 'video', 'audio'] as const;
type MediaFilter = typeof TYPE_FILTERS[number];
const galleryFilter = (asset: GalleryAsset, filters: MediaFilter[]) => filters.includes(asset.type);

function GalleryTileStatusBadges({ favorited, bucket, mobile = false }: { favorited: boolean; bucket?: 'common' | 'draft' | 'upscale'; mobile?: boolean }) {
    const hasBucketBadge = bucket === 'draft' || bucket === 'upscale';
    if (!favorited && !hasBucketBadge) return null;

    const sizeClass = mobile ? 'h-[18px] w-[18px]' : 'h-5 w-5';
    const iconClass = mobile ? 'h-[11px] w-[11px]' : 'h-3 w-3';

    return (
        <div className="pointer-events-none absolute bottom-1.5 left-1.5 z-10 flex flex-col gap-1">
            {favorited ? (
                <div className={`inline-flex ${sizeClass} items-center justify-center rounded-md border border-white/10 bg-black/55 text-rose-400`}>
                    <Heart className={`${iconClass} fill-current`} />
                </div>
            ) : null}
            {bucket === 'draft' ? (
                <div className={`inline-flex ${sizeClass} items-center justify-center rounded-md border border-white/10 bg-black/55 text-amber-400`}>
                    <PenSquare className={iconClass} />
                </div>
            ) : null}
            {bucket === 'upscale' ? (
                <div className={`inline-flex ${sizeClass} items-center justify-center rounded-md border border-white/10 bg-black/55 text-violet-400`}>
                    <Sparkles className={iconClass} />
                </div>
            ) : null}
        </div>
    );
}

export default function RightPanel({ mobile = false, mobileMode }: { mobile?: boolean; mobileMode?: 'jobs' | 'gallery' }) {
    const { jobs, workspaces, activeWorkspaceId, selectWorkspace, createWorkspace, deleteJob, cancelJob, clearFinishedJobs, reuseJobInput, addJob } = useStudio();
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [selectedGalleryAsset, setSelectedGalleryAsset] = useState<GalleryAsset | null>(null);
    const [gallerySelectedAssetId, setGallerySelectedAssetId] = useState<string | null>(null);
    const [mobileSelectedJobId, setMobileSelectedJobId] = useState<string | null>(null);
    const [mobileSelectedGalleryAssetId, setMobileSelectedGalleryAssetId] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [galleryDetailsOpen, setGalleryDetailsOpen] = useState(false);
    const [galleryViewerOpen, setGalleryViewerOpen] = useState(false);
    const [galleryViewerIndex, setGalleryViewerIndex] = useState(0);
    const [galleryViewerItems, setGalleryViewerItems] = useState<GalleryAsset[]>([]);
    const [galleryViewerPage, setGalleryViewerPage] = useState(1);
    const [galleryViewerHasNextPage, setGalleryViewerHasNextPage] = useState(false);
    const [isLoadingMoreViewerItems, setIsLoadingMoreViewerItems] = useState(false);
    const [panelMode, setPanelMode] = useState<'jobs' | 'gallery'>('jobs');
    const [selectedFilters, setSelectedFilters] = useState<MediaFilter[]>(['image', 'video', 'audio']);
    const [semanticFilter, setSemanticFilter] = useState<GallerySemanticFilter>('common');
    const [isMounted, setIsMounted] = useState(false);
    const [loadedJobs, setLoadedJobs] = useState<Job[]>([]);
    const [galleryPages, setGalleryPages] = useState<Record<number, GalleryPageData>>({});
    const [showTrashed, setShowTrashed] = useState(false);
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [gallerySearchQuery, setGallerySearchQuery] = useState('');
    const [debouncedGallerySearchQuery, setDebouncedGallerySearchQuery] = useState('');
    const [gallerySort, setGallerySort] = useState<'newest' | 'oldest' | 'favorites'>('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [galleryAnchorPage, setGalleryAnchorPage] = useState(1);
    const [galleryLowestPage, setGalleryLowestPage] = useState(1);
    const [galleryHighestPage, setGalleryHighestPage] = useState(1);
    const [galleryHasNextPage, setGalleryHasNextPage] = useState(false);
    const [galleryHasPrevPage, setGalleryHasPrevPage] = useState(false);
    const [isLoadingJobs, setIsLoadingJobs] = useState(false);
    const [isLoadingGallery, setIsLoadingGallery] = useState(false);
    const [isLoadingPreviousGallery, setIsLoadingPreviousGallery] = useState(false);
    const [isBackfillingGallery, setIsBackfillingGallery] = useState(false);
    const [isBackfillingDerivatives, setIsBackfillingDerivatives] = useState(false);
    const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isLoadingMoreGallery, setIsLoadingMoreGallery] = useState(false);
    const [galleryScrollerEl, setGalleryScrollerEl] = useState<HTMLElement | null>(null);
    const pageSize = 12;
    const galleryScrollContainerRef = useRef<HTMLElement | null>(null);
    const galleryGridRef = useRef<VirtuosoGridHandle | null>(null);
    const panelScrollPositionsRef = useRef<{ jobs: number; gallery: number }>({ jobs: 0, gallery: 0 });
    const galleryTopSentinelRef = useRef<HTMLDivElement>(null);
    const galleryBottomSentinelRef = useRef<HTMLDivElement>(null);
    const galleryPageRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const galleryFocusRestoreRef = useRef<{ assetId: string; page: number; indexOnPage: number } | null>(null);
    const galleryRestoreInProgressRef = useRef(false);
    const galleryPostRestoreAwaitDirectionRef = useRef(false);
    const galleryScrollAnchorRef = useRef<{ assetId: string; top: number } | null>(null);
    const galleryScrollDirectionRef = useRef<'up' | 'down' | null>(null);
    const lastViewedGalleryAssetIdRef = useRef<string | null>(null);

    // Workspace Creation State
    const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const restoredMobileViewerRef = useRef(false);
    const mobileViewerPersistenceReadyRef = useRef(false);
    const mobileTouchHandledRef = useRef<{ kind: 'job' | 'gallery'; id: string } | null>(null);
    const mobileGalleryTouchRef = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);
    const galleryContainerTouchRef = useRef<{ startY: number; direction: 'up' | 'down' | null } | null>(null);
    const galleryRestoreHydratedRef = useRef(false);
    const previousPanelModeRef = useRef<'jobs' | 'gallery'>('jobs');
    const centerGallerySelectionOnEntryRef = useRef(false);
    const galleryEntryRestoreRequestRef = useRef<string | null>(null);

    const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
    const { showToast } = useToast();
    const sortedGalleryPageNumbers = useMemo(
        () => Object.keys(galleryPages).map(Number).sort((a, b) => a - b),
        [galleryPages]
    );
    const galleryGridItems = useMemo<GalleryGridItem[]>(
        () => sortedGalleryPageNumbers.flatMap((pageNumber) => {
            const pageData = galleryPages[pageNumber];
            if (!pageData) return [];
            return pageData.assets.map((asset) => ({
                asset,
                pageNumber,
                imagesHydrated: pageData.imagesHydrated,
            }));
        }),
        [galleryPages, sortedGalleryPageNumbers]
    );
    const filteredGalleryAssets = useMemo(
        () => galleryGridItems.map((item) => item.asset),
        [galleryGridItems]
    );
    const scrollGalleryAssetIntoView = useCallback((assetId: string, align: 'start' | 'center' = 'center') => {
        const targetIndex = filteredGalleryAssets.findIndex(asset => asset.id === assetId);
        if (targetIndex === -1) return false;

        window.requestAnimationFrame(() => {
            galleryGridRef.current?.scrollToIndex({
                index: targetIndex,
                align,
                behavior: 'auto',
            });
        });
        return true;
    }, [filteredGalleryAssets]);
    const resolveGalleryAssetById = useCallback((assetId: string | null | undefined) => {
        if (!assetId) return null;
        return filteredGalleryAssets.find(item => item.id === assetId)
            || galleryViewerItems.find(item => item.id === assetId)
            || (selectedGalleryAsset?.id === assetId ? selectedGalleryAsset : null)
            || null;
    }, [filteredGalleryAssets, galleryViewerItems, selectedGalleryAsset]);
    const emitGallerySelection = useCallback((asset: GalleryAsset | null) => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent('rightPanelGallerySelect', {
            detail: asset ? { id: asset.id } : null,
        }));
    }, []);
    const applyGallerySelection = useCallback((asset: GalleryAsset | null) => {
        const assetId = asset?.id || null;
        setGallerySelectedAssetId(assetId);
        setSelectedGalleryAsset(asset);
        setMobileSelectedGalleryAssetId(assetId);
        if (assetId) {
            lastViewedGalleryAssetIdRef.current = assetId;
        }
        emitGallerySelection(asset);
    }, [emitGallerySelection]);
    useEffect(() => {
        if (!gallerySelectedAssetId) return;
        const nextSelectedAsset = resolveGalleryAssetById(gallerySelectedAssetId);
        if (!nextSelectedAsset) return;
        if (selectedGalleryAsset !== nextSelectedAsset) {
            setSelectedGalleryAsset(nextSelectedAsset);
        }
        if (mobileSelectedGalleryAssetId !== gallerySelectedAssetId) {
            setMobileSelectedGalleryAssetId(gallerySelectedAssetId);
        }
    }, [gallerySelectedAssetId, mobileSelectedGalleryAssetId, resolveGalleryAssetById, selectedGalleryAsset]);
    const updateGalleryPages = useCallback((updater: (asset: GalleryAsset) => GalleryAsset | null) => {
        setGalleryPages(prev => {
            const next: Record<number, GalleryPageData> = {};
            for (const [pageKey, pageData] of Object.entries(prev)) {
                next[Number(pageKey)] = {
                    ...pageData,
                    assets: pageData.assets.map((asset) => updater(asset)).filter((asset): asset is GalleryAsset => asset !== null),
                };
            }
            return next;
        });
    }, []);

    const handleGalleryScrollerRef = useCallback((node: HTMLElement | null) => {
        galleryScrollContainerRef.current = node;
        setGalleryScrollerEl(prev => prev === node ? prev : node);
    }, []);

    const jobMatchesFilter = useCallback((job: Job, filters: MediaFilter[]) => {
        const jobType = (job.type || '').toLowerCase();
        if (filters.includes('audio') && ['audio', 'tts', 'music'].includes(jobType)) return true;
        return filters.includes(jobType as MediaFilter);
    }, []);

    const mergeUniqueJobs = useCallback((items: Job[]) => {
        const byId = new Map<string, Job>();
        for (const item of items) {
            const prev = byId.get(item.id);
            byId.set(item.id, prev ? { ...prev, ...item } : item);
        }
        return Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
    }, []);

    useEffect(() => {
        setIsMounted(true);
        if (typeof window === 'undefined') return;

        const panelModeKey = mobile ? 'engui.mobile.library.panelMode' : 'engui.rightPanel.mode';
        const savedPanelMode = window.localStorage.getItem(panelModeKey);
        if (!mobileMode && savedPanelMode === 'jobs') {
            setPanelMode(savedPanelMode);
        }

        if (mobile) {
            const savedFilter = window.localStorage.getItem('engui.mobile.library.filter');
            if (savedFilter) {
                const parsed = savedFilter === 'all'
                    ? [...TYPE_FILTERS]
                    : savedFilter.split(',').map(entry => entry.trim()).filter((entry): entry is MediaFilter => TYPE_FILTERS.includes(entry as MediaFilter));
                if (parsed.length > 0) {
                    setSelectedFilters(Array.from(new Set(parsed)));
                }
            }

            const savedSearch = window.localStorage.getItem('engui.mobile.library.search');
            if (typeof savedSearch === 'string') {
                setGallerySearchQuery(savedSearch);
            }

            const savedSort = window.localStorage.getItem('engui.mobile.library.sort');
            if (savedSort === 'newest' || savedSort === 'oldest' || savedSort === 'favorites') {
                setGallerySort(savedSort);
            }

            const savedSemanticFilter = window.localStorage.getItem('engui.mobile.library.semanticFilter');
            if (savedSemanticFilter === 'all' || savedSemanticFilter === 'common' || savedSemanticFilter === 'draft' || savedSemanticFilter === 'upscale') {
                setSemanticFilter(savedSemanticFilter);
            }
        } else {
            const savedSemanticFilter = window.localStorage.getItem('engui.rightPanel.gallery.semanticFilter');
            if (savedSemanticFilter === 'all' || savedSemanticFilter === 'common' || savedSemanticFilter === 'draft' || savedSemanticFilter === 'upscale') {
                setSemanticFilter(savedSemanticFilter);
            }
        }
    }, [mobile, mobileMode]);

    useEffect(() => {
        if (!mobile || !mobileMode) return;
        setPanelMode(mobileMode);
    }, [mobile, mobileMode]);

    useEffect(() => {
        const previousMode = previousPanelModeRef.current;
        previousPanelModeRef.current = panelMode;
        if (previousMode !== 'gallery' && panelMode === 'gallery') {
            centerGallerySelectionOnEntryRef.current = true;
            galleryEntryRestoreRequestRef.current = null;
        }
    }, [panelMode]);

    useEffect(() => {
        if (!isMounted || typeof window === 'undefined') return;
        if (!mobileMode) {
            window.localStorage.setItem(mobile ? 'engui.mobile.library.panelMode' : 'engui.rightPanel.mode', panelMode);
        }
        if (mobile) {
            window.localStorage.setItem('engui.mobile.library.filter', selectedFilters.length === TYPE_FILTERS.length ? 'all' : selectedFilters.join(','));
            window.localStorage.setItem('engui.mobile.library.search', gallerySearchQuery);
            window.localStorage.setItem('engui.mobile.library.sort', gallerySort);
            window.localStorage.setItem('engui.mobile.library.semanticFilter', semanticFilter);
        } else {
            window.localStorage.setItem('engui.rightPanel.gallery.semanticFilter', semanticFilter);
        }
        window.dispatchEvent(new CustomEvent('rightPanelModeChanged', {
            detail: panelMode,
        }));
    }, [gallerySearchQuery, gallerySort, isMounted, mobile, mobileMode, panelMode, selectedFilters, semanticFilter]);

    useEffect(() => {
        const container = galleryScrollerEl || galleryScrollContainerRef.current;
        if (!container) return;

        const handleScrollPositionSave = () => {
            panelScrollPositionsRef.current[panelMode] = container.scrollTop;
        };

        handleScrollPositionSave();
        container.addEventListener('scroll', handleScrollPositionSave, { passive: true });
        return () => container.removeEventListener('scroll', handleScrollPositionSave);
    }, [galleryScrollerEl, panelMode]);

    useEffect(() => {
        const container = galleryScrollerEl || galleryScrollContainerRef.current;
        if (!container) return;
        window.requestAnimationFrame(() => {
            const node = galleryScrollContainerRef.current;
            if (!node) return;
            node.scrollTop = panelScrollPositionsRef.current[panelMode] || 0;
        });
    }, [galleryScrollerEl, panelMode, isMounted]);

    useEffect(() => {
        if (isCreatingWorkspace && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isCreatingWorkspace]);

    useEffect(() => {
        const handleOpenPreviewInfo = (event: Event) => {
            const custom = event as CustomEvent<{ id?: string; kind?: 'gallery' | 'job' }>;
            const detail = custom.detail;
            if (!detail?.id || !detail?.kind) return;

            if (detail.kind === 'gallery') {
                const asset = filteredGalleryAssets.find(item => item.id === detail.id);
                if (!asset) return;
                applyGallerySelection(asset);
                setGalleryDetailsOpen(true);
                return;
            }

            const job = loadedJobs.find(item => item.id === detail.id) || jobs.find(item => item.id === detail.id) || null;
            if (!job) return;
            setSelectedJob(job);
            setDetailsOpen(true);
        };

        window.addEventListener('openPreviewInfo', handleOpenPreviewInfo as EventListener);
        return () => window.removeEventListener('openPreviewInfo', handleOpenPreviewInfo as EventListener);
    }, [applyGallerySelection, filteredGalleryAssets, jobs, loadedJobs]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setDebouncedGallerySearchQuery(gallerySearchQuery);
        }, 250);

        return () => window.clearTimeout(timeout);
    }, [gallerySearchQuery]);

    const getApiType = (filters: MediaFilter[]) => {
        if (filters.length === TYPE_FILTERS.length) return '';
        return filters.join(',');
    };

    const fetchJobsPage = useCallback(async (page: number, append = false) => {
        if (!activeWorkspaceId) return;

        if (append) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingJobs(true);
        }

        try {
            const params = new URLSearchParams({
                userId: 'user-with-settings',
                workspaceId: activeWorkspaceId,
                page: String(page),
                limit: String(pageSize),
            });

            const apiType = getApiType(selectedFilters);
            if (apiType) {
                params.set('type', apiType);
            }

            const response = await fetch(`/api/jobs?${params.toString()}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch jobs');
            }

            const nextJobs: Job[] = data.jobs || [];
            setLoadedJobs(prev => mergeUniqueJobs(append ? [...prev, ...nextJobs] : nextJobs));
            setCurrentPage(page);
            setHasNextPage(!!data.pagination?.hasNextPage);
        } catch (error) {
            console.error('Failed to fetch jobs page:', error);
            if (!append) {
                setLoadedJobs([]);
            }
        } finally {
            setIsLoadingJobs(false);
            setIsLoadingMore(false);
        }
    }, [activeWorkspaceId, mergeUniqueJobs, selectedFilters]);

    const fetchGalleryAssetsPage = useCallback(async (page: number, options?: { focusAssetId?: string | null }): Promise<GalleryFetchResult | null> => {
        if (!activeWorkspaceId) return null;

        const params = new URLSearchParams({
            workspaceId: activeWorkspaceId,
            page: String(page),
            limit: String(pageSize),
            includeTrashed: showTrashed ? 'true' : 'false',
            onlyTrashed: showTrashed ? 'true' : 'false',
            type: getApiType(selectedFilters) || 'all',
            favoritesOnly: favoritesOnly ? 'true' : 'false',
            bucket: semanticFilter,
            q: debouncedGallerySearchQuery,
            sort: gallerySort,
        });

        if (options?.focusAssetId) {
            params.set('focusAssetId', options.focusAssetId);
        }

        const response = await fetch(`/api/gallery/assets?${params.toString()}`, {
            cache: 'no-store',
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch gallery assets');
        }

        return {
            assets: (data.assets || []) as GalleryAsset[],
            page: Number(data.pagination?.page || page),
            hasNextPage: !!data.pagination?.hasNextPage,
            hasPrevPage: !!data.pagination?.hasPrevPage,
            totalCount: Number(data.pagination?.totalCount || 0),
            focus: data.focus,
        };
    }, [activeWorkspaceId, debouncedGallerySearchQuery, favoritesOnly, gallerySort, selectedFilters, semanticFilter, showTrashed]);

    const applyGalleryImageRetention = useCallback((pages: Record<number, GalleryPageData>, anchorPage: number) => {
        let changed = false;
        const nextPages: Record<number, GalleryPageData> = {};
        for (const [pageKey, pageData] of Object.entries(pages)) {
            const pageNumber = Number(pageKey);
            const shouldHydrate = pageData.imagesHydrated || Math.abs(pageNumber - anchorPage) <= 3;
            if (shouldHydrate !== pageData.imagesHydrated) {
                changed = true;
                nextPages[pageNumber] = {
                    ...pageData,
                    imagesHydrated: shouldHydrate,
                };
            } else {
                nextPages[pageNumber] = pageData;
            }
        }
        return changed ? nextPages : pages;
    }, []);

    const handleGalleryGridRangeChange = useCallback((range: { startIndex: number; endIndex: number }) => {
        const midIndex = Math.max(0, Math.floor((range.startIndex + range.endIndex) / 2));
        const nextAnchor = galleryGridItems[midIndex]?.pageNumber;
        if (!nextAnchor || nextAnchor === galleryAnchorPage) return;
        setGalleryAnchorPage(nextAnchor);
        setGalleryPages(prev => applyGalleryImageRetention(prev, nextAnchor));
    }, [applyGalleryImageRetention, galleryAnchorPage, galleryGridItems]);

    const mergeGalleryPage = useCallback((
        resolvedPage: number,
        assets: GalleryAsset[],
        options?: { preserveScroll?: boolean; keepAnchor?: boolean; anchorPage?: number; recomputeRetention?: boolean }
    ) => {
        const container = galleryScrollContainerRef.current;
        let anchorSnapshot: { assetId: string; top: number } | null = null;
        if (options?.preserveScroll && container) {
            const visibleAnchor = Array.from(container.querySelectorAll<HTMLElement>('[data-gallery-asset-id]')).find((node) => {
                const rect = node.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                return rect.bottom > containerRect.top;
            });
            if (visibleAnchor?.dataset.galleryAssetId) {
                const containerRect = container.getBoundingClientRect();
                const rect = visibleAnchor.getBoundingClientRect();
                anchorSnapshot = {
                    assetId: visibleAnchor.dataset.galleryAssetId,
                    top: rect.top - containerRect.top,
                };
                galleryScrollAnchorRef.current = anchorSnapshot;
            }
        }
        const nextAnchorPage = options?.anchorPage ?? galleryAnchorPage;

        setGalleryPages(prev => {
            const merged = {
                ...prev,
                [resolvedPage]: {
                    page: resolvedPage,
                    assets,
                    imagesHydrated: true,
                },
            };
            return options?.recomputeRetention === false
                ? merged
                : applyGalleryImageRetention(merged, nextAnchorPage);
        });
        setGalleryLowestPage(prev => Math.min(prev, resolvedPage));
        setGalleryHighestPage(prev => Math.max(prev, resolvedPage));
        if (!options?.keepAnchor) {
            setGalleryAnchorPage(nextAnchorPage);
        }

        if (options?.preserveScroll && anchorSnapshot) {
            window.requestAnimationFrame(() => {
                const node = galleryScrollContainerRef.current;
                if (!node) return;
                const anchorNode = node.querySelector<HTMLElement>(`[data-gallery-asset-id="${anchorSnapshot?.assetId}"]`);
                if (!anchorNode) return;
                const containerRect = node.getBoundingClientRect();
                const rect = anchorNode.getBoundingClientRect();
                node.scrollTop += (rect.top - containerRect.top) - anchorSnapshot.top;
            });
        }
    }, [applyGalleryImageRetention, galleryAnchorPage]);

    const fetchGalleryAssets = useCallback(async (
        page: number,
        options?: { append?: boolean; prepend?: boolean; focusAssetId?: string | null; preserveScroll?: boolean }
    ) => {
        if (!activeWorkspaceId) return null;

        const append = options?.append === true;
        const prepend = options?.prepend === true;

        if (prepend) {
            setIsLoadingPreviousGallery(true);
        } else if (append) {
            setIsLoadingMoreGallery(true);
        } else {
            setIsLoadingGallery(true);
        }

        const container = galleryScrollContainerRef.current;
        const previousScrollHeight = prepend && options?.preserveScroll && container ? container.scrollHeight : null;
        const previousScrollTop = prepend && options?.preserveScroll && container ? container.scrollTop : null;

        try {
            const result = await fetchGalleryAssetsPage(page, { focusAssetId: options?.focusAssetId });
            if (!result) return null;

            const resolvedPage = result.page;
            setGalleryHasNextPage(result.hasNextPage);
            setGalleryHasPrevPage(result.hasPrevPage);

            if (!append && !prepend) {
                const initialPages = applyGalleryImageRetention({
                    [resolvedPage]: {
                        page: resolvedPage,
                        assets: result.assets,
                        imagesHydrated: true,
                    },
                }, resolvedPage);
                setGalleryPages(initialPages);
                setGalleryAnchorPage(resolvedPage);
                setGalleryLowestPage(resolvedPage);
                setGalleryHighestPage(resolvedPage);
            } else {
                let nextAnchorPage = galleryAnchorPage;
                setGalleryAnchorPage(prev => {
                    nextAnchorPage = prepend ? Math.min(prev, resolvedPage) : Math.max(prev, resolvedPage);
                    return nextAnchorPage;
                });
                mergeGalleryPage(resolvedPage, result.assets, {
                    preserveScroll: prepend && options?.preserveScroll,
                    keepAnchor: true,
                    anchorPage: nextAnchorPage,
                });
            }

            if (result.focus?.found && result.focus.assetId && result.focus.page && result.focus.indexOnPage !== null) {
                lastViewedGalleryAssetIdRef.current = result.focus.assetId;
                setGallerySelectedAssetId(result.focus.assetId);
                setMobileSelectedGalleryAssetId(result.focus.assetId);
                galleryPostRestoreAwaitDirectionRef.current = true;
                galleryFocusRestoreRef.current = {
                    assetId: result.focus.assetId,
                    page: result.focus.page,
                    indexOnPage: result.focus.indexOnPage,
                };
            } else if (options?.focusAssetId) {
                galleryRestoreInProgressRef.current = false;
            }

            return result;
        } catch (error) {
            console.error('Failed to fetch gallery assets:', error);
            if (!append && !prepend) {
                setGalleryPages({});
            }
            if (options?.focusAssetId) {
                galleryRestoreInProgressRef.current = false;
            }
            return null;
        } finally {
            setIsLoadingGallery(false);
            setIsLoadingMoreGallery(false);
            setIsLoadingPreviousGallery(false);
        }
    }, [activeWorkspaceId, applyGalleryImageRetention, fetchGalleryAssetsPage]);

    useEffect(() => {
        setSelectedJob(null);
        setSelectedGalleryAsset(null);
        setGallerySelectedAssetId(null);
        setMobileSelectedGalleryAssetId(null);
        lastViewedGalleryAssetIdRef.current = null;
        setDetailsOpen(false);
        setGalleryDetailsOpen(false);
        if (!activeWorkspaceId) {
            setLoadedJobs([]);
            setGalleryPages({});
            setGallerySelectedAssetId(null);
            setCurrentPage(1);
            setHasNextPage(false);
            setGalleryAnchorPage(1);
            setGalleryLowestPage(1);
            setGalleryHighestPage(1);
            setGalleryHasNextPage(false);
            setGalleryHasPrevPage(false);
            setGalleryViewerItems([]);
            setGalleryViewerPage(1);
            setGalleryViewerHasNextPage(false);
            setGalleryViewerOpen(false);
            restoredMobileViewerRef.current = false;
            mobileViewerPersistenceReadyRef.current = false;
            return;
        }
        void fetchJobsPage(1, false);
    }, [activeWorkspaceId, fetchJobsPage, selectedFilters]);

    useEffect(() => {
        if (!activeWorkspaceId || typeof window === 'undefined') return;
        const storageKey = `engui.gallery.lastViewed.${activeWorkspaceId}`;
        const savedAssetId = window.localStorage.getItem(storageKey);
        if (savedAssetId) {
            lastViewedGalleryAssetIdRef.current = savedAssetId;
            setGallerySelectedAssetId(savedAssetId);
            void fetchGalleryAssets(1, { focusAssetId: savedAssetId });
            galleryRestoreHydratedRef.current = true;
            return;
        }
        void fetchGalleryAssets(1);
        galleryRestoreHydratedRef.current = true;
    }, [activeWorkspaceId, fetchGalleryAssets]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleGalleryAssetChanged = (event: Event) => {
            const customEvent = event as CustomEvent<{ workspaceId?: string; assetId?: string; reason?: string }>;
            if (!customEvent.detail?.workspaceId || customEvent.detail.workspaceId !== activeWorkspaceId) return;
            void fetchGalleryAssets(1);
        };

        window.addEventListener('galleryAssetChanged', handleGalleryAssetChanged as EventListener);
        return () => window.removeEventListener('galleryAssetChanged', handleGalleryAssetChanged as EventListener);
    }, [activeWorkspaceId, fetchGalleryAssets]);

    useEffect(() => {
        if (!activeWorkspaceId || panelMode !== 'gallery') return;

        const hasPendingGalleryWork = filteredGalleryAssets.some(asset =>
            asset.derivativeStatus === 'pending'
            || asset.derivativeStatus === 'processing'
            || asset.enrichmentStatus === 'pending'
            || asset.enrichmentStatus === 'processing'
        );

        if (!hasPendingGalleryWork) return;

        const interval = window.setInterval(() => {
            void fetchGalleryAssets(1);
        }, 2500);

        return () => window.clearInterval(interval);
    }, [activeWorkspaceId, panelMode, fetchGalleryAssets, filteredGalleryAssets]);


    // Keep right panel live: new jobs should appear immediately, and completed jobs should refresh result URL.
    useEffect(() => {
        if (!activeWorkspaceId) return;

        const liveWorkspaceJobs = jobs.filter(job =>
            job.workspaceId === activeWorkspaceId && jobMatchesFilter(job, selectedFilters)
        );

        // Keep live state as source of truth: it must overwrite stale paginated items.
        setLoadedJobs(prev => mergeUniqueJobs([...prev, ...liveWorkspaceJobs]));
    }, [jobs, activeWorkspaceId, jobMatchesFilter, mergeUniqueJobs, selectedFilters]);

    const handleJobClick = (job: Job) => {
        if (mobile) {
            const isSameJob = mobileSelectedJobId === job.id;
            setMobileSelectedJobId(job.id);

            if (isSameJob) {
                emitHoverPreview(job);
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('mobileOpenPreviewTab'));
                }
            }
            return;
        }

        setSelectedJob(job);
        setDetailsOpen(true);
    };

    const handleMobileJobTouchEnd = (job: Job) => {
        mobileTouchHandledRef.current = { kind: 'job', id: job.id };
        handleJobClick(job);
        window.setTimeout(() => {
            if (mobileTouchHandledRef.current?.kind === 'job' && mobileTouchHandledRef.current?.id === job.id) {
                mobileTouchHandledRef.current = null;
            }
        }, 350);
    };

    const handleGalleryAssetClick = (asset: GalleryAsset) => {
        const itemIndex = filteredGalleryAssets.findIndex(item => item.id === asset.id);

        if (mobile) {
            const isSameAsset = gallerySelectedAssetId === asset.id;
            applyGallerySelection(asset);
            setMobileSelectedJobId(null);
            setGalleryDetailsOpen(false);

            if (!isSameAsset) {
                return;
            }
        } else {
            applyGallerySelection(asset);
            setGalleryDetailsOpen(false);
        }

        setGalleryViewerItems(filteredGalleryAssets);
        setGalleryViewerPage(galleryHighestPage);
        setGalleryViewerHasNextPage(galleryHasNextPage);
        setGalleryViewerIndex(itemIndex >= 0 ? itemIndex : 0);
        setGalleryViewerOpen(true);
    };

    const handleMobileGalleryTouchStart = (event: React.TouchEvent, asset: GalleryAsset) => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        mobileGalleryTouchRef.current = {
            id: asset.id,
            startX: touch.clientX,
            startY: touch.clientY,
            moved: false,
        };
    };

    const handleMobileGalleryTouchMove = (event: React.TouchEvent, asset: GalleryAsset) => {
        const touch = event.changedTouches[0];
        const current = mobileGalleryTouchRef.current;
        if (!touch || !current || current.id !== asset.id) return;
        if (Math.abs(touch.clientX - current.startX) > 8 || Math.abs(touch.clientY - current.startY) > 8) {
            mobileGalleryTouchRef.current = {
                ...current,
                moved: true,
            };
        }
    };

    const handleMobileGalleryTouchEnd = (event: React.TouchEvent, asset: GalleryAsset) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('[data-gallery-overlay-action="true"]')) {
            mobileGalleryTouchRef.current = null;
            return;
        }

        const current = mobileGalleryTouchRef.current;
        mobileGalleryTouchRef.current = null;
        if (!current || current.id !== asset.id || current.moved) {
            return;
        }

        mobileTouchHandledRef.current = { kind: 'gallery', id: asset.id };
        handleGalleryAssetClick(asset);
        window.setTimeout(() => {
            if (mobileTouchHandledRef.current?.kind === 'gallery' && mobileTouchHandledRef.current?.id === asset.id) {
                mobileTouchHandledRef.current = null;
            }
        }, 350);
    };

    const emitHoverPreview = (job: Job | null) => {
        if (typeof window === 'undefined') return;
        const detail = job ? {
            id: job.id,
            type: job.type,
            url: job.resultUrl,
            prompt: job.prompt,
            modelId: job.modelId,
            workspaceId: job.workspaceId,
            status: job.status,
            createdAt: job.createdAt,
        } : null;

        if (mobile && detail) {
            window.localStorage.setItem('engui.mobile.pending-preview', JSON.stringify(detail));
        }

        window.dispatchEvent(new CustomEvent('jobHoverPreview', {
            detail,
        }));
    };

    const handleDeleteJob = async (e: React.MouseEvent, jobId: string) => {
        e.stopPropagation();
        if (!confirm('Delete this finished job and clean up its local outputs when safe?')) return;

        const ok = await deleteJob(jobId);
        if (!ok) {
            showToast('Failed to delete job', 'error');
            return;
        }

        setLoadedJobs(prev => prev.filter(job => job.id !== jobId));
        if (selectedJob?.id === jobId) {
            setDetailsOpen(false);
            setSelectedJob(null);
        }
        showToast('Job deleted', 'success');
    };

    const handleCancelJob = async (e: React.MouseEvent, jobId: string) => {
        e.stopPropagation();
        if (!confirm('Cancel this running job? It will become failed with reason cancelled.')) return;

        const ok = await cancelJob(jobId);
        if (!ok) {
            showToast('Failed to cancel job', 'error');
            return;
        }

        setLoadedJobs(prev => prev.map(job => job.id === jobId ? {
            ...job,
            status: 'failed',
            error: 'cancelled',
        } : job));
        showToast('Job cancelled', 'success');
    };

    const handleClearFinishedJobs = async () => {
        if (!confirm('Delete all finished jobs in this workspace? Active jobs will be kept.')) return;

        const result = await clearFinishedJobs(activeWorkspaceId);
        if (!result.success) {
            showToast(result.error || 'Failed to clear finished jobs', 'error');
            return;
        }

        setLoadedJobs(prev => prev.filter(job => job.status !== 'completed' && job.status !== 'failed'));
        if (selectedJob && (selectedJob.status === 'completed' || selectedJob.status === 'failed')) {
            setDetailsOpen(false);
            setSelectedJob(null);
        }
        showToast(`Cleared ${result.deleted || 0} finished jobs`, 'success');
    };

    const handleCreateWorkspace = async () => {
        if (newWorkspaceName.trim()) {
            await createWorkspace(newWorkspaceName.trim());
            setNewWorkspaceName('');
            setIsCreatingWorkspace(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCreateWorkspace();
        } else if (e.key === 'Escape') {
            setIsCreatingWorkspace(false);
            setNewWorkspaceName('');
        }
    };

    const filteredJobs = loadedJobs;
    const finishedJobsCount = filteredJobs.filter(job => job.status === 'completed' || job.status === 'failed').length;

    const handleGalleryViewerIndexChange = useCallback((index: number) => {
        const asset = galleryViewerItems[index];
        if (!asset) return;
        setGalleryViewerIndex(index);
        applyGallerySelection(asset);
    }, [applyGallerySelection, galleryViewerItems]);

    useEffect(() => {
        if (!galleryViewerOpen) return;
        if (galleryViewerItems.length === 0) {
            setGalleryViewerOpen(false);
            return;
        }
        if (galleryViewerIndex >= galleryViewerItems.length) {
            setGalleryViewerIndex(galleryViewerItems.length - 1);
        }
    }, [galleryViewerItems, galleryViewerIndex, galleryViewerOpen]);

    useEffect(() => {
        if (!mobile || typeof window === 'undefined') return;
        if (panelMode !== 'gallery' || filteredGalleryAssets.length === 0 || restoredMobileViewerRef.current) return;

        const raw = window.localStorage.getItem('engui.mobile.library.viewer');
        if (!raw) {
            restoredMobileViewerRef.current = true;
            mobileViewerPersistenceReadyRef.current = true;
            return;
        }

        try {
            const saved = JSON.parse(raw) as { open?: boolean; assetId?: string | null };
            if (!saved?.open || !saved.assetId) {
                restoredMobileViewerRef.current = true;
                mobileViewerPersistenceReadyRef.current = true;
                return;
            }

            const asset = filteredGalleryAssets.find((entry) => entry.id === saved.assetId);
            if (!asset) return;

            const itemIndex = filteredGalleryAssets.findIndex((entry) => entry.id === asset.id);
            applyGallerySelection(asset);
            setGalleryViewerItems(filteredGalleryAssets);
            setGalleryViewerPage(galleryHighestPage);
            setGalleryViewerHasNextPage(galleryHasNextPage);
            setGalleryViewerIndex(itemIndex >= 0 ? itemIndex : 0);
            setGalleryViewerOpen(true);
            restoredMobileViewerRef.current = true;
            mobileViewerPersistenceReadyRef.current = true;
        } catch {
            restoredMobileViewerRef.current = true;
            mobileViewerPersistenceReadyRef.current = true;
        }
    }, [applyGallerySelection, filteredGalleryAssets, galleryHasNextPage, galleryHighestPage, mobile, panelMode]);

    useEffect(() => {
        if (!mobile || typeof window === 'undefined' || !mobileViewerPersistenceReadyRef.current) return;
        window.localStorage.setItem('engui.mobile.library.viewer', JSON.stringify({
            open: galleryViewerOpen,
            assetId: galleryViewerOpen ? (galleryViewerItems[galleryViewerIndex]?.id || gallerySelectedAssetId || null) : null,
        }));
    }, [gallerySelectedAssetId, galleryViewerIndex, galleryViewerItems, galleryViewerOpen, mobile]);

    useEffect(() => {
        if (typeof window === 'undefined' || !activeWorkspaceId || !galleryRestoreHydratedRef.current) return;
        const storageKey = `engui.gallery.lastViewed.${activeWorkspaceId}`;
        const assetId = gallerySelectedAssetId || lastViewedGalleryAssetIdRef.current || null;
        if (assetId) {
            window.localStorage.setItem(storageKey, assetId);
        }
    }, [activeWorkspaceId, gallerySelectedAssetId]);

    useEffect(() => {
        if (!galleryViewerOpen || isLoadingMoreViewerItems || !galleryViewerHasNextPage) return;
        if (galleryViewerItems.length - galleryViewerIndex > 5) return;

        const loadMoreViewerItems = async () => {
            setIsLoadingMoreViewerItems(true);
            try {
                const nextPage = galleryViewerPage + 1;
                const result = await fetchGalleryAssetsPage(nextPage);
                if (!result) return;
                setGalleryViewerItems(prev => {
                    const seen = new Set(prev.map(item => item.id));
                    const merged = [...prev];
                    for (const item of result.assets) {
                        if (!seen.has(item.id)) {
                            merged.push(item);
                            seen.add(item.id);
                        }
                    }
                    return merged;
                });
                setGalleryViewerPage(nextPage);
                setGalleryViewerHasNextPage(result.hasNextPage);
            } catch (error) {
                console.error('Failed to load more gallery viewer items:', error);
            } finally {
                setIsLoadingMoreViewerItems(false);
            }
        };

        void loadMoreViewerItems();
    }, [fetchGalleryAssetsPage, galleryViewerHasNextPage, galleryViewerIndex, galleryViewerItems.length, galleryViewerOpen, galleryViewerPage, isLoadingMoreViewerItems]);

    useEffect(() => {
        if (!galleryViewerOpen) return;
        setGalleryViewerItems(prev => prev.map(item => {
            const updated = filteredGalleryAssets.find(entry => entry.id === item.id);
            return updated || item;
        }));
    }, [filteredGalleryAssets, galleryViewerOpen]);

    useEffect(() => {
        const restore = galleryFocusRestoreRef.current;
        if (!restore) return;
        const centered = scrollGalleryAssetIntoView(restore.assetId, 'center');
        if (!centered) return;

        galleryScrollAnchorRef.current = {
            assetId: restore.assetId,
            top: 0,
        };
        galleryFocusRestoreRef.current = null;
        galleryEntryRestoreRequestRef.current = null;
        setGalleryAnchorPage(restore.page);
        window.setTimeout(() => {
            galleryRestoreInProgressRef.current = false;
            galleryPostRestoreAwaitDirectionRef.current = true;
        }, 80);
    }, [scrollGalleryAssetIntoView]);

    useEffect(() => {
        if (panelMode !== 'gallery' || !centerGallerySelectionOnEntryRef.current) return;
        const assetId = gallerySelectedAssetId || lastViewedGalleryAssetIdRef.current;
        if (!assetId) {
            centerGallerySelectionOnEntryRef.current = false;
            galleryEntryRestoreRequestRef.current = null;
            return;
        }

        const centered = scrollGalleryAssetIntoView(assetId, 'center');
        if (centered) {
            centerGallerySelectionOnEntryRef.current = false;
            galleryEntryRestoreRequestRef.current = null;
            return;
        }

        if (galleryEntryRestoreRequestRef.current === assetId || galleryRestoreInProgressRef.current) {
            return;
        }

        galleryEntryRestoreRequestRef.current = assetId;
        galleryRestoreInProgressRef.current = true;
        void fetchGalleryAssets(1, { focusAssetId: assetId });
    }, [fetchGalleryAssets, gallerySelectedAssetId, panelMode, scrollGalleryAssetIntoView]);

    const loadPreviousGalleryPages = useCallback(() => {
        if (galleryRestoreInProgressRef.current || !galleryHasPrevPage || isLoadingPreviousGallery) return;
        const pagesToLoad = [galleryLowestPage - 1, galleryLowestPage - 2, galleryLowestPage - 3].filter(page => page >= 1);
        void (async () => {
            for (const page of pagesToLoad) {
                await fetchGalleryAssets(page, { prepend: true, preserveScroll: true });
            }
        })();
    }, [fetchGalleryAssets, galleryHasPrevPage, galleryLowestPage, isLoadingPreviousGallery]);

    const loadNextGalleryPages = useCallback(() => {
        if (galleryRestoreInProgressRef.current || !galleryHasNextPage || isLoadingMoreGallery) return;
        const pagesToLoad = [galleryHighestPage + 1, galleryHighestPage + 2, galleryHighestPage + 3];
        void (async () => {
            for (const page of pagesToLoad) {
                await fetchGalleryAssets(page, { append: true });
            }
        })();
    }, [fetchGalleryAssets, galleryHasNextPage, galleryHighestPage, isLoadingMoreGallery]);

    useEffect(() => {
        if (panelMode !== 'gallery') return;
        const container = galleryScrollContainerRef.current;
        const topTarget = galleryTopSentinelRef.current;
        const bottomTarget = galleryBottomSentinelRef.current;
        if (!container || !topTarget || !bottomTarget) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting || galleryRestoreInProgressRef.current) return;
                if (entry.target === topTarget && galleryScrollDirectionRef.current === 'up') {
                    loadPreviousGalleryPages();
                }
                if (entry.target === bottomTarget && galleryScrollDirectionRef.current === 'down') {
                    loadNextGalleryPages();
                }
            });
        }, {
            root: container,
            rootMargin: '400px 0px 400px 0px',
            threshold: 0.01,
        });

        observer.observe(topTarget);
        observer.observe(bottomTarget);
        return () => observer.disconnect();
    }, [loadNextGalleryPages, loadPreviousGalleryPages, panelMode]);

    useEffect(() => {
        if (panelMode !== 'gallery' || sortedGalleryPageNumbers.length === 0) return;
        if (sortedGalleryPageNumbers.length === 1 && lastViewedGalleryAssetIdRef.current) {
            galleryPostRestoreAwaitDirectionRef.current = true;
        }
        const container = galleryScrollerEl || galleryScrollContainerRef.current;
        if (!container) return;

        let lastScrollTop = container.scrollTop;

        const handleScroll = () => {
            if (galleryRestoreInProgressRef.current) return;
            galleryScrollDirectionRef.current = container.scrollTop > lastScrollTop ? 'down' : container.scrollTop < lastScrollTop ? 'up' : galleryScrollDirectionRef.current;
            lastScrollTop = container.scrollTop;

            const nearTop = container.scrollTop <= 300;
            const nearBottom = (container.scrollHeight - (container.scrollTop + container.clientHeight)) <= 300;
            if (galleryPostRestoreAwaitDirectionRef.current && galleryScrollDirectionRef.current) {
                if (galleryScrollDirectionRef.current === 'up') {
                    loadPreviousGalleryPages();
                } else {
                    loadNextGalleryPages();
                }
                galleryPostRestoreAwaitDirectionRef.current = false;
            }

            if (galleryScrollDirectionRef.current === 'up' && nearTop) {
                loadPreviousGalleryPages();
            }
            if (galleryScrollDirectionRef.current === 'down' && nearBottom) {
                loadNextGalleryPages();
            }
        };

        handleScroll();
        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [galleryScrollerEl, loadNextGalleryPages, loadPreviousGalleryPages, panelMode, sortedGalleryPageNumbers]);


    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent('rightPanelGalleryItemsChanged', {
            detail: filteredGalleryAssets.map(asset => ({
                id: asset.id,
                type: asset.type,
                url: asset.originalUrl,
                prompt: (asset.userTags || asset.autoTags || []).join(', '),
                modelId: 'gallery',
                workspaceId: asset.workspaceId,
                sourceJobId: asset.sourceJobId,
                status: 'completed',
                createdAt: new Date(asset.addedToGalleryAt).getTime(),
            })),
        }));
    }, [filteredGalleryAssets]);
    const gallerySearchTokens = Array.from(new Set(gallerySearchQuery.split(/\s+/).map(token => token.trim()).filter(Boolean)));
    const isAllFilterActive = selectedFilters.length === TYPE_FILTERS.length;
    const gallerySummaryParts = [
        `${filteredGalleryAssets.length} assets`,
        semanticFilter !== 'all' ? semanticFilter : null,
        !isAllFilterActive ? selectedFilters.join(', ') : null,
        favoritesOnly ? 'favorites' : null,
        showTrashed ? 'trash' : 'active',
    ].filter(Boolean);

    const navigateSelectedJob = useCallback((direction: 'previous' | 'next') => {
        if (!selectedJob || filteredJobs.length === 0) return;

        const currentIndex = filteredJobs.findIndex(job => job.id === selectedJob.id);

        if (currentIndex === -1) {
            setSelectedJob(filteredJobs[0]);
            return;
        }

        let nextIndex: number;

        if (direction === 'previous') {
            // ArrowRight: move to previous/older item in the list (wrap to start)
            nextIndex = (currentIndex + 1) % filteredJobs.length;
        } else {
            // ArrowLeft: move to next/newer item in the list (wrap to end)
            nextIndex = (currentIndex - 1 + filteredJobs.length) % filteredJobs.length;
        }

        setSelectedJob(filteredJobs[nextIndex]);
    }, [selectedJob, filteredJobs]);


    const selectedJobIndex = selectedJob
        ? filteredJobs.findIndex(job => job.id === selectedJob.id)
        : -1;
    const selectedJobPosition = selectedJobIndex >= 0 ? selectedJobIndex + 1 : 0;

    const getExecutionMs = (job: Job): number | null => {
        if (typeof job.executionMs === 'number' && Number.isFinite(job.executionMs)) return job.executionMs;
        try {
            const rawOptions = (job as any).options;
            const opts = typeof rawOptions === 'string' ? JSON.parse(rawOptions) : (rawOptions || {});
            const v = opts?.executionMs;
            if (typeof v === 'number' && Number.isFinite(v)) return v;
            if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
            return null;
        } catch {
            return null;
        }
    };

    const formatExecution = (ms: number | null) => {
        if (ms === null) return null;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    // Helper to format time ago
    const timeAgo = (date: number) => {
        const seconds = Math.floor((Date.now() - date) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    const updateGalleryFavorite = useCallback(async (asset: GalleryAsset) => {
        const nextFavorited = !asset.favorited;
        updateGalleryPages(item => item.id === asset.id ? { ...item, favorited: nextFavorited } : item);
        setGalleryViewerItems(prev => prev.map(item => item.id === asset.id ? { ...item, favorited: nextFavorited } : item));
        setSelectedGalleryAsset(prev => prev && prev.id === asset.id ? { ...prev, favorited: nextFavorited } : prev);
        try {
            const response = await fetch(`/api/gallery/assets/${asset.id}/favorite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ favorited: nextFavorited }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to update favorite');
            }
            showToast(nextFavorited ? 'Added to favorites' : 'Removed from favorites', 'success');
            return nextFavorited;
        } catch (error) {
            console.error('Failed to update favorite:', error);
            updateGalleryPages(item => item.id === asset.id ? { ...item, favorited: asset.favorited } : item);
            setGalleryViewerItems(prev => prev.map(item => item.id === asset.id ? { ...item, favorited: asset.favorited } : item));
            setSelectedGalleryAsset(prev => prev && prev.id === asset.id ? { ...prev, favorited: asset.favorited } : prev);
            showToast(error instanceof Error ? error.message : 'Failed to update favorite', 'error');
            return asset.favorited;
        }
    }, [showToast]);

    const handleGalleryFavorite = async (e: React.MouseEvent, asset: GalleryAsset) => {
        e.stopPropagation();
        await updateGalleryFavorite(asset);
    };

    const applyGalleryBucketLocal = useCallback((assetId: string, bucket: GalleryViewerBucket) => {
        updateGalleryPages(item => item.id === assetId ? { ...item, bucket } : item);
        setGalleryViewerItems(prev => prev.map(item => item.id === assetId ? { ...item, bucket } : item));
        setSelectedGalleryAsset(prev => prev && prev.id === assetId ? { ...prev, bucket } : prev);
    }, [updateGalleryPages]);

    const updateGalleryBucket = useCallback(async (asset: GalleryAsset, bucket: GalleryViewerBucket) => {
        if (asset.bucket === bucket) return true;
        const response = await fetch(`/api/gallery/assets/${asset.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bucket }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to update asset bucket');
        }
        applyGalleryBucketLocal(asset.id, bucket);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('galleryAssetChanged', {
                detail: { workspaceId: asset.workspaceId, assetId: asset.id, reason: 'updated' }
            }));
        }
        return true;
    }, [applyGalleryBucketLocal]);

    const handleGalleryTagClick = (tag: string) => {
        if (mobile && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('mobileOpenGalleryTab'));
        }
        setPanelMode('gallery');
        setGallerySearchQuery(prev => {
            const tokens = Array.from(new Set(prev.split(/\s+/).map(token => token.trim()).filter(Boolean)));
            if (tokens.includes(tag)) return prev;
            return [...tokens, tag].join(' ');
        });
        setShowTrashed(false);
    };

    const handleGalleryTokenRemove = (tokenToRemove: string) => {
        setGallerySearchQuery(prev => prev.split(/\s+/).map(token => token.trim()).filter(Boolean).filter(token => token !== tokenToRemove).join(' '));
    };

    const toggleMediaFilter = (target: 'all' | MediaFilter) => {
        setSelectedFilters(prev => {
            if (target === 'all') {
                return [...TYPE_FILTERS];
            }
            const allSelected = prev.length === TYPE_FILTERS.length;
            if (allSelected) {
                return [target];
            }
            const hasTarget = prev.includes(target);
            const next = hasTarget ? prev.filter(entry => entry !== target) : [...prev, target];
            if (next.length === 0) {
                return [...TYPE_FILTERS];
            }
            if (next.length === TYPE_FILTERS.length) {
                return [...TYPE_FILTERS];
            }
            return next;
        });
    };

    const toggleGalleryFavorites = () => {
        setFavoritesOnly(prev => {
            const next = !prev;
            if (next) {
                setShowTrashed(false);
            }
            return next;
        });
    };

    const toggleGalleryTrash = () => {
        setShowTrashed(prev => {
            const next = !prev;
            if (next) {
                setFavoritesOnly(false);
            }
            return next;
        });
    };

    const handleGallerySaveTags = async (asset: GalleryAsset, tags: string[]) => {
        updateGalleryPages(item => item.id === asset.id ? { ...item, userTags: tags } : item);
        setSelectedGalleryAsset(prev => prev && prev.id === asset.id ? { ...prev, userTags: tags } : prev);
        try {
            const response = await fetch(`/api/gallery/assets/${asset.id}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userTags: tags, autoTags: asset.autoTags || [] }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to save tags');
            }
            showToast('Tags saved', 'success');
        } catch (error) {
            console.error('Failed to save tags:', error);
            updateGalleryPages(item => item.id === asset.id ? { ...item, userTags: asset.userTags || [] } : item);
            setSelectedGalleryAsset(prev => prev && prev.id === asset.id ? { ...prev, userTags: asset.userTags || [] } : prev);
            showToast(error instanceof Error ? error.message : 'Failed to save tags', 'error');
        }
    };

    const handleGalleryRemoveAutoTag = async (asset: GalleryAsset, tagToRemove: string) => {
        const nextAutoTags = (asset.autoTags || []).filter(tag => tag !== tagToRemove);
        updateGalleryPages(item => item.id === asset.id ? { ...item, autoTags: nextAutoTags } : item);
        setSelectedGalleryAsset(prev => prev && prev.id === asset.id ? { ...prev, autoTags: nextAutoTags } : prev);
        try {
            const response = await fetch(`/api/gallery/assets/${asset.id}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userTags: asset.userTags || [], autoTags: nextAutoTags }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to remove auto tag');
            }
            showToast('Auto tag removed', 'success');
        } catch (error) {
            console.error('Failed to remove auto tag:', error);
            updateGalleryPages(item => item.id === asset.id ? { ...item, autoTags: asset.autoTags || [] } : item);
            setSelectedGalleryAsset(prev => prev && prev.id === asset.id ? { ...prev, autoTags: asset.autoTags || [] } : prev);
            showToast(error instanceof Error ? error.message : 'Failed to remove auto tag', 'error');
        }
    };

    const handleGalleryBackfill = async () => {
        if (!activeWorkspaceId || isBackfillingGallery) return;
        setIsBackfillingGallery(true);
        try {
            const response = await fetch('/api/gallery/assets/backfill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId: activeWorkspaceId, limit: 100 }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to backfill gallery enrichment');
            }
            showToast(`Enriched ${data.processed || 0} gallery assets`, 'success');
            void fetchGalleryAssets(1);
        } catch (error) {
            console.error('Failed to backfill gallery enrichment:', error);
            showToast(error instanceof Error ? error.message : 'Failed to backfill gallery enrichment', 'error');
        } finally {
            setIsBackfillingGallery(false);
        }
    };

    const handleGalleryDerivativesBackfill = async () => {
        if (!activeWorkspaceId || isBackfillingDerivatives) return;
        setIsBackfillingDerivatives(true);
        try {
            const response = await fetch('/api/gallery/assets/derivatives/backfill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId: activeWorkspaceId, limit: 100 }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to backfill gallery derivatives');
            }
            showToast(`Generated derivatives for ${data.processed || 0} gallery assets`, 'success');
            void fetchGalleryAssets(1);
        } catch (error) {
            console.error('Failed to backfill gallery derivatives:', error);
            showToast(error instanceof Error ? error.message : 'Failed to backfill gallery derivatives', 'error');
        } finally {
            setIsBackfillingDerivatives(false);
        }
    };

    const handleGalleryPermanentDelete = async (asset: GalleryAsset) => {
        if (!confirm('Delete this gallery asset forever? This will remove stored files too.')) return;
        try {
            const response = await fetch(`/api/gallery/assets/${asset.id}?permanent=true`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to permanently delete asset');
            }
            updateGalleryPages(item => item.id === asset.id ? null : item);
            if (selectedGalleryAsset?.id === asset.id) {
                applyGallerySelection(null);
                setGalleryDetailsOpen(false);
            }
            showToast('Gallery asset permanently deleted', 'success');
        } catch (error) {
            console.error('Failed to permanently delete gallery asset:', error);
            showToast(error instanceof Error ? error.message : 'Failed to permanently delete asset', 'error');
        }
    };

    const handleEmptyGalleryTrash = async () => {
        if (!activeWorkspaceId || isEmptyingTrash) return;
        if (!confirm('Empty gallery trash for this workspace? This permanently deletes trashed assets and files.')) return;
        setIsEmptyingTrash(true);
        try {
            const response = await fetch(`/api/gallery/trash?workspaceId=${encodeURIComponent(activeWorkspaceId)}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to empty gallery trash');
            }
            showToast(`Deleted ${data.deletedCount || 0} trashed assets`, 'success');
            void fetchGalleryAssets(1);
            if (selectedGalleryAsset?.trashed) {
                applyGallerySelection(null);
                setGalleryDetailsOpen(false);
            }
        } catch (error) {
            console.error('Failed to empty gallery trash:', error);
            showToast(error instanceof Error ? error.message : 'Failed to empty gallery trash', 'error');
        } finally {
            setIsEmptyingTrash(false);
        }
    };

    const handleGalleryTrash = async (e: React.MouseEvent, asset: GalleryAsset, nextTrashed = true) => {
        e.stopPropagation();
        updateGalleryPages(item => item.id === asset.id ? { ...item, trashed: nextTrashed } : item);
        if (selectedGalleryAsset?.id === asset.id) {
            setSelectedGalleryAsset(prev => prev ? { ...prev, trashed: nextTrashed } : prev);
            if (!showTrashed && nextTrashed) {
                setGalleryDetailsOpen(false);
                applyGallerySelection(null);
            }
        }
        try {
            const response = await fetch(`/api/gallery/assets/${asset.id}/trash`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trashed: nextTrashed }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to update trash state');
            }
            showToast(nextTrashed ? 'Moved asset to trash' : 'Restored asset from trash', 'success');
            if (!showTrashed) {
                updateGalleryPages(item => item.trashed ? null : item);
            }
        } catch (error) {
            console.error('Failed to update trash state:', error);
            updateGalleryPages(item => item.id === asset.id ? { ...item, trashed: asset.trashed } : item);
            setSelectedGalleryAsset(prev => prev && prev.id === asset.id ? { ...prev, trashed: asset.trashed } : prev);
            showToast(error instanceof Error ? error.message : 'Failed to update trash state', 'error');
        }
    };

    const handleGalleryViewerClose = useCallback(() => {
        const assetId = galleryViewerItems[galleryViewerIndex]?.id || gallerySelectedAssetId || lastViewedGalleryAssetIdRef.current;
        setGalleryViewerOpen(false);
        if (!assetId) return;
        const selectedAsset = resolveGalleryAssetById(assetId);
        if (selectedAsset) {
            applyGallerySelection(selectedAsset);
        } else {
            setGallerySelectedAssetId(assetId);
            setMobileSelectedGalleryAssetId(assetId);
            lastViewedGalleryAssetIdRef.current = assetId;
        }

        const loadedPageEntry = Object.entries(galleryPages).find(([, pageData]) =>
            pageData.assets.some(asset => asset.id === assetId)
        );

        if (loadedPageEntry) {
            const loadedPage = Number(loadedPageEntry[0]);
            const indexOnPage = loadedPageEntry[1].assets.findIndex(asset => asset.id === assetId);
            galleryRestoreInProgressRef.current = true;
            galleryPostRestoreAwaitDirectionRef.current = true;
            galleryFocusRestoreRef.current = {
                assetId,
                page: loadedPage,
                indexOnPage,
            };
            return;
        }

        galleryRestoreInProgressRef.current = true;
        void fetchGalleryAssets(1, { focusAssetId: assetId });
    }, [applyGallerySelection, fetchGalleryAssets, galleryPages, gallerySelectedAssetId, galleryViewerIndex, galleryViewerItems, resolveGalleryAssetById]);

    const renderGalleryGridItem = (_index: number, item: GalleryGridItem) => {
        const asset = item.asset;
        const isSelected = gallerySelectedAssetId === asset.id;
        const visibleUserTags = (asset.userTags || []).slice(0, 2);
        const visibleAutoTags = (asset.autoTags || []).slice(0, Math.max(0, 2 - visibleUserTags.length));

        return (
            <button
                key={asset.id}
                data-gallery-asset-id={asset.id}
                type="button"
                onClick={() => {
                    if (mobile && mobileTouchHandledRef.current?.kind === 'gallery' && mobileTouchHandledRef.current?.id === asset.id) {
                        mobileTouchHandledRef.current = null;
                        return;
                    }
                    handleGalleryAssetClick(asset);
                }}
                onTouchStart={(event) => {
                    if (mobile) {
                        handleMobileGalleryTouchStart(event, asset);
                    }
                }}
                onTouchMove={(event) => {
                    if (mobile) {
                        handleMobileGalleryTouchMove(event, asset);
                    }
                }}
                onTouchEnd={(event) => {
                    if (mobile) {
                        handleMobileGalleryTouchEnd(event, asset);
                    }
                }}
                className={`group relative h-full w-full overflow-hidden rounded-lg border text-left transition-all ${isSelected ? 'border-primary ring-2 ring-primary/60 bg-primary/12 shadow-[0_0_0_1px_rgba(99,102,241,0.35)] scale-[1.01]' : 'border-border bg-muted/10 hover:bg-muted/20'}`}
            >
                <div className="aspect-square bg-black/30 flex items-center justify-center overflow-hidden">
                    {item.imagesHydrated ? (
                        asset.type === 'video' ? (
                            asset.thumbnailUrl ? (
                                <img src={asset.thumbnailUrl} alt="Gallery video thumbnail" className="w-full h-full object-cover" />
                            ) : (
                                <video src={asset.previewUrl || asset.originalUrl} poster={asset.thumbnailUrl || undefined} className="w-full h-full object-cover" muted />
                            )
                        ) : asset.type === 'audio' ? (
                            <div className="w-full h-full flex items-center justify-center text-orange-400 text-xs font-medium">AUDIO</div>
                        ) : (
                            <img src={asset.previewUrl || asset.originalUrl} alt="Gallery asset" className="w-full h-full object-cover" />
                        )
                    ) : (
                        <div className="w-full h-full bg-muted/20" />
                    )}
                </div>
                <GalleryTileStatusBadges favorited={asset.favorited} bucket={asset.bucket} mobile={mobile} />
                <div className={`absolute top-2 right-2 flex gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button
                        type="button"
                        data-gallery-overlay-action="true"
                        onTouchEnd={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            applyGallerySelection(asset);
                            setGalleryDetailsOpen(true);
                        }}
                        className="p-1 rounded-md backdrop-blur-sm border bg-background/80 text-muted-foreground border-border/50 hover:text-blue-400"
                        title="Info"
                    >
                        <Info className="w-3 h-3" />
                    </button>
                    <button
                        type="button"
                        data-gallery-overlay-action="true"
                        onTouchEnd={(e) => e.stopPropagation()}
                        onClick={(e) => void handleGalleryFavorite(e, asset)}
                        className={`p-1 rounded-md backdrop-blur-sm border ${asset.favorited ? 'bg-pink-500/20 text-pink-400 border-pink-500/30' : 'bg-background/80 text-muted-foreground border-border/50 hover:text-pink-400'}`}
                        title={asset.favorited ? 'Unfavorite' : 'Favorite'}
                    >
                        ♥
                    </button>
                    <button
                        type="button"
                        data-gallery-overlay-action="true"
                        onTouchEnd={(e) => e.stopPropagation()}
                        onClick={(e) => void handleGalleryTrash(e, asset, !asset.trashed)}
                        className="p-1 rounded-md backdrop-blur-sm border bg-background/80 text-muted-foreground border-border/50 hover:text-red-400"
                        title={asset.trashed ? 'Restore from trash' : 'Move to trash'}
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
                <div className={`${mobile ? 'p-1.5 min-h-[42px]' : 'p-2 min-h-[78px]'} flex flex-col gap-1`}>
                    <div className="min-h-[14px] text-[10px] font-medium capitalize text-foreground flex items-center gap-1 flex-wrap">
                        <span>{asset.type}</span>
                        {asset.favorited && <span className="text-pink-400">♥</span>}
                        {asset.enrichmentStatus === 'completed' && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Tagged</span>
                        )}
                        {(asset.enrichmentStatus === 'pending' || asset.enrichmentStatus === 'processing') && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Tagging…</span>
                        )}
                        {(asset.derivativeStatus === 'pending' || asset.derivativeStatus === 'processing') && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Preview…</span>
                        )}
                    </div>
                    {!mobile && <div className="h-3 text-[9px] text-muted-foreground truncate">{asset.sourceOutputId || asset.id}</div>}
                    {!mobile && (
                        <div className="flex h-[28px] flex-wrap content-start gap-1 overflow-hidden pt-1">
                            {visibleUserTags.map(tag => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleGalleryTagClick(tag);
                                    }}
                                    className="max-w-full truncate text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                                >
                                    {tag}
                                </button>
                            ))}
                            {visibleAutoTags.map(tag => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleGalleryTagClick(tag);
                                    }}
                                    className="max-w-full truncate text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </button>
        );
    };

    return (
        <div className={mobile ? 'flex h-full w-full flex-col bg-card' : 'flex h-full flex-col bg-card border-l border-border w-[320px]'}>
            {/* Header */}
            <div className={`${mobile ? 'p-3 pb-2 border-b border-border flex flex-col gap-3 bg-muted/5' : 'p-3 border-b border-border flex flex-col gap-3 bg-muted/5'}`}>
                {/* Workspace Selector */}
                <div className="flex items-center justify-between">
                    {isCreatingWorkspace ? (
                        <div className="flex items-center gap-1 w-full animate-in fade-in slide-in-from-left-2 duration-200">
                            <Input
                                ref={inputRef}
                                value={newWorkspaceName}
                                onChange={(e) => setNewWorkspaceName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Workspace Name"
                                className="h-7 text-xs"
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:text-green-600" onClick={handleCreateWorkspace}>
                                <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setIsCreatingWorkspace(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 px-2 -ml-2 text-sm font-semibold hover:bg-muted/50 w-full justify-between group">
                                    <span className="truncate">{activeWorkspace?.name || 'Select Workspace'}</span>
                                    <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[280px] bg-[#1a1a2e]/95 backdrop-blur-md border-white/10">
                                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Switch Workspace</DropdownMenuLabel>
                                {workspaces.map(ws => (
                                    <DropdownMenuItem key={ws.id} onClick={() => selectWorkspace(ws.id)} className="justify-between">
                                        <span className="truncate">{ws.name}</span>
                                        {ws.id === activeWorkspaceId && <Check className="w-3 h-3 text-primary" />}
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setIsCreatingWorkspace(true)} className="text-primary focus:text-primary">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create New Workspace
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                {/* Filters & Actions */}
                <div className="space-y-2">
                    {!mobile && <div className="flex items-center gap-1 bg-muted/30 rounded-md p-0.5 w-fit">
                        <button
                            onClick={() => setPanelMode('jobs')}
                            className="px-2 py-0.5 text-[10px] rounded-sm transition-all capitalize bg-background shadow-sm text-foreground font-medium"
                        >
                            jobs
                        </button>
                    </div>}
                    <div className={mobile ? 'flex flex-col items-stretch gap-1.5' : 'flex items-center justify-between gap-2'}>
                        <div className="flex flex-col gap-1 w-full">
                            {panelMode === 'gallery' && (
                                <div className={`${mobile ? 'grid grid-cols-4 gap-1 w-full' : 'flex items-center gap-1 flex-wrap'}`}>
                                    {([
                                        { key: 'all', label: 'All' },
                                        { key: 'common', icon: ImageIcon, title: 'Common', activeClass: 'text-blue-400 border-blue-500/40 bg-blue-500/10' },
                                        { key: 'draft', icon: PenSquare, title: 'Drafts', activeClass: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
                                        { key: 'upscale', icon: Sparkles, title: 'Upscale', activeClass: 'text-violet-400 border-violet-500/40 bg-violet-500/10' },
                                    ] as const).map((item) => {
                                        const active = semanticFilter === item.key;
                                        const Icon = 'icon' in item ? item.icon : null;
                                        return (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={() => setSemanticFilter(item.key)}
                                                title={'title' in item ? item.title : item.label}
                                                aria-label={'title' in item ? item.title : item.label}
                                                className={`h-7 min-w-7 px-2 rounded border text-[10px] transition-colors inline-flex items-center justify-center gap-1 ${active
                                                    ? ('activeClass' in item ? item.activeClass : 'text-foreground border-border bg-background shadow-sm font-medium')
                                                    : 'text-muted-foreground border-border/40 bg-transparent grayscale opacity-40 hover:opacity-70 hover:border-border/70 hover:bg-muted/20'}`}
                                            >
                                                {Icon ? <Icon className="w-3.5 h-3.5" /> : item.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <div className={`${mobile ? 'grid grid-cols-6 gap-1 w-full' : 'flex items-center gap-1 flex-wrap'}`}>
                                {([
                                    { key: 'all', label: 'All' },
                                    { key: 'image', icon: ImageIcon, activeClass: 'text-blue-400 border-blue-500/40 bg-blue-500/10' },
                                    { key: 'video', icon: Video, activeClass: 'text-violet-400 border-violet-500/40 bg-violet-500/10' },
                                    { key: 'audio', icon: AudioLines, activeClass: 'text-orange-400 border-orange-500/40 bg-orange-500/10' },
                                ] as const).map((item) => {
                                    const active = item.key === 'all' ? isAllFilterActive : selectedFilters.includes(item.key);
                                    const Icon = 'icon' in item ? item.icon : null;
                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => toggleMediaFilter(item.key)}
                                            className={`h-7 px-2 rounded border text-[10px] transition-colors inline-flex items-center justify-center gap-1 ${active
                                                ? ('activeClass' in item ? item.activeClass : 'text-foreground border-border bg-background shadow-sm font-medium')
                                                : 'text-muted-foreground border-border/40 bg-transparent grayscale opacity-40 hover:opacity-70 hover:border-border/70 hover:bg-muted/20'}`}
                                        >
                                            {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
                                            {!Icon ? item.label : null}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className={`${mobile ? 'flex items-center gap-2 pt-0.5' : 'flex items-center gap-1'}`}>
                            {panelMode === 'gallery' && (
                                <div className={`${mobile ? 'flex items-center gap-2' : 'flex items-center gap-1'}`}>
                                    <button
                                        type="button"
                                        onClick={toggleGalleryFavorites}
                                        className={`h-7 w-7 rounded border text-[10px] transition-colors inline-flex items-center justify-center shrink-0 ${favoritesOnly ? 'text-pink-400 border-pink-500/40 bg-pink-500/10' : 'text-muted-foreground border-border/40 bg-transparent grayscale opacity-40 hover:opacity-70 hover:border-border/70 hover:bg-muted/20'}`}
                                    >
                                        <Heart className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={toggleGalleryTrash}
                                        className={`h-7 w-7 rounded border text-[10px] transition-colors inline-flex items-center justify-center shrink-0 ${showTrashed ? 'text-red-400 border-red-500/40 bg-red-500/10' : 'text-muted-foreground border-border/40 bg-transparent grayscale opacity-40 hover:opacity-70 hover:border-border/70 hover:bg-muted/20'}`}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                            {panelMode === 'jobs' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300"
                                    title="Delete all finished jobs"
                                    onClick={() => void handleClearFinishedJobs()}
                                    disabled={finishedJobsCount === 0}
                                >
                                    Clear finished
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`${mobile ? 'ml-auto h-7 w-7 rounded border border-border/40' : 'h-6 w-6'} text-muted-foreground hover:text-foreground hover:bg-muted/20`}
                                title={panelMode === 'gallery' ? 'Refresh gallery' : 'Refresh jobs'}
                                aria-label={panelMode === 'gallery' ? 'Refresh gallery' : 'Refresh jobs'}
                                onClick={() => {
                                    if (panelMode === 'gallery') {
                                        void fetchGalleryAssets(1);
                                    } else {
                                        void fetchJobsPage(1, false);
                                    }
                                }}
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                    {panelMode === 'gallery' && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                                <div className="truncate">{gallerySummaryParts.join(' • ')}</div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void handleGalleryBackfill()}
                                        disabled={isBackfillingGallery}
                                        className="text-[10px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                                    >
                                        {isBackfillingGallery ? 'Enriching...' : 'Backfill tags'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleGalleryDerivativesBackfill()}
                                        disabled={isBackfillingDerivatives}
                                        className="text-[10px] text-blue-400 hover:text-blue-300 disabled:opacity-50"
                                    >
                                        {isBackfillingDerivatives ? 'Generating...' : 'Backfill previews'}
                                    </button>
                                    {showTrashed && (
                                        <button
                                            type="button"
                                            onClick={() => void handleEmptyGalleryTrash()}
                                            disabled={isEmptyingTrash}
                                            className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-50"
                                        >
                                            {isEmptyingTrash ? 'Deleting...' : 'Empty trash'}
                                        </button>
                                    )}
                                    {gallerySearchQuery !== debouncedGallerySearchQuery && (
                                        <div className="text-blue-400">Updating...</div>
                                    )}
                                </div>
                            </div>
                            <div className={`${mobile ? 'grid grid-cols-1 gap-2' : 'flex gap-2'}`}>
                                <Input
                                    value={gallerySearchQuery}
                                    onChange={(e) => setGallerySearchQuery(e.target.value)}
                                    placeholder="Search by tags, asset id, source job..."
                                    className="h-9 text-xs"
                                />
                                <select
                                    value={gallerySort}
                                    onChange={(e) => setGallerySort(e.target.value as 'newest' | 'oldest' | 'favorites')}
                                    className="h-9 rounded-md border border-border bg-background px-2 text-xs"
                                >
                                    <option value="newest">Newest</option>
                                    <option value="oldest">Oldest</option>
                                    <option value="favorites">Favorites first</option>
                                </select>
                            </div>
                            {gallerySearchTokens.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {gallerySearchTokens.map(token => (
                                        <button
                                            key={token}
                                            type="button"
                                            onClick={() => handleGalleryTokenRemove(token)}
                                            className="text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                                        >
                                            {token} ×
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content List */}
            <div
                ref={panelMode === 'gallery' ? undefined : handleGalleryScrollerRef}
                className={panelMode === 'gallery' ? 'flex-1 min-h-0' : 'flex-1 overflow-y-auto'}
            >
                {!isMounted || (panelMode === 'jobs' ? isLoadingJobs : isLoadingGallery) ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                        <div className="w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center">
                            <FolderPlus className="w-5 h-5 opacity-50" />
                        </div>
                        <div className="text-xs">Loading...</div>
                    </div>
                ) : panelMode === 'gallery' ? (
                    filteredGalleryAssets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2 px-4 text-center">
                            <div className="w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center">
                                <FolderPlus className="w-5 h-5 opacity-50" />
                            </div>
                            <div className="text-xs">No gallery assets found</div>
                            <div className="text-[10px] opacity-70">
                                {gallerySearchTokens.length > 0
                                    ? 'Try removing a token or changing filters'
                                    : showTrashed
                                        ? 'Trash is empty for this selection'
                                        : 'Save items to gallery or broaden the current filters'}
                            </div>
                        </div>
                    ) : (
                        <div className="relative h-full min-h-0">
                            <VirtuosoGrid
                                ref={galleryGridRef}
                                scrollerRef={handleGalleryScrollerRef}
                                style={{ height: '100%' }}
                                data={galleryGridItems}
                                computeItemKey={(_, item) => item.asset.id}
                                listClassName="flex flex-wrap content-start px-1 py-2"
                                itemClassName={mobile ? 'box-border flex-none w-1/3 p-1' : 'box-border flex-none w-1/2 p-1'}
                                increaseViewportBy={{ top: 600, bottom: 900 }}
                                overscan={{ main: 700, reverse: 400 }}
                                rangeChanged={handleGalleryGridRangeChange}
                                startReached={() => {
                                    loadPreviousGalleryPages();
                                }}
                                endReached={() => {
                                    loadNextGalleryPages();
                                }}
                                itemContent={renderGalleryGridItem}
                            />
                            {(isLoadingPreviousGallery || isLoadingMoreGallery) && (
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 px-2 pb-2 text-[10px] text-muted-foreground">
                                    Loading more gallery items…
                                </div>
                            )}
                        </div>
                    )
                ) : filteredJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                        <div className="w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center">
                            <FolderPlus className="w-5 h-5 opacity-50" />
                        </div>
                        <div className="text-xs">No generations yet</div>
                    </div>
                ) : (
                    filteredJobs.map(job => {
                        const model = getModelById(job.modelId);
                        const executionLabel = formatExecution(getExecutionMs(job));
                        return (
                            <div
                                key={job.id}
                                onClick={() => {
                                    if (mobile && mobileTouchHandledRef.current?.kind === 'job' && mobileTouchHandledRef.current?.id === job.id) {
                                        mobileTouchHandledRef.current = null;
                                        return;
                                    }
                                    handleJobClick(job);
                                }}
                                onTouchEnd={() => {
                                    if (mobile) {
                                        handleMobileJobTouchEnd(job);
                                    }
                                }}
                                onMouseEnter={() => { if (!mobile) emitHoverPreview(job); }}
                                onMouseLeave={() => { if (!mobile) emitHoverPreview(null); }}
                                className={`group flex gap-3 cursor-pointer transition-all hover:bg-muted/5 border-b border-white/5 last:border-0 relative ${mobile ? 'p-2.5' : 'p-3'} ${mobile && mobileSelectedJobId === job.id ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : ''}`}
                                draggable={job.status === 'completed' && !!job.resultUrl}
                                onDragStart={(e) => {
                                    if (job.status === 'completed' && job.resultUrl) {
                                        const mediaData = {
                                            id: job.id,
                                            type: job.type,
                                            url: job.resultUrl,
                                            prompt: job.prompt,
                                            duration: 5000, // Default 5 seconds
                                        };
                                        e.dataTransfer.setData('application/json', JSON.stringify(mediaData));
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }
                                }}
                            >
                                {/* Thumbnail */}
                                <div className={`${mobile ? 'w-12 h-12' : 'w-14 h-14'} bg-black/20 rounded-md overflow-hidden flex-shrink-0 relative shadow-sm group-hover:shadow-md transition-shadow`}>
                                    {job.status === 'completed' && job.resultUrl ? (
                                        job.type === 'video' ? (
                                            <JobCardImageThumbnail
                                                thumbnailUrl={job.thumbnailUrl}
                                                alt={job.prompt || 'Generated video poster'}
                                            />
                                        ) : ['audio', 'tts', 'music'].includes(job.type) ? (
                                            <div className="w-full h-full flex items-center justify-center bg-purple-900/20 text-purple-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                                    <path fillRule="evenodd" d="M19.952 1.651a.75.75 0 01.298.599V16.303a3 3 0 01-2.176 2.884l-1.32.377a2.553 2.553 0 11-1.403-4.909l2.311-.66a1.5 1.5 0 001.088-1.442V6.994l-9 2.572v9.737a3 3 0 01-2.176 2.884l-1.32.377a2.553 2.553 0 11-1.402-4.909l2.31-.66a1.5 1.5 0 001.088-1.442V9.017 5.25a.75.75 0 01.544-.721l10.5-3a.75.75 0 01.658.122z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        ) : (
                                            <JobCardImageThumbnail
                                                thumbnailUrl={job.thumbnailUrl}
                                                resultUrl={job.resultUrl}
                                                alt={job.prompt || 'Generated image preview'}
                                            />
                                        )
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-muted/20">
                                            {job.status === 'failed' ? (
                                                <span className="text-red-500 text-[10px]">✕</span>
                                            ) : job.status === 'completed' && !job.resultUrl ? (
                                                <span className="text-amber-500 text-[10px]" title="Result missing">?</span>
                                            ) : (
                                                <div className="w-3 h-3 border-2 border-primary/50 border-t-primary rounded-full animate-spin" />
                                            )}
                                        </div>
                                    )}

                                    {/* Type Badge */}
                                    {job.type === 'video' && (
                                        <div className="absolute bottom-0 right-0 bg-purple-500/70 px-1 py-0.5 text-[6px] font-mono text-white uppercase rounded-tl-sm">
                                            VID
                                        </div>
                                    )}
                                    {job.type === 'image' && (
                                        <div className="absolute bottom-0 right-0 bg-blue-500/70 px-1 py-0.5 text-[6px] font-mono text-white uppercase rounded-tl-sm">
                                            IMG
                                        </div>
                                    )}
                                    {['audio', 'tts', 'music'].includes(job.type) && (
                                        <div className="absolute bottom-0 right-0 bg-orange-500/70 px-1 py-0.5 text-[6px] font-mono text-white uppercase rounded-tl-sm">
                                            AUD
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center justify-between">
                                            <span className={`${mobile ? 'text-[11px]' : 'text-xs'} font-medium text-foreground truncate pr-2`}>
                                                {model?.name || job.modelId}
                                            </span>
                                            <span className="text-[9px] text-muted-foreground/50 whitespace-nowrap bg-muted/10 px-1 py-0.5 rounded-[2px] border border-white/5">
                                                {model?.provider}
                                            </span>
                                        </div>
                                        <p className={`${mobile ? 'text-[9px]' : 'text-[10px]'} text-muted-foreground line-clamp-1 leading-tight opacity-80`}>
                                            {job.prompt || 'No prompt'}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-[9px] text-muted-foreground/40 font-medium">
                                            {timeAgo(job.createdAt)}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {job.status === 'queueing_up' && (
                                                <span className="text-[9px] text-orange-500 font-medium">Queueing Up</span>
                                            )}
                                            {job.status === 'queued' && (
                                                <span className="text-[9px] text-amber-500 font-medium">In Queue</span>
                                            )}
                                            {job.status === 'processing' && (
                                                <span className="text-[9px] text-blue-500 font-medium">Running</span>
                                            )}
                                            {job.status === 'finalizing' && (
                                                <span className="text-[9px] text-sky-500 font-medium">Finalizing</span>
                                            )}
                                            {job.status === 'failed' && (
                                                <span className="text-[9px] text-red-500 font-medium">{job.error === 'cancelled' ? 'Cancelled' : 'Failed'}</span>
                                            )}
                                            {executionLabel && (
                                                <span className="text-[9px] text-emerald-500 font-medium">⏱ {executionLabel}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons (Bottom Right - Hover) */}
                                {job.status === 'completed' && job.resultUrl && (
                                    <div className={`absolute bottom-2 right-2 flex gap-1 transition-all duration-200 ${mobile && mobileSelectedJobId === job.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        <div className="relative group/tooltip">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    reuseJobInput(job.id);
                                                }}
                                                className="p-1.5 text-muted-foreground/70 hover:text-primary hover:bg-primary/10 rounded-md transition-colors shadow-sm bg-background/80 backdrop-blur-sm border border-border/50"
                                                aria-label="Reuse all inputs from this generation"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                                    <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full right-0 mb-1 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded shadow-lg border border-border whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none">
                                                Reuse inputs
                                                <div className="absolute top-full right-2 -mt-px w-2 h-2 bg-popover border-r border-b border-border transform rotate-45"></div>
                                            </div>
                                        </div>

                                        {(job.type === 'image' || job.type === 'video') && (
                                            <div className="relative group/tooltip">
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        showToast(`Starting upscale for ${job.type}...`, 'info');
                                                        try {
                                                            const response = await fetch('/api/upscale', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    jobId: job.id,
                                                                    type: job.type
                                                                })
                                                            });
                                                            const data = await response.json();
                                                            if (data.success && data.job) {
                                                                console.log('Upscale job created:', data.job.id);
                                                                addJob(data.job);
                                                                showToast('Upscale job created and processing', 'success');
                                                            } else {
                                                                showToast(data.error || 'Failed to create upscale job', 'error');
                                                            }
                                                        } catch (error) {
                                                            console.error('Error creating upscale job:', error);
                                                            showToast('Failed to create upscale job', 'error');
                                                        }
                                                    }}
                                                    className="p-1.5 text-muted-foreground/70 hover:text-green-500 hover:bg-green-500/10 rounded-md transition-colors shadow-sm bg-background/80 backdrop-blur-sm border border-border/50"
                                                    aria-label={`Upscale ${job.type}`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                                        <path d="M10 3.75a2 2 0 10-4 0 2 2 0 004 0zM17.25 4.5a.75.75 0 000-1.5h-5.5a.75.75 0 000 1.5h5.5zM5 3.75a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5a.75.75 0 01.75.75zM4.25 17a.75.75 0 000-1.5h-1.5a.75.75 0 000 1.5h1.5zM17.25 17a.75.75 0 000-1.5h-5.5a.75.75 0 000 1.5h5.5zM9 10a.75.75 0 01.75-.75h5.5a.75.75 0 010 1.5h-5.5A.75.75 0 019 10zM4.25 10.75a.75.75 0 000-1.5h-1.5a.75.75 0 000 1.5h1.5zM10 16.25a2 2 0 10-4 0 2 2 0 004 0zM10 10a2 2 0 10-4 0 2 2 0 004 0z" />
                                                    </svg>
                                                </button>
                                                <div className="absolute bottom-full right-0 mb-1 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded shadow-lg border border-border whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none">
                                                    Upscale
                                                    <div className="absolute top-full right-2 -mt-px w-2 h-2 bg-popover border-r border-b border-border transform rotate-45"></div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Upscale + Frame Interpolation Button (Video only) */}
                                        {job.type === 'video' && (
                                            <div className="relative group/tooltip">
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        showToast('Starting upscale with frame interpolation...', 'info');
                                                        try {
                                                            const response = await fetch('/api/upscale', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    jobId: job.id,
                                                                    type: 'video-interpolation'
                                                                })
                                                            });
                                                            const data = await response.json();
                                                            if (data.success && data.job) {
                                                                console.log('Upscale + FI job created:', data.job.id);
                                                                addJob(data.job);
                                                                showToast('Upscale + FI job created and processing', 'success');
                                                            } else {
                                                                showToast(data.error || 'Failed to create upscale job', 'error');
                                                            }
                                                        } catch (error) {
                                                            console.error('Error creating upscale job:', error);
                                                            showToast('Failed to create upscale job', 'error');
                                                        }
                                                    }}
                                                    className="p-1.5 text-muted-foreground/70 hover:text-purple-500 hover:bg-purple-500/10 rounded-md transition-colors shadow-sm bg-background/80 backdrop-blur-sm border border-border/50"
                                                    aria-label="Upscale + Frame Interpolation"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                                    </svg>
                                                </button>
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full right-0 mb-1 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded shadow-lg border border-border whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none">
                                                    Upscale + Frame Interpolation
                                                    <div className="absolute top-full right-2 -mt-px w-2 h-2 bg-popover border-r border-b border-border transform rotate-45"></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Top Right Action (Cancel for active, Delete for finished) */}
                                {(job.status === 'completed' || job.status === 'failed') ? (
                                    <button
                                        onClick={(e) => void handleDeleteJob(e, job.id)}
                                        className="absolute top-2 right-2 p-1.5 text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => void handleCancelJob(e, job.id)}
                                        className="absolute top-2 right-2 p-1.5 text-muted-foreground/50 hover:text-amber-500 hover:bg-amber-500/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                        title="Cancel"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}

                {panelMode === 'jobs' && isMounted && hasNextPage && (
                    <div className="p-3 border-t border-border/60">
                        <Button
                            variant="outline"
                            className="w-full h-8 text-xs"
                            onClick={() => void fetchJobsPage(currentPage + 1, true)}
                            disabled={isLoadingMore}
                        >
                            {isLoadingMore ? 'Loading...' : 'Load more'}
                        </Button>
                    </div>
                )}
            </div>

            {/* Properties Panel - shows when keyframe is selected */}
            <PropertiesPanel />

            <JobDetailsDialog
                job={selectedJob}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                onNavigate={(direction) => navigateSelectedJob(direction)}
                currentIndex={selectedJobPosition}
                totalCount={filteredJobs.length}
            />

            <GalleryAssetDialog
                asset={selectedGalleryAsset}
                open={galleryDetailsOpen}
                onOpenChange={setGalleryDetailsOpen}
                onToggleFavorite={() => selectedGalleryAsset && void handleGalleryFavorite({ stopPropagation() {} } as React.MouseEvent, selectedGalleryAsset)}
                onTrash={() => selectedGalleryAsset && void handleGalleryTrash({ stopPropagation() {} } as React.MouseEvent, selectedGalleryAsset, !selectedGalleryAsset.trashed)}
                onPermanentDelete={() => selectedGalleryAsset && void handleGalleryPermanentDelete(selectedGalleryAsset)}
                onSaveTags={(tags) => selectedGalleryAsset ? handleGallerySaveTags(selectedGalleryAsset, tags) : undefined}
                onRemoveAutoTag={(tag) => selectedGalleryAsset ? handleGalleryRemoveAutoTag(selectedGalleryAsset, tag) : undefined}
                onTagClick={(tag) => handleGalleryTagClick(tag)}
            />

            <GalleryFullscreenViewer
                open={galleryViewerOpen}
                items={galleryViewerItems.map(asset => ({
                    id: asset.id,
                    url: asset.originalUrl,
                    favorited: asset.favorited,
                    type: asset.type,
                    bucket: asset.bucket,
                }))}
                currentIndex={galleryViewerIndex}
                onIndexChange={handleGalleryViewerIndexChange}
                onClose={handleGalleryViewerClose}
                onOpenInfo={(itemId) => {
                    const asset = galleryViewerItems.find((entry) => entry.id === itemId) || filteredGalleryAssets.find((entry) => entry.id === itemId) || null;
                    if (!asset) return;
                    applyGallerySelection(asset);
                    setGalleryDetailsOpen(true);
                }}
                onToggleFavorite={async (itemId) => {
                    const asset = galleryViewerItems.find((entry) => entry.id === itemId) || filteredGalleryAssets.find((entry) => entry.id === itemId);
                    if (!asset) return false;
                    return await updateGalleryFavorite(asset);
                }}
                renderFooterActions={(item, meta) => {
                    const asset = galleryViewerItems.find((entry) => entry.id === item.id) || filteredGalleryAssets.find((entry) => entry.id === item.id);
                    if (!asset || asset.type !== 'image') return null;
                    return (
                        <>
                            {asset.bucket !== 'draft' && asset.bucket !== 'upscale' ? (
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    className="h-10 w-10 rounded-full bg-black/70 hover:bg-black/85 text-white border border-white/10"
                                    onClick={() => void updateGalleryBucket(asset, 'draft')}
                                    aria-label="Mark as draft"
                                    title="Move to drafts"
                                >
                                    <PenSquare className="w-5 h-5" />
                                </Button>
                            ) : null}
                            {asset.bucket !== 'upscale' && meta.canMarkUpscale ? (
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    className="h-10 w-10 rounded-full bg-black/70 hover:bg-black/85 text-white border border-white/10"
                                    onClick={() => void updateGalleryBucket(asset, 'upscale')}
                                    aria-label="Mark as upscale"
                                    title="Move to upscale"
                                >
                                    <Sparkles className="w-5 h-5" />
                                </Button>
                            ) : null}
                        </>
                    );
                }}
            />
        </div>
    );
}
