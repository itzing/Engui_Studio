'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Job, useStudio } from '@/lib/context/StudioContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Download, Trash2, Copy, X } from 'lucide-react';
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

type JobOutput = {
    outputId: string;
    type: 'image' | 'video' | 'audio';
    url: string;
    previewUrl: string | null;
    thumbnailUrl: string | null;
    alreadyInGallery: boolean;
    galleryAssetId: string | null;
};

export function JobDetailsDialog({ job, open, onOpenChange, onNavigate, currentIndex = 0, totalCount = 0 }: JobDetailsDialogProps) {
    const { deleteJob, cancelJob } = useStudio();
    const { t } = useI18n();
    const { showToast } = useToast();

    const [jobOutputs, setJobOutputs] = useState<JobOutput[]>([]);
    const [selectedOutputIndex, setSelectedOutputIndex] = useState(0);
    const [isSavingToGallery, setIsSavingToGallery] = useState(false);

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
        };
    }, [job]);

    const outputs = jobOutputs.length > 0 ? jobOutputs : (fallbackOutput ? [fallbackOutput] : []);
    const selectedOutput = outputs[selectedOutputIndex] || outputs[0] || null;
    const isVideo = selectedOutput?.type === 'video';
    const isAudio = selectedOutput?.type === 'audio';
    const isRunning = job ? (job.status === 'queued' || job.status === 'processing' || job.status === 'finalizing') : false;
    const isFinished = job ? (job.status === 'completed' || job.status === 'failed') : false;
    const statusLabel = job?.status === 'failed' && job.error === 'cancelled' ? 'cancelled' : job?.status;

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
        const ok = await cancelJob(job.id);
        if (!ok) {
            showToast('Failed to cancel job', 'error');
            return;
        }
        showToast('Job cancelled', 'success');
        onOpenChange(false);
    };

    const handleAddToGallery = async () => {
        if (!job || !selectedOutput || selectedOutput.alreadyInGallery || isSavingToGallery) return;

        setIsSavingToGallery(true);
        try {
            const response = await fetch('/api/gallery/assets/from-job-output', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jobId: job.id,
                    outputId: selectedOutput.outputId,
                }),
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to add output to gallery');
            }

            setJobOutputs((prev) => prev.map((output, index) => {
                if (index !== selectedOutputIndex) return output;
                return {
                    ...output,
                    alreadyInGallery: true,
                    galleryAssetId: data.asset?.id || output.galleryAssetId,
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

            showToast(data.alreadyInGallery ? 'Output is already in Gallery' : 'Output added to Gallery', 'success');
        } catch (error) {
            console.error('Failed to save output to gallery:', error);
            showToast(error instanceof Error ? error.message : 'Failed to add output to Gallery', 'error');
        } finally {
            setIsSavingToGallery(false);
        }
    };

    const handleCopyPrompt = () => {
        if (job?.prompt) {
            navigator.clipboard.writeText(job.prompt);
        }
    };

    const getExecutionLabel = () => {
        if (!job) return null;
        try {
            const opts = typeof (job as any).options === 'string' ? JSON.parse((job as any).options) : ((job as any).options || {});
            const raw = opts?.executionMs;
            let ms: number | null = null;
            if (typeof raw === 'number' && Number.isFinite(raw)) ms = raw;
            else if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) ms = Number(raw);
            if (ms === null) return null;
            return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
        } catch {
            return null;
        }
    };

    const handleDialogKeyDownCapture = (event: React.KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName;

        if (target?.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
            return;
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            onNavigate?.('previous');
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            onNavigate?.('next');
        }
    };

    return (
        <Dialog open={safeOpen} onOpenChange={onOpenChange}>
            {job && (
                <DialogContent onKeyDownCapture={handleDialogKeyDownCapture} className="max-w-4xl w-[90vw] h-[85vh] p-0 gap-0 bg-background border-border overflow-hidden flex flex-col md:flex-row">
                    {/* Media Preview - Left/Top Side */}
                    <div className="flex-1 bg-black/90 flex items-center justify-center relative min-h-[300px] md:h-full overflow-hidden p-4">
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
                                <div className={`w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin ${job.status === 'processing' || job.status === 'queued' || job.status === 'finalizing' ? 'block' : 'hidden'}`} />
                                <span>{job.status === 'failed' ? 'Generation Failed' : 'Processing...'}</span>
                            </div>
                        )}
                    </div>

                    {/* Details - Right/Bottom Side */}
                    <div className="w-full md:w-[350px] flex flex-col border-t md:border-t-0 md:border-l border-border bg-card">
                        <DialogHeader className="p-4 border-b border-border">
                            <div className="flex items-center justify-between">
                                <DialogTitle className="text-lg font-semibold">{t('jobDetails.title')}</DialogTitle>
                            </div>
                            <DialogDescription className="text-xs text-muted-foreground font-mono flex items-center justify-between gap-2">
                                <span className="truncate">ID: {job.id}</span>
                                {totalCount > 0 && (
                                    <span className="text-[11px] px-2 py-0.5 rounded bg-muted/40 border border-border whitespace-nowrap">
                                        {currentIndex} / {totalCount}
                                    </span>
                                )}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
                                        {selectedOutput?.alreadyInGallery && (
                                            <span className="text-[11px] px-2 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20">
                                                Already in Gallery
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Error Message */}
                            {job.error && (
                                <div className={`rounded-lg p-3 text-xs border ${job.error === 'cancelled' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                                    <span className="font-bold">{job.error === 'cancelled' ? 'Cancelled:' : 'Error:'}</span> {job.error}
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-border bg-muted/10 flex gap-2">
                            <Button className="flex-1" variant="outline" onClick={handleDownload} disabled={!selectedOutput?.url}>
                                <Download className="w-4 h-4 mr-2" />
                                {t('jobDetails.download')}
                            </Button>
                            <Button
                                className="flex-1"
                                variant="default"
                                onClick={handleAddToGallery}
                                disabled={!selectedOutput || selectedOutput.alreadyInGallery || isSavingToGallery}
                            >
                                {selectedOutput?.alreadyInGallery ? 'In Gallery' : isSavingToGallery ? 'Saving...' : 'Add to Gallery'}
                            </Button>
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
