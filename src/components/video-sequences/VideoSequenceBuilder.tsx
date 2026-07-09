'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clapperboard,
  CopyPlus,
  Film,
  FastForward,
  ImagePlus,
  Images,
  Layers3,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Sparkles,
  Trash2,
  Waypoints,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type VideoSequenceSegment = {
  id: string;
  sequenceId: string;
  orderIndex: number;
  title: string;
  status: string;
  sourceMode: string;
  sourceImageUrl: string | null;
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
    loraConfigJson: '{}',
    generationOptionsJson: '{}',
  };
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSegment = useMemo(() => (
    activeSequence?.segments.find((segment) => segment.id === selectedSegmentId) ?? activeSequence?.segments[0] ?? null
  ), [activeSequence, selectedSegmentId]);

  const totalDuration = useMemo(() => (
    activeSequence?.segments.reduce((sum, segment) => sum + (segment.durationSeconds || 0), 0) ?? 0
  ), [activeSequence]);

  const loadSequence = useCallback(async (sequenceId: string, preferredSegmentId?: string | null) => {
    const data = await fetchJson<{ success: true; sequence: VideoSequence }>(`/api/video-sequences/${sequenceId}`);
    setActiveSequence(data.sequence);
    setSequenceTitle(data.sequence.title);
    setSequenceDescription(data.sequence.description ?? '');
    const nextSelected = preferredSegmentId && data.sequence.segments.some((segment) => segment.id === preferredSegmentId)
      ? preferredSegmentId
      : data.sequence.segments[0]?.id ?? null;
    setSelectedSegmentId(nextSelected);
    setSequences((current) => current.map((sequence) => (
      sequence.id === data.sequence.id
        ? { ...sequence, title: data.sequence.title, description: data.sequence.description, segmentCount: data.sequence.segments.length }
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

  useEffect(() => {
    if (selectedSegment) {
      setSegmentDraft(makeSegmentDraft(selectedSegment));
    } else {
      setSegmentDraft(emptySegmentDraft());
    }
  }, [selectedSegment]);

  async function runAction(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Action failed');
    } finally {
      setBusy(null);
    }
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
      const data = await fetchJson<{ success: true; sequence: VideoSequence }>(`/api/video-sequences/${activeSequence.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: sequenceTitle, description: sequenceDescription }),
      });
      setActiveSequence(data.sequence);
      setSequences((current) => current.map((sequence) => (
        sequence.id === data.sequence.id ? { ...sequence, title: data.sequence.title, description: data.sequence.description } : sequence
      )));
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
    });
  }

  async function saveSegment() {
    if (!activeSequence || !selectedSegment) return;
    await runAction('segment', async () => {
      await fetchJson<{ success: true; segment: VideoSequenceSegment }>(
        `/api/video-sequences/${activeSequence.id}/segments/${selectedSegment.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
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
            generationOptionsJson: segmentDraft.generationOptionsJson,
          }),
        },
      );
      await loadSequence(activeSequence.id, selectedSegment.id);
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
    });
  }

  async function generateSelectedSegment() {
    if (!activeSequence || !selectedSegment) return;
    await runAction('generate', async () => {
      await fetchJson<{ success: boolean; segment: VideoSequenceSegment }>(
        `/api/video-sequences/${activeSequence.id}/segments/${selectedSegment.id}/generate`,
        {
          method: 'POST',
          body: JSON.stringify({ userId }),
        },
      );
      await loadSequence(activeSequence.id, selectedSegment.id);
    });
  }

  async function generateFromSelectedSegment() {
    if (!activeSequence || !selectedSegment) return;
    await runAction('generate-from', async () => {
      await fetchJson<{ success: boolean; segment?: VideoSequenceSegment | null }>(
        `/api/video-sequences/${activeSequence.id}/generate-from`,
        {
          method: 'POST',
          body: JSON.stringify({ segmentId: selectedSegment.id, userId }),
        },
      );
      await loadSequence(activeSequence.id, selectedSegment.id);
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
    });
  }

  async function extractSelectedFrames() {
    if (!activeSequence || !selectedSegment) return;
    await runAction('frames', async () => {
      await fetchJson<{ success: true; segment: VideoSequenceSegment }>(
        `/api/video-sequences/${activeSequence.id}/segments/${selectedSegment.id}/extract-frames`,
        { method: 'POST' },
      );
      await loadSequence(activeSequence.id, selectedSegment.id);
    });
  }

  async function renderFinalVideo() {
    if (!activeSequence) return;
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
                  <span className="block truncate text-xs text-zinc-500">{sequence.segmentCount ?? sequence.segments?.length ?? 0} segments</span>
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
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-zinc-950 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              <Waypoints className="h-4 w-4" />
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(180px,320px)_minmax(160px,360px)] gap-2">
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
            </div>
            <Button variant="outline" size="sm" className="h-9 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10" onClick={saveSequence} disabled={!activeSequence || !!busy}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-9 gap-2 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
              onClick={generateSelectedSegment}
              disabled={!selectedSegment || !!busy}
            >
              {busy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Generate selected
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-2 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
              onClick={generateFromSelectedSegment}
              disabled={!selectedSegment || !!busy}
            >
              {busy === 'generate-from' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FastForward className="h-4 w-4" />}
              Generate from here
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-2 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
              onClick={refreshSelectedStatus}
              disabled={!selectedSegment?.generationJobId || !!busy}
            >
              {busy === 'status' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh status
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-2 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10"
              onClick={renderFinalVideo}
              disabled={!activeSequence?.segments.length || !!busy}
            >
              {busy === 'render' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
              Render final
            </Button>
            {activeSequence?.finalVideoUrl ? (
              <Button asChild variant="outline" className="h-9 gap-2 border-emerald-500/30 bg-transparent text-emerald-200 hover:bg-emerald-500/10">
                <a href={activeSequence.finalVideoUrl} target="_blank" rel="noreferrer">
                  <Film className="h-4 w-4" />
                  Final
                </a>
              </Button>
            ) : null}
          </div>
        </header>

        {error ? (
          <div className="border-b border-rose-500/30 bg-rose-500/10 px-5 py-2 text-sm text-rose-200">{error}</div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden p-5">
            {loading ? (
              <div className="flex flex-1 items-center justify-center text-zinc-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading sequences
              </div>
            ) : activeSequence ? (
              <div className="flex min-w-max items-center gap-3">
                {activeSequence.segments.map((segment, segmentIndex) => (
                  <div key={segment.id} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedSegmentId(segment.id)}
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
                      <div className="grid grid-cols-[72px_1fr_72px] gap-px bg-white/10">
                        <MediaCell type="image" url={segment.sourceImageUrl} icon={<Images className="h-5 w-5" />} />
                        <MediaCell type="video" url={segment.outputVideoUrl} icon={<Film className="h-6 w-6" />} />
                        <MediaCell type="image" url={segment.lastFrameUrl} icon={<Images className="h-5 w-5" />} />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 text-xs text-zinc-500">
                        <span className="truncate">{sourceModeLabels[segment.sourceMode] ?? segment.sourceMode}</span>
                        <span>{segment.durationSeconds}s</span>
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
                  className="flex h-[184px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-white/15 bg-white/[0.02] text-zinc-500 transition-colors hover:border-white/25 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === 'segment' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                  <span className="text-sm">Add segment</span>
                </button>
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
              <span>{activeSequence?.finalVideoUrl ? 'Final rendered' : `00:00 - 00:${String(totalDuration).padStart(2, '0')}`}</span>
            </div>
            <div className="flex h-12 overflow-hidden rounded-md border border-white/10 bg-zinc-900">
              {activeSequence?.segments.length ? activeSequence.segments.map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => setSelectedSegmentId(segment.id)}
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
            <Button variant="outline" size="icon" className="h-9 w-9 border-white/10 bg-transparent text-zinc-300 hover:bg-white/10" onClick={saveSelectedAsTemplate} disabled={!selectedSegment || !!busy}>
              <Sparkles className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 border-white/10 bg-transparent text-zinc-300 hover:bg-white/10" onClick={saveSegment} disabled={!selectedSegment || !!busy}>
              {busy === 'segment' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {selectedSegment ? (
            <div className="space-y-4">
              <InspectorSection icon={<Images className="h-4 w-4" />} title="Source">
                <div className="grid grid-cols-[96px_1fr] gap-3">
                  <div className="aspect-[3/4] overflow-hidden rounded border border-white/10 bg-zinc-900">
                    {segmentDraft.sourceImageUrl ? <img src={segmentDraft.sourceImageUrl} alt="" className="h-full w-full object-cover" /> : null}
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
                <TextArea label="LoRA JSON" value={segmentDraft.loraConfigJson} onChange={(value) => setSegmentDraft((draft) => ({ ...draft, loraConfigJson: value }))} rows={4} mono />
                <TextArea label="Options JSON" value={segmentDraft.generationOptionsJson} onChange={(value) => setSegmentDraft((draft) => ({ ...draft, generationOptionsJson: value }))} rows={4} mono />
              </InspectorSection>

              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" className="h-9 flex-1 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10" onClick={generateSelectedSegment} disabled={!!busy}>
                  {busy === 'generate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Generate
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9 border-white/10 bg-transparent text-zinc-300 hover:bg-white/10" onClick={generateFromSelectedSegment} disabled={!!busy} aria-label="Generate from selected segment">
                  {busy === 'generate-from' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FastForward className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9 border-white/10 bg-transparent text-zinc-300 hover:bg-white/10" onClick={refreshSelectedStatus} disabled={!selectedSegment.generationJobId || !!busy} aria-label="Refresh segment status">
                  {busy === 'status' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9 border-white/10 bg-transparent text-zinc-300 hover:bg-white/10" onClick={extractSelectedFrames} disabled={!selectedSegment.outputVideoUrl || !!busy} aria-label="Extract segment frames">
                  {busy === 'frames' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                </Button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" className="h-9 flex-1 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10" onClick={saveSelectedAsTemplate} disabled={!!busy}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Save template
                </Button>
                <Button variant="outline" className="h-9 border-rose-500/30 bg-transparent text-rose-200 hover:bg-rose-500/10" onClick={deleteSegment} disabled={!!busy}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
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
    </main>
  );
}

function MediaCell({ type, url, icon }: { type: 'image' | 'video'; url: string | null; icon: ReactNode }) {
  return (
    <div className={cn('bg-zinc-950 p-2', type === 'video' ? 'aspect-video' : 'aspect-[3/4]')}>
      <div className="flex h-full items-center justify-center overflow-hidden rounded border border-white/10 bg-zinc-900 text-zinc-500">
        {url ? (
          type === 'image'
            ? <img src={url} alt="" className="h-full w-full object-cover" />
            : <video src={url} className="h-full w-full object-cover" muted playsInline />
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
