'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStudio } from '@/lib/context/StudioContext';
import { buildJobPreviewItem } from '@/lib/mobile/mobilePreview';

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
};

export function useMobileJobsScreen() {
  const { activeWorkspaceId, workspaces } = useStudio();
  const effectiveWorkspaceId = activeWorkspaceId || workspaces[0]?.id || null;
  const [jobs, setJobs] = useState<MobileJobsScreenItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const search = new URLSearchParams({
        limit: '50',
      });
      if (effectiveWorkspaceId) {
        search.set('workspaceId', effectiveWorkspaceId);
      }
      const response = await fetch(`/api/jobs?${search.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.jobs)) {
        throw new Error(data.error || 'Failed to load jobs');
      }
      setJobs(data.jobs);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load jobs');
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveWorkspaceId]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (!jobs.some((job) => job.status === 'queueing_up' || job.status === 'queued' || job.status === 'processing' || job.status === 'finalizing')) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchJobs();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [fetchJobs, jobs]);

  const groupedJobs = useMemo(() => ({
    active: jobs.filter((job) => job.status !== 'completed' && job.status !== 'failed'),
    recent: jobs.filter((job) => job.status === 'completed' || job.status === 'failed'),
  }), [jobs]);

  return {
    jobs,
    groupedJobs,
    isLoading,
    error,
    refresh: fetchJobs,
    workspaceId: effectiveWorkspaceId,
    buildPreview: buildJobPreviewItem,
  };
}
