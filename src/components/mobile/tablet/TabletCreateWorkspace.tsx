'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Ban,
  Clapperboard,
  Download,
  Film,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  Play,
  Rows3,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  WandSparkles,
  Zap,
} from 'lucide-react';
import AudioGenerationForm from '@/components/forms/AudioGenerationForm';
import MusicGenerationForm from '@/components/forms/MusicGenerationForm';
import VideoGenerationForm from '@/components/forms/VideoGenerationForm';
import { InlineConfirmDeleteButton } from '@/components/jobs/InlineConfirmDeleteButton';
import MobileCreateModeBar from '@/components/mobile/create/MobileCreateModeBar';
import { useMobileCreate } from '@/components/mobile/create/MobileCreateProvider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useMobileJobsScreen, type MobileJobsScreenItem } from '@/hooks/jobs/useMobileJobsScreen';
import { persistCreateReuseDraft } from '@/lib/create/persistCreateReuseDraft';
import type { CreateMode } from '@/lib/createDrafts';
import { getModelById, type ModelParameter } from '@/lib/models/modelConfig';
import { getPromptForMode, getPromptVersions, type PromptVersionMode } from '@/lib/promptVersions';
import { cn } from '@/lib/utils';

type GalleryBucket = 'common' | 'draft' | 'upscale';

type TabletJobDetailOutput = {
  outputId: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  savedBuckets: GalleryBucket[];
  galleryAssetId?: string | null;
  galleryAssetIdsByBucket?: Partial<Record<GalleryBucket, string[]>>;
};

type TabletJobDetail = {
  id: string;
  type: MobileJobsScreenItem['type'];
  modelId: string;
  status: MobileJobsScreenItem['status'];
  prompt?: string;
  options?: unknown;
  outputs?: TabletJobDetailOutput[];
  createdAt?: string | number;
  completedAt?: string | number | null;
  executionMs?: number | null;
  error?: string | null;
  sceneSnapshotJson?: unknown;
};

type LoadedJobEntry = {
  job: MobileJobsScreenItem;
  absoluteIndex: number;
};

const STRIP_MIN_HEIGHT = 112;
const STRIP_DEFAULT_HEIGHT = 168;
const PREVIEW_SWIPE_THRESHOLD = 40;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getStripMaxHeight() {
  if (typeof window === 'undefined') return 256;
  return Math.max(STRIP_MIN_HEIGHT, Math.floor(window.innerHeight / 3));
}

function isRunningJob(status: MobileJobsScreenItem['status']) {
  return status === 'queueing_up' || status === 'queued' || status === 'processing' || status === 'finalizing';
}

function formatJobStatus(status: MobileJobsScreenItem['status']) {
  switch (status) {
    case 'queueing_up':
      return 'Queuing up';
    case 'queued':
      return 'In queue';
    case 'processing':
      return 'Running';
    case 'finalizing':
      return 'Finalizing';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

function formatExecution(executionMs?: number | null) {
  if (!executionMs || executionMs <= 0) return null;
  if (executionMs < 1000) return `${executionMs}ms`;
  const seconds = executionMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remSeconds}s`;
}

function formatCreatedAt(value: string | number | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function getPrimaryOutput(detail: TabletJobDetail | null) {
  return detail?.outputs?.find((output) => output.outputId === 'output-1') || detail?.outputs?.[0] || null;
}

function getPreviewUrl(job: MobileJobsScreenItem | null, output: TabletJobDetailOutput | null) {
  return output?.previewUrl || output?.url || job?.resultUrl || job?.thumbnailUrl || '';
}

function updateOutputBucketState(
  detail: TabletJobDetail | null,
  outputId: string,
  bucket: GalleryBucket,
  assetId?: string | null,
) {
  if (!detail?.outputs) return detail;

  return {
    ...detail,
    outputs: detail.outputs.map((output) => {
      if (output.outputId !== outputId) return output;
      const savedBuckets = output.savedBuckets.includes(bucket)
        ? output.savedBuckets
        : [...output.savedBuckets, bucket];
      const galleryAssetIdsByBucket = assetId
        ? {
            ...(output.galleryAssetIdsByBucket || {}),
            [bucket]: [...(output.galleryAssetIdsByBucket?.[bucket] || []), assetId],
          }
        : output.galleryAssetIdsByBucket;

      return {
        ...output,
        savedBuckets,
        galleryAssetId: output.galleryAssetId || assetId || null,
        galleryAssetIdsByBucket,
      };
    }),
  };
}

function StatusMessage({ type, text }: { type: 'success' | 'error'; text: string }) {
  return (
    <div className={cn(
      'rounded-md border px-3 py-2 text-sm',
      type === 'success'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
        : 'border-red-500/30 bg-red-500/10 text-red-300',
    )}>
      {text}
    </div>
  );
}

function TabletReferenceInput({
  title,
  description,
  previewUrl,
  accept,
  onSelect,
  onClear,
}: {
  title: string;
  description: string;
  previewUrl: string;
  accept: string;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <section className="space-y-2 rounded-md border border-border/70 bg-background/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
        </div>
        {previewUrl ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </div>
      <div className="flex h-36 items-center justify-center overflow-hidden rounded-md border border-border bg-black">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={`${title} preview`} className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
            No image selected
          </div>
        )}
      </div>
      <label className="inline-flex cursor-pointer">
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onSelect(file);
            event.currentTarget.value = '';
          }}
        />
        <span className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
          <ImageIcon className="mr-2 h-4 w-4" />
          Choose image
        </span>
      </label>
    </section>
  );
}

function TabletBasicParameter({
  param,
  value,
  onChange,
  onNumericChange,
}: {
  param: ModelParameter;
  value: unknown;
  onChange: (paramName: string, value: unknown) => void;
  onNumericChange: (paramName: string, rawValue: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase text-muted-foreground">{param.label}</label>
      {param.type === 'boolean' ? (
        <Button
          type="button"
          variant={value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(param.name, !(value ?? false))}
          className="w-full justify-start"
        >
          {value ? 'Enabled' : 'Disabled'}
        </Button>
      ) : param.type === 'select' ? (
        <select
          value={String(value ?? param.default ?? '')}
          onChange={(event) => onChange(param.name, event.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          {param.options?.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : param.type === 'number' ? (
        <Input
          type="number"
          value={String(value ?? param.default ?? '')}
          min={param.min}
          max={param.max}
          step={param.step}
          className="h-9"
          onChange={(event) => onNumericChange(param.name, event.target.value)}
        />
      ) : (
        <Input
          type="text"
          value={String(value ?? param.default ?? '')}
          className="h-9"
          onChange={(event) => onChange(param.name, event.target.value)}
        />
      )}
    </div>
  );
}

function TabletImageCreateControls({
  activeMode,
  onModeChange,
}: {
  activeMode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
}) {
  const { showToast } = useToast();
  const [showPromptDraftSelector, setShowPromptDraftSelector] = useState(false);
  const {
    imageModels,
    selectedModel,
    currentModel,
    prompt,
    setPrompt,
    previewUrl,
    previewUrl2,
    primaryImageVisible,
    secondaryImageVisible,
    primaryImageRequired,
    secondaryImageRequired,
    selectPrimaryImageFile,
    selectSecondaryImageFile,
    clearPrimaryImage,
    clearSecondaryImage,
    randomizeSeed,
    setRandomizeSeed,
    handleParameterChange,
    handleNumericParameterInput,
    parameterValues,
    basicParameters,
    promptDocuments,
    isPromptDocumentsLoading,
    isPromptDraftSyncing,
    selectedPromptDocumentId,
    selectedPromptDocumentTitle,
    isPromptDraftSelected,
    selectPromptDocument,
    clearPromptDocument,
    isGenerating,
    submit,
    message,
    setMessage,
    isLoadingMedia,
    selectModel,
    promptHelperInstruction,
    setPromptHelperInstruction,
    isPromptHelperConfigured,
    promptHelperError,
    isPromptHelperLoading,
    runSavedPromptHelperInstruction,
  } = useMobileCreate();

  const seedParameter = currentModel?.parameters.find((param) => param.name === 'seed');
  const widthParameter = currentModel?.parameters.find((param) => param.name === 'width');
  const heightParameter = currentModel?.parameters.find((param) => param.name === 'height');
  const currentSeed = parameterValues.seed ?? seedParameter?.default;
  const currentWidth = widthParameter ? Number(parameterValues[widthParameter.name] ?? widthParameter.default) : undefined;
  const currentHeight = heightParameter ? Number(parameterValues[heightParameter.name] ?? heightParameter.default) : undefined;
  const resolvedWidth = typeof currentWidth === 'number' && Number.isFinite(currentWidth) ? currentWidth : null;
  const resolvedHeight = typeof currentHeight === 'number' && Number.isFinite(currentHeight) ? currentHeight : null;
  const formatLabel = resolvedWidth !== null && resolvedHeight !== null
    ? resolvedWidth === resolvedHeight
      ? 'Square'
      : resolvedWidth > resolvedHeight
        ? 'Landscape'
        : 'Portrait'
    : 'Resolution';
  const resolutionLabel = resolvedWidth !== null && resolvedHeight !== null
    ? `${resolvedWidth}w x ${resolvedHeight}h`
    : '-';
  const visibleBasicParameters = basicParameters.filter((param) => (
    param.name !== 'width'
    && param.name !== 'height'
    && param.name !== 'seed'
    && param.name !== 'negativePrompt'
    && param.name !== 'negative_prompt'
    && param.name !== 'use_controlnet'
  ));

  useEffect(() => {
    if (message?.type === 'success') {
      showToast(message.text, 'success', 2200);
      setMessage(null);
    }
  }, [message, setMessage, showToast]);

  return (
    <>
      <div className="flex min-h-0 h-full flex-col">
        <div className="shrink-0 border-b border-border/70 px-4 py-3">
          <MobileCreateModeBar activeMode={activeMode} onModeChange={onModeChange} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
          <div className="space-y-4 pb-4">
            {message?.type === 'error' ? <StatusMessage type={message.type} text={message.text} /> : null}
            {promptHelperError ? <StatusMessage type="error" text={promptHelperError} /> : null}

            <section className="space-y-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase text-muted-foreground">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(event) => void selectModel(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground"
                  >
                    {imageModels.map((model) => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="mt-6 h-10 w-10"
                  asChild
                  aria-label="Open advanced settings"
                  title="Advanced"
                >
                  <Link href="/m/create/advanced">
                    <SlidersHorizontal className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={randomizeSeed ? 'default' : 'outline'}
                  className="h-auto flex-col items-start px-3 py-3 text-left"
                  onClick={() => setRandomizeSeed(!randomizeSeed)}
                >
                  <span className="text-sm font-semibold leading-none">{randomizeSeed ? 'Random' : 'Fixed'}</span>
                  <span className={cn('mt-1 text-xs leading-none', randomizeSeed ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {currentSeed ?? '-'}
                  </span>
                </Button>

                <button
                  type="button"
                  className="rounded-md border border-border bg-background/60 px-3 py-3 text-left transition-colors hover:bg-accent/40"
                  onClick={() => {
                    if (!widthParameter || !heightParameter || resolvedWidth === null || resolvedHeight === null) {
                      return;
                    }
                    handleParameterChange(widthParameter.name, resolvedHeight);
                    handleParameterChange(heightParameter.name, resolvedWidth);
                  }}
                >
                  <div className="text-sm font-semibold leading-none text-foreground">{formatLabel}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{resolutionLabel}</div>
                </button>
              </div>

              {visibleBasicParameters.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {visibleBasicParameters.slice(0, 4).map((param) => (
                    <TabletBasicParameter
                      key={param.name}
                      param={param}
                      value={parameterValues[param.name] ?? param.default}
                      onChange={handleParameterChange}
                      onNumericChange={handleNumericParameterInput}
                    />
                  ))}
                </div>
              ) : null}
            </section>

            <section className="space-y-2">
              <button
                type="button"
                className={cn(
                  'w-full rounded-md border px-3 py-3 text-left transition-colors',
                  isPromptDraftSelected
                    ? 'border-primary/30 bg-primary/10'
                    : 'border-border bg-background/60 hover:bg-accent/40',
                )}
                onClick={() => setShowPromptDraftSelector(true)}
                data-testid="tablet-prompt-draft-tile"
              >
                <div className="text-sm font-semibold text-foreground">Prompt draft</div>
                <div className="mt-1 truncate text-xs text-muted-foreground" data-testid="tablet-prompt-draft-title">
                  {selectedPromptDocumentTitle.trim() || 'Not selected'}
                </div>
              </button>

              {!isPromptDraftSelected ? (
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Describe the image you want to generate..."
                  className="min-h-36 w-full resize-none rounded-md border border-input bg-background px-3 py-3 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  data-testid="tablet-create-prompt-textarea"
                />
              ) : (
                <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-3 text-sm text-foreground">
                  {selectedPromptDocumentTitle || 'Prompt Constructor draft'}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Prompt Helper</label>
                <textarea
                  value={promptHelperInstruction}
                  onChange={(event) => setPromptHelperInstruction(event.target.value)}
                  placeholder="Optional reusable helper instruction"
                  className="min-h-20 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  disabled={isPromptDraftSelected}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={!isPromptHelperConfigured || !promptHelperInstruction.trim() || isPromptHelperLoading || isPromptDraftSelected}
                  onClick={() => void runSavedPromptHelperInstruction()}
                >
                  {isPromptHelperLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                  Apply Prompt Helper
                </Button>
              </div>
            </section>

            {(primaryImageVisible || secondaryImageVisible) ? (
              <section className="space-y-3">
                {primaryImageVisible ? (
                  <TabletReferenceInput
                    title="Primary image"
                    description={primaryImageRequired ? 'Required input image' : 'Optional input image'}
                    previewUrl={previewUrl}
                    accept="image/*"
                    onSelect={(file) => void selectPrimaryImageFile(file)}
                    onClear={clearPrimaryImage}
                  />
                ) : null}
                {secondaryImageVisible ? (
                  <TabletReferenceInput
                    title="Second image"
                    description={secondaryImageRequired ? 'Required second image' : 'Optional second image'}
                    previewUrl={previewUrl2}
                    accept="image/*"
                    onSelect={(file) => void selectSecondaryImageFile(file)}
                    onClear={clearSecondaryImage}
                  />
                ) : null}
              </section>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/70 px-4 py-3">
          <Button
            className="h-11 w-full"
            disabled={isGenerating || isLoadingMedia || isPromptDraftSyncing}
            onClick={() => void submit()}
          >
            {isGenerating || isPromptDraftSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {isGenerating ? 'Starting generation...' : isPromptDraftSyncing ? 'Syncing draft...' : 'Generate'}
          </Button>
        </div>
      </div>

      <Dialog open={showPromptDraftSelector} onOpenChange={setShowPromptDraftSelector}>
        <DialogContent className="max-h-[80dvh] w-[calc(100vw-2rem)] max-w-lg overflow-hidden p-0">
          <DialogHeader className="border-b px-4 py-4">
            <DialogTitle>Select Prompt Draft</DialogTitle>
            <DialogDescription>Choose a saved Prompt Constructor draft or keep using a manual prompt.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65dvh] overflow-y-auto px-4 py-4">
            <div className="space-y-2">
              {isPromptDocumentsLoading ? (
                <div className="rounded-md border border-border px-4 py-6 text-sm text-muted-foreground">Loading prompt drafts...</div>
              ) : (
                <>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-md border px-3 py-3 text-left',
                      !isPromptDraftSelected ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-background/40 hover:border-primary/40 hover:bg-primary/5',
                    )}
                    onClick={() => {
                      clearPromptDocument();
                      setShowPromptDraftSelector(false);
                    }}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="truncate text-sm font-medium text-foreground">Manual prompt</div>
                      <div className="mt-1 text-xs text-muted-foreground">No Prompt Constructor draft selected</div>
                    </div>
                    {!isPromptDraftSelected ? <WandSparkles className="h-4 w-4 shrink-0 text-primary" /> : null}
                  </button>

                  {promptDocuments.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                      No saved Prompt Constructor drafts yet.
                    </div>
                  ) : (
                    promptDocuments.map((document) => {
                      const isSelected = isPromptDraftSelected && selectedPromptDocumentId === document.id;
                      return (
                        <button
                          key={document.id}
                          type="button"
                          className={cn(
                            'flex w-full items-center justify-between rounded-md border px-3 py-3 text-left',
                            isSelected ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-background/40 hover:border-primary/40 hover:bg-primary/5',
                          )}
                          onClick={() => {
                            selectPromptDocument(document.id);
                            setShowPromptDraftSelector(false);
                          }}
                        >
                          <div className="min-w-0 pr-3">
                            <div className="truncate text-sm font-medium text-foreground">{document.title}</div>
                            <div className="mt-1 truncate text-xs text-muted-foreground">{document.sceneType || document.templateId}</div>
                          </div>
                          {isSelected ? <WandSparkles className="h-4 w-4 shrink-0 text-primary" /> : null}
                        </button>
                      );
                    })
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TabletModeControls({
  activeMode,
  onModeChange,
}: {
  activeMode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
}) {
  if (activeMode === 'image') {
    return <TabletImageCreateControls activeMode={activeMode} onModeChange={onModeChange} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/70 px-4 py-3">
        <MobileCreateModeBar activeMode={activeMode} onModeChange={onModeChange} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        {activeMode === 'video' ? <VideoGenerationForm /> : null}
        {activeMode === 'tts' ? <AudioGenerationForm /> : null}
        {activeMode === 'music' ? <MusicGenerationForm /> : null}
      </div>
    </div>
  );
}

function TabletJobStripThumbnail({ job }: { job: MobileJobsScreenItem }) {
  const imageUrl = job.thumbnailUrl || (job.type === 'image' ? job.resultUrl : null);

  if (imageUrl && job.status === 'completed') {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={job.modelId} className="h-full w-full object-contain" loading="lazy" decoding="async" />
        {job.type === 'video' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white">
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (job.type === 'image') {
    return <ImageIcon className="h-6 w-6 text-muted-foreground" />;
  }

  if (job.type === 'video') {
    return <Rows3 className="h-6 w-6 text-muted-foreground" />;
  }

  return <Rows3 className="h-6 w-6 text-muted-foreground" />;
}

function TabletJobsStrip({
  entries,
  totalCount,
  selectedJobId,
  isLoading,
  isLoadingMore,
  stripHeight,
  onSelect,
  onLoadRange,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerEnd,
}: {
  entries: LoadedJobEntry[];
  totalCount: number;
  selectedJobId: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  stripHeight: number;
  onSelect: (job: MobileJobsScreenItem) => void;
  onLoadRange: (startIndex: number, endIndex: number) => void;
  onResizePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onResizePointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onResizePointerEnd: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || totalCount <= 0 || entries.length === 0) return;
    const remaining = scroller.scrollWidth - scroller.scrollLeft - scroller.clientWidth;
    if (remaining > scroller.clientWidth * 1.2) return;
    const lastLoadedIndex = entries[entries.length - 1]?.absoluteIndex ?? 0;
    onLoadRange(lastLoadedIndex + 1, Math.min(totalCount - 1, lastLoadedIndex + 72));
  }, [entries, onLoadRange, totalCount]);

  useEffect(() => {
    if (!selectedJobId) return;
    const selectedElement = itemRefs.current.get(selectedJobId);
    if (!selectedElement || typeof selectedElement.scrollIntoView !== 'function') return;
    selectedElement.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [selectedJobId]);

  return (
    <section
      className="relative shrink-0 border-t border-border bg-card/80"
      style={{ height: stripHeight }}
      data-testid="tablet-jobs-strip"
    >
      <div
        role="separator"
        aria-label="Resize jobs strip"
        className="absolute -top-2 left-0 right-0 z-10 flex h-4 touch-none items-center justify-center"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerEnd}
        onPointerCancel={onResizePointerEnd}
      >
        <div className="h-1 w-16 rounded-full bg-border" />
      </div>

      <div className="flex h-full min-h-0">
        <div ref={scrollerRef} className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain custom-scrollbar" onScroll={handleScroll}>
          <div className="flex h-full gap-2 pr-2">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="aspect-square h-full shrink-0 rounded-md border border-border/70 bg-muted/20 animate-pulse" />
              ))
            ) : entries.length === 0 ? (
              <div className="flex h-full min-w-48 items-center justify-center rounded-md border border-dashed border-border px-4 text-sm text-muted-foreground">
                No jobs yet
              </div>
            ) : (
              entries.map(({ job }) => {
                const selected = selectedJobId === job.id;
                return (
                  <button
                    key={job.id}
                    ref={(element) => {
                      if (element) {
                        itemRefs.current.set(job.id, element);
                      } else {
                        itemRefs.current.delete(job.id);
                      }
                    }}
                    type="button"
                    className={cn(
                      'relative flex aspect-square h-full shrink-0 items-center justify-center overflow-hidden rounded-md border bg-black transition-colors',
                      selected ? 'border-primary ring-2 ring-primary/50' : 'border-border/70 hover:border-primary/50',
                    )}
                    onClick={() => onSelect(job)}
                    aria-label={`Preview ${job.modelId}`}
                  >
                    <TabletJobStripThumbnail job={job} />
                    {isRunningJob(job.status) ? (
                      <div className="absolute left-1 top-1 h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.9)]" />
                    ) : null}
                    {job.status === 'failed' ? (
                      <div className="absolute left-1 top-1 h-2 w-2 rounded-full bg-red-400" />
                    ) : null}
                  </button>
                );
              })
            )}
            {isLoadingMore ? (
              <div className="flex aspect-square h-full shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/20">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function TabletJobInfo({
  job,
  detail,
}: {
  job: MobileJobsScreenItem;
  detail: TabletJobDetail | null;
}) {
  const output = getPrimaryOutput(detail);
  const promptVersions = getPromptVersions({
    prompt: detail?.prompt || job.prompt,
    options: detail?.options,
  });
  const [promptMode, setPromptMode] = useState<PromptVersionMode>('original');
  const selectedPrompt = getPromptForMode(promptVersions, promptMode);

  useEffect(() => {
    setPromptMode('original');
  }, [job.id]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4 custom-scrollbar">
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-muted-foreground">Model</div>
            <div className="truncate text-foreground">{getModelById(job.modelId)?.name || job.modelId}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Status</div>
            <div className="text-foreground">{formatJobStatus(detail?.status || job.status)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Type</div>
            <div className="text-foreground">{job.type}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Created</div>
            <div className="text-foreground">{formatCreatedAt(detail?.createdAt || job.createdAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Execution</div>
            <div className="text-foreground">{formatExecution(detail?.executionMs ?? job.executionMs) || '-'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Saved</div>
            <div className="text-foreground">{output?.savedBuckets.length ? output.savedBuckets.join(', ') : '-'}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-muted-foreground">Prompt</div>
            {promptVersions.hasResolvedPrompt ? (
              <div className="inline-flex overflow-hidden rounded-md border border-border bg-muted/20 p-0.5">
                {(['original', 'resolved'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPromptMode(mode)}
                    className={cn(
                      'rounded px-2 py-0.5 text-[11px] transition-colors',
                      promptMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                    )}
                  >
                    {mode === 'original' ? 'Original' : 'Resolved'}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="whitespace-pre-wrap text-foreground">{selectedPrompt || 'No prompt saved.'}</div>
        </div>

        {detail?.error ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300">
            <div className="mb-1 font-medium">Error</div>
            <div className="whitespace-pre-wrap break-words">{detail.error}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TabletPreviewActions({
  job,
  detail,
  isSubmitting,
  onDownload,
  onSaveToBucket,
  onReuse,
  onUpscale,
  onCancel,
  onDelete,
}: {
  job: MobileJobsScreenItem;
  detail: TabletJobDetail | null;
  isSubmitting: boolean;
  onDownload: () => void;
  onSaveToBucket: (bucket: GalleryBucket) => void;
  onReuse: (action: 'txt2img' | 'img2img' | 'img2vid') => void;
  onUpscale: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const output = getPrimaryOutput(detail);
  const canPreviewMedia = job.type === 'image' || job.type === 'video';
  const canUseOutput = !!output?.url || !!job.resultUrl;
  const canSaveDraft = !!output && !output.savedBuckets.includes('draft') && !output.savedBuckets.includes('upscale');
  const canAddToGallery = !!output && !output.savedBuckets.includes('common');
  const running = isRunningJob(detail?.status || job.status);
  const finished = !running && (detail?.status || job.status) !== 'queueing_up';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" className="h-9 w-9" onClick={onDownload} disabled={!canUseOutput || isSubmitting} aria-label="Download" title="Download">
        <Download className="h-4 w-4" />
      </Button>
      {canSaveDraft ? (
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => onSaveToBucket('draft')} disabled={isSubmitting} aria-label="Save draft" title="Save Draft">
          <FolderPlus className="h-4 w-4" />
        </Button>
      ) : null}
      {canAddToGallery ? (
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => onSaveToBucket('common')} disabled={isSubmitting} aria-label="Add to Gallery" title="Add to Gallery">
          <FolderOpen className="h-4 w-4" />
        </Button>
      ) : null}
      {job.type === 'image' ? (
        <>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => onReuse('txt2img')} disabled={isSubmitting} aria-label="Open in txt2img" title="To txt2img">
            <Type className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => onReuse('img2img')} disabled={isSubmitting} aria-label="Open in img2img" title="To img2img">
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => onReuse('img2vid')} disabled={isSubmitting} aria-label="Open in img2vid" title="To img2vid">
            <Clapperboard className="h-4 w-4" />
          </Button>
        </>
      ) : null}
      {job.type === 'video' ? (
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => onReuse('txt2img')} disabled={isSubmitting} aria-label="Open in txt2img" title="To txt2img">
          <Type className="h-4 w-4" />
        </Button>
      ) : null}
      {canPreviewMedia ? (
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={onUpscale} disabled={isSubmitting} aria-label="Upscale" title="Upscale">
          <Zap className="h-4 w-4" />
        </Button>
      ) : null}
      {running ? (
        <InlineConfirmDeleteButton
          onConfirm={onCancel}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground"
          confirmClassName="inline-flex h-9 w-9 items-center justify-center rounded-md border border-amber-300/30 bg-amber-600 text-white"
          ariaLabel="Cancel job"
          confirmAriaLabel="Confirm cancel job"
          title="Cancel"
          confirmTitle="Confirm cancel"
          icon={<Ban className="h-4 w-4" />}
          iconClassName="h-4 w-4"
        />
      ) : null}
      {finished ? (
        <InlineConfirmDeleteButton
          onConfirm={onDelete}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground"
          confirmClassName="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-300/30 bg-red-600 text-white"
          ariaLabel="Delete job"
          confirmAriaLabel="Confirm delete job"
          title="Delete"
          confirmTitle="Confirm delete"
          icon={<Trash2 className="h-4 w-4" />}
          iconClassName="h-4 w-4"
        />
      ) : null}
      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
    </div>
  );
}

function TabletJobPreviewPanel({
  job,
  detail,
  isDetailLoading,
  isSubmitting,
  viewMode,
  onViewModeChange,
  onDownload,
  onSaveToBucket,
  onReuse,
  onUpscale,
  onCancel,
  onDelete,
  canSwipeToPreviousJob,
  canSwipeToNextJob,
  onSwipeJob,
}: {
  job: MobileJobsScreenItem | null;
  detail: TabletJobDetail | null;
  isDetailLoading: boolean;
  isSubmitting: boolean;
  viewMode: 'asset' | 'info';
  onViewModeChange: (mode: 'asset' | 'info') => void;
  onDownload: () => void;
  onSaveToBucket: (bucket: GalleryBucket) => void;
  onReuse: (action: 'txt2img' | 'img2img' | 'img2vid') => void;
  onUpscale: () => void;
  onCancel: () => void;
  onDelete: () => void;
  canSwipeToPreviousJob: boolean;
  canSwipeToNextJob: boolean;
  onSwipeJob: (direction: 'previous' | 'next') => void;
}) {
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const output = getPrimaryOutput(detail);
  const mediaUrl = getPreviewUrl(job, output);
  const previewType = output?.type || job?.type;
  const canUsePreviewSwipe = viewMode === 'asset'
    && !!job
    && previewType === 'image'
    && !!mediaUrl
    && (canSwipeToPreviousJob || canSwipeToNextJob);

  const handlePreviewTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!canUsePreviewSwipe || event.touches.length !== 1) {
      swipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [canUsePreviewSwipe]);

  const handlePreviewTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      swipeStartRef.current = null;
    }
  }, []);

  const handlePreviewTouchCancel = useCallback(() => {
    swipeStartRef.current = null;
  }, []);

  const handlePreviewTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!canUsePreviewSwipe || !start || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < PREVIEW_SWIPE_THRESHOLD || Math.abs(deltaY) > Math.abs(deltaX)) return;

    if (deltaX < 0 && canSwipeToNextJob) {
      onSwipeJob('next');
      return;
    }

    if (deltaX > 0 && canSwipeToPreviousJob) {
      onSwipeJob('previous');
    }
  }, [canSwipeToNextJob, canSwipeToPreviousJob, canUsePreviewSwipe, onSwipeJob]);

  return (
    <section className="flex h-full min-h-0 flex-col border-l border-border/70 bg-background">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {job ? (getModelById(job.modelId)?.name || job.modelId) : 'Preview'}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {job ? formatJobStatus(detail?.status || job.status) : 'Select a job from the strip'}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-border bg-muted/20 p-0.5">
            {(['asset', 'info'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={cn(
                  'h-8 px-3 text-xs font-medium capitalize transition-colors',
                  viewMode === mode ? 'rounded bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                )}
                onClick={() => onViewModeChange(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9" asChild aria-label="Open Gallery" title="Gallery">
            <Link href="/m/gallery">
              <FolderOpen className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" asChild aria-label="Open Carousel" title="Carousel">
            <Link href="/m/carousel">
              <Film className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {!job ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Select a job from the strip.
        </div>
      ) : viewMode === 'info' ? (
        <TabletJobInfo job={job} detail={detail} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className="flex min-h-0 flex-1 items-center justify-center bg-black p-3"
            data-testid="tablet-preview-media-surface"
            onTouchStart={handlePreviewTouchStart}
            onTouchMove={handlePreviewTouchMove}
            onTouchEnd={handlePreviewTouchEnd}
            onTouchCancel={handlePreviewTouchCancel}
            style={{ touchAction: canUsePreviewSwipe ? 'pan-y' : undefined }}
          >
            {isDetailLoading ? (
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading preview...
              </div>
            ) : mediaUrl ? (
              previewType === 'video' ? (
                <video src={mediaUrl} poster={output?.thumbnailUrl || job.thumbnailUrl || undefined} controls playsInline className="max-h-full max-w-full object-contain" />
            ) : previewType === 'audio' ? (
              <audio src={mediaUrl} controls className="w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt={job.prompt || job.modelId} className="max-h-full max-w-full object-contain" />
            )
            ) : (
              <div className="flex flex-col items-center gap-3 text-sm text-white/60">
                {job.type === 'image' ? <ImageIcon className="h-8 w-8" /> : <Rows3 className="h-8 w-8" />}
                {isRunningJob(job.status) ? formatJobStatus(job.status) : 'No output media yet'}
              </div>
            )}
          </div>
          <div className="shrink-0 border-t border-border/70 px-4 py-3">
            <TabletPreviewActions
              job={job}
              detail={detail}
              isSubmitting={isSubmitting}
              onDownload={onDownload}
              onSaveToBucket={onSaveToBucket}
              onReuse={onReuse}
              onUpscale={onUpscale}
              onCancel={onCancel}
              onDelete={onDelete}
            />
          </div>
        </div>
      )}
    </section>
  );
}

export default function TabletCreateWorkspace({
  activeMode,
  onModeChange,
}: {
  activeMode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    totalCount,
    loadedEntries,
    isLoading,
    isLoadingMore,
    error,
    refresh,
    ensureRangeLoaded,
    removeJob,
    cancelActiveJob,
    upscaleJob,
  } = useMobileJobsScreen();
  const [stripHeight, setStripHeight] = useState(STRIP_DEFAULT_HEIGHT);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState<TabletJobDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [previewViewMode, setPreviewViewMode] = useState<'asset' | 'info'>('asset');
  const resizeRef = useRef<{ pointerId: number | null; startY: number; startHeight: number }>({
    pointerId: null,
    startY: 0,
    startHeight: STRIP_DEFAULT_HEIGHT,
  });

  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return loadedEntries.find((entry) => entry.job.id === selectedJobId)?.job || null;
  }, [loadedEntries, selectedJobId]);

  const selectedLoadedEntryIndex = useMemo(() => {
    if (!selectedJobId) return -1;
    return loadedEntries.findIndex((entry) => entry.job.id === selectedJobId);
  }, [loadedEntries, selectedJobId]);

  const selectLoadedJobAtIndex = useCallback((index: number) => {
    const entry = loadedEntries[index];
    if (!entry) return;
    setSelectedJobId(entry.job.id);
    setPreviewViewMode('asset');
  }, [loadedEntries]);

  const navigatePreviewJob = useCallback((direction: 'previous' | 'next') => {
    if (selectedLoadedEntryIndex < 0) return;
    const nextIndex = direction === 'next' ? selectedLoadedEntryIndex + 1 : selectedLoadedEntryIndex - 1;
    selectLoadedJobAtIndex(nextIndex);
  }, [selectLoadedJobAtIndex, selectedLoadedEntryIndex]);

  useEffect(() => {
    if (totalCount > 0) {
      void ensureRangeLoaded(0, Math.min(totalCount - 1, 95));
    }
  }, [ensureRangeLoaded, totalCount]);

  useEffect(() => {
    if (selectedJobId && loadedEntries.some((entry) => entry.job.id === selectedJobId)) return;
    const firstPreviewable = loadedEntries[0]?.job || null;
    setSelectedJobId(firstPreviewable?.id || null);
  }, [loadedEntries, selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJobDetail(null);
      setIsDetailLoading(false);
      return;
    }

    let cancelled = false;
    setIsDetailLoading(true);
    const loadDetail = async () => {
      try {
        const response = await fetch(`/api/jobs/${selectedJobId}`, { cache: 'no-store' });
        const data = await response.json();
        if (!cancelled && response.ok && data.success && data.job) {
          setSelectedJobDetail(data.job);
        }
      } catch {
        if (!cancelled) setSelectedJobDetail(null);
      } finally {
        if (!cancelled) setIsDetailLoading(false);
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedJobId]);

  const withActionState = useCallback(async (action: () => Promise<void>, successMessage?: string) => {
    setIsSubmittingAction(true);
    try {
      await action();
      if (successMessage) showToast(successMessage, 'success', 1800);
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : 'Action failed', 'error', 2400);
    } finally {
      setIsSubmittingAction(false);
    }
  }, [showToast]);

  const selectedOutput = getPrimaryOutput(selectedJobDetail);

  const downloadSelectedOutput = useCallback(() => {
    const output = selectedOutput;
    const job = selectedJob;
    const url = output?.url || job?.resultUrl;
    if (!url || !job) return;

    void withActionState(async () => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `job-${job.id}-${output?.outputId || 'output-1'}.${(output?.type || job.type) === 'video' ? 'mp4' : (output?.type || job.type) === 'audio' ? 'mp3' : 'png'}`;
        document.body.appendChild(anchor);
        anchor.click();
        window.URL.revokeObjectURL(objectUrl);
        document.body.removeChild(anchor);
      } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  }, [selectedJob, selectedOutput, withActionState]);

  const saveSelectedOutput = useCallback((bucket: GalleryBucket) => {
    const output = selectedOutput;
    const job = selectedJob;
    if (!output || !job) return;

    void withActionState(async () => {
      const response = await fetch('/api/gallery/assets/from-job-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, outputId: output.outputId, bucket }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to save to ${bucket}`);
      }
      setSelectedJobDetail((prev) => updateOutputBucketState(prev, output.outputId, bucket, data.asset?.id || null));
    }, bucket === 'common' ? 'Added to Gallery' : bucket === 'draft' ? 'Draft saved' : 'Saved');
  }, [selectedJob, selectedOutput, withActionState]);

  const reuseSelectedOutput = useCallback((action: 'txt2img' | 'img2img' | 'img2vid') => {
    const output = selectedOutput;
    const job = selectedJob;
    if (!job) return;

    void withActionState(async () => {
      const response = await fetch(`/api/jobs/${job.id}/reuse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          outputId: output?.outputId || 'output-1',
          ...(action === 'txt2img' && job.type === 'image' ? { promptOverride: selectedJobDetail?.prompt || job.prompt } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.payload) {
        throw new Error(data.error || 'Failed to prepare reuse payload');
      }
      persistCreateReuseDraft(data.payload);
      router.push('/m/create');
    }, 'Opened in Create');
  }, [router, selectedJob, selectedJobDetail?.prompt, selectedOutput, withActionState]);

  const upscaleSelectedJob = useCallback(() => {
    const job = selectedJob;
    if (!job || (job.type !== 'image' && job.type !== 'video')) return;

    void withActionState(async () => {
      await upscaleJob(job);
      await refresh();
    }, 'Upscale job created');
  }, [refresh, selectedJob, upscaleJob, withActionState]);

  const cancelSelectedJob = useCallback(() => {
    const job = selectedJob;
    if (!job) return;

    void withActionState(async () => {
      await cancelActiveJob(job.id);
      await refresh();
    }, 'Job cancelled');
  }, [cancelActiveJob, refresh, selectedJob, withActionState]);

  const deleteSelectedJob = useCallback(() => {
    const job = selectedJob;
    if (!job) return;

    void withActionState(async () => {
      await removeJob(job.id);
      setSelectedJobId(null);
      setSelectedJobDetail(null);
      await refresh();
    }, 'Job deleted');
  }, [refresh, removeJob, selectedJob, withActionState]);

  const handleResizePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    resizeRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: stripHeight,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [stripHeight]);

  const handleResizePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (resize.pointerId !== event.pointerId) return;
    const deltaY = resize.startY - event.clientY;
    setStripHeight(clamp(resize.startHeight + deltaY, STRIP_MIN_HEIGHT, getStripMaxHeight()));
  }, []);

  const handleResizePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (resizeRef.current.pointerId !== event.pointerId) return;
    resizeRef.current = { pointerId: null, startY: 0, startHeight: stripHeight };
  }, [stripHeight]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background text-foreground" data-testid="tablet-create-workspace">
      <div className="flex min-h-0 flex-1">
        <aside className="flex min-h-0 w-[42%] min-w-[360px] max-w-[480px] shrink-0 flex-col border-r border-border/70 bg-card/80">
          <TabletModeControls activeMode={activeMode} onModeChange={onModeChange} />
        </aside>

        <main className="min-w-0 flex-1">
          <TabletJobPreviewPanel
            job={selectedJob}
            detail={selectedJobDetail}
            isDetailLoading={isDetailLoading}
            isSubmitting={isSubmittingAction}
            viewMode={previewViewMode}
            onViewModeChange={setPreviewViewMode}
            onDownload={downloadSelectedOutput}
            onSaveToBucket={saveSelectedOutput}
            onReuse={reuseSelectedOutput}
            onUpscale={upscaleSelectedJob}
            onCancel={cancelSelectedJob}
            onDelete={deleteSelectedJob}
            canSwipeToPreviousJob={selectedLoadedEntryIndex > 0}
            canSwipeToNextJob={selectedLoadedEntryIndex >= 0 && selectedLoadedEntryIndex < loadedEntries.length - 1}
            onSwipeJob={navigatePreviewJob}
          />
        </main>
      </div>

      {error ? (
        <div className="shrink-0 border-t border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</div>
      ) : null}

      <TabletJobsStrip
        entries={loadedEntries}
        totalCount={totalCount}
        selectedJobId={selectedJobId}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        stripHeight={stripHeight}
        onSelect={(job) => {
          setSelectedJobId(job.id);
          setPreviewViewMode('asset');
        }}
        onLoadRange={(startIndex, endIndex) => void ensureRangeLoaded(startIndex, endIndex)}
        onResizePointerDown={handleResizePointerDown}
        onResizePointerMove={handleResizePointerMove}
        onResizePointerEnd={handleResizePointerEnd}
      />
    </div>
  );
}
