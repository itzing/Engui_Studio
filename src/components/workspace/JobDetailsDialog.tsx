'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Job, useStudio } from '@/lib/context/StudioContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ChevronLeft, ChevronRight, Download, Trash2, Copy, Sparkles, X } from 'lucide-react';
import { getModelById } from '@/lib/models/modelConfig';
import { useI18n } from '@/lib/i18n/context';

interface JobDetailsDialogProps {
    job: Job | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onNavigate?: (direction: 'previous' | 'next') => void;
    currentIndex?: number;
    totalCount?: number;
}

type GalleryBucket = 'common' | 'draft';

type JobOutput = {
    outputId: string;
    type: 'image' | 'video' | 'audio';
    url: string;
    previewUrl: string | null;
    thumbnailUrl: string | null;
    alreadyInGallery: boolean;
    galleryAssetId: string | null;
    savedBuckets: Array<'common' | 'draft' | 'upscale'>;
    galleryAssetIdsByBucket: Partial<Record<'common' | 'draft' | 'upscale', string[]>>;
};

export function JobDetailsDialog({ job, open, onOpenChange, onNavigate, currentIndex = 0, totalCount = 0 }: JobDetailsDialogProps) {
    const { addJob, deleteJob, cancelJob } = useStudio();
    const { t } = useI18n();
    const { showToast } = useToast();

    const parsedSecureState = useMemo(() => {
        if (!job) return null;
        const raw = (job as any).secureState;
        if (!raw) return null;
        if (typeof raw === 'string') {
            try {
                return JSON.parse(raw);
            } catch {
                return null;
            }
        }
        return typeof raw === 'object' ? raw : null;
    }, [job]);

    const [jobOutputs, setJobOutputs] = useState<JobOutput[]>([]);
    const [selectedOutputIndex, setSelectedOutputIndex] = useState(0);
    const [savingBucket, setSavingBucket] = useState<GalleryBucket | null>(null);
    const [isUpscaling, setIsUpscaling] = useState(false);

    // If no job, we still render the Dialog but with open=false to prevent unmounting issues
    const safeOpen = open && !!job;
    const model = job ? getModelById(job.modelId) : null;

    useEffect(() => {
        if (!job || !safeOpen) {
            setJobOutputs([]);
            setSelectedOutputIndex(0);
            return;
        }

        let cancelled = false;

        const loadJobDetails = async (preserveSelectedOutputId?: string | null) => {
            try {
                const response = await fetch(`/api/jobs/${job.id}`);
                const data = await response.json();
                if (!cancelled && data.success && Array.isArray(data.job?.outputs)) {
                    const nextOutputs = data.job.outputs;
                    setJobOutputs(nextOutputs);
                    if (preserveSelectedOutputId) {
                        const nextIndex = nextOutputs.findIndex((output: JobOutput) => output.outputId === preserveSelectedOutputId);
                        setSelectedOutputIndex(nextIndex >= 0 ? nextIndex : 0);
                    } else {
                        setSelectedOutputIndex(0);
                    }
                }
            } catch (error) {
                console.error('Failed to load job outputs:', error);
            }
        };

        void loadJobDetails();
        return () => {
            cancelled = true;
        };
    }, [job?.id, safeOpen]);

    const fallbackOutput = useMemo<JobOutput | null>(() => {
        if (!job?.resultUrl) return null;
        const type: 'image' | 'video' | 'audio' = job.type === 'video'
            ? 'video'
            : (job.type === 'audio' || job.type === 'tts' || job.type === 'music')
                ? 'audio'
                : 'image';

        return {
            outputId: 'output-1',
            type,
            url: job.resultUrl,
            previewUrl: job.resultUrl,
            thumbnailUrl: null,
            alreadyInGallery: false,
            galleryAssetId: null,
            savedBuckets: [],
            galleryAssetIdsByBucket: {},
        };
    }, [job]);

    const outputs = jobOutputs.length > 0 ? jobOutputs : (fallbackOutput ? [fallbackOutput] : []);
    const selectedOutput = outputs[selectedOutputIndex] || outputs[0] || null;
    const isVideo = selectedOutput?.type === 'video';
    const isAudio = selectedOutput?.type === 'audio';
    const isRunning = job ? (job.status === 'queueing_up' || job.status === 'queued' || job.status === 'processing' || job.status === 'finalizing') : false;
    const isFinished = job ? (job.status === 'completed' || job.status === 'failed') : false;
    const statusLabel = job?.status === 'failed' && job.error === 'cancelled' ? 'cancelled' : job?.status;
    const canNavigateLeft = Boolean(onNavigate && totalCount > 1 && currentIndex > 1);
    const canNavigateRight = Boolean(onNavigate && totalCount > 1 && currentIndex > 0 && currentIndex < totalCount);

    const handleDownload = async () => {
        if (!job || !selectedOutput?.url) return;
        try {
            const response = await fetch(selectedOutput.url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            let ext = 'png';
            if (isVideo) ext = 'mp4';
            if (isAudio) ext = 'mp3';

            a.download = `job-${job.id}-${selectedOutput.outputId}.${ext}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download failed:', error);
            const a = document.createElement('a');
            a.href = selectedOutput.url;
            a.target = '_blank';
            a.download = `job-${job.id}-${selectedOutput.outputId}.${isVideo ? 'mp4' : isAudio ? 'mp3' : 'png'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    const handleDelete = async () => {
        if (!job || !confirm('Delete this finished job and clean up its local outputs when safe?')) return;
        const ok = await deleteJob(job.id);
        if (!ok) {
            showToast('Failed to delete job', 'error');
            return;
        }
        showToast('Job deleted', 'success');
        onOpenChange(false);
    };

    const handleCancel = async () => {
        if (!job || !confirm('Cancel this running job? It will become failed with reason cancelled.')) return;
        const result = await cancelJob(job.id);
        if (!result.success) {
            showToast('Failed to cancel job', 'error');
            return;
        }
        showToast(result.removed ? 'Job deleted' : 'Job cancelled', 'success');
        onOpenChange(false);
    };

    const handleUpscale = async () => {
        if (!job || isUpscaling) return;
        if (job.type !== 'image' && job.type !== 'video') {
            showToast('Upscale is only available for image and video results', 'error');
            return;
        }

        setIsUpscaling(true);
        showToast(`Starting upscale for ${job.type}...`, 'info');

        try {
            const response = await fetch('/api/upscale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId: job.id, type: job.type }),
            });
            const data = await response.json();

            if (data.success && data.job) {
                addJob(data.job);
                showToast('Upscale job created and processing', 'success');
            } else {
                showToast(data.error || 'Failed to create upscale job', 'error');
            }
        } catch (error) {
            console.error('Failed to create job details upscale job:', error);
            showToast('Failed to create upscale job', 'error');
        } finally {
            setIsUpscaling(false);
        }
    };

    const handleSaveToGalleryBucket = async (bucket: GalleryBucket) => {
        if (!job || !selectedOutput || savingBucket || selectedOutput.savedBuckets.includes(bucket)) return;

        setSavingBucket(bucket);
        try {
            const response = await fetch('/api/gallery/assets/from-job-output', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jobId: job.id,
                    outputId: selectedOutput.outputId,
                    bucket,
                }),
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || `Failed to save output to ${bucket}`);
            }

            setJobOutputs((prev) => prev.map((output, index) => {
                if (index !== selectedOutputIndex) return output;
                const nextSavedBuckets = output.savedBuckets.includes(bucket)
                    ? output.savedBuckets
                    : [...output.savedBuckets, bucket];
                const nextIds = data.asset?.id
                    ? {
                        ...output.galleryAssetIdsByBucket,
                        [bucket]: [...(output.galleryAssetIdsByBucket[bucket] || []), data.asset.id],
                      }
                    : output.galleryAssetIdsByBucket;
                return {
                    ...output,
                    alreadyInGallery: nextSavedBuckets.length > 0,
                    galleryAssetId: output.galleryAssetId || data.asset?.id || null,
                    savedBuckets: nextSavedBuckets,
                    galleryAssetIdsByBucket: nextIds,
                };
            }));

            if (typeof window !== 'undefined' && data.asset) {
                window.dispatchEvent(new CustomEvent('galleryAssetChanged', {
                    detail: {
                        workspaceId: job.workspaceId,
                        assetId: data.asset.id,
                        reason: data.alreadyInGallery ? 'existing' : 'created',
                    }
                }));
            }

            showToast(
                bucket === 'draft'
                    ? (data.alreadyInGallery ? 'Output is already saved as draft' : 'Output saved as draft')
                    : (data.alreadyInGallery ? 'Output is already in Gallery' : 'Output added to Gallery'),
                'success'
            );
        } catch (error) {
            console.error('Failed to save output to gallery bucket:', error);
            showToast(error instanceof Error ? error.message : `Failed to save output to ${bucket}`, 'error');
        } finally {
            setSavingBucket(null);
        }
    };

    const handleCopyPrompt = () => {
        if (job?.prompt) {
            navigator.clipboard.writeText(job.prompt);
        }
    };

    const handleCopyError = () => {
        if (job?.error) {
            navigator.clipboard.writeText(job.error);
        }
    };

    const getExecutionLabel = () => {
        if (!job) return null;
        const raw = job.executionMs;
        if (typeof raw === 'number' && Number.isFinite(raw)) {
            return `${(raw / 1000).toFixed(2)}s`;
        }
        try {
            const opts = typeof (job as any).options === 'string' ? JSON.parse((job as any).options) : ((job as any).options || {});
            const fallback = opts?.executionMs;
            if (typeof fallback === 'number' && Number.isFinite(fallback)) return `${(fallback / 1000).toFixed(2)}s`;
            if (typeof fallback === 'string' && fallback.trim() !== '' && !Number.isNaN(Number(fallback))) return `${(Number(fallback) / 1000).toFixed(2)}s`;
        } catch {}
        return null;
    };

    const handleDialogKeyDownCapture = (event: React.KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName;

        if (target?.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
            return;
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            if (canNavigateRight) onNavigate?.('previous');
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            if (canNavigateLeft) onNavigate?.('next');
        }
    };

    return (
        <Dialog open={safeOpen} onOpenChange={onOpenChange}>
            {job && (
                <DialogContent onOpenAutoFocus={(event) => event.preventDefault()} onKeyDownCapture={handleDialogKeyDownCapture} className="max-w-4xl w-[96vw] md:w-[90vw] h-[92dvh] md:h-[85vh] p-0 gap-0 bg-background border-border overflow-hidden flex flex-col md:flex-row">
                    {/* Media Preview - Left/Top Side */}
                    <div className="flex-none bg-black/90 flex items-center justify-center relative min-h-[220px] max-h-[32dvh] md:min-h-[300px] md:max-h-none md:flex-1 md:h-full overflow-hidden p-4">
                        {job.status === 'completed' && selectedOutput?.url ? (
                            isVideo ? (
                                <video
                                    src={selectedOutput.url}
                                    poster={selectedOutput.thumbnailUrl || undefined}
                                    controls
                                    loop
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : isAudio ? (
                                <div className="flex flex-col items-center justify-center w-full max-w-md gap-6 p-8 bg-zinc-900/50 rounded-xl border border-white/10 backdrop-blur-sm">
                                    <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-primary animate-pulse">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
                                            <path fillRule="evenodd" d="M19.952 1.651a.75.75 0 01.298.599V16.303a3 3 0 01-2.176 2.884l-1.32.377a2.553 2.553 0 11-1.403-4.909l2.311-.66a1.5 1.5 0 001.088-1.442V6.994l-9 2.572v9.737a3 3 0 01-2.176 2.884l-1.32.377a2.553 2.553 0 11-1.402-4.909l2.31-.66a1.5 1.5 0 001.088-1.442V9.017 5.25a.75.75 0 01.544-.721l10.5-3a.75.75 0 01.658.122z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <audio
                                        src={selectedOutput.url}
                                        controls
                                        className="w-full"
                                    />
                                    <div className="text-sm text-muted-foreground text-center">
                                        {job.modelId} • Audio Generated
                                    </div>
                                </div>
                            ) : (
                                <img
                                    src={selectedOutput.previewUrl || selectedOutput.url}
                                    alt={job.prompt || 'Generated Image'}
                                    className="max-w-full max-h-full object-contain"
                                />
                            )
                        ) : (
                            <div className="text-muted-foreground flex flex-col items-center gap-2">
                                <div className={`w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin ${job.status === 'queueing_up' || job.status === 'processing' || job.status === 'queued' || job.status === 'finalizing' ? 'block' : 'hidden'}`} />
                                <span>{job.status === 'failed' ? 'Generation Failed' : 'Processing...'}</span>
                            </div>
                        )}
                    </div>

                    {/* Details - Right/Bottom Side */}
                    <div className="w-full md:w-[350px] min-h-0 flex-1 md:flex-initial flex flex-col border-t md:border-t-0 md:border-l border-border bg-card overflow-hidden">
                        <DialogHeader className="p-4 border-b border-border">
                            <div className="flex items-center justify-between">
                                <DialogTitle className="text-lg font-semibold">{t('jobDetails.title')}</DialogTitle>
                            </div>
                            <DialogDescription className="text-xs text-muted-foreground font-mono flex items-center justify-between gap-2">
                                <span className="truncate">ID: {job.id}</span>
                                {totalCount > 0 && (
                                    <span className="inline-flex items-center overflow-hidden rounded border border-border bg-muted/40 text-[11px] whitespace-nowrap">
                                        <button
                                            type="button"
                                            onClick={() => canNavigateLeft && onNavigate?.('next')}
                                            disabled={!canNavigateLeft}
                                            className="flex h-6 w-6 items-center justify-center border-r border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
                                            aria-label="Previous job"
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                        </button>
                                        <span className="px-2 py-0.5">{currentIndex} / {totalCount}</span>
                                        <button
                                            type="button"
                                            onClick={() => canNavigateRight && onNavigate?.('previous')}
                                            disabled={!canNavigateRight}
                                            className="flex h-6 w-6 items-center justify-center border-l border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
                                            aria-label="Next job"
                                        >
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </button>
                                    </span>
                                )}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6 overscroll-contain">
                            {/* Prompt Section */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-foreground">{t('jobDetails.prompt')}</h3>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyPrompt}>
                                        <Copy className="w-3 h-3" />
                                    </Button>
                                </div>
                                <div className="bg-muted/30 p-3 rounded-lg border border-border text-sm text-muted-foreground leading-relaxed max-h-[150px] overflow-y-auto">
                                    {job.prompt || 'No prompt provided'}
                                </div>
                            </div>

                            {outputs.length > 1 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-foreground">Outputs</h3>
                                        <span className="text-xs text-muted-foreground">{selectedOutputIndex + 1} / {outputs.length}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {outputs.map((output, index) => (
                                            <button
                                                key={output.outputId}
                                                type="button"
                                                onClick={() => setSelectedOutputIndex(index)}
                                                className={`px-2 py-1 text-xs rounded border ${index === selectedOutputIndex ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'}`}
                                            >
                                                {output.outputId}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">{t('jobDetails.model')}</span>
                                    <div className="text-sm font-medium">{model?.name || job.modelId}</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">Provider</span>
                                    <div className="text-sm font-medium">{model?.provider || 'Unknown'}</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">{t('jobDetails.status')}</span>
                                    <div className={`text-sm font-medium capitalize ${job.status === 'completed' ? 'text-green-500' :
                                        job.status === 'failed' ? 'text-red-500' : 'text-blue-500'
                                        }`}>
                                        {statusLabel}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">{t('jobDetails.createdAt')}</span>
                                    <div className="text-sm font-medium">
                                        {new Date(job.createdAt).toLocaleTimeString()}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground">Execution</span>
                                    <div className="text-sm font-medium">{getExecutionLabel() || '—'}</div>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <span className="text-xs text-muted-foreground">Selected Output</span>
                                    <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                                        <span>{selectedOutput?.outputId || '—'}</span>
                                        {selectedOutput?.savedBuckets.includes('common') && (
                                            <span className="text-[11px] px-2 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20">
                                                In Gallery
                                            </span>
                                        )}
                                        {selectedOutput?.savedBuckets.includes('draft') && (
                                            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                Saved as Draft
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {parsedSecureState && (
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-foreground">Secure Flow</h3>
                                    <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Phase</span>
                                            <span className="font-mono text-right">{parsedSecureState.phase || '—'}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Attempt</span>
                                            <span className="font-mono text-right truncate max-w-[180px]">{parsedSecureState.activeAttempt?.attemptId || '—'}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Cleanup</span>
                                            <span className="font-mono text-right">{parsedSecureState.cleanup?.transportStatus || 'pending'}</span>
                                        </div>
                                        {parsedSecureState.cleanup?.warning && (
                                            <div className="rounded border border-amber-500/20 bg-amber-500/10 p-2 text-amber-500 break-words">
                                                <span className="font-semibold">Cleanup warning:</span> {parsedSecureState.cleanup.warning}
                                            </div>
                                        )}
                                        {parsedSecureState.failure?.error && (
                                            <div className="rounded border border-red-500/20 bg-red-500/10 p-2 text-red-500 break-words">
                                                <div><span className="font-semibold">Source:</span> {parsedSecureState.failure.source || '—'}</div>
                                                <div><span className="font-semibold">Code:</span> {parsedSecureState.failure.error.code || '—'}</div>
                                                <div><span className="font-semibold">Message:</span> {parsedSecureState.failure.error.message || '—'}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Error Message */}
                            {job.error && (
                                <div className={`rounded-lg p-3 text-xs border ${job.error === 'cancelled' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 whitespace-pre-wrap break-words">
                                            <span className="font-bold">{job.error === 'cancelled' ? 'Cancelled:' : 'Error:'}</span> {job.error}
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCopyError} title="Copy error">
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-border bg-muted/10 flex gap-2 shrink-0 flex-wrap">
                            <Button className="flex-1" variant="outline" onClick={handleDownload} disabled={!selectedOutput?.url}>
                                <Download className="w-4 h-4 mr-2" />
                                {t('jobDetails.download')}
                            </Button>
                            <Button
                                className="flex-1"
                                variant="outline"
                                onClick={() => void handleSaveToGalleryBucket('draft')}
                                disabled={!selectedOutput || selectedOutput.savedBuckets.includes('draft') || !!savingBucket}
                            >
                                {selectedOutput?.savedBuckets.includes('draft') ? 'Draft Saved' : savingBucket === 'draft' ? 'Saving...' : 'Save Draft'}
                            </Button>
                            <Button
                                className="flex-1"
                                variant="default"
                                onClick={() => void handleSaveToGalleryBucket('common')}
                                disabled={!selectedOutput || selectedOutput.savedBuckets.includes('common') || !!savingBucket}
                            >
                                {selectedOutput?.savedBuckets.includes('common') ? 'In Gallery' : savingBucket === 'common' ? 'Saving...' : 'Add to Gallery'}
                            </Button>
                            {(job?.type === 'image' || job?.type === 'video') && (
                                <Button
                                    className="flex-1"
                                    variant="outline"
                                    onClick={() => void handleUpscale()}
                                    disabled={isUpscaling}
                                >
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    {isUpscaling ? 'Starting...' : 'Upscale'}
                                </Button>
                            )}
                            {isFinished && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                    onClick={() => void handleDelete()}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                            {isRunning && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                                    onClick={() => void handleCancel()}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            )}
        </Dialog>
    );
}
