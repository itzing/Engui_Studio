'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FolderPlus, Loader2, PenSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspaceFetch } from '@/lib/workspaces/useWorkspaceFetch';
import type { MobileJobDetailOutput } from '@/hooks/jobs/useMobileJobDetails';

type Bucket = 'common' | 'draft';
type OutputUpdate = (output: MobileJobDetailOutput) => MobileJobDetailOutput;

export function useMobileJobGalleryActions(onUpdate: (jobId: string, outputId: string, update: OutputUpdate) => void) {
  const fetch = useWorkspaceFetch();
  const [feedback, setFeedback] = useState<{ jobId: string; text: string; error: boolean } | null>(null);
  const [pending, setPending] = useState<{ jobId: string; outputId: string; bucket: Bucket } | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), feedback.error ? 4500 : 2500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const toggleBucket = async (jobId: string, output: MobileJobDetailOutput, bucket: Bucket) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPending({ jobId, outputId: output.outputId, bucket });
    setFeedback(null);
    const controller = new AbortController();
    controllerRef.current = controller;
    const saved = output.savedBuckets.includes(bucket);
    try {
      if (saved) {
        const ids = [...new Set(output.galleryAssetIdsByBucket[bucket] || [])];
        if (!ids.length) throw new Error('Refresh job details before removing this item.');
        for (const id of ids) {
          if (!mountedRef.current) return;
          const response = await fetch(`/api/gallery/assets/${encodeURIComponent(id)}/trash`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trashed: true }), signal: controller.signal,
          });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error('Could not remove item. Please try again.');
          if (!mountedRef.current) return;
          onUpdate(jobId, output.outputId, (current) => {
            const remaining = (current.galleryAssetIdsByBucket[bucket] || []).filter((assetId) => assetId !== id);
            const galleryAssetIdsByBucket = { ...current.galleryAssetIdsByBucket, [bucket]: remaining };
            const savedBuckets = remaining.length ? current.savedBuckets : current.savedBuckets.filter((value) => value !== bucket);
            return {
              ...current, galleryAssetIdsByBucket, savedBuckets,
              alreadyInGallery: savedBuckets.length > 0,
              galleryAssetId: current.galleryAssetId === id
                ? Object.values(galleryAssetIdsByBucket).flat()[0] || null
                : current.galleryAssetId,
            };
          });
        }
      } else {
        const response = await fetch('/api/gallery/assets/from-job-output', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, outputId: output.outputId, bucket }), signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.success || !data.asset?.id) throw new Error('Could not save item. Please try again.');
        if (!mountedRef.current) return;
        onUpdate(jobId, output.outputId, (current) => ({
          ...current,
          alreadyInGallery: true,
          galleryAssetId: current.galleryAssetId || data.asset.id,
          savedBuckets: current.savedBuckets.includes(bucket) ? current.savedBuckets : [...current.savedBuckets, bucket],
          galleryAssetIdsByBucket: {
            ...current.galleryAssetIdsByBucket,
            [bucket]: [...new Set([...(current.galleryAssetIdsByBucket[bucket] || []), data.asset.id])],
          },
        }));
      }
      if (mountedRef.current) setFeedback({ jobId, error: false, text: saved
        ? bucket === 'draft' ? 'Removed from Drafts. Moved to trash.' : 'Removed from Gallery. Moved to trash.'
        : bucket === 'draft' ? 'Draft saved' : 'Added to Gallery' });
    } catch (error) {
      if (mountedRef.current) setFeedback({ jobId, error: true, text: error instanceof Error ? error.message : 'Could not update item. Please try again.' });
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setPending(null);
    }
  };

  return { pending, toggleBucket, feedback };
}

export default function MobileJobGalleryActions({ jobId, output, actions, disabled = false }: {
  jobId: string;
  output: MobileJobDetailOutput;
  actions: ReturnType<typeof useMobileJobGalleryActions>;
  disabled?: boolean;
}) {
  const pendingBucket = actions.pending?.jobId === jobId && actions.pending.outputId === output.outputId ? actions.pending.bucket : null;
  return <>
    {actions.feedback?.jobId === jobId ? (
      <div role="status" aria-live="polite" className={`pointer-events-none absolute bottom-full right-0 mb-3 w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border bg-black/95 px-3 py-2 text-sm shadow-lg ${actions.feedback.error ? 'border-red-400/40 text-red-200' : 'border-white/20 text-white'}`}>
        {actions.feedback.text}
      </div>
    ) : null}
    {(['draft', 'common'] as const).map((bucket) => {
      const saved = output.savedBuckets.includes(bucket);
      // Upscale-only outputs keep their existing draft eligibility; saved drafts remain removable.
      if (bucket === 'draft' && !saved && output.savedBuckets.includes('upscale')) return null;
      const Icon = bucket === 'draft' ? PenSquare : FolderPlus;
      const label = bucket === 'draft'
        ? saved ? 'Remove output from drafts' : 'Save output as draft'
        : saved ? 'Remove job output from gallery' : 'Add job output to gallery';
      return <Button key={bucket} size="icon" variant="secondary"
        className={`h-10 w-10 rounded-full border ${saved
          ? bucket === 'draft' ? 'border-amber-300/50 bg-amber-950/90 text-amber-200 hover:bg-amber-900' : 'border-green-300/50 bg-green-950/90 text-green-200 hover:bg-green-900'
          : 'border-white/10 bg-black/70 text-white hover:bg-black/85'}`}
        onClick={() => void actions.toggleBucket(jobId, output, bucket)} disabled={disabled || actions.pending !== null}
        aria-label={label} title={label} aria-pressed={saved} aria-busy={pendingBucket === bucket}>
        {pendingBucket === bucket ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Icon className="h-5 w-5" aria-hidden="true" />}
      </Button>;
    })}
  </>;
}
