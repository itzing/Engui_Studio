'use client';

import { useRouter } from 'next/navigation';
import { Clapperboard, Copy, Download, FolderPlus, Loader2, RefreshCw, Sparkles, Trash2, Type, X } from 'lucide-react';
import { persistCreateReuseDraft } from '@/lib/create/persistCreateReuseDraft';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { useMobileJobDetails } from '@/hooks/jobs/useMobileJobDetails';

export default function MobileJobDetailsScreen({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { job, isLoading, error, refresh, setJob } = useMobileJobDetails(jobId);
  const selectedOutput = job?.outputs?.[0] || null;
  const isRunning = job ? ['queueing_up', 'queued', 'processing', 'finalizing'].includes(job.status) : false;
  const isFinished = job ? ['completed', 'failed'].includes(job.status) : false;

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

  const addToGallery = async () => {
    if (!job || !selectedOutput || selectedOutput.alreadyInGallery) return;
    const response = await fetch('/api/gallery/assets/from-job-output', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id, outputId: selectedOutput.outputId }),
    });
    const data = await response.json();
    if (response.ok && data.success) {
      setJob((prev) => prev ? ({
        ...prev,
        outputs: prev.outputs.map((output, index) => index === 0 ? { ...output, alreadyInGallery: true, galleryAssetId: data.asset?.id || output.galleryAssetId } : output),
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
                <Button variant="outline" onClick={() => void addToGallery()} disabled={!selectedOutput || selectedOutput.alreadyInGallery}>
                  <FolderPlus className="mr-2 h-4 w-4" />{selectedOutput?.alreadyInGallery ? 'Already in Gallery' : 'Add to Gallery'}
                </Button>
                {job.type === 'image' ? <Button onClick={() => void openInCreate('img2img')}><Sparkles className="mr-2 h-4 w-4" />Open in Create</Button> : null}
                {job.type === 'image' ? <Button variant="outline" onClick={() => void openInCreate('txt2img')}><Type className="mr-2 h-4 w-4" />Reuse prompt only</Button> : null}
                {job.type === 'image' ? <Button variant="outline" onClick={() => void openInCreate('img2vid')}><Clapperboard className="mr-2 h-4 w-4" />Open in img2vid</Button> : null}
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
