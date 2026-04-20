'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Image as ImageIcon, Loader2, RefreshCw, Rows3, Trash2, Wand2, X, Ban, RotateCcw } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getModelById } from '@/lib/models/modelConfig';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Button } from '@/components/ui/button';
import { GalleryFullscreenViewer } from '@/components/workspace/GalleryFullscreenViewer';
import { useMobileJobsScreen, type MobileJobsScreenItem } from '@/hooks/jobs/useMobileJobsScreen';

function timeAgo(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatExecution(executionMs?: number) {
  if (!executionMs || executionMs <= 0) return null;
  if (executionMs < 1000) return `${executionMs}ms`;
  const seconds = executionMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remSeconds}s`;
}

function PlaceholderRow() {
  return <div className="h-[92px] rounded-xl border border-border/60 bg-muted/10 animate-pulse" />;
}

function SelectedJobActions({
  job,
  onDelete,
  onCancel,
  onReuse,
  onUpscale,
}: {
  job: MobileJobsScreenItem;
  onDelete: (job: MobileJobsScreenItem) => void;
  onCancel: (job: MobileJobsScreenItem) => void;
  onReuse: (job: MobileJobsScreenItem) => void;
  onUpscale: (job: MobileJobsScreenItem) => void;
}) {
  return (
    <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
      {job.status === 'completed' ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onReuse(job);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/85 backdrop-blur-sm"
          aria-label="Reuse job inputs"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      ) : null}
      {(job.type === 'image' || job.type === 'video') && job.status === 'completed' ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onUpscale(job);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/85 backdrop-blur-sm"
          aria-label="Upscale job"
        >
          <Wand2 className="h-4 w-4" />
        </button>
      ) : null}
      {job.status === 'queueing_up' || job.status === 'queued' || job.status === 'processing' || job.status === 'finalizing' ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCancel(job);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/85 backdrop-blur-sm"
          aria-label="Cancel job"
        >
          <Ban className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(job);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/85 backdrop-blur-sm"
          aria-label="Delete job"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function MobileJobsScreen() {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const restoreHandledTickRef = useRef<number>(0);
  const {
    totalCount,
    itemsByAbsoluteIndex,
    loadedViewerItems,
    isLoading,
    isLoadingMore,
    error,
    refresh,
    ensureRangeLoaded,
    selectedJobId,
    selectedAbsoluteIndex,
    handleJobPress,
    viewerOpen,
    viewerIndex,
    closeViewer,
    updateViewerIndex,
    restoreTick,
    restoreAbsoluteIndex,
    clearFinished,
    removeJob,
    cancelActiveJob,
    reuseJob,
    upscaleJob,
  } = useMobileJobsScreen();

  const rowVirtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 104,
    overscan: 6,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (virtualRows.length === 0 || totalCount === 0) return;
    const startIndex = Math.max(0, (virtualRows[0]?.index ?? 0) - 5);
    const endIndex = Math.min(totalCount - 1, (virtualRows[virtualRows.length - 1]?.index ?? 0) + 5);
    void ensureRangeLoaded(startIndex, endIndex);
  }, [ensureRangeLoaded, totalCount, virtualRows]);

  useEffect(() => {
    if (restoreTick <= 0 || restoreHandledTickRef.current === restoreTick) return;
    if (typeof restoreAbsoluteIndex !== 'number' || restoreAbsoluteIndex < 0) return;
    restoreHandledTickRef.current = restoreTick;
    rowVirtualizer.scrollToIndex(restoreAbsoluteIndex, { align: 'center' });
    void ensureRangeLoaded(Math.max(0, restoreAbsoluteIndex - 10), restoreAbsoluteIndex + 10);
  }, [ensureRangeLoaded, restoreAbsoluteIndex, restoreTick, rowVirtualizer]);

  const selectedLoadedViewerIndex = useMemo(() => {
    if (!selectedJobId) return -1;
    return loadedViewerItems.findIndex((entry) => entry.id === selectedJobId);
  }, [loadedViewerItems, selectedJobId]);

  return (
    <MobileScreen>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded border border-border/40" onClick={() => void refresh()} aria-label="Refresh jobs">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto h-8 rounded border border-border/40 px-3 text-xs" onClick={() => void clearFinished()}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Clear finished
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading jobs...
            </div>
          </div>
        ) : null}

        {error ? <div className="mx-4 mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}

        {!isLoading && !error && totalCount === 0 ? (
          <div className="mx-4 mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            No jobs yet for the current workspace.
          </div>
        ) : null}

        {!isLoading && totalCount > 0 ? (
          <div ref={parentRef} className="min-h-0 flex-1 overflow-auto px-4 py-4">
            <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {virtualRows.map((virtualRow) => {
                const job = itemsByAbsoluteIndex[virtualRow.index];
                return (
                  <div
                    key={virtualRow.key}
                    className="absolute left-0 top-0 w-full"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    {job ? (
                      (() => {
                        const model = getModelById(job.modelId);
                        const executionLabel = formatExecution(job.executionMs);
                        const isSelected = selectedAbsoluteIndex === virtualRow.index || selectedJobId === job.id;
                        return (
                          <button
                            type="button"
                            onClick={() => handleJobPress(job, virtualRow.index)}
                            className={`relative flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${isSelected ? 'border-primary/40 bg-primary/10 ring-1 ring-inset ring-primary/40' : 'border-border/60 bg-background/40'}`}
                          >
                            <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/20">
                              {job.thumbnailUrl || job.resultUrl ? (
                                job.type === 'video' ? (
                                  <video src={job.resultUrl || undefined} className="h-full w-full object-cover" muted playsInline />
                                ) : job.type === 'image' ? (
                                  <img src={job.thumbnailUrl || job.resultUrl || ''} alt={job.modelId} className="h-full w-full object-cover" />
                                ) : (
                                  <Rows3 className="h-5 w-5 text-muted-foreground" />
                                )
                              ) : job.type === 'image' ? <ImageIcon className="h-5 w-5 text-muted-foreground" /> : <Rows3 className="h-5 w-5 text-muted-foreground" />}
                            </div>

                            <div className="min-w-0 flex-1 pr-16">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-foreground">{model?.name || job.modelId}</div>
                                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span>{model?.provider || job.type}</span>
                                    <span>•</span>
                                    <span>{timeAgo(job.createdAt)}</span>
                                  </div>
                                </div>
                                <div className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-300' : job.status === 'failed' ? 'bg-red-500/10 text-red-300' : 'bg-blue-500/10 text-blue-300'}`}>
                                  {job.status}
                                </div>
                              </div>
                              <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="uppercase">{job.type}</span>
                                {executionLabel ? <span>⏱ {executionLabel}</span> : null}
                                {typeof job.cost === 'number' ? <span>${job.cost.toFixed(2)}</span> : null}
                              </div>
                            </div>

                            {isSelected ? (
                              <SelectedJobActions
                                job={job}
                                onDelete={(item) => {
                                  if (window.confirm('Delete this job?')) {
                                    void removeJob(item.id);
                                  }
                                }}
                                onCancel={(item) => {
                                  if (window.confirm('Cancel this job?')) {
                                    void cancelActiveJob(item.id);
                                  }
                                }}
                                onReuse={(item) => void reuseJob(item.id)}
                                onUpscale={(item) => void upscaleJob(item)}
                              />
                            ) : null}
                          </button>
                        );
                      })()
                    ) : (
                      <PlaceholderRow />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {isLoadingMore ? (
          <div className="pointer-events-none px-4 py-2 text-center text-xs text-muted-foreground">
            Loading more jobs...
          </div>
        ) : null}
      </div>

      <GalleryFullscreenViewer
        open={viewerOpen}
        items={loadedViewerItems.map((item) => ({ id: item.id, url: item.url, favorited: false }))}
        currentIndex={selectedLoadedViewerIndex >= 0 ? selectedLoadedViewerIndex : viewerIndex}
        onIndexChange={updateViewerIndex}
        onClose={closeViewer}
      />
    </MobileScreen>
  );
}
