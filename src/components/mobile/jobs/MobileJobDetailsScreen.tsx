'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Clapperboard, Copy, Download, FolderPlus, Loader2, RefreshCw, Sparkles, Trash2, Type, X } from 'lucide-react';

type GalleryBucket = 'common' | 'draft';
import { persistCreateReuseDraft } from '@/lib/create/persistCreateReuseDraft';
import { persistPromptConstructorReuseDraft } from '@/lib/prompt-constructor/persistPromptConstructorReuseDraft';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { useMobileJobDetails } from '@/hooks/jobs/useMobileJobDetails';

function parseJobOptions(rawOptions: unknown): Record<string, any> {
  if (!rawOptions) return {};
  if (typeof rawOptions === 'string') {
    try {
      const parsed = JSON.parse(rawOptions);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof rawOptions === 'object' ? rawOptions as Record<string, any> : {};
}

function compactLoraName(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const normalized = value.trim().split('/').pop() || value.trim();
  return normalized.replace(/\.safetensors$/i, '');
}

export default function MobileJobDetailsScreen({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { job, isLoading, error, refresh, setJob } = useMobileJobDetails(jobId);
  const selectedOutput = job?.outputs?.[0] || null;
  const isRunning = job ? ['queueing_up', 'queued', 'processing', 'finalizing'].includes(job.status) : false;
  const isFinished = job ? ['completed', 'failed'].includes(job.status) : false;
  const hasSceneSnapshot = !!(job as any)?.sceneSnapshotJson;
  const loraSummary = useMemo(() => {
    if (!job) return '';
    const options = parseJobOptions((job as any).options);

    const zImageSlots = Array.isArray(options.zImageLoraSlots)
      ? options.zImageLoraSlots
          .map((slot: any) => {
            const name = compactLoraName(slot?.path);
            if (!name) return null;
            const weight = typeof slot?.weight === 'number' && Number.isFinite(slot.weight) ? slot.weight : 1;
            return `${name} (${weight})`;
          })
          .filter(Boolean)
      : [];

    if (zImageSlots.length > 0) {
      return zImageSlots.join(' • ');
    }

    const simpleSlots = [1, 2, 3, 4]
      .map((index) => {
        const pathKey = index === 1 ? 'lora' : `lora${index}`;
        const weightKey = index === 1 ? 'loraWeight' : `loraWeight${index}`;
        const name = compactLoraName(options[pathKey]);
        if (!name) return null;
        const weight = typeof options[weightKey] === 'number' && Number.isFinite(options[weightKey]) ? options[weightKey] : 1;
        return `${name} (${weight})`;
      })
      .filter(Boolean);

    if (simpleSlots.length > 0) {
      return simpleSlots.join(' • ');
    }

    const arraySlots = Array.isArray(options.lora)
      ? options.lora
          .map((entry: any) => {
            if (!Array.isArray(entry)) return null;
            const name = compactLoraName(entry[0]);
            if (!name) return null;
            const weight = typeof entry[1] === 'number' && Number.isFinite(entry[1]) ? entry[1] : 1;
            return `${name} (${weight})`;
          })
          .filter(Boolean)
      : [];

    return arraySlots.join(' • ');
  }, [job]);

  const downloadOutput = async () => {
    if (!selectedOutput?.url) return;
    try {
      const response = await fetch(selectedOutput.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job-${jobId}-${selectedOutput.outputId}.${selectedOutput.type === 'video' ? 'mp4' : selectedOutput.type === 'audio' ? 'mp3' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      window.open(selectedOutput.url, '_blank', 'noopener,noreferrer');
    }
  };

  const saveToBucket = async (bucket: GalleryBucket) => {
    if (!job || !selectedOutput || selectedOutput.savedBuckets.includes(bucket)) return;
    const response = await fetch('/api/gallery/assets/from-job-output', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id, outputId: selectedOutput.outputId, bucket }),
    });
    const data = await response.json();
    if (response.ok && data.success) {
      setJob((prev) => prev ? ({
        ...prev,
        outputs: prev.outputs.map((output, index) => index === 0 ? {
          ...output,
          alreadyInGallery: true,
          galleryAssetId: output.galleryAssetId || data.asset?.id || null,
          savedBuckets: output.savedBuckets.includes(bucket) ? output.savedBuckets : [...output.savedBuckets, bucket],
          galleryAssetIdsByBucket: data.asset?.id ? {
            ...output.galleryAssetIdsByBucket,
            [bucket]: [...(output.galleryAssetIdsByBucket[bucket] || []), data.asset.id],
          } : output.galleryAssetIdsByBucket,
        } : output),
      }) : prev);
    }
  };

  const openInCreate = async (action: 'txt2img' | 'img2img' | 'img2vid') => {
    if (!job || !selectedOutput || selectedOutput.type !== 'image') return;
    const response = await fetch(`/api/jobs/${job.id}/reuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, outputId: selectedOutput.outputId }),
    });
    const data = await response.json();
    if (response.ok && data.success && data.payload) {
      persistCreateReuseDraft(data.payload);
      router.push('/m/create');
    }
  };

  const openInPromptConstructor = async () => {
    if (!job) return;
    const response = await fetch(`/api/jobs/${job.id}/reuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'scene-template-v2' }),
    });
    const data = await response.json();
    if (response.ok && data.success && data.payload) {
      persistPromptConstructorReuseDraft(data.payload);
      router.push('/prompt-constructor');
    }
  };

  const deleteJob = async () => {
    if (!job) return;
    const response = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (response.ok && data.success) {
      router.push('/m/jobs');
    }
  };

  const cancelJob = async () => {
    if (!job) return;
    const response = await fetch(`/api/jobs/${job.id}/cancel`, { method: 'POST' });
    const data = await response.json();
    if (response.ok && data.success) {
      await refresh();
    }
  };

  const copyError = async () => {
    if (!job?.error) return;
    try {
      await navigator.clipboard.writeText(job.error);
      showToast('Error copied', 'success');
    } catch {
      showToast('Failed to copy error', 'error');
    }
  };

  return (
    <MobileScreen>
      <MobileHeader
        title="Job details"
        subtitle={job ? `${job.modelId} • ${job.status}` : 'Standalone mobile route for job inspection.'}
        backHref="/m/jobs"
        action={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 custom-scrollbar">
        <div className="space-y-4">
          {isLoading ? <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading job...</div> : null}
          {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
          {!isLoading && !error && !job ? <div className="rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">Job not found.</div> : null}

          {job ? (
            <>
              <Card>
                <CardContent className="p-3">
                  <div className="flex min-h-[18rem] items-center justify-center overflow-hidden rounded-lg border border-border bg-black/30">
                    {selectedOutput?.url ? (
                      selectedOutput.type === 'video' ? (
                        <video src={selectedOutput.url} controls playsInline className="max-h-[70vh] w-full object-contain" />
                      ) : selectedOutput.type === 'audio' ? (
                        <audio src={selectedOutput.url} controls className="w-full" />
                      ) : (
                        <img src={selectedOutput.previewUrl || selectedOutput.url} alt={job.prompt || job.id} className="max-h-[70vh] w-full object-contain" />
                      )
                    ) : (
                      <div className="p-6 text-sm text-muted-foreground">No output media yet.</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Details</CardDescription>
                  <CardTitle className="text-lg">{job.modelId}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><div className="text-muted-foreground">Status</div><div>{job.status}</div></div>
                    <div><div className="text-muted-foreground">Type</div><div>{job.type}</div></div>
                    <div><div className="text-muted-foreground">Created</div><div>{new Date(job.createdAt || Date.now()).toLocaleString()}</div></div>
                    <div><div className="text-muted-foreground">Execution</div><div>{typeof job.executionMs === 'number' ? `${(job.executionMs / 1000).toFixed(2)}s` : '—'}</div></div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Prompt</div>
                    <div className="whitespace-pre-wrap">{job.prompt || 'No prompt saved.'}</div>
                  </div>
                  {selectedOutput ? (
                    <div>
                      <div className="text-muted-foreground">Saved state</div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {selectedOutput.savedBuckets.includes('common') ? <span className="rounded border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs text-green-300">In Gallery</span> : null}
                        {selectedOutput.savedBuckets.includes('draft') ? <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">Draft Saved</span> : null}
                        {selectedOutput.savedBuckets.includes('upscale') ? <span className="rounded border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300">Upscale</span> : null}
                        {selectedOutput.savedBuckets.length === 0 ? <span className="text-sm">Not saved yet</span> : null}
                      </div>
                    </div>
                  ) : null}
                  {loraSummary ? (
                    <div>
                      <div className="text-muted-foreground">LoRA</div>
                      <div className="truncate">{loraSummary}</div>
                    </div>
                  ) : null}
                  {job.error ? (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="font-medium">Error</div>
                        <button
                          type="button"
                          onClick={() => void copyError()}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-500/30 text-red-200 hover:bg-red-500/10"
                          aria-label="Copy error"
                          title="Copy error"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="whitespace-pre-wrap break-words">{job.error}</div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button variant="outline" onClick={() => void downloadOutput()} disabled={!selectedOutput?.url}>
                  <Download className="mr-2 h-4 w-4" />Download
                </Button>
                <Button variant="outline" onClick={() => void saveToBucket('draft')} disabled={!selectedOutput || selectedOutput.savedBuckets.includes('draft')}>
                  <FolderPlus className="mr-2 h-4 w-4" />{selectedOutput?.savedBuckets.includes('draft') ? 'Draft Saved' : 'Save Draft'}
                </Button>
                <Button variant="outline" onClick={() => void saveToBucket('common')} disabled={!selectedOutput || selectedOutput.savedBuckets.includes('common')}>
                  <FolderPlus className="mr-2 h-4 w-4" />{selectedOutput?.savedBuckets.includes('common') ? 'In Gallery' : 'Add to Gallery'}
                </Button>
                {hasSceneSnapshot ? <Button variant="outline" onClick={() => void openInPromptConstructor()}><Sparkles className="mr-2 h-4 w-4" />Reuse scene</Button> : null}
                {job.type === 'image' ? <Button variant="outline" onClick={() => void openInCreate('txt2img')}><Type className="mr-2 h-4 w-4" />To txt2img</Button> : null}
                {job.type === 'image' ? <Button onClick={() => void openInCreate('img2img')}><Sparkles className="mr-2 h-4 w-4" />To img2img</Button> : null}
                {job.type === 'image' ? <Button variant="outline" onClick={() => void openInCreate('img2vid')}><Clapperboard className="mr-2 h-4 w-4" />To img2vid</Button> : null}
                {isRunning ? <Button variant="outline" onClick={() => void cancelJob()}><X className="mr-2 h-4 w-4" />Cancel job</Button> : null}
                {isFinished ? <Button variant="destructive" onClick={() => void deleteJob()}><Trash2 className="mr-2 h-4 w-4" />Delete job</Button> : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </MobileScreen>
  );
}
