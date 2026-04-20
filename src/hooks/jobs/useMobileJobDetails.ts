'use client';

import { useCallback, useEffect, useState } from 'react';

export type MobileJobDetailOutput = {
  outputId: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  alreadyInGallery: boolean;
  galleryAssetId: string | null;
};

export type MobileJobDetail = {
  id: string;
  workspaceId?: string | null;
  status: 'queueing_up' | 'queued' | 'processing' | 'finalizing' | 'completed' | 'failed';
  type: 'image' | 'video' | 'audio' | 'tts' | 'music';
  modelId: string;
  prompt: string;
  resultUrl?: string | null;
  thumbnailUrl?: string | null;
  outputs: MobileJobDetailOutput[];
  error?: string | null;
  createdAt?: string | number;
  completedAt?: string | number | null;
  executionMs?: number | null;
};

export function useMobileJobDetails(jobId: string) {
  const [job, setJob] = useState<MobileJobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success || !data.job) {
        throw new Error(data.error || 'Failed to load job details');
      }
      setJob(data.job);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load job details');
      setJob(null);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    setIsLoading(true);
    void fetchJob();
  }, [fetchJob]);

  useEffect(() => {
    if (!job || !['queueing_up', 'queued', 'processing', 'finalizing'].includes(job.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchJob();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [fetchJob, job]);

  return {
    job,
    isLoading,
    error,
    refresh: fetchJob,
    setJob,
  };
}
