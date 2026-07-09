'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clapperboard,
  CopyPlus,
  Film,
  FastForward,
  ImageIcon,
  ImagePlus,
  Images,
  Layers3,
  Loader2,
  Package,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Search,
  Sparkles,
  Trash2,
  Waypoints,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { LoRAFile } from '@/components/lora/LoRASelector';
import { buildLoraPairs, filterLorasForModel, getLoraSearchText } from '@/lib/lora/modelFilters';
import { cn } from '@/lib/utils';

type VideoSequenceSegment = {
  id: string;
  sequenceId: string;
  orderIndex: number;
  title: string;
  status: string;
  sourceMode: string;
  sourceImageUrl: string | null;
  sourceImageAssetId?: string | null;
  sourceFrozen: boolean;
  prompt: string;
  negativePrompt: string;
  motionPrompt: string;
  continuityPrompt: string;
  modelId: string;
  endpointId: string | null;
  loraConfig: Record<string, unknown>;
  generationOptions: Record<string, unknown>;
  seed: number | null;
  randomizeSeed: boolean;
  durationSeconds: number;
  generationJobId: string | null;
  outputVideoUrl: string | null;
  outputVideoMetadata?: {
    durationSeconds: number;
    fps: number | null;
    frameCount: number | null;
    width?: number | null;
    height?: number | null;
    format?: string | null;
  } | null;
  firstFrameUrl: string | null;
  lastFrameUrl: string | null;
  templateId: string | null;
  error: string | null;
};

type VideoSequence = {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: string;
  aspectRatio: string;
  width: number;
  height: number;
  targetFps: number;
  defaultModelId: string;
  defaultGenerationOptions: Record<string, unknown>;
  finalVideoUrl: string | null;
  segments: VideoSequenceSegment[];
  segmentCount?: number;
};

type VideoSegmentTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  promptTemplate: string;
  motionTemplate: string;
  defaultDurationSeconds: number;
  thumbnailUrl: string | null;
};

type GalleryAsset = {
  id: string;
  type: 'image' | 'video' | string;
  originalUrl: string;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  prompt?: string | null;
  modelId?: string | null;
  addedToGalleryAt: string;
};

type SegmentDraft = {
  title: string;
  sourceMode: string;
  sourceImageUrl: string;
  sourceFrozen: boolean;
  prompt: string;
  negativePrompt: string;
  motionPrompt: string;
  continuityPrompt: string;
  modelId: string;
  endpointId: string;
  durationSeconds: string;
  seed: string;
  randomizeSeed: boolean;
  generationSteps: string;
  loraConfigJson: string;
  generationOptionsJson: string;
};

const userId = 'user-with-settings';

const sourceModeLabels: Record<string, string> = {
  initial: 'Initial image',
  previous_last_frame: 'Previous last frame',
  gallery_asset: 'Gallery asset',
  job_output: 'Job output',
  upload: 'Upload',
  manual_frame: 'Manual frame',
};

const statusStyles: Record<string, string> = {
  draft: 'border-zinc-600 text-zinc-300',
  queued: 'border-sky-500/50 text-sky-300',
  processing: 'border-cyan-500/50 text-cyan-300',
  completed: 'border-emerald-500/50 text-emerald-300',
  failed: 'border-rose-500/50 text-rose-300',
  stale: 'border-amber-500/50 text-amber-300',
};

function jsonText(value: unknown, fallback: unknown) {
  return JSON.stringify(value ?? fallback, null, 2);
}

function formatSeconds(value: number) {
  return `${value.toFixed(2)}s`;
}

function formatPreviewTime(value: number) {
  const safeValue = Number.isFinite(value) && value > 0 ? value : 0;
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue % 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
}

function getSegmentOutputDuration(segment: VideoSequenceSegment) {
  const metadataDuration = Number(segment.outputVideoMetadata?.durationSeconds);
  if (Number.isFinite(metadataDuration) && metadataDuration > 0) return metadataDuration;
  return segment.durationSeconds || 0;
}

function formatFps(value: number | null | undefined) {
  if (!Number.isFinite(value) || !value || value <= 0) return null;
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

export function formatSegmentOutputMetrics(segment: VideoSequenceSegment) {
  const metadata = segment.outputVideoMetadata;
  if (!metadata?.durationSeconds) return `${segment.durationSeconds}s`;
  const duration = formatSeconds(metadata.durationSeconds);
  const fps = formatFps(metadata.fps);
  const frameCount = Number.isInteger(metadata.frameCount) && metadata.frameCount && metadata.frameCount > 0
    ? `${metadata.frameCount}f`
    : null;
  return [frameCount, fps ? `${fps}fps` : null, duration].filter(Boolean).join(' / ');
}

const maxWanLoraPairs = 4;
const maxWanLoraFiles = maxWanLoraPairs * 2;
const defaultWanLoraWeight = 0.8;
const defaultWanSteps = 4;

type WanLoraSlot = {
  index: number;
  highPath: string;
  lowPath: string;
  highWeight: number;
  lowWeight: number;
  highLoRA?: LoRAFile;
  lowLoRA?: LoRAFile;
  label: string;
};

function parseJsonObjectText(value: string, fallback: Record<string, unknown> = {}) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { ...parsed } as Record<string, unknown>
      : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function parseRequiredJsonObjectText(value: string, label: string) {
  try {
    const parsed = JSON.parse(value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} must contain a JSON object`);
    }
    return { ...parsed } as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.message.includes('must contain')) throw error;
    throw new Error(`${label} must contain valid JSON`);
  }
}

function numberFromUnknown(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatLoraFileSize(sizeStr: string) {
  const bytes = Number.parseInt(sizeStr, 10);
  if (!Number.isFinite(bytes)) return sizeStr;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function getSelectedWanLoraSlots(loraConfigJson: string, availableLoras: LoRAFile[]): WanLoraSlot[] {
  const config = parseJsonObjectText(loraConfigJson);

  return Array.from({ length: maxWanLoraPairs }, (_, offset) => offset + 1)
    .map((index) => {
      const highPath = typeof config[`lora_high_${index}`] === 'string' ? String(config[`lora_high_${index}`]).trim() : '';
      const lowPath = typeof config[`lora_low_${index}`] === 'string' ? String(config[`lora_low_${index}`]).trim() : '';
      if (!highPath && !lowPath) return null;

      const highLoRA = availableLoras.find((lora) => lora.s3Path === highPath);
      const lowLoRA = availableLoras.find((lora) => lora.s3Path === lowPath);
      return {
        index,
        highPath,
        lowPath,
        highWeight: numberFromUnknown(config[`lora_high_${index}_weight`], defaultWanLoraWeight),
        lowWeight: numberFromUnknown(config[`lora_low_${index}_weight`], defaultWanLoraWeight),
        highLoRA,
        lowLoRA,
        label: highLoRA?.name || lowLoRA?.name || highLoRA?.fileName || lowLoRA?.fileName || `LoRA pair ${index}`,
      };
    })
    .filter((slot): slot is WanLoraSlot => slot !== null);
}

export function getNextWanLoraSlotIndex(loraConfigJson: string) {
  const config = parseJsonObjectText(loraConfigJson);
  for (let index = 1; index <= maxWanLoraPairs; index += 1) {
    const highPath = typeof config[`lora_high_${index}`] === 'string' ? String(config[`lora_high_${index}`]).trim() : '';
    const lowPath = typeof config[`lora_low_${index}`] === 'string' ? String(config[`lora_low_${index}`]).trim() : '';
    if (!highPath && !lowPath) return index;
  }
  return null;
}

export function setWanLoraPairInConfig(
  loraConfigJson: string,
  index: number,
  pair: { highPath: string; lowPath: string; highWeight?: number; lowWeight?: number } | null,
) {
  const config = parseJsonObjectText(loraConfigJson);
  const highKey = `lora_high_${index}`;
  const lowKey = `lora_low_${index}`;
  const highWeightKey = `lora_high_${index}_weight`;
  const lowWeightKey = `lora_low_${index}_weight`;

  if (!pair) {
    delete config[highKey];
    delete config[lowKey];
    delete config[highWeightKey];
    delete config[lowWeightKey];
    return JSON.stringify(config, null, 2);
  }

  config[highKey] = pair.highPath;
  config[lowKey] = pair.lowPath;
  config[highWeightKey] = pair.highWeight ?? defaultWanLoraWeight;
  config[lowWeightKey] = pair.lowWeight ?? defaultWanLoraWeight;
  return JSON.stringify(config, null, 2);
}

export function setWanLoraWeightInConfig(loraConfigJson: string, index: number, component: 'high' | 'low', weight: number) {
  const config = parseJsonObjectText(loraConfigJson);
  config[`lora_${component}_${index}_weight`] = weight;
  return JSON.stringify(config, null, 2);
}

export function buildSegmentGenerationOptionsJson(generationOptionsJson: string, generationSteps: string) {
  const steps = Number(generationSteps || defaultWanSteps);
  const generationOptions = parseRequiredJsonObjectText(generationOptionsJson, 'Options JSON');
  delete generationOptions.width;
  delete generationOptions.height;
  delete generationOptions.aspectRatio;
  generationOptions.steps = Number.isFinite(steps) && steps > 0 ? steps : defaultWanSteps;
  return JSON.stringify(generationOptions, null, 2);
}

function aspectRatioFromDimensions(width: number, height: number) {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function parseSequenceDimension(value: string, fallback: number) {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : fallback;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || data?.message || `Request failed: ${response.status}`);
  }
  return data as T;
}

function makeSegmentDraft(segment: VideoSequenceSegment): SegmentDraft {
  const generationOptions = parseJsonObjectText(jsonText(segment.generationOptions, {}));
  return {
    title: segment.title,
    sourceMode: segment.sourceMode,
    sourceImageUrl: segment.sourceImageUrl ?? '',
    sourceFrozen: segment.sourceFrozen,
    prompt: segment.prompt,
    negativePrompt: segment.negativePrompt,
    motionPrompt: segment.motionPrompt,
    continuityPrompt: segment.continuityPrompt,
    modelId: segment.modelId,
    endpointId: segment.endpointId ?? '',
    durationSeconds: String(segment.durationSeconds || 6),
    seed: segment.seed === null || segment.seed === undefined ? '' : String(segment.seed),
    randomizeSeed: segment.randomizeSeed,
    generationSteps: String(numberFromUnknown(generationOptions.steps, defaultWanSteps)),
    loraConfigJson: jsonText(segment.loraConfig, {}),
    generationOptionsJson: jsonText(segment.generationOptions, {}),
  };
}

function emptySegmentDraft(): SegmentDraft {
  return {
    title: '',
    sourceMode: 'previous_last_frame',
    sourceImageUrl: '',
    sourceFrozen: false,
    prompt: '',
    negativePrompt: '',
    motionPrompt: '',
    continuityPrompt: '',
    modelId: 'wan22',
    endpointId: '',
    durationSeconds: '6',
    seed: '',
    randomizeSeed: true,
    generationSteps: String(defaultWanSteps),
    loraConfigJson: '{}',
    generationOptionsJson: jsonText({ steps: defaultWanSteps }, {}),
  };
}

export function getSegmentSourcePreviewUrl(segment: VideoSequenceSegment, segments: VideoSequenceSegment[]) {
  if (segment.sourceImageUrl) return segment.sourceImageUrl;
  if (segment.sourceMode === 'previous_last_frame') {
    const previous = segments.find((item) => item.orderIndex === segment.orderIndex - 1);
    return previous?.lastFrameUrl ?? null;
  }
  return null;
}

export function shouldAutoSyncVideoSequenceSegment(segment: Pick<VideoSequenceSegment, 'status' | 'generationJobId'>) {
  return Boolean(segment.generationJobId && (segment.status === 'queued' || segment.status === 'processing'));
}

export function hasSyncedVideoSequenceSegmentChange(current: VideoSequenceSegment, next: VideoSequenceSegment) {
  return current.status !== next.status
    || current.outputVideoUrl !== next.outputVideoUrl
    || current.firstFrameUrl !== next.firstFrameUrl
    || current.lastFrameUrl !== next.lastFrameUrl
    || current.error !== next.error;
}

export type SequencePreviewTimelineItem = {
  segment: VideoSequenceSegment;
  start: number;
  end: number;
  duration: number;
};

export function buildSequencePreviewTimeline(segments: VideoSequenceSegment[]): SequencePreviewTimelineItem[] {
  let cursor = 0;
  return segments
    .filter((segment) => segment.status === 'completed' && Boolean(segment.outputVideoUrl))
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((segment) => {
      const duration = Math.max(0.1, getSegmentOutputDuration(segment));
      const item = {
        segment,
        start: cursor,
        end: cursor + duration,
        duration,
      };
      cursor += duration;
      return item;
    });
}

export function findSequencePreviewTimelineItem(timeline: SequencePreviewTimelineItem[], timeSeconds: number) {
  if (timeline.length === 0) return null;
  const safeTime = Math.max(0, timeSeconds);
  return timeline.find((item) => safeTime >= item.start && safeTime < item.end) ?? timeline[timeline.length - 1];
}

export function getRenderBlocker(sequence: VideoSequence | null) {
  if (!sequence) return 'No sequence selected';
  if (!sequence.segments.length) return 'Add segments before rendering';

  const incomplete = sequence.segments.find((segment) => segment.status !== 'completed');
  if (incomplete) return `Segment ${incomplete.orderIndex + 1} is ${incomplete.status}`;

  const missingOutput = sequence.segments.find((segment) => !segment.outputVideoUrl);
  if (missingOutput) return `Segment ${missingOutput.orderIndex + 1} is missing output`;

  return null;
}

export function getHeaderActionTooltip(action: 'save' | 'generate' | 'generateFrom' | 'status' | 'render' | 'final', renderBlocker?: string | null) {
  switch (action) {
    case 'save':
      return 'Save sequence title, description, and selected segment changes';
    case 'generate':
      return 'Generate only the selected segment';
    case 'generateFrom':
      return 'Generate from the selected segment forward until the chain blocks or finishes';
    case 'status':
      return 'Refresh the selected segment job status and pull completed output metadata';
    case 'render':
      return renderBlocker ? `Render final is blocked: ${renderBlocker}` : 'Render one final video from all completed segment outputs';
    case 'final':
      return 'Open the rendered final video in a new tab';
  }
}

export function getSegmentInspectorActionTooltip(
  action: 'saveSegment' | 'generate' | 'generateFrom' | 'status' | 'saveTemplate' | 'delete' | 'galleryImage' | 'galleryVideo' | 'manualFramePicker',
  context?: { hasJob?: boolean; hasOutput?: boolean; isFirstSegment?: boolean; hasPreviousOutput?: boolean },
) {
  switch (action) {
    case 'saveSegment':
      return 'Save the selected segment draft: source, prompt, model, seed, duration, LoRAs, and generation options';
    case 'generate':
      return 'Generate only this selected segment from its current source frame and prompt settings';
    case 'generateFrom':
      return 'Generate this segment, then continue forward through chained segments until one blocks or fails';
    case 'status':
      return context?.hasJob
        ? 'Refresh this segment job status and import completed output, first frame, and last frame metadata'
        : 'Refresh status becomes available after this segment has a generation job';
    case 'saveTemplate':
      return 'Save this segment prompt, model, and generation settings as a reusable segment template';
    case 'delete':
      return 'Delete this segment from the sequence and renumber the remaining timeline';
    case 'galleryImage':
      return 'Choose a Gallery image and use it as this segment source frame';
    case 'galleryVideo':
      return context?.isFirstSegment
        ? 'Choose a Gallery video and seed segment 1 as an already completed segment'
        : 'Gallery video can only seed segment 1; use Previous last frame for chained follow-up segments';
    case 'manualFramePicker':
      return context?.hasPreviousOutput
        ? 'Open the previous segment video and pick a custom source frame for this segment'
        : 'Manual frame picker becomes available after the previous segment has an output video';
  }
}

export default function VideoSequenceBuilder() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [sequences, setSequences] = useState<VideoSequence[]>([]);
  const [activeSequence, setActiveSequence] = useState<VideoSequence | null>(null);
  const [templates, setTemplates] = useState<VideoSegmentTemplate[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [segmentDraft, setSegmentDraft] = useState<SegmentDraft>(emptySegmentDraft);
  const [sequenceTitle, setSequenceTitle] = useState('');
  const [sequenceDescription, setSequenceDescription] = useState('');
  const [sequenceWidth, setSequenceWidth] = useState('1280');
  const [sequenceHeight, setSequenceHeight] = useState('720');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [galleryPickerType, setGalleryPickerType] = useState<'image' | 'video' | null>(null);
  const [galleryAssets, setGalleryAssets] = useState<GalleryAsset[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryQuery, setGalleryQuery] = useState('');
  const [framePickerOpen, setFramePickerOpen] = useState(false);
  const [framePickerTime, setFramePickerTime] = useState(0);
  const [framePickerDuration, setFramePickerDuration] = useState(0);
  const [availableLoras, setAvailableLoras] = useState<LoRAFile[]>([]);
  const [loraLoading, setLoraLoading] = useState(false);
  const [loraPickerOpen, setLoraPickerOpen] = useState(false);
  const [loraSearchQuery, setLoraSearchQuery] = useState('');
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const framePickerVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const loraSearchInputRef = useRef<HTMLInputElement | null>(null);
  const autoStatusSyncInFlightRef = useRef(false);

  const selectedSegment = useMemo(() => (
    activeSequence?.segments.find((segment) => segment.id === selectedSegmentId) ?? activeSequence?.segments[0] ?? null
  ), [activeSequence, selectedSegmentId]);

  const previousSegment = useMemo(() => (
    selectedSegment && activeSequence
      ? activeSequence.segments.find((segment) => segment.orderIndex === selectedSegment.orderIndex - 1) ?? null
      : null
  ), [activeSequence, selectedSegment]);

  const totalDuration = useMemo(() => (
    activeSequence?.segments.reduce((sum, segment) => sum + (segment.durationSeconds || 0), 0) ?? 0
  ), [activeSequence]);

  const renderBlocker = useMemo(() => getRenderBlocker(activeSequence), [activeSequence]);
  const selectedSourcePreviewUrl = useMemo(() => (
    selectedSegment && activeSequence
      ? getSegmentSourcePreviewUrl(selectedSegment, activeSequence.segments)
      : null
  ), [activeSequence, selectedSegment]);
  const previousSegmentOutputVideoUrl = previousSegment?.outputVideoUrl ?? null;
  const previewTimeline = useMemo(() => (
    activeSequence ? buildSequencePreviewTimeline(activeSequence.segments) : []
  ), [activeSequence]);
  const previewTotalDuration = previewTimeline.length ? previewTimeline[previewTimeline.length - 1].end : 0;
  const activePreviewTimelineItem = useMemo(() => (
    findSequencePreviewTimelineItem(previewTimeline, previewTime)
  ), [previewTimeline, previewTime]);
  const activePreviewSegment = activePreviewTimelineItem?.segment ?? null;
  const activePreviewLocalTime = activePreviewTimelineItem
    ? Math.max(0, Math.min(activePreviewTimelineItem.duration, previewTime - activePreviewTimelineItem.start))
    : 0;
  const timelineStatus = activeSequence?.finalVideoUrl
    ? 'Final rendered'
    : renderBlocker ?? `${formatPreviewTime(0)} - ${formatPreviewTime(totalDuration)}`;
  const filteredGalleryAssets = useMemo(() => {
    const query = galleryQuery.trim().toLowerCase();
    if (!query) return galleryAssets;
    return galleryAssets.filter((asset) => [
      asset.id,
      asset.prompt ?? '',
      asset.modelId ?? '',
      asset.originalUrl,
    ].join(' ').toLowerCase().includes(query));
  }, [galleryAssets, galleryQuery]);
  const modelLoras = useMemo(() => (
    filterLorasForModel(availableLoras, segmentDraft.modelId || 'wan22')
  ), [availableLoras, segmentDraft.modelId]);
  const selectedLoraSlots = useMemo(() => (
    getSelectedWanLoraSlots(segmentDraft.loraConfigJson, modelLoras)
  ), [modelLoras, segmentDraft.loraConfigJson]);
  const nextLoraSlotIndex = useMemo(() => (
    getNextWanLoraSlotIndex(segmentDraft.loraConfigJson)
  ), [segmentDraft.loraConfigJson]);
  const selectedLoraPathSet = useMemo(() => new Set(selectedLoraSlots.flatMap((slot) => [slot.highPath, slot.lowPath]).filter(Boolean)), [selectedLoraSlots]);
  const loraPairs = useMemo(() => (
    buildLoraPairs(modelLoras).filter((pair) => pair.isComplete && pair.high && pair.low)
  ), [modelLoras]);
  const filteredLoraPairs = useMemo(() => {
    const query = loraSearchQuery.trim().toLowerCase();
    return loraPairs.filter((pair) => {
      if ((pair.high && selectedLoraPathSet.has(pair.high.s3Path)) || (pair.low && selectedLoraPathSet.has(pair.low.s3Path))) {
        return false;
      }
      if (!query) return true;
      const searchText = [
        pair.baseName,
        pair.high ? getLoraSearchText(pair.high) : '',
        pair.low ? getLoraSearchText(pair.low) : '',
      ].join(' ').toLowerCase();
      return searchText.includes(query);
    });
  }, [loraPairs, loraSearchQuery, selectedLoraPathSet]);

  const loadSequence = useCallback(async (sequenceId: string, preferredSegmentId?: string | null) => {
    const data = await fetchJson<{ success: true; sequence: VideoSequence }>(`/api/video-sequences/${sequenceId}`);
    setActiveSequence(data.sequence);
    setSequenceTitle(data.sequence.title);
    setSequenceDescription(data.sequence.description ?? '');
    setSequenceWidth(String(data.sequence.width || 1280));
    setSequenceHeight(String(data.sequence.height || 720));
    const nextSelected = preferredSegmentId && data.sequence.segments.some((segment) => segment.id === preferredSegmentId)
      ? preferredSegmentId
      : data.sequence.segments[0]?.id ?? null;
    setSelectedSegmentId(nextSelected);
    setSequences((current) => current.map((sequence) => (
      sequence.id === data.sequence.id
        ? {
            ...sequence,
            title: data.sequence.title,
            description: data.sequence.description,
            aspectRatio: data.sequence.aspectRatio,
            width: data.sequence.width,
            height: data.sequence.height,
            segmentCount: data.sequence.segments.length,
          }
        : sequence
    )));
  }, []);

  const loadWorkspaceData = useCallback(async (nextWorkspaceId: string, preferredSequenceId?: string | null) => {
    const [sequenceData, templateData] = await Promise.all([
      fetchJson<{ success: true; sequences: VideoSequence[] }>(`/api/video-sequences?workspaceId=${encodeURIComponent(nextWorkspaceId)}`),
      fetchJson<{ success: true; templates: VideoSegmentTemplate[] }>(`/api/video-segment-templates?workspaceId=${encodeURIComponent(nextWorkspaceId)}`),
    ]);
    setSequences(sequenceData.sequences);
    setTemplates(templateData.templates);
    const nextSequenceId = preferredSequenceId ?? sequenceData.sequences[0]?.id ?? null;
    if (nextSequenceId) {
      await loadSequence(nextSequenceId);
    } else {
      setActiveSequence(null);
      setSelectedSegmentId(null);
      setSequenceTitle('');
      setSequenceDescription('');
      setSequenceWidth('1280');
      setSequenceHeight('720');
    }
  }, [loadSequence]);

  useEffect(() => {
    let cancelled = false;

    async function resolveWorkspace() {
      setLoading(true);
      try {
        const storedWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkspaceId') : null;
        const workspaceData = await fetchJson<{ workspaces: Array<{ id: string; isDefault: boolean }> }>(`/api/workspaces?userId=${userId}`);
        let workspace = workspaceData.workspaces.find((item) => item.id === storedWorkspaceId)
          ?? workspaceData.workspaces.find((item) => item.isDefault)
          ?? workspaceData.workspaces[0];

        if (!workspace) {
          const created = await fetchJson<{ workspace: { id: string; isDefault: boolean } }>('/api/workspaces', {
            method: 'POST',
            body: JSON.stringify({ userId, name: 'Default workspace' }),
          });
          workspace = created.workspace;
        }

        if (cancelled) return;
        setWorkspaceId(workspace.id);
        if (typeof window !== 'undefined') localStorage.setItem('activeWorkspaceId', workspace.id);
        await loadWorkspaceData(workspace.id);
      } catch (nextError) {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Failed to load Video Sequences');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolveWorkspace();
    return () => {
      cancelled = true;
    };
  }, [loadWorkspaceData]);

  const fetchAvailableLoras = useCallback(async () => {
    if (!workspaceId) {
      setAvailableLoras([]);
      return;
    }

    setLoraLoading(true);
    try {
      const data = await fetchJson<{ success: boolean; loras?: LoRAFile[] }>(`/api/lora?workspaceId=${encodeURIComponent(workspaceId)}`);
      setAvailableLoras(Array.isArray(data.loras) ? data.loras : []);
    } catch (nextError) {
      setAvailableLoras([]);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load LoRAs');
    } finally {
      setLoraLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchAvailableLoras();
  }, [fetchAvailableLoras]);

  useEffect(() => {
    if (!loraPickerOpen) return;
    const timeout = window.setTimeout(() => loraSearchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, [loraPickerOpen]);

  useEffect(() => {
    if (selectedSegment) {
      setSegmentDraft(makeSegmentDraft(selectedSegment));
    } else {
      setSegmentDraft(emptySegmentDraft());
    }
    setFramePickerOpen(false);
    setFramePickerTime(0);
    setFramePickerDuration(0);
    setLoraPickerOpen(false);
    setLoraSearchQuery('');
  }, [selectedSegment]);

  useEffect(() => {
    setPreviewPlaying(false);
    setPreviewTime(0);
  }, [activeSequence?.id]);

  useEffect(() => {
    if (previewTotalDuration <= 0) {
      setPreviewPlaying(false);
      setPreviewTime(0);
      return;
    }
    if (previewTime > previewTotalDuration) {
      setPreviewTime(previewTotalDuration);
    }
  }, [previewTime, previewTotalDuration]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || !activePreviewSegment) return;
    const localTime = activePreviewLocalTime;

    const applyLocalTime = () => {
      if (Number.isFinite(video.duration)) {
        video.currentTime = Math.min(Math.max(0, localTime), Math.max(0, video.duration - 0.05));
      } else {
        video.currentTime = Math.max(0, localTime);
      }
    };

    if (video.readyState >= 1) applyLocalTime();
    else video.addEventListener('loadedmetadata', applyLocalTime, { once: true });

    if (previewPlaying) {
      void video.play().catch(() => setPreviewPlaying(false));
    } else {
      video.pause();
    }

    return () => video.removeEventListener('loadedmetadata', applyLocalTime);
  }, [activePreviewSegment?.id, previewPlaying]);

  useEffect(() => {
    if (!activeSequence) return;
    const syncableSegments = activeSequence.segments.filter(shouldAutoSyncVideoSequenceSegment);
    if (syncableSegments.length === 0) return;

    let cancelled = false;

    async function syncActiveSegmentJobs() {
      if (!activeSequence || autoStatusSyncInFlightRef.current) return;
      autoStatusSyncInFlightRef.current = true;

      try {
        for (const segment of syncableSegments) {
          if (cancelled) return;
          try {
            const data = await fetchJson<{ success: true; segment: VideoSequenceSegment }>(
              `/api/video-sequences/${activeSequence.id}/segments/${segment.id}/sync-status`,
              { method: 'POST' },
            );
            if (cancelled) return;
            setActiveSequence((current) => {
              if (!current || current.id !== activeSequence.id) return current;
              const currentSegment = current.segments.find((item) => item.id === data.segment.id);
              if (currentSegment && !hasSyncedVideoSequenceSegmentChange(currentSegment, data.segment)) return current;
              return {
                ...current,
                segments: current.segments.map((item) => (
                  item.id === data.segment.id ? data.segment : item
                )),
              };
            });
          } catch {
            // Background sync is best-effort; the manual Refresh action still surfaces errors.
          }
        }
      } finally {
        autoStatusSyncInFlightRef.current = false;
      }
    }

    void syncActiveSegmentJobs();
    const intervalId = window.setInterval(() => {
      void syncActiveSegmentJobs();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeSequence]);

  function seekPreview(timeSeconds: number) {
    const nextTime = Math.max(0, Math.min(timeSeconds, previewTotalDuration));
    const nextItem = findSequencePreviewTimelineItem(previewTimeline, nextTime);
    setPreviewTime(nextTime);
    if (nextItem?.segment.id === activePreviewSegment?.id && previewVideoRef.current) {
      previewVideoRef.current.currentTime = Math.max(0, nextTime - nextItem.start);
    }
  }

  function selectSegment(segmentId: string) {
    setSelectedSegmentId(segmentId);
    const previewItem = previewTimeline.find((item) => item.segment.id === segmentId);
    if (previewItem) seekPreview(previewItem.start);
  }

  function togglePreviewPlayback() {
    if (!activePreviewSegment) return;
    setPreviewPlaying((value) => !value);
  }

  function handlePreviewTimeUpdate() {
    const video = previewVideoRef.current;
    if (!video || !activePreviewTimelineItem) return;
    setPreviewTime(Math.min(previewTotalDuration, activePreviewTimelineItem.start + video.currentTime));
  }

  function handlePreviewEnded() {
    if (!activePreviewTimelineItem) return;
    const currentIndex = previewTimeline.findIndex((item) => item.segment.id === activePreviewTimelineItem.segment.id);
    const nextItem = previewTimeline[currentIndex + 1];
    if (nextItem) {
      setPreviewTime(nextItem.start);
      return;
    }
    setPreviewPlaying(false);
    setPreviewTime(previewTotalDuration);
  }

  async function runAction(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  async function openGalleryPicker(type: 'image' | 'video') {
    if (!workspaceId || !selectedSegment) return;
    setGalleryPickerType(type);
    setGalleryQuery('');
    setGalleryLoading(true);
    setError(null);
    try {
      const search = new URLSearchParams({
        workspaceId,
        type,
        bucket: 'all',
        limit: '48',
      });
      const data = await fetchJson<{ success: true; assets: GalleryAsset[] }>(`/api/gallery/assets?${search.toString()}`);
      setGalleryAssets(data.assets);
    } catch (nextError) {
      setGalleryPickerType(null);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load gallery assets');
    } finally {
      setGalleryLoading(false);
    }
  }

  async function applyGalleryAsset(asset: GalleryAsset) {
    if (!activeSequence || !selectedSegment || !galleryPickerType) return;
    const mode = galleryPickerType === 'video' ? 'completed_video' : 'initial_image';
    await runAction('gallery', async () => {
      await fetchJson<{ success: true; segment: VideoSequenceSegment }>(
        `/api/video-sequences/${activeSequence.id}/segments/${selectedSegment.id}/gallery-asset`,
        {
          method: 'POST',
          body: JSON.stringify({ assetId: asset.id, mode }),
        },
      );
      setGalleryPickerType(null);
      setGalleryAssets([]);
      await loadSequence(activeSequence.id, selectedSegment.id);
      setNotice(galleryPickerType === 'video' ? 'Gallery video applied as first segment' : 'Gallery image applied as source');
    });
  }

  function openManualFramePicker() {
    if (!selectedSegment || !previousSegmentOutputVideoUrl) return;
    setSegmentDraft((draft) => ({ ...draft, sourceMode: 'manual_frame' }));
    setFramePickerTime(0);
    setFramePickerDuration(0);
    setFramePickerOpen(true);
  }

  function seekFramePickerVideo(nextTime: number) {
    setFramePickerTime(nextTime);
    if (framePickerVideoRef.current) {
      framePickerVideoRef.current.currentTime = nextTime;
    }
  }

  async function pickManualFrame() {
    if (!activeSequence || !selectedSegment) return;
    await runAction('pick-frame', async () => {
      await fetchJson<{ success: true; segment: VideoSequenceSegment }>(
        `/api/video-sequences/${activeSequence.id}/segments/${selectedSegment.id}/pick-frame`,
        {
          method: 'POST',
          body: JSON.stringify({ timeSeconds: framePickerTime }),
        },
      );
      setFramePickerOpen(false);
      await loadSequence(activeSequence.id, selectedSegment.id);
      setNotice(`Manual frame picked at ${formatSeconds(framePickerTime)}`);
    });
  }

  function addLoraPair(pair: { high?: LoRAFile; low?: LoRAFile }) {
    if (!nextLoraSlotIndex || !pair.high || !pair.low) return;
    setSegmentDraft((draft) => ({
      ...draft,
      loraConfigJson: setWanLoraPairInConfig(draft.loraConfigJson, nextLoraSlotIndex, {
        highPath: pair.high!.s3Path,
        lowPath: pair.low!.s3Path,
      }),
    }));
    setLoraPickerOpen(false);
    setLoraSearchQuery('');
  }

  function clearLoraSlot(index: number) {
    setSegmentDraft((draft) => ({
      ...draft,
      loraConfigJson: setWanLoraPairInConfig(draft.loraConfigJson, index, null),
    }));
  }

  function updateLoraSlotWeight(index: number, component: 'high' | 'low', value: string) {
    const nextWeight = Number(value);
    if (!Number.isFinite(nextWeight)) return;
    setSegmentDraft((draft) => ({
      ...draft,
      loraConfigJson: setWanLoraWeightInConfig(draft.loraConfigJson, index, component, nextWeight),
    }));
  }

  function buildSegmentDraftPayload() {
    return {
      title: segmentDraft.title,
      sourceMode: segmentDraft.sourceMode,
      sourceImageUrl: segmentDraft.sourceImageUrl || null,
      sourceFrozen: segmentDraft.sourceFrozen,
      prompt: segmentDraft.prompt,
      negativePrompt: segmentDraft.negativePrompt,
      motionPrompt: segmentDraft.motionPrompt,
      continuityPrompt: segmentDraft.continuityPrompt,
      modelId: segmentDraft.modelId || 'wan22',
      endpointId: segmentDraft.endpointId || null,
      durationSeconds: Number(segmentDraft.durationSeconds || 6),
      seed: segmentDraft.seed ? Number(segmentDraft.seed) : null,
      randomizeSeed: segmentDraft.randomizeSeed,
      loraConfigJson: segmentDraft.loraConfigJson,
      generationOptionsJson: buildSegmentGenerationOptionsJson(segmentDraft.generationOptionsJson, segmentDraft.generationSteps),
    };
  }

  async function persistSelectedSegmentDraft() {
    if (!activeSequence || !selectedSegment) return null;
    const data = await fetchJson<{ success: true; segment: VideoSequenceSegment }>(
      `/api/video-sequences/${activeSequence.id}/segments/${selectedSegment.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(buildSegmentDraftPayload()),
      },
    );
    return data.segment;
  }

  async function createSequence() {
    if (!workspaceId) return;
    await runAction('sequence', async () => {
      const data = await fetchJson<{ success: true; sequence: VideoSequence }>('/api/video-sequences', {
        method: 'POST',
        body: JSON.stringify({ workspaceId, title: 'Untitled sequence' }),
      });
      await loadWorkspaceData(workspaceId, data.sequence.id);
    });
  }

  async function saveSequence() {
    if (!activeSequence) return;
    await runAction('sequence', async () => {
      const width = parseSequenceDimension(sequenceWidth, activeSequence.width || 1280);
      const height = parseSequenceDimension(sequenceHeight, activeSequence.height || 720);
      const data = await fetchJson<{ success: true; sequence: VideoSequence }>(`/api/video-sequences/${activeSequence.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: sequenceTitle,
          description: sequenceDescription,
          width,
          height,
          aspectRatio: aspectRatioFromDimensions(width, height),
        }),
      });
      setActiveSequence(data.sequence);
      setSequenceWidth(String(data.sequence.width || width));
      setSequenceHeight(String(data.sequence.height || height));
      setSequences((current) => current.map((sequence) => (
        sequence.id === data.sequence.id
          ? {
              ...sequence,
              title: data.sequence.title,
              description: data.sequence.description,
              aspectRatio: data.sequence.aspectRatio,
              width: data.sequence.width,
              height: data.sequence.height,
            }
          : sequence
      )));
      setNotice('Sequence saved');
    });
  }

  async function addSegment() {
    if (!activeSequence) return;
    await runAction('segment', async () => {
      const orderIndex = activeSequence.segments.length;
      const data = await fetchJson<{ success: true; segment: VideoSequenceSegment }>(`/api/video-sequences/${activeSequence.id}/segments`, {
        method: 'POST',
        body: JSON.stringify({
          title: `Segment ${orderIndex + 1}`,
          sourceMode: orderIndex === 0 ? 'initial' : 'previous_last_frame',
        }),
      });
      setSelectedSegmentId(data.segment.id);
      await loadSequence(activeSequence.id, data.segment.id);
      setNotice(`Added ${data.segment.title}`);
    });
  }

  async function saveSegment() {
    if (!activeSequence || !selectedSegment) return;
    await runAction('segment', async () => {
      await persistSelectedSegmentDraft();
      await loadSequence(activeSequence.id, selectedSegment.id);
      setNotice('Segment saved');
    });
  }

  async function deleteSegment() {
    if (!activeSequence || !selectedSegment) return;
    await runAction('segment', async () => {
      await fetchJson<{ success: true; deleted: true }>(`/api/video-sequences/${activeSequence.id}/segments/${selectedSegment.id}`, {
        method: 'DELETE',
      });
      setSelectedSegmentId(null);
      await loadSequence(activeSequence.id);
      setNotice('Segment deleted');
    });
  }

  async function saveSelectedAsTemplate() {
    if (!activeSequence || !selectedSegment || !workspaceId) return;
    const name = window.prompt('Template name', selectedSegment.title);
    if (!name) return;
    await runAction('template', async () => {
      await fetchJson<{ success: true; template: VideoSegmentTemplate }>(
        `/api/video-sequences/${activeSequence.id}/segments/${selectedSegment.id}/save-template`,
        {
          method: 'POST',
          body: JSON.stringify({ name }),
        },
      );
      const data = await fetchJson<{ success: true; templates: VideoSegmentTemplate[] }>(`/api/video-segment-templates?workspaceId=${encodeURIComponent(workspaceId)}`);
      setTemplates(data.templates);
      setNotice('Template saved');
    });
  }

  async function insertTemplate(templateId: string) {
    if (!activeSequence) return;
    await runAction('template', async () => {
      const data = await fetchJson<{ success: true; segment: VideoSequenceSegment }>(`/api/video-sequences/${activeSequence.id}/segments/from-template`, {
        method: 'POST',
        body: JSON.stringify({ templateId }),
      });
      setSelectedSegmentId(data.segment.id);
      await loadSequence(activeSequence.id, data.segment.id);
      setNotice(`Inserted ${data.segment.title}`);
    });
  }

  async function generateSelectedSegment() {
    if (!activeSequence || !selectedSegment) return;
    await runAction('generate', async () => {
      await persistSelectedSegmentDraft();
      const data = await fetchJson<{ success: boolean; segment: VideoSequenceSegment; jobId?: string | null }>(
        `/api/video-sequences/${activeSequence.id}/segments/${selectedSegment.id}/generate`,
        {
          method: 'POST',
          body: JSON.stringify({ userId }),
        },
      );
      await loadSequence(activeSequence.id, selectedSegment.id);
      setNotice(data.jobId ? `Queued ${selectedSegment.title}` : `Updated ${selectedSegment.title}`);
    });
  }

  async function generateFromSelectedSegment() {
    if (!activeSequence || !selectedSegment) return;
    await runAction('generate-from', async () => {
      await persistSelectedSegmentDraft();
      const data = await fetchJson<{ success: boolean; action?: string; message?: string; segment?: VideoSequenceSegment | null }>(
        `/api/video-sequences/${activeSequence.id}/generate-from`,
        {
          method: 'POST',
          body: JSON.stringify({ segmentId: selectedSegment.id, userId }),
        },
      );
      await loadSequence(activeSequence.id, selectedSegment.id);
      setNotice(data.message ?? (data.action ? `Generate from here: ${data.action}` : 'Generate from here updated'));
    });
  }

  async function refreshSelectedStatus() {
    if (!activeSequence || !selectedSegment) return;
    await runAction('status', async () => {
      await fetchJson<{ success: true; segment: VideoSequenceSegment }>(
        `/api/video-sequences/${activeSequence.id}/segments/${selectedSegment.id}/sync-status`,
        { method: 'POST' },
      );
      await loadSequence(activeSequence.id, selectedSegment.id);
      setNotice(`Status refreshed for ${selectedSegment.title}`);
    });
  }

  async function renderFinalVideo() {
    if (!activeSequence || renderBlocker) return;
    await runAction('render', async () => {
      const data = await fetchJson<{ success: true; sequence: VideoSequence }>(
        `/api/video-sequences/${activeSequence.id}/render`,
        { method: 'POST' },
      );
      setActiveSequence(data.sequence);
      setSequences((current) => current.map((sequence) => (
        sequence.id === data.sequence.id
          ? { ...sequence, status: data.sequence.status, title: data.sequence.title, segmentCount: data.sequence.segments.length }
          : sequence
      )));
      setNotice('Final video rendered');
    });
  }

  return (
    <main className="flex h-screen w-full overflow-hidden bg-zinc-950 text-zinc-100">
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-white/10 bg-zinc-950">
        <div className="flex h-14 items-center gap-3 border-b border-white/10 px-4">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-zinc-300 hover:bg-white/10 hover:text-white">
            <Link href="/" aria-label="Back to workspace">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Video Sequences</div>
            <div className="truncate text-xs text-zinc-500">Desktop sequence builder</div>
          </div>
        </div>

        <div className="border-b border-white/10 p-4">
          <Button className="h-9 w-full justify-start gap-2" onClick={createSequence} disabled={!workspaceId || !!busy}>
            {busy === 'sequence' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New sequence
          </Button>
        </div>

        <section className="border-b border-white/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Sequences</h2>
            <Waypoints className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {sequences.map((sequence) => (
              <button
                key={sequence.id}
                type="button"
                onClick={() => loadSequence(sequence.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors',
                  activeSequence?.id === sequence.id
                    ? 'border-cyan-500/40 bg-cyan-500/10'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{sequence.title}</span>
                  <span className="block truncate text-xs text-zinc-500">
                    {sequence.segmentCount ?? sequence.segments?.length ?? 0} segments - {sequence.width}x{sequence.height}
                  </span>
                </span>
                <span className={cn('rounded border px-2 py-0.5 text-[10px]', statusStyles[sequence.status] ?? statusStyles.draft)}>
                  {sequence.status}
                </span>
              </button>
            ))}
            {!loading && sequences.length === 0 ? (
              <div className="rounded-md border border-dashed border-white/15 px-3 py-4 text-sm text-zinc-500">
                No sequences yet.
              </div>
            ) : null}
          </div>
        </section>

        <section className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Segment templates</h2>
            <Sparkles className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => insertTemplate(template.id)}
                disabled={!activeSequence || !!busy}
                className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{template.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{template.category} - {template.defaultDurationSeconds}s</span>
                </span>
                <CopyPlus className="h-4 w-4 shrink-0 text-zinc-500" />
              </button>
            ))}
            {!loading && templates.length === 0 ? (
              <div className="rounded-md border border-dashed border-white/15 px-3 py-4 text-sm text-zinc-500">
                Save a segment as a template to build this library.
              </div>
            ) : null}
          </div>
        </section>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-zinc-950 px-5 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              <Waypoints className="h-4 w-4" />
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-[minmax(160px,300px)_minmax(140px,1fr)_88px_88px] gap-2">
              <Input
                value={sequenceTitle}
                onChange={(event) => setSequenceTitle(event.target.value)}
                className="h-9 border-white/10 bg-zinc-900 text-sm"
                placeholder="Sequence title"
                disabled={!activeSequence}
              />
              <Input
                value={sequenceDescription}
                onChange={(event) => setSequenceDescription(event.target.value)}
                className="h-9 border-white/10 bg-zinc-900 text-sm"
                placeholder="Description"
                disabled={!activeSequence}
              />
              <Input
                type="number"
                min={1}
                value={sequenceWidth}
                onChange={(event) => setSequenceWidth(event.target.value)}
                className="h-9 border-white/10 bg-zinc-900 text-sm"
                placeholder="Width"
                disabled={!activeSequence}
                aria-label="Sequence width"
              />
              <Input
                type="number"
                min={1}
                value={sequenceHeight}
                onChange={(event) => setSequenceHeight(event.target.value)}
                className="h-9 border-white/10 bg-zinc-900 text-sm"
                placeholder="Height"
                disabled={!activeSequence}
                aria-label="Sequence height"
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ToolbarIconButton
              label="Save sequence"
              tooltip={getHeaderActionTooltip('save')}
              onClick={saveSequence}
              disabled={!activeSequence || !!busy}
            >
              <Save className="h-4 w-4" />
            </ToolbarIconButton>
            <ToolbarIconButton
              label="Generate selected segment"
              tooltip={getHeaderActionTooltip('generate')}
              onClick={generateSelectedSegment}
              disabled={!selectedSegment || !!busy}
            >
              {busy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            </ToolbarIconButton>
            <ToolbarIconButton
              label="Generate from selected segment"
              tooltip={getHeaderActionTooltip('generateFrom')}
              onClick={generateFromSelectedSegment}
              disabled={!selectedSegment || !!busy}
            >
              {busy === 'generate-from' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FastForward className="h-4 w-4" />}
            </ToolbarIconButton>
            <ToolbarIconButton
              label="Refresh selected segment status"
              tooltip={getHeaderActionTooltip('status')}
              onClick={refreshSelectedStatus}
              disabled={!selectedSegment?.generationJobId || !!busy}
            >
              {busy === 'status' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </ToolbarIconButton>
            <ToolbarIconButton
              label="Render final video"
              tooltip={getHeaderActionTooltip('render', renderBlocker)}
              onClick={renderFinalVideo}
              disabled={!!renderBlocker || !!busy}
            >
              {busy === 'render' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
            </ToolbarIconButton>
            {activeSequence?.finalVideoUrl ? (
              <ToolbarIconLink
                href={activeSequence.finalVideoUrl}
                label="Open final video"
                tooltip={getHeaderActionTooltip('final')}
                accent="emerald"
              >
                <Film className="h-4 w-4" />
              </ToolbarIconLink>
            ) : null}
          </div>
        </header>

        {error ? (
          <div className="border-b border-rose-500/30 bg-rose-500/10 px-5 py-2 text-sm text-rose-200">{error}</div>
        ) : null}
        {!error && notice ? (
          <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-2 text-sm text-emerald-200">{notice}</div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
            {loading ? (
              <div className="flex flex-1 items-center justify-center text-zinc-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading sequences
              </div>
            ) : activeSequence ? (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                <section className="flex min-h-0 flex-1 flex-col rounded-md border border-white/10 bg-black">
                  <button
                    type="button"
                    onClick={togglePreviewPlayback}
                    className="group relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black"
                    aria-label={previewPlaying ? 'Pause sequence preview' : 'Play sequence preview'}
                  >
                    {activePreviewSegment?.outputVideoUrl ? (
                      <video
                        ref={previewVideoRef}
                        key={activePreviewSegment.id}
                        src={activePreviewSegment.outputVideoUrl}
                        className="h-full w-full object-contain"
                        playsInline
                        onTimeUpdate={handlePreviewTimeUpdate}
                        onEnded={handlePreviewEnded}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-zinc-600">
                        <Film className="h-10 w-10" />
                        <div className="text-sm">Completed segment outputs will preview here.</div>
                      </div>
                    )}
                    {activePreviewSegment?.outputVideoUrl ? (
                      <div className="pointer-events-none absolute right-4 top-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg shadow-black/30 opacity-80 transition-opacity group-hover:opacity-100">
                          {previewPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                        </span>
                      </div>
                    ) : null}
                    {activePreviewSegment ? (
                      <div className="pointer-events-none absolute left-4 top-4 rounded border border-white/10 bg-black/60 px-3 py-1 text-xs text-zinc-200">
                        Segment {activePreviewSegment.orderIndex + 1} - {activePreviewSegment.title}
                      </div>
                    ) : null}
                  </button>
                  <div className="border-t border-white/10 bg-zinc-950 px-4 py-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                      <span>{formatPreviewTime(previewTime)}</span>
                      <span>{formatPreviewTime(previewTotalDuration)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(previewTotalDuration, 0)}
                      step={0.01}
                      value={Math.min(previewTime, previewTotalDuration)}
                      onChange={(event) => seekPreview(Number(event.target.value))}
                      disabled={previewTotalDuration <= 0}
                      className="h-2 w-full accent-cyan-400"
                      aria-label="Sequence preview scrubber"
                    />
                  </div>
                </section>

                <div className="h-[184px] shrink-0 overflow-x-auto overflow-y-hidden">
                  <div className="flex min-w-max items-center gap-3">
                    {activeSequence.segments.map((segment, segmentIndex) => (
                      <div key={segment.id} className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => selectSegment(segment.id)}
                          className={cn(
                            'w-[292px] overflow-hidden rounded-md border bg-zinc-900 text-left transition-colors',
                            selectedSegment?.id === segment.id ? 'border-cyan-500/50' : 'border-white/10 hover:border-white/20',
                          )}
                        >
                          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-white/10 bg-black/30 text-xs text-zinc-300">
                                {segment.orderIndex + 1}
                              </span>
                              <span className="truncate text-sm font-medium">{segment.title}</span>
                            </div>
                            <span className={cn('rounded border px-2 py-0.5 text-[10px]', statusStyles[segment.status] ?? statusStyles.draft)}>
                              {segment.status}
                            </span>
                          </div>
                          <div className="grid h-[88px] grid-cols-[72px_1fr_72px] gap-px bg-white/10">
                            <MediaCell type="image" url={getSegmentSourcePreviewUrl(segment, activeSequence.segments)} icon={<Images className="h-5 w-5" />} />
                            <MediaCell type="video" url={segment.outputVideoUrl} icon={<Film className="h-6 w-6" />} />
                            <MediaCell type="image" url={segment.lastFrameUrl} icon={<Images className="h-5 w-5" />} />
                          </div>
                          <div className="flex items-center justify-between px-3 py-2 text-xs text-zinc-500">
                            <span className="truncate">{sourceModeLabels[segment.sourceMode] ?? segment.sourceMode}</span>
                            <span className="shrink-0 font-mono text-[11px]">{formatSegmentOutputMetrics(segment)}</span>
                          </div>
                        </button>
                        {segmentIndex < activeSequence.segments.length - 1 ? (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-zinc-500">
                            <Waypoints className="h-4 w-4" />
                          </div>
                        ) : null}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addSegment}
                      disabled={!!busy}
                      className="flex h-[168px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-white/15 bg-white/[0.02] text-zinc-500 transition-colors hover:border-white/25 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy === 'segment' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                      <span className="text-sm">Add segment</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-500">
                <Waypoints className="h-8 w-8" />
                <Button onClick={createSequence} disabled={!workspaceId || !!busy}>
                  <Plus className="mr-2 h-4 w-4" />
                  New sequence
                </Button>
              </div>
            )}
          </div>

          <div className="h-28 shrink-0 border-t border-white/10 bg-zinc-950 px-5 py-3">
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
              <span>Sequence timeline</span>
              <span className={cn(renderBlocker && !activeSequence?.finalVideoUrl ? 'text-amber-300' : '')}>{timelineStatus}</span>
            </div>
            <div className="flex h-12 overflow-hidden rounded-md border border-white/10 bg-zinc-900">
              {activeSequence?.segments.length ? activeSequence.segments.map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => selectSegment(segment.id)}
                  className={cn(
                    'flex min-w-24 flex-1 items-center border-r border-white/10 px-3 last:border-r-0',
                    selectedSegment?.id === segment.id ? 'bg-cyan-500/10' : '',
                  )}
                >
                  <div className="h-2 w-full rounded-full bg-zinc-700">
                    <div className="h-2 rounded-full bg-cyan-400/70" style={{ width: segment.status === 'completed' ? '100%' : '38%' }} />
                  </div>
                </button>
              )) : (
                <div className="flex flex-1 items-center justify-center text-xs text-zinc-600">No segments</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <aside className="flex w-[400px] shrink-0 flex-col border-l border-white/10 bg-zinc-950">
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Segment inspector</h2>
            <div className="truncate text-xs text-zinc-500">{selectedSegment?.title ?? 'No segment selected'}</div>
          </div>
          <div className="flex items-center gap-2">
            <ActionTooltip tooltip={getSegmentInspectorActionTooltip('saveTemplate')}>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-white/10 bg-transparent text-zinc-300 hover:bg-white/10"
                onClick={saveSelectedAsTemplate}
                disabled={!selectedSegment || !!busy}
                aria-label="Save selected segment as template"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </ActionTooltip>
            <ActionTooltip tooltip={getSegmentInspectorActionTooltip('saveSegment')}>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-white/10 bg-transparent text-zinc-300 hover:bg-white/10"
                onClick={saveSegment}
                disabled={!selectedSegment || !!busy}
                aria-label="Save selected segment"
              >
                {busy === 'segment' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </ActionTooltip>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {selectedSegment ? (
            <div className="space-y-4">
              <InspectorSection icon={<Images className="h-4 w-4" />} title="Source">
                <div className="grid grid-cols-[96px_1fr] gap-3">
                  <div className="aspect-[3/4] overflow-hidden rounded border border-white/10 bg-zinc-900">
                    {selectedSourcePreviewUrl ? <img src={selectedSourcePreviewUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="space-y-2">
                    <select
                      value={segmentDraft.sourceMode}
                      onChange={(event) => setSegmentDraft((draft) => ({ ...draft, sourceMode: event.target.value }))}
                      className="h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-100"
                    >
                      {Object.entries(sourceModeLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <Input
                      value={segmentDraft.sourceImageUrl}
                      onChange={(event) => setSegmentDraft((draft) => ({ ...draft, sourceImageUrl: event.target.value }))}
                      className="h-9 border-white/10 bg-zinc-900 text-sm"
                      placeholder="Source image URL"
                    />
                    <ActionTooltip tooltip={getSegmentInspectorActionTooltip('manualFramePicker', { hasPreviousOutput: !!previousSegmentOutputVideoUrl })}>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-full gap-2 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
                        onClick={openManualFramePicker}
                        disabled={!previousSegmentOutputVideoUrl || !!busy}
                        aria-label="Pick manual frame from previous segment video"
                      >
                        <ImagePlus className="h-4 w-4" />
                        Pick frame from previous video
                      </Button>
                    </ActionTooltip>
                    <div className="grid grid-cols-2 gap-2">
                      <ActionTooltip tooltip={getSegmentInspectorActionTooltip('galleryImage')} className="min-w-0">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 w-full gap-2 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
                          onClick={() => openGalleryPicker('image')}
                          disabled={!workspaceId || !!busy}
                          aria-label="Choose Gallery image as segment source"
                        >
                          <ImageIcon className="h-4 w-4" />
                          Image
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip tooltip={getSegmentInspectorActionTooltip('galleryVideo', { isFirstSegment: selectedSegment.orderIndex === 0 })} className="min-w-0">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 w-full gap-2 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
                          onClick={() => openGalleryPicker('video')}
                          disabled={!workspaceId || selectedSegment.orderIndex !== 0 || !!busy}
                          aria-label="Choose Gallery video as first completed segment"
                        >
                          <Film className="h-4 w-4" />
                          Video
                        </Button>
                      </ActionTooltip>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-zinc-400">
                      <input
                        type="checkbox"
                        checked={segmentDraft.sourceFrozen}
                        onChange={(event) => setSegmentDraft((draft) => ({ ...draft, sourceFrozen: event.target.checked }))}
                      />
                      Frozen source
                    </label>
                  </div>
                </div>
              </InspectorSection>

              <InspectorSection icon={<Clapperboard className="h-4 w-4" />} title="Prompt">
                <Field label="Title">
                  <Input value={segmentDraft.title} onChange={(event) => setSegmentDraft((draft) => ({ ...draft, title: event.target.value }))} className="h-9 border-white/10 bg-zinc-900 text-sm" />
                </Field>
                <TextArea label="Positive" value={segmentDraft.prompt} onChange={(value) => setSegmentDraft((draft) => ({ ...draft, prompt: value }))} rows={5} />
                <TextArea label="Negative" value={segmentDraft.negativePrompt} onChange={(value) => setSegmentDraft((draft) => ({ ...draft, negativePrompt: value }))} rows={3} />
                <TextArea label="Motion" value={segmentDraft.motionPrompt} onChange={(value) => setSegmentDraft((draft) => ({ ...draft, motionPrompt: value }))} rows={3} />
                <TextArea label="Continuity" value={segmentDraft.continuityPrompt} onChange={(value) => setSegmentDraft((draft) => ({ ...draft, continuityPrompt: value }))} rows={3} />
              </InspectorSection>

              <InspectorSection icon={<Layers3 className="h-4 w-4" />} title="Generation">
                <div className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                  <div className="flex items-center justify-between gap-2">
                    <span>Status</span>
                    <span className={cn('rounded border px-2 py-0.5 text-[10px]', statusStyles[selectedSegment.status] ?? statusStyles.draft)}>
                      {selectedSegment.status}
                    </span>
                  </div>
                  {selectedSegment.generationJobId ? (
                    <div className="mt-2 truncate font-mono text-[11px] text-zinc-500">Job {selectedSegment.generationJobId}</div>
                  ) : null}
                  {selectedSegment.firstFrameUrl || selectedSegment.lastFrameUrl ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <MiniFrame label="First" url={selectedSegment.firstFrameUrl} />
                      <MiniFrame label="Last" url={selectedSegment.lastFrameUrl} />
                    </div>
                  ) : null}
                  {selectedSegment.error ? (
                    <div className="mt-2 text-rose-300">{selectedSegment.error}</div>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Model">
                    <Input value={segmentDraft.modelId} onChange={(event) => setSegmentDraft((draft) => ({ ...draft, modelId: event.target.value }))} className="h-9 border-white/10 bg-zinc-900 text-sm" />
                  </Field>
                  <Field label="Endpoint">
                    <Input value={segmentDraft.endpointId} onChange={(event) => setSegmentDraft((draft) => ({ ...draft, endpointId: event.target.value }))} className="h-9 border-white/10 bg-zinc-900 text-sm" placeholder="wan22" />
                  </Field>
                  <Field label="Duration">
                    <Input type="number" min={1} value={segmentDraft.durationSeconds} onChange={(event) => setSegmentDraft((draft) => ({ ...draft, durationSeconds: event.target.value }))} className="h-9 border-white/10 bg-zinc-900 text-sm" />
                  </Field>
                  <Field label="Steps">
                    <Input type="number" min={1} value={segmentDraft.generationSteps} onChange={(event) => setSegmentDraft((draft) => ({ ...draft, generationSteps: event.target.value }))} className="h-9 border-white/10 bg-zinc-900 text-sm" />
                  </Field>
                  <Field label="Seed">
                    <Input type="number" min={0} value={segmentDraft.seed} onChange={(event) => setSegmentDraft((draft) => ({ ...draft, seed: event.target.value }))} className="h-9 border-white/10 bg-zinc-900 text-sm" placeholder="random" />
                  </Field>
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={segmentDraft.randomizeSeed}
                    onChange={(event) => setSegmentDraft((draft) => ({ ...draft, randomizeSeed: event.target.checked }))}
                  />
                  Randomize seed
                </label>
                <div className="space-y-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-zinc-100">LoRAs</div>
                      <div className="text-xs text-zinc-500">Only selected LoRAs are shown here.</div>
                    </div>
                    <div className="text-xs text-zinc-400">
                      {selectedLoraSlots.length * 2}/{maxWanLoraFiles}
                    </div>
                  </div>

                  {selectedLoraSlots.length > 0 ? (
                    <div className="space-y-3">
                      {selectedLoraSlots.map((slot) => (
                        <div key={slot.index} className="rounded-md border border-white/10 bg-zinc-950/70 p-3">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-zinc-100">
                                {slot.label}
                              </div>
                              <div className="mt-1 text-xs text-zinc-500">
                                Slot {slot.index} - High {slot.highWeight.toFixed(2)} / Low {slot.lowWeight.toFixed(2)}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-zinc-400 hover:bg-white/10 hover:text-white"
                              onClick={() => clearLoraSlot(slot.index)}
                              aria-label={`Clear LoRA slot ${slot.index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="min-w-0 space-y-2">
                              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">High</div>
                              <div className="truncate text-xs text-zinc-300" title={slot.highLoRA?.fileName ?? slot.highPath}>
                                {slot.highLoRA?.fileName ?? slot.highPath}
                              </div>
                              <Input
                                type="number"
                                min="-5"
                                max="5"
                                step="0.05"
                                value={slot.highWeight}
                                onChange={(event) => updateLoraSlotWeight(slot.index, 'high', event.target.value)}
                                className="h-8 border-white/10 bg-zinc-900 text-xs"
                                aria-label={`High LoRA ${slot.index} weight`}
                              />
                            </div>
                            <div className="min-w-0 space-y-2">
                              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Low</div>
                              <div className="truncate text-xs text-zinc-300" title={slot.lowLoRA?.fileName ?? slot.lowPath}>
                                {slot.lowLoRA?.fileName ?? slot.lowPath}
                              </div>
                              <Input
                                type="number"
                                min="-5"
                                max="5"
                                step="0.05"
                                value={slot.lowWeight}
                                onChange={(event) => updateLoraSlotWeight(slot.index, 'low', event.target.value)}
                                className="h-8 border-white/10 bg-zinc-900 text-xs"
                                aria-label={`Low LoRA ${slot.index} weight`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-500">
                      No LoRAs selected yet.
                    </div>
                  )}

                  {nextLoraSlotIndex ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 w-full gap-2 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
                      onClick={() => {
                        setLoraSearchQuery('');
                        setLoraPickerOpen(true);
                      }}
                      disabled={loraLoading || !!busy}
                    >
                      <Plus className="h-4 w-4" />
                      Add LoRA
                    </Button>
                  ) : null}
                </div>
              </InspectorSection>

              <div className="flex items-center justify-between gap-2">
                <ActionTooltip tooltip={getSegmentInspectorActionTooltip('generate')} className="min-w-0 flex-1">
                  <Button variant="outline" className="h-9 w-full border-white/10 bg-transparent text-zinc-200 hover:bg-white/10" onClick={generateSelectedSegment} disabled={!!busy} aria-label="Generate selected segment">
                    {busy === 'generate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Generate
                  </Button>
                </ActionTooltip>
                <ActionTooltip tooltip={getSegmentInspectorActionTooltip('generateFrom')}>
                  <Button variant="outline" size="icon" className="h-9 w-9 border-white/10 bg-transparent text-zinc-300 hover:bg-white/10" onClick={generateFromSelectedSegment} disabled={!!busy} aria-label="Generate from selected segment">
                    {busy === 'generate-from' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FastForward className="h-4 w-4" />}
                  </Button>
                </ActionTooltip>
                <ActionTooltip tooltip={getSegmentInspectorActionTooltip('status', { hasJob: !!selectedSegment.generationJobId })}>
                  <Button variant="outline" size="icon" className="h-9 w-9 border-white/10 bg-transparent text-zinc-300 hover:bg-white/10" onClick={refreshSelectedStatus} disabled={!selectedSegment.generationJobId || !!busy} aria-label="Refresh segment status">
                    {busy === 'status' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </ActionTooltip>
              </div>

              <div className="flex items-center justify-between gap-2">
                <ActionTooltip tooltip={getSegmentInspectorActionTooltip('saveTemplate')} className="min-w-0 flex-1">
                  <Button variant="outline" className="h-9 w-full border-white/10 bg-transparent text-zinc-200 hover:bg-white/10" onClick={saveSelectedAsTemplate} disabled={!!busy} aria-label="Save selected segment as template">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Save template
                  </Button>
                </ActionTooltip>
                <ActionTooltip tooltip={getSegmentInspectorActionTooltip('delete')}>
                  <Button variant="outline" className="h-9 border-rose-500/30 bg-transparent text-rose-200 hover:bg-rose-500/10" onClick={deleteSegment} disabled={!!busy} aria-label="Delete selected segment">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </ActionTooltip>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
              <Clapperboard className="h-8 w-8" />
              <Button onClick={addSegment} disabled={!activeSequence || !!busy}>
                <Plus className="mr-2 h-4 w-4" />
                Add segment
              </Button>
            </div>
          )}
        </div>
      </aside>
      {framePickerOpen && previousSegmentOutputVideoUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
              <div>
                <div className="text-sm font-semibold">Pick manual source frame</div>
                <div className="text-xs text-zinc-500">
                  Previous segment video to custom frame for {selectedSegment?.title ?? 'selected segment'}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-9 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
                onClick={() => setFramePickerOpen(false)}
                disabled={busy === 'pick-frame'}
              >
                Close
              </Button>
            </div>
            <div className="space-y-4 p-4">
              <div className="overflow-hidden rounded-md border border-white/10 bg-black">
                <video
                  ref={framePickerVideoRef}
                  src={previousSegmentOutputVideoUrl}
                  controls
                  playsInline
                  className="max-h-[52vh] w-full bg-black"
                  onLoadedMetadata={(event) => {
                    const duration = event.currentTarget.duration;
                    setFramePickerDuration(Number.isFinite(duration) && duration > 0 ? duration : 0);
                  }}
                  onTimeUpdate={(event) => {
                    if (busy !== 'pick-frame') setFramePickerTime(event.currentTarget.currentTime);
                  }}
                />
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                  <span>Frame time</span>
                  <span className="font-mono text-zinc-300">{formatSeconds(framePickerTime)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(framePickerDuration || previousSegment?.durationSeconds || 6, 0.1)}
                  step={0.05}
                  value={Math.min(framePickerTime, Math.max(framePickerDuration || previousSegment?.durationSeconds || 6, 0.1))}
                  onChange={(event) => seekFramePickerVideo(Number(event.target.value))}
                  disabled={busy === 'pick-frame'}
                  className="w-full accent-cyan-400"
                  aria-label="Manual frame time"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-zinc-500">
                  `Pick frame` extracts the current timestamp and sets this segment to Manual frame.
                </div>
                <Button
                  type="button"
                  className="h-9 min-w-32 gap-2"
                  onClick={pickManualFrame}
                  disabled={busy === 'pick-frame'}
                >
                  {busy === 'pick-frame' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  Pick frame
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {loraPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="flex max-h-[82vh] w-full max-w-xl flex-col overflow-hidden rounded-md border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
              <div>
                <div className="text-sm font-semibold">Select LoRA</div>
                <div className="text-xs text-zinc-500">
                  Pick a complete High/Low pair for slot {nextLoraSlotIndex ?? '-'}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-9 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
                onClick={() => setLoraPickerOpen(false)}
              >
                Close
              </Button>
            </div>
            <div className="border-b border-white/10 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  ref={loraSearchInputRef}
                  value={loraSearchQuery}
                  onChange={(event) => setLoraSearchQuery(event.target.value)}
                  className="h-9 border-white/10 bg-zinc-900 pl-9 text-sm"
                  placeholder="Search LoRAs"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {loraLoading ? (
                <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading LoRAs
                </div>
              ) : loraPairs.length === 0 ? (
                <div className="rounded-md border border-dashed border-white/10 px-4 py-8 text-sm text-zinc-500">
                  No complete High/Low video LoRA pairs found.
                </div>
              ) : filteredLoraPairs.length === 0 ? (
                <div className="rounded-md border border-dashed border-white/10 px-4 py-8 text-sm text-zinc-500">
                  No LoRAs match your search.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLoraPairs.map((pair) => (
                    <button
                      key={pair.key}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10"
                      onClick={() => addLoraPair(pair)}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <Package className="h-4 w-4 shrink-0 text-cyan-300" />
                          <span className="truncate text-sm font-medium text-zinc-100">{pair.baseName}</span>
                        </span>
                        <span className="mt-2 grid grid-cols-2 gap-3 text-xs text-zinc-500">
                          <span className="min-w-0">
                            <span className="block font-medium text-zinc-400">High</span>
                            <span className="block truncate" title={pair.high?.fileName}>{pair.high?.fileName}</span>
                            <span>{pair.high ? formatLoraFileSize(pair.high.fileSize) : ''}</span>
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium text-zinc-400">Low</span>
                            <span className="block truncate" title={pair.low?.fileName}>{pair.low?.fileName}</span>
                            <span>{pair.low ? formatLoraFileSize(pair.low.fileSize) : ''}</span>
                          </span>
                        </span>
                      </span>
                      <Plus className="h-4 w-4 shrink-0 text-zinc-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {galleryPickerType ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="flex max-h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
              <div>
                <div className="text-sm font-semibold">
                  {galleryPickerType === 'video' ? 'Pick first segment video' : 'Pick initial image'}
                </div>
                <div className="text-xs text-zinc-500">
                  {galleryPickerType === 'video' ? 'Video becomes completed segment 1' : 'Image becomes the selected segment source'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={galleryQuery}
                  onChange={(event) => setGalleryQuery(event.target.value)}
                  className="h-9 w-64 border-white/10 bg-zinc-900 text-sm"
                  placeholder="Filter loaded assets"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
                  onClick={() => setGalleryPickerType(null)}
                  disabled={busy === 'gallery'}
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {galleryLoading ? (
                <div className="flex h-56 items-center justify-center text-zinc-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading Gallery
                </div>
              ) : filteredGalleryAssets.length ? (
                <div className="grid grid-cols-6 gap-3">
                  {filteredGalleryAssets.map((asset) => {
                    const previewUrl = asset.thumbnailUrl || asset.previewUrl || asset.originalUrl;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => applyGalleryAsset(asset)}
                        disabled={busy === 'gallery'}
                        className="group overflow-hidden rounded-md border border-white/10 bg-white/[0.03] text-left transition-colors hover:border-cyan-500/45 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="aspect-video bg-zinc-900">
                          {asset.type === 'video' ? (
                            <video src={asset.previewUrl || asset.originalUrl} poster={asset.thumbnailUrl || undefined} className="h-full w-full object-cover" muted playsInline />
                          ) : (
                            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="space-y-1 px-2 py-2">
                          <div className="truncate text-xs text-zinc-300">{asset.prompt || asset.originalUrl.split('/').pop() || asset.id}</div>
                          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
                            <span>{asset.type}</span>
                            <span>{asset.modelId || 'Gallery'}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-white/15 text-zinc-500">
                  {galleryPickerType === 'video' ? <Film className="h-7 w-7" /> : <ImageIcon className="h-7 w-7" />}
                  <div className="text-sm">No matching Gallery {galleryPickerType}s</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function MediaCell({ type, url, icon }: { type: 'image' | 'video'; url: string | null; icon: ReactNode }) {
  return (
    <div className="min-h-0 bg-zinc-950 p-1.5">
      <div className="flex h-full items-center justify-center overflow-hidden rounded border border-white/10 bg-zinc-900 text-zinc-500">
        {url ? (
          type === 'image'
            ? <img src={url} alt="" className="h-full w-full object-contain" />
            : <video src={url} className="h-full w-full object-contain" muted playsInline />
        ) : icon}
      </div>
    </div>
  );
}

function InspectorSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {icon}
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ActionTooltip({ tooltip, className, children }: { tooltip: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('group relative flex', className)} title={tooltip}>
      {children}
      <ToolbarTooltip>{tooltip}</ToolbarTooltip>
    </div>
  );
}

function ToolbarIconButton({
  label,
  tooltip,
  disabled,
  onClick,
  children,
}: {
  label: string;
  tooltip: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <ActionTooltip tooltip={tooltip}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10 disabled:opacity-40"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
      >
        {children}
      </Button>
    </ActionTooltip>
  );
}

function ToolbarIconLink({
  href,
  label,
  tooltip,
  accent,
  children,
}: {
  href: string;
  label: string;
  tooltip: string;
  accent?: 'emerald';
  children: ReactNode;
}) {
  return (
    <ActionTooltip tooltip={tooltip}>
      <Button
        asChild
        variant="outline"
        size="icon"
        className={cn(
          'h-9 w-9 shrink-0 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10',
          accent === 'emerald' ? 'border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10' : null,
        )}
      >
        <a href={href} target="_blank" rel="noreferrer" aria-label={label}>
          {children}
        </a>
      </Button>
    </ActionTooltip>
  );
}

function ToolbarTooltip({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-64 rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-xs leading-5 text-zinc-200 opacity-0 shadow-xl shadow-black/40 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function MiniFrame({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="overflow-hidden rounded border border-white/10 bg-black/20">
      <div className="aspect-video bg-zinc-950">
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  mono?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-zinc-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={cn(
          'w-full resize-y rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500/50',
          mono ? 'font-mono text-xs' : 'leading-6',
        )}
      />
    </label>
  );
}
