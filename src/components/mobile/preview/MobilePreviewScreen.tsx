'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clapperboard, FolderPlus, Image as ImageIcon, Info, Loader2, Rows3, Sparkles, Type, Zap } from 'lucide-react';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMobilePreviewState } from '@/hooks/mobile/useMobilePreviewState';
import { persistCreateReuseDraft } from '@/lib/create/persistCreateReuseDraft';

type JobDetail = {
  id: string;
  outputs?: Array<{
    outputId: string;
    type: 'image' | 'video' | 'audio';
    url: string;
    alreadyInGallery: boolean;
    galleryAssetId: string | null;
  }>;
};

export default function MobilePreviewScreen() {
  const router = useRouter();
  const { preview } = useMobilePreviewState();
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [isLoadingJobDetail, setIsLoadingJobDetail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!preview || preview.kind !== 'job') {
      setJobDetail(null);
      return;
    }

    let cancelled = false;
    const loadJobDetail = async () => {
      setIsLoadingJobDetail(true);
      try {
        const response = await fetch(`/api/jobs/${preview.id}`, { cache: 'no-store' });
        const data = await response.json();
        if (!cancelled && response.ok && data.success) {
          setJobDetail(data.job);
        }
      } catch {
        if (!cancelled) {
          setJobDetail(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingJobDetail(false);
        }
      }
    };

    void loadJobDetail();
    return () => {
      cancelled = true;
    };
  }, [preview]);

  const primaryOutput = useMemo(() => jobDetail?.outputs?.find((output) => output.outputId === 'output-1') || jobDetail?.outputs?.[0] || null, [jobDetail]);
  const alreadyInGallery = !!primaryOutput?.alreadyInGallery;

  const runReuse = async (action: 'txt2img' | 'img2img' | 'img2vid' = 'img2img') => {
    if (!preview || preview.type !== 'image') return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const endpoint = preview.kind === 'gallery'
        ? `/api/gallery/assets/${preview.id}/reuse`
        : `/api/jobs/${preview.id}/reuse`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preview.kind === 'gallery' ? { action } : { action, outputId: 'output-1' }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.payload) {
        throw new Error(data.error || 'Failed to prepare reuse payload');
      }
      persistCreateReuseDraft(data.payload);
      router.push('/m/create');
      setStatusMessage({ type: 'success', text: 'Opened in Create' });
    } catch (error) {
      setStatusMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to open in Create' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addToGallery = async () => {
    if (!preview || preview.kind !== 'job') return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/gallery/assets/from-job-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: preview.id, outputId: 'output-1' }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to add to gallery');
      }
      setStatusMessage({ type: 'success', text: data.alreadyInGallery ? 'Already in Gallery' : 'Added to Gallery' });
      setJobDetail((prev) => prev ? {
        ...prev,
        outputs: prev.outputs?.map((output, index) => index === 0 ? { ...output, alreadyInGallery: true, galleryAssetId: data.asset?.id || output.galleryAssetId } : output),
      } : prev);
    } catch (error) {
      setStatusMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to add to Gallery' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const upscale = async () => {
    if (!preview) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preview.kind === 'gallery' ? {
          galleryAssetId: preview.id,
          type: preview.type,
        } : {
          jobId: preview.id,
          type: preview.type,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create upscale job');
      }
      setStatusMessage({ type: 'success', text: 'Upscale job created' });
    } catch (error) {
      setStatusMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create upscale job' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!preview) {
    return (
      <MobileScreen>
        <MobileHeader title="Preview" subtitle="Select something from Jobs or Gallery to inspect it here." />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Nothing selected yet</h2>
            <p className="text-sm text-muted-foreground">Open Jobs or Gallery, tap an item, and it will load here.</p>
          </div>
          <div className="flex gap-3">
            <Button asChild><Link href="/m/jobs">Jobs</Link></Button>
            <Button variant="outline" asChild><Link href="/m/gallery">Gallery</Link></Button>
          </div>
        </div>
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobileHeader
        title="Preview"
        subtitle={preview.kind === 'gallery' ? 'Gallery asset preview' : 'Job result preview'}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={preview.kind === 'gallery' ? '/m/gallery' : '/m/jobs'}>{preview.kind === 'gallery' ? 'Gallery' : 'Jobs'}</Link>
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 custom-scrollbar">
        <div className="space-y-4">
          {statusMessage ? (
            <div className={`rounded-lg border px-3 py-2 text-sm ${statusMessage.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
              {statusMessage.text}
            </div>
          ) : null}

          <Card>
            <CardContent className="p-3">
              <div className="flex min-h-[18rem] items-center justify-center overflow-hidden rounded-lg border border-border bg-black/30">
                {preview.url ? (
                  preview.type === 'video' ? (
                    <video src={preview.url} controls playsInline className="max-h-[70vh] w-full object-contain" />
                  ) : preview.type === 'image' ? (
                    <img src={preview.url} alt={preview.prompt || preview.title || preview.id} className="max-h-[70vh] w-full object-contain" />
                  ) : (
                    <div className="p-6 text-sm text-muted-foreground">Audio preview is not yet implemented in the mobile Preview screen.</div>
                  )
                ) : (
                  <div className="p-6 text-sm text-muted-foreground">This item does not have a previewable media URL yet.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Details</CardDescription>
              <CardTitle className="text-lg">{preview.title || preview.modelId || preview.id}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Kind</span>
                <span>{preview.kind}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Type</span>
                <span>{preview.type}</span>
              </div>
              {preview.status ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <span>{preview.status}</span>
                </div>
              ) : null}
              {preview.prompt ? (
                <div className="space-y-1">
                  <div className="text-muted-foreground">Prompt</div>
                  <div className="whitespace-pre-wrap text-sm text-foreground">{preview.prompt}</div>
                </div>
              ) : null}
              {isLoadingJobDetail ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading job metadata...
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {preview.type === 'image' ? (
              <>
                <Button variant="outline" disabled={isSubmitting} onClick={() => void runReuse('txt2img')}>
                  <Type className="mr-2 h-4 w-4" />
                  To txt2img
                </Button>
                <Button disabled={isSubmitting} onClick={() => void runReuse('img2img')}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  To img2img
                </Button>
                <Button variant="outline" disabled={isSubmitting} onClick={() => void runReuse('img2vid')}>
                  <Clapperboard className="mr-2 h-4 w-4" />
                  To img2vid
                </Button>
              </>
            ) : null}
            {(preview.type === 'image' || preview.type === 'video') ? (
              <Button variant="outline" disabled={isSubmitting} onClick={() => void upscale()}>
                <Zap className="mr-2 h-4 w-4" />
                Upscale
              </Button>
            ) : null}
            {preview.kind === 'job' && preview.type === 'image' ? (
              <Button variant="outline" disabled={isSubmitting || alreadyInGallery} onClick={() => void addToGallery()}>
                <FolderPlus className="mr-2 h-4 w-4" />
                {alreadyInGallery ? 'Already in Gallery' : 'Add to Gallery'}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => router.push(preview.kind === 'gallery' ? '/m/gallery' : '/m/jobs')}>
              {preview.kind === 'gallery' ? <ImageIcon className="mr-2 h-4 w-4" /> : <Rows3 className="mr-2 h-4 w-4" />}
              Back to {preview.kind === 'gallery' ? 'Gallery' : 'Jobs'}
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Temporary preview route notes</CardDescription>
              <CardTitle className="text-lg">Info</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  This is the standalone mobile Preview screen from ENGUI-142. Dedicated detail routes for Jobs and Gallery still come next in ENGUI-143.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MobileScreen>
  );
}
