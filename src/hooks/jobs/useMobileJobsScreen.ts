'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '@/lib/context/StudioContext';

export type MobileJobsScreenItem = {
  id: string;
  modelId: string;
  type: 'image' | 'video' | 'audio' | 'tts' | 'music';
  status: 'queueing_up' | 'queued' | 'processing' | 'finalizing' | 'completed' | 'failed';
  prompt: string;
  createdAt: number;
  resultUrl?: string;
  thumbnailUrl?: string | null;
  workspaceId?: string | null;
  cost?: number | null;
  executionMs?: number;
  error?: string | null;
};

type JobsResponse = {
  success: boolean;
  jobs?: MobileJobsScreenItem[];
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  focus?: {
    jobId: string;
    found: boolean;
    page: number | null;
    indexOnPage: number | null;
    absoluteIndex: number | null;
  };
  error?: string;
};

type LoadedJobsPage = {
  page: number;
  startIndex: number;
  jobs: MobileJobsScreenItem[];
};

const PAGE_SIZE = 10;

export function useMobileJobsScreen() {
  const { activeWorkspaceId, workspaces, deleteJob, clearFinishedJobs, addJob } = useStudio();
  const effectiveWorkspaceId = activeWorkspaceId || workspaces[0]?.id || null;
  const [loadedPages, setLoadedPages] = useState<Record<number, LoadedJobsPage>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedAbsoluteIndex, setSelectedAbsoluteIndex] = useState<number | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [restoreTick, setRestoreTick] = useState(0);
  const [restoreAbsoluteIndex, setRestoreAbsoluteIndex] = useState<number | null>(null);
  const loadingPagesRef = useRef<Set<number>>(new Set());

  const storageKey = effectiveWorkspaceId ? `engui.jobs.lastViewed.${effectiveWorkspaceId}` : null;

  const loadedEntries = useMemo(() => {
    const entries = Object.values(loadedPages)
      .sort((a, b) => a.startIndex - b.startIndex)
      .flatMap((page) => page.jobs.map((job, index) => ({ job, absoluteIndex: page.startIndex + index })));
    const seen = new Set<number>();
    return entries.filter((entry) => {
      if (seen.has(entry.absoluteIndex)) return false;
      seen.add(entry.absoluteIndex);
      return true;
    });
  }, [loadedPages]);

  const itemsByAbsoluteIndex = useMemo(() => {
    const next: Record<number, MobileJobsScreenItem> = {};
    for (const entry of loadedEntries) next[entry.absoluteIndex] = entry.job;
    return next;
  }, [loadedEntries]);

  const jobIndexMap = useMemo(() => {
    const next: Record<string, number> = {};
    for (const entry of loadedEntries) next[entry.job.id] = entry.absoluteIndex;
    return next;
  }, [loadedEntries]);

  const loadedViewerItems = useMemo(
    () => loadedEntries
      .filter(({ job }) => job.status === 'completed' && !!job.resultUrl && (job.type === 'image' || job.type === 'video'))
      .map(({ job, absoluteIndex }) => ({
        id: job.id,
        url: job.resultUrl!,
        favorited: false,
        absoluteIndex,
      })),
    [loadedEntries],
  );

  const fetchPage = useCallback(async (page: number, options?: { focusJobId?: string | null }) => {
    const search = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(page),
    });
    if (effectiveWorkspaceId) search.set('workspaceId', effectiveWorkspaceId);
    if (options?.focusJobId) search.set('focusJobId', options.focusJobId);

    const response = await fetch(`/api/jobs?${search.toString()}`, { cache: 'no-store' });
    const data = await response.json() as JobsResponse;
    if (!response.ok || !data.success || !Array.isArray(data.jobs) || !data.pagination) {
      throw new Error(data.error || 'Failed to load jobs');
    }
    return data;
  }, [effectiveWorkspaceId]);

  const mergePage = useCallback((pageNumber: number, data: JobsResponse) => {
    if (!data.pagination) return;
    setLoadedPages((prev) => ({
      ...prev,
      [pageNumber]: {
        page: pageNumber,
        startIndex: (pageNumber - 1) * data.pagination!.limit,
        jobs: data.jobs || [],
      },
    }));
    setTotalCount(data.pagination.totalCount);
  }, []);

  const loadPage = useCallback(async (pageNumber: number, options?: { focusJobId?: string | null }) => {
    if (pageNumber < 1 || loadingPagesRef.current.has(pageNumber)) return null;
    loadingPagesRef.current.add(pageNumber);
    try {
      const data = await fetchPage(pageNumber, options);
      if (data.pagination) mergePage(data.pagination.page, data);
      return data;
    } finally {
      loadingPagesRef.current.delete(pageNumber);
    }
  }, [fetchPage, mergePage]);

  const hydrateInitialState = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const savedSelection = storageKey && typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
      setLoadedPages({});
      const focusData = await loadPage(1, { focusJobId: savedSelection });
      if (!focusData?.pagination) return;

      const focusPage = focusData.focus?.found && focusData.focus.page ? focusData.focus.page : focusData.pagination.page;
      const pagesToLoad = new Set<number>([focusPage]);
      if (focusPage > 1) pagesToLoad.add(focusPage - 1);
      if (focusPage * focusData.pagination.limit < focusData.pagination.totalCount) pagesToLoad.add(focusPage + 1);
      await Promise.all(Array.from(pagesToLoad).filter((page) => page !== focusData.pagination?.page).map((page) => loadPage(page)));

      const focusedJobId = focusData.focus?.found ? focusData.focus.jobId : null;
      const focusedAbsoluteIndex = focusData.focus?.found ? focusData.focus.absoluteIndex : null;
      const fallbackJobId = (focusData.jobs || [])[0]?.id || null;
      const fallbackAbsoluteIndex = (focusData.jobs || []).length > 0 ? (focusPage - 1) * focusData.pagination.limit : null;

      setSelectedJobId(focusedJobId || savedSelection || fallbackJobId);
      setSelectedAbsoluteIndex(typeof focusedAbsoluteIndex === 'number' ? focusedAbsoluteIndex : fallbackAbsoluteIndex);
      if (typeof focusedAbsoluteIndex === 'number') {
        setRestoreAbsoluteIndex(focusedAbsoluteIndex);
        setRestoreTick((value) => value + 1);
      } else {
        setRestoreAbsoluteIndex(null);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load jobs');
      setLoadedPages({});
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [loadPage, storageKey]);

  useEffect(() => {
    void hydrateInitialState();
  }, [hydrateInitialState]);

  useEffect(() => {
    if (!storageKey || !selectedJobId || typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, selectedJobId);
  }, [selectedJobId, storageKey]);

  useEffect(() => {
    if (!loadedEntries.some(({ job }) => ['queueing_up', 'queued', 'processing', 'finalizing'].includes(job.status))) return;
    const intervalId = window.setInterval(() => {
      void hydrateInitialState();
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [hydrateInitialState, loadedEntries]);

  const ensureRangeLoaded = useCallback(async (startIndex: number, endIndex: number) => {
    if (totalCount <= 0) return;
    const safeStart = Math.max(0, startIndex);
    const safeEnd = Math.min(totalCount - 1, endIndex);
    if (safeEnd < safeStart) return;

    const firstPage = Math.floor(safeStart / PAGE_SIZE) + 1;
    const lastPage = Math.floor(safeEnd / PAGE_SIZE) + 1;
    const missingPages: number[] = [];
    for (let page = firstPage; page <= lastPage; page += 1) {
      if (!loadedPages[page] && !loadingPagesRef.current.has(page)) missingPages.push(page);
    }
    if (missingPages.length === 0) return;

    setIsLoadingMore(true);
    try {
      await Promise.all(missingPages.map((page) => loadPage(page)));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load jobs range');
    } finally {
      setIsLoadingMore(false);
    }
  }, [loadPage, loadedPages, totalCount]);

  const selectedJob = useMemo(
    () => (selectedAbsoluteIndex !== null ? itemsByAbsoluteIndex[selectedAbsoluteIndex] || null : null),
    [itemsByAbsoluteIndex, selectedAbsoluteIndex],
  );

  const refresh = useCallback(async () => {
    await hydrateInitialState();
  }, [hydrateInitialState]);

  const handleJobPress = useCallback((job: MobileJobsScreenItem, absoluteIndex: number) => {
    if (selectedJobId === job.id && job.status === 'completed' && job.resultUrl && (job.type === 'image' || job.type === 'video')) {
      const index = loadedViewerItems.findIndex((entry) => entry.id === job.id);
      if (index >= 0) {
        setViewerIndex(index);
        setViewerOpen(true);
      }
      return;
    }
    setSelectedJobId(job.id);
    setSelectedAbsoluteIndex(absoluteIndex);
  }, [loadedViewerItems, selectedJobId]);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
    if (selectedAbsoluteIndex !== null) {
      setRestoreAbsoluteIndex(selectedAbsoluteIndex);
      setRestoreTick((value) => value + 1);
    }
  }, [selectedAbsoluteIndex]);

  const updateViewerIndex = useCallback((index: number) => {
    const item = loadedViewerItems[index];
    if (!item) return;
    setViewerIndex(index);
    setSelectedJobId(item.id);
    setSelectedAbsoluteIndex(item.absoluteIndex);
  }, [loadedViewerItems]);

  const removeJob = useCallback(async (jobId: string) => {
    await deleteJob(jobId);
    await hydrateInitialState();
  }, [deleteJob, hydrateInitialState]);

  const upscaleJob = useCallback(async (job: MobileJobsScreenItem) => {
    if (!(job.type === 'image' || job.type === 'video')) return;
    const response = await fetch('/api/upscale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id, type: job.type }),
    });
    const data = await response.json();
    if (!response.ok || !data.success || !data.job) {
      throw new Error(data.error || 'Failed to create upscale job');
    }
    addJob(data.job);
    await hydrateInitialState();
  }, [addJob, hydrateInitialState]);

  const clearFinished = useCallback(async () => {
    await clearFinishedJobs();
    await hydrateInitialState();
  }, [clearFinishedJobs, hydrateInitialState]);

  return {
    totalCount,
    pageSize: PAGE_SIZE,
    itemsByAbsoluteIndex,
    loadedViewerItems,
    isLoading,
    isLoadingMore,
    error,
    refresh,
    ensureRangeLoaded,
    selectedJobId,
    selectedAbsoluteIndex,
    selectedJob,
    handleJobPress,
    viewerOpen,
    viewerIndex,
    closeViewer,
    updateViewerIndex,
    restoreTick,
    restoreAbsoluteIndex,
    clearFinished,
    removeJob,
    upscaleJob,
    workspaceId: effectiveWorkspaceId,
    jobIndexMap,
  };
}
