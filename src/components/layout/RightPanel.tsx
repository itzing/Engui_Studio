'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStudio, Job, Workspace } from '@/lib/context/StudioContext';
import { getModelById } from '@/lib/models/modelConfig';
import { JobDetailsDialog } from '@/components/workspace/JobDetailsDialog';
import { GalleryAssetDialog } from '@/components/workspace/GalleryAssetDialog';
import { GalleryFullscreenViewer } from '@/components/workspace/GalleryFullscreenViewer';
import { Search, RefreshCw, Info, ChevronDown, Plus, Trash2, FolderPlus, Check, X, Image as ImageIcon, Video, AudioLines, Heart } from 'lucide-react';
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
    derivativeStatus?: string;
    enrichmentStatus?: string;
    addedToGalleryAt: string;
    updatedAt?: string;
};

const TYPE_FILTERS = ['image', 'video', 'audio'] as const;
type MediaFilter = typeof TYPE_FILTERS[number];
const galleryFilter = (asset: GalleryAsset, filters: MediaFilter[]) => filters.includes(asset.type);

export default function RightPanel({ mobile = false }: { mobile?: boolean }) {
    const { jobs, workspaces, activeWorkspaceId, selectWorkspace, createWorkspace, deleteJob, cancelJob, clearFinishedJobs, reuseJobInput, addJob } = useStudio();
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [selectedGalleryAsset, setSelectedGalleryAsset] = useState<GalleryAsset | null>(null);
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
    const [isMounted, setIsMounted] = useState(false);
    const [loadedJobs, setLoadedJobs] = useState<Job[]>([]);
    const [galleryAssets, setGalleryAssets] = useState<GalleryAsset[]>([]);
    const [showTrashed, setShowTrashed] = useState(false);
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [gallerySearchQuery, setGallerySearchQuery] = useState('');
    const [debouncedGallerySearchQuery, setDebouncedGallerySearchQuery] = useState('');
    const [gallerySort, setGallerySort] = useState<'newest' | 'oldest' | 'favorites'>('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [galleryPage, setGalleryPage] = useState(1);
    const [galleryHasNextPage, setGalleryHasNextPage] = useState(false);
    const [isLoadingJobs, setIsLoadingJobs] = useState(false);
    const [isLoadingGallery, setIsLoadingGallery] = useState(false);
    const [isBackfillingGallery, setIsBackfillingGallery] = useState(false);
    const [isBackfillingDerivatives, setIsBackfillingDerivatives] = useState(false);
    const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isLoadingMoreGallery, setIsLoadingMoreGallery] = useState(false);
    const pageSize = 50;

    // Workspace Creation State
    const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const restoredMobileViewerRef = useRef(false);
    const mobileViewerPersistenceReadyRef = useRef(false);

    const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
    const { showToast } = useToast();


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
        if (savedPanelMode === 'jobs' || savedPanelMode === 'gallery') {
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
        }
    }, [mobile]);

    useEffect(() => {
        if (!isMounted || typeof window === 'undefined') return;
        window.localStorage.setItem(mobile ? 'engui.mobile.library.panelMode' : 'engui.rightPanel.mode', panelMode);
        if (mobile) {
            window.localStorage.setItem('engui.mobile.library.filter', selectedFilters.length === TYPE_FILTERS.length ? 'all' : selectedFilters.join(','));
            window.localStorage.setItem('engui.mobile.library.search', gallerySearchQuery);
            window.localStorage.setItem('engui.mobile.library.sort', gallerySort);
        }
        window.dispatchEvent(new CustomEvent('rightPanelModeChanged', {
            detail: panelMode,
        }));
    }, [gallerySearchQuery, gallerySort, isMounted, mobile, panelMode, selectedFilters]);

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
                const asset = galleryAssets.find(item => item.id === detail.id);
                if (!asset) return;
                setSelectedGalleryAsset(asset);
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
    }, [galleryAssets, jobs, loadedJobs]);

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

    const fetchGalleryAssetsPage = useCallback(async (page: number) => {
        if (!activeWorkspaceId) return null;

        const params = new URLSearchParams({
            workspaceId: activeWorkspaceId,
            page: String(page),
            limit: String(pageSize),
            includeTrashed: showTrashed ? 'true' : 'false',
            onlyTrashed: showTrashed ? 'true' : 'false',
            type: getApiType(selectedFilters) || 'all',
            favoritesOnly: favoritesOnly ? 'true' : 'false',
            q: debouncedGallerySearchQuery,
            sort: gallerySort,
        });

        const response = await fetch(`/api/gallery/assets?${params.toString()}`, {
            cache: 'no-store',
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch gallery assets');
        }

        return {
            assets: (data.assets || []) as GalleryAsset[],
            hasNextPage: !!data.pagination?.hasNextPage,
        };
    }, [activeWorkspaceId, debouncedGallerySearchQuery, favoritesOnly, gallerySort, selectedFilters, showTrashed]);

    const fetchGalleryAssets = useCallback(async (page: number, append = false) => {
        if (!activeWorkspaceId) return;

        if (append) {
            setIsLoadingMoreGallery(true);
        } else {
            setIsLoadingGallery(true);
        }

        try {
            const result = await fetchGalleryAssetsPage(page);
            if (!result) return;
            const nextAssets = result.assets;
            setGalleryAssets(prev => append ? [...prev, ...nextAssets] : nextAssets);
            setGalleryPage(page);
            setGalleryHasNextPage(result.hasNextPage);
        } catch (error) {
            console.error('Failed to fetch gallery assets:', error);
            if (!append) {
                setGalleryAssets([]);
            }
        } finally {
            setIsLoadingGallery(false);
            setIsLoadingMoreGallery(false);
        }
    }, [activeWorkspaceId, fetchGalleryAssetsPage]);

    useEffect(() => {
        setSelectedJob(null);
        setSelectedGalleryAsset(null);
        setDetailsOpen(false);
        setGalleryDetailsOpen(false);
        if (!activeWorkspaceId) {
            setLoadedJobs([]);
            setGalleryAssets([]);
            setCurrentPage(1);
            setHasNextPage(false);
            setGalleryPage(1);
            setGalleryHasNextPage(false);
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
        if (!activeWorkspaceId) return;
        void fetchGalleryAssets(1, false);
    }, [activeWorkspaceId, fetchGalleryAssets]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleGalleryAssetChanged = (event: Event) => {
            const customEvent = event as CustomEvent<{ workspaceId?: string; assetId?: string; reason?: string }>;
            if (!customEvent.detail?.workspaceId || customEvent.detail.workspaceId !== activeWorkspaceId) return;
            void fetchGalleryAssets(1, false);
        };

        window.addEventListener('galleryAssetChanged', handleGalleryAssetChanged as EventListener);
        return () => window.removeEventListener('galleryAssetChanged', handleGalleryAssetChanged as EventListener);
    }, [activeWorkspaceId, fetchGalleryAssets]);

    useEffect(() => {
        if (!activeWorkspaceId || panelMode !== 'gallery') return;

        const hasPendingGalleryWork = galleryAssets.some(asset =>
            asset.derivativeStatus === 'pending'
            || asset.derivativeStatus === 'processing'
            || asset.enrichmentStatus === 'pending'
            || asset.enrichmentStatus === 'processing'
        );

        if (!hasPendingGalleryWork) return;

        const interval = window.setInterval(() => {
            void fetchGalleryAssets(1, false);
        }, 2500);

        return () => window.clearInterval(interval);
    }, [activeWorkspaceId, panelMode, galleryAssets, fetchGalleryAssets]);


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
            setMobileSelectedGalleryAssetId(null);

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

    const emitGallerySelection = useCallback((asset: GalleryAsset | null) => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent('rightPanelGallerySelect', {
            detail: asset ? { id: asset.id } : null,
        }));
    }, []);

    const handleGalleryAssetClick = (asset: GalleryAsset) => {
        const itemIndex = filteredGalleryAssets.findIndex(item => item.id === asset.id);

        if (mobile) {
            const isSameAsset = mobileSelectedGalleryAssetId === asset.id;
            setSelectedGalleryAsset(asset);
            setMobileSelectedGalleryAssetId(asset.id);
            setMobileSelectedJobId(null);
            emitGallerySelection(asset);
            setGalleryDetailsOpen(false);

            if (!isSameAsset) {
                return;
            }
        } else {
            setSelectedGalleryAsset(asset);
            emitGallerySelection(asset);
            setGalleryDetailsOpen(false);
        }

        setGalleryViewerItems(filteredGalleryAssets);
        setGalleryViewerPage(galleryPage);
        setGalleryViewerHasNextPage(galleryHasNextPage);
        setGalleryViewerIndex(itemIndex >= 0 ? itemIndex : 0);
        setGalleryViewerOpen(true);
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

    const emitGalleryHoverPreview = (asset: GalleryAsset | null) => {
        if (typeof window === 'undefined') return;
        const detail = asset ? {
            id: asset.id,
            type: asset.type,
            url: asset.originalUrl,
            prompt: (asset.userTags || asset.autoTags || []).join(', '),
            modelId: 'gallery',
            workspaceId: asset.workspaceId,
            sourceJobId: asset.sourceJobId,
            status: 'completed',
            createdAt: new Date(asset.addedToGalleryAt).getTime(),
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
    const filteredGalleryAssets = galleryAssets;

    const handleGalleryViewerIndexChange = useCallback((index: number) => {
        const asset = galleryViewerItems[index];
        if (!asset) return;
        setGalleryViewerIndex(index);
        setSelectedGalleryAsset(asset);
        emitGallerySelection(asset);
    }, [emitGallerySelection, galleryViewerItems]);

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
        if (panelMode !== 'gallery' || galleryAssets.length === 0 || restoredMobileViewerRef.current) return;

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

            const asset = galleryAssets.find((entry) => entry.id === saved.assetId);
            if (!asset) return;

            const itemIndex = filteredGalleryAssets.findIndex((entry) => entry.id === asset.id);
            setSelectedGalleryAsset(asset);
            setMobileSelectedGalleryAssetId(asset.id);
            setGalleryViewerItems(filteredGalleryAssets);
            setGalleryViewerPage(galleryPage);
            setGalleryViewerHasNextPage(galleryHasNextPage);
            setGalleryViewerIndex(itemIndex >= 0 ? itemIndex : 0);
            setGalleryViewerOpen(true);
            restoredMobileViewerRef.current = true;
            mobileViewerPersistenceReadyRef.current = true;
        } catch {
            restoredMobileViewerRef.current = true;
            mobileViewerPersistenceReadyRef.current = true;
        }
    }, [filteredGalleryAssets, galleryAssets, galleryHasNextPage, galleryPage, mobile, panelMode]);

    useEffect(() => {
        if (!mobile || typeof window === 'undefined' || !mobileViewerPersistenceReadyRef.current) return;
        window.localStorage.setItem('engui.mobile.library.viewer', JSON.stringify({
            open: galleryViewerOpen,
            assetId: galleryViewerOpen ? (galleryViewerItems[galleryViewerIndex]?.id || selectedGalleryAsset?.id || null) : null,
        }));
    }, [galleryViewerIndex, galleryViewerItems, galleryViewerOpen, mobile, selectedGalleryAsset?.id]);

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
        setGalleryAssets(prev => prev.map(item => item.id === asset.id ? { ...item, favorited: nextFavorited } : item));
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
            setGalleryAssets(prev => prev.map(item => item.id === asset.id ? { ...item, favorited: asset.favorited } : item));
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

    const handleGalleryTagClick = (tag: string) => {
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
                return TYPE_FILTERS.filter(entry => entry !== target);
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
        setGalleryAssets(prev => prev.map(item => item.id === asset.id ? { ...item, userTags: tags } : item));
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
            setGalleryAssets(prev => prev.map(item => item.id === asset.id ? { ...item, userTags: asset.userTags || [] } : item));
            setSelectedGalleryAsset(prev => prev && prev.id === asset.id ? { ...prev, userTags: asset.userTags || [] } : prev);
            showToast(error instanceof Error ? error.message : 'Failed to save tags', 'error');
        }
    };

    const handleGalleryRemoveAutoTag = async (asset: GalleryAsset, tagToRemove: string) => {
        const nextAutoTags = (asset.autoTags || []).filter(tag => tag !== tagToRemove);
        setGalleryAssets(prev => prev.map(item => item.id === asset.id ? { ...item, autoTags: nextAutoTags } : item));
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
            setGalleryAssets(prev => prev.map(item => item.id === asset.id ? { ...item, autoTags: asset.autoTags || [] } : item));
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
            void fetchGalleryAssets(1, false);
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
            void fetchGalleryAssets(1, false);
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
            setGalleryAssets(prev => prev.filter(item => item.id !== asset.id));
            if (selectedGalleryAsset?.id === asset.id) {
                setSelectedGalleryAsset(null);
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
            void fetchGalleryAssets(1, false);
            if (selectedGalleryAsset?.trashed) {
                setSelectedGalleryAsset(null);
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
        setGalleryAssets(prev => prev.map(item => item.id === asset.id ? { ...item, trashed: nextTrashed } : item));
        if (selectedGalleryAsset?.id === asset.id) {
            setSelectedGalleryAsset(prev => prev ? { ...prev, trashed: nextTrashed } : prev);
            if (!showTrashed && nextTrashed) {
                setGalleryDetailsOpen(false);
                setSelectedGalleryAsset(null);
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
                setGalleryAssets(prev => prev.filter(item => !item.trashed));
            }
        } catch (error) {
            console.error('Failed to update trash state:', error);
            setGalleryAssets(prev => prev.map(item => item.id === asset.id ? { ...item, trashed: asset.trashed } : item));
            setSelectedGalleryAsset(prev => prev && prev.id === asset.id ? { ...prev, trashed: asset.trashed } : prev);
            showToast(error instanceof Error ? error.message : 'Failed to update trash state', 'error');
        }
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
                    <div className="flex items-center gap-1 bg-muted/30 rounded-md p-0.5 w-fit">
                        {(['jobs', 'gallery'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setPanelMode(mode)}
                                className={`px-2 py-0.5 text-[10px] rounded-sm transition-all capitalize ${panelMode === mode
                                    ? 'bg-background shadow-sm text-foreground font-medium'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                    }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                    <div className={mobile ? 'flex flex-col items-stretch gap-2' : 'flex items-center justify-between gap-2'}>
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
                                            : 'text-muted-foreground border-border/50 bg-transparent grayscale opacity-70 hover:opacity-100 hover:border-border hover:bg-muted/30'}`}
                                    >
                                        {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
                                        {!Icon ? item.label : null}
                                    </button>
                                );
                            })}
                        </div>
                        <div className={`${mobile ? 'flex flex-wrap items-center gap-1 justify-between' : 'flex items-center gap-1'}`}>
                            {panelMode === 'gallery' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={toggleGalleryFavorites}
                                        className={`h-7 px-2 rounded border text-[10px] transition-colors inline-flex items-center justify-center gap-1 ${favoritesOnly ? 'text-pink-400 border-pink-500/40 bg-pink-500/10' : 'text-muted-foreground border-border/50 bg-transparent grayscale opacity-70 hover:opacity-100 hover:border-border hover:bg-muted/30'}`}
                                    >
                                        <Heart className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={toggleGalleryTrash}
                                        className={`h-7 px-2 rounded border text-[10px] transition-colors inline-flex items-center justify-center gap-1 ${showTrashed ? 'text-red-400 border-red-500/40 bg-red-500/10' : 'text-muted-foreground border-border/50 bg-transparent grayscale opacity-70 hover:opacity-100 hover:border-border hover:bg-muted/30'}`}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </>
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
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                title={panelMode === 'gallery' ? 'Refresh gallery' : 'Refresh jobs'}
                                aria-label={panelMode === 'gallery' ? 'Refresh gallery' : 'Refresh jobs'}
                                onClick={() => {
                                    if (panelMode === 'gallery') {
                                        void fetchGalleryAssets(1, false);
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
            <div className="flex-1 overflow-y-auto">
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
                        <div className={`${mobile ? 'grid grid-cols-3 gap-2 p-2' : 'grid grid-cols-2 gap-2 p-2'}`}>
                            {filteredGalleryAssets.map(asset => (
                                <button
                                    key={asset.id}
                                    type="button"
                                    onClick={() => handleGalleryAssetClick(asset)}
                                    onMouseEnter={() => { if (!mobile) emitGalleryHoverPreview(asset); }}
                                    onMouseLeave={() => { if (!mobile) emitGalleryHoverPreview(null); }}
                                    className={`group text-left rounded-lg overflow-hidden border bg-muted/10 hover:bg-muted/20 transition-colors relative ${mobile && mobileSelectedGalleryAssetId === asset.id ? 'border-primary ring-1 ring-primary/40 bg-primary/10' : 'border-border'}`}
                                >
                                    <div className="aspect-square bg-black/30 flex items-center justify-center overflow-hidden">
                                        {asset.type === 'video' ? (
                                            asset.thumbnailUrl ? (
                                                <img src={asset.thumbnailUrl} alt="Gallery video thumbnail" className="w-full h-full object-cover" />
                                            ) : (
                                                <video src={asset.previewUrl || asset.originalUrl} poster={asset.thumbnailUrl || undefined} className="w-full h-full object-cover" muted />
                                            )
                                        ) : asset.type === 'audio' ? (
                                            <div className="w-full h-full flex items-center justify-center text-orange-400 text-xs font-medium">AUDIO</div>
                                        ) : (
                                            <img src={asset.previewUrl || asset.originalUrl} alt="Gallery asset" className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    <div className={`absolute top-2 right-2 flex gap-1 transition-opacity ${mobile && mobileSelectedGalleryAssetId === asset.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        <button
                                            type="button"
                                            onClick={(e) => void handleGalleryFavorite(e, asset)}
                                            className={`p-1 rounded-md backdrop-blur-sm border ${asset.favorited ? 'bg-pink-500/20 text-pink-400 border-pink-500/30' : 'bg-background/80 text-muted-foreground border-border/50 hover:text-pink-400'}`}
                                            title={asset.favorited ? 'Unfavorite' : 'Favorite'}
                                        >
                                            ♥
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => void handleGalleryTrash(e, asset, !asset.trashed)}
                                            className="p-1 rounded-md backdrop-blur-sm border bg-background/80 text-muted-foreground border-border/50 hover:text-red-400"
                                            title={asset.trashed ? 'Restore from trash' : 'Move to trash'}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className={`${mobile ? 'p-1.5 space-y-1' : 'p-2 space-y-1'}`}>
                                        <div className="text-[10px] font-medium capitalize text-foreground flex items-center gap-1 flex-wrap">
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
                                        {!mobile && <div className="text-[9px] text-muted-foreground truncate">{asset.sourceOutputId || asset.id}</div>}
                                        {!mobile && !!(asset.userTags?.length || asset.autoTags?.length) && (
                                            <div className="flex flex-wrap gap-1 pt-1">
                                                {(asset.userTags || []).slice(0, 2).map(tag => (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleGalleryTagClick(tag);
                                                        }}
                                                        className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                                {(asset.autoTags || []).slice(0, Math.max(0, 2 - (asset.userTags || []).length)).map(tag => (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleGalleryTagClick(tag);
                                                        }}
                                                        className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
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
                                onClick={() => handleJobClick(job)}
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
                                            <video src={job.resultUrl} className="w-full h-full object-cover" muted />
                                        ) : ['audio', 'tts', 'music'].includes(job.type) ? (
                                            <div className="w-full h-full flex items-center justify-center bg-purple-900/20 text-purple-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                                    <path fillRule="evenodd" d="M19.952 1.651a.75.75 0 01.298.599V16.303a3 3 0 01-2.176 2.884l-1.32.377a2.553 2.553 0 11-1.403-4.909l2.311-.66a1.5 1.5 0 001.088-1.442V6.994l-9 2.572v9.737a3 3 0 01-2.176 2.884l-1.32.377a2.553 2.553 0 11-1.402-4.909l2.31-.66a1.5 1.5 0 001.088-1.442V9.017 5.25a.75.75 0 01.544-.721l10.5-3a.75.75 0 01.658.122z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        ) : (
                                            <img src={job.resultUrl} alt="Thumbnail" className="w-full h-full object-cover" />
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

                {panelMode === 'gallery' && isMounted && galleryHasNextPage && (
                    <div className="p-3 border-t border-border/60">
                        <Button
                            variant="outline"
                            className="w-full h-8 text-xs"
                            onClick={() => void fetchGalleryAssets(galleryPage + 1, true)}
                            disabled={isLoadingMoreGallery}
                        >
                            {isLoadingMoreGallery ? 'Loading...' : 'Load more'}
                        </Button>
                    </div>
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
                }))}
                currentIndex={galleryViewerIndex}
                onIndexChange={handleGalleryViewerIndexChange}
                onClose={() => setGalleryViewerOpen(false)}
                onOpenInfo={(itemId) => {
                    const asset = galleryViewerItems.find((entry) => entry.id === itemId) || filteredGalleryAssets.find((entry) => entry.id === itemId) || null;
                    if (!asset) return;
                    setSelectedGalleryAsset(asset);
                    setGalleryDetailsOpen(true);
                }}
                onToggleFavorite={async (itemId) => {
                    const asset = galleryViewerItems.find((entry) => entry.id === itemId) || filteredGalleryAssets.find((entry) => entry.id === itemId);
                    if (!asset) return false;
                    return await updateGalleryFavorite(asset);
                }}
            />
        </div>
    );
}
