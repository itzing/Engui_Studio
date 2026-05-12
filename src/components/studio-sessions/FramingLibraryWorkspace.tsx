'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, Crop, FlipHorizontal2, ImageIcon, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useStudio } from '@/lib/context/StudioContext';
import type { StudioFramingPresetSummary, StudioPoseSummary, StudioSessionPoseOrientation } from '@/lib/studio-sessions/types';

export type FramingLibraryRoute = { level: 'framingLibrary' };


type FramingPreviewResult = {
  mode: 'openpose_control' | 'text_only';
  previewUrl?: string;
  width: number;
  height: number;
  pointCount?: number;
  helperPrompt?: string;
  message?: string;
  pose?: { id: string; title: string; categoryId?: string | null };
};

type PreviewLaunchResult = {
  success: boolean;
  requiresConfirmation?: boolean;
  reason?: string;
  jobId?: string;
  runpodJobId?: string;
  error?: string;
};

type FramingDraft = {
  title: string;
  description: string;
  tags: string;
  orientation: StudioSessionPoseOrientation;
  aspectRatio: number;
  centerX: number;
  centerY: number;
  poseHeight: number;
  rotationDeg: number;
  flipX: boolean;
  helperPrompt: string;
};

const DEFAULT_DRAFT: FramingDraft = {
  title: '',
  description: '',
  tags: '',
  orientation: 'portrait',
  aspectRatio: 2 / 3,
  centerX: 0.5,
  centerY: 0.58,
  poseHeight: 0.78,
  rotationDeg: 0,
  flipX: false,
  helperPrompt: 'centered full-body composition',
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function aspectLabel(value: number) {
  if (Math.abs(value - 2 / 3) < 0.01) return '2:3';
  if (Math.abs(value - 3 / 2) < 0.01) return '3:2';
  if (Math.abs(value - 1) < 0.01) return '1:1';
  return value.toFixed(2);
}

function defaultAspectRatio(orientation: StudioSessionPoseOrientation) {
  return orientation === 'landscape' ? 3 / 2 : orientation === 'square' ? 1 : 2 / 3;
}

function draftFromPreset(preset: StudioFramingPresetSummary): FramingDraft {
  return {
    title: preset.title,
    description: preset.description,
    tags: preset.tags.join(', '),
    orientation: preset.orientation,
    aspectRatio: preset.aspectRatio,
    centerX: preset.centerX,
    centerY: preset.centerY,
    poseHeight: preset.poseHeight,
    rotationDeg: preset.rotationDeg,
    flipX: preset.flipX,
    helperPrompt: preset.helperPrompt,
  };
}

function payloadFromDraft(draft: FramingDraft) {
  return {
    ...draft,
    aspectRatio: round(clamp(draft.aspectRatio, 0.2, 4), 4),
    centerX: round(clamp(draft.centerX, 0, 1), 4),
    centerY: round(clamp(draft.centerY, 0, 1), 4),
    poseHeight: round(clamp(draft.poseHeight, 0.05, 1.5), 4),
    rotationDeg: round(clamp(draft.rotationDeg, -180, 180), 2),
    tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
  };
}

function TileGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">{children}</div>;
}

function AddTile({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.025] text-white/60 transition hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-white">
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><Plus className="h-8 w-8" /></div>
      <div className="text-sm font-medium">New framing preset</div>
    </button>
  );
}

function subjectRectStyle(transform: Pick<FramingDraft, 'aspectRatio' | 'centerX' | 'centerY' | 'poseHeight' | 'rotationDeg' | 'flipX'>) {
  const aspectRatio = clamp(transform.aspectRatio, 0.2, 4);
  const heightPct = clamp(transform.poseHeight, 0.05, 1.5) * 100;
  const widthPct = clamp((clamp(transform.poseHeight, 0.05, 1.5) * 0.38 / aspectRatio) * 100, 4, 96);
  return {
    left: `${clamp(transform.centerX, 0, 1) * 100}%`,
    top: `${clamp(transform.centerY, 0, 1) * 100}%`,
    width: `${widthPct}%`,
    height: `${heightPct}%`,
    transform: `translate(-50%, -50%) rotate(${transform.rotationDeg}deg) scaleX(${transform.flipX ? -1 : 1})`,
  };
}

function SubjectAreaOverlay({ transform, interactive = false, onPointerDown }: { transform: Pick<FramingDraft, 'aspectRatio' | 'centerX' | 'centerY' | 'poseHeight' | 'rotationDeg' | 'flipX'>; interactive?: boolean; onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>, action: 'drag' | 'resize') => void }) {
  return (
    <div
      className={`absolute origin-center rounded-[10%] border-2 border-cyan-200/90 bg-cyan-400/10 shadow-[0_0_28px_rgba(34,211,238,.32)] ${interactive ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={subjectRectStyle(transform)}
      onPointerDown={interactive ? (event) => onPointerDown?.(event, 'drag') : undefined}
    >
      <div className="absolute inset-x-[42%] inset-y-0 border-x border-cyan-100/35" />
      <div className="absolute inset-x-0 top-[12%] border-t border-cyan-100/35" />
      <div className="absolute inset-x-0 top-[34%] border-t border-cyan-100/30" />
      <div className="absolute inset-x-0 bottom-[18%] border-t border-cyan-100/30" />
      <div className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-50 bg-cyan-300/95" />
      <div className="absolute left-1/2 top-[18%] h-[18%] w-[46%] -translate-x-1/2 rounded-full border-2 border-cyan-200/70" />
      <div className="absolute left-1/2 top-[42%] h-0 w-[92%] -translate-x-1/2 border-t-2 border-cyan-200/75 before:absolute before:left-0 before:top-0 before:h-8 before:w-0 before:origin-top before:rotate-[22deg] before:border-l-2 before:border-cyan-200/65 after:absolute after:right-0 after:top-0 after:h-8 after:w-0 after:origin-top after:-rotate-[22deg] after:border-l-2 after:border-cyan-200/65" />
      <div className="absolute bottom-[22%] left-1/2 h-0 w-[54%] -translate-x-1/2 border-t-2 border-cyan-200/75 before:absolute before:left-0 before:top-0 before:h-9 before:w-0 before:origin-top before:-rotate-[10deg] before:border-l-2 before:border-cyan-200/65 after:absolute after:right-0 after:top-0 after:h-9 after:w-0 after:origin-top after:rotate-[10deg] after:border-l-2 after:border-cyan-200/65" />
      {interactive ? (
        <>
          <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-blue-400 shadow-[0_0_14px_rgba(96,165,250,.8)]" />
          <div className="absolute -bottom-2 left-1/2 h-4 w-10 -translate-x-1/2 cursor-ns-resize rounded-full border border-cyan-100 bg-cyan-400/90 shadow-lg" onPointerDown={(event) => onPointerDown?.(event, 'resize')} />
          <div className="absolute -top-2 left-1/2 h-4 w-10 -translate-x-1/2 cursor-ns-resize rounded-full border border-cyan-100 bg-cyan-400/60 shadow-lg" onPointerDown={(event) => onPointerDown?.(event, 'resize')} />
        </>
      ) : null}
    </div>
  );
}

function PlacementPreview({ preset, className = 'max-w-[220px]' }: { preset: Pick<FramingDraft, 'aspectRatio' | 'centerX' | 'centerY' | 'poseHeight' | 'rotationDeg' | 'flipX'>; className?: string }) {
  return (
    <div className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-white/10 bg-black ${className}`} style={{ aspectRatio: `${clamp(preset.aspectRatio, 0.2, 4)} / 1` }}>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] bg-[size:25%_25%]" />
      <SubjectAreaOverlay transform={preset} />
    </div>
  );
}

type FramingPointerState = {
  action: 'drag' | 'resize';
  pointerId: number;
  startX: number;
  startY: number;
  startCenterX: number;
  startCenterY: number;
  startPoseHeight: number;
};

function FramingEditor({ draft, onChange }: { draft: FramingDraft; onChange: (updater: (current: FramingDraft) => FramingDraft) => void }) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const pointerState = useRef<FramingPointerState | null>(null);

  function updateCenterFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    onChange((current) => ({ ...current, centerX: round(clamp((event.clientX - rect.left) / rect.width, 0, 1)), centerY: round(clamp((event.clientY - rect.top) / rect.height, 0, 1)) }));
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateCenterFromPointer(event);
  }

  function handleSubjectPointerDown(event: ReactPointerEvent<HTMLDivElement>, action: 'drag' | 'resize') {
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    canvasRef.current?.setPointerCapture(event.pointerId);
    pointerState.current = {
      action,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCenterX: draft.centerX,
      startCenterY: draft.centerY,
      startPoseHeight: draft.poseHeight,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const state = pointerState.current;
    if (state && state.pointerId === event.pointerId) {
      if (state.action === 'drag') {
        const dx = (event.clientX - state.startX) / rect.width;
        const dy = (event.clientY - state.startY) / rect.height;
        onChange((current) => ({ ...current, centerX: round(clamp(state.startCenterX + dx, 0, 1)), centerY: round(clamp(state.startCenterY + dy, 0, 1)) }));
      } else {
        const pointerY = (event.clientY - rect.top) / rect.height;
        const nextHeight = Math.abs(pointerY - state.startCenterY) * 2;
        onChange((current) => ({ ...current, poseHeight: round(clamp(nextHeight, 0.05, 1.5)) }));
      }
      return;
    }
    if (event.buttons === 1) updateCenterFromPointer(event);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerState.current?.pointerId === event.pointerId) pointerState.current = null;
  }

  function setAspectPreset(orientation: StudioSessionPoseOrientation) {
    onChange((current) => ({ ...current, orientation, aspectRatio: defaultAspectRatio(orientation) }));
  }

  return (
    <div className="space-y-4">
      <div
        ref={canvasRef}
        role="application"
        aria-label="2D framing editor canvas"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative mx-auto w-full max-w-[520px] touch-none overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl"
        style={{ aspectRatio: `${clamp(draft.aspectRatio, 0.2, 4)} / 1` }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(59,130,246,.16),transparent_38%),linear-gradient(rgba(255,255,255,.075)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.075)_1px,transparent_1px)] bg-[size:100%_100%,12.5%_12.5%,12.5%_12.5%]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-full border-l border-white/10" />
        <div className="pointer-events-none absolute left-0 top-1/2 w-full border-t border-white/10" />
        <SubjectAreaOverlay transform={draft} interactive onPointerDown={handleSubjectPointerDown} />
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-xs text-white/55">Drag rectangle to place · pull top/bottom handle to resize</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/35">Aspect presets</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setAspectPreset('portrait')} className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">Portrait 2:3</Button>
            <Button type="button" variant="outline" onClick={() => setAspectPreset('landscape')} className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">Landscape 3:2</Button>
            <Button type="button" variant="outline" onClick={() => setAspectPreset('square')} className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">Square 1:1</Button>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/55">
          <div className="mb-2 uppercase tracking-[0.16em] text-white/35">Stored relative subject area</div>
          <div>centerX {draft.centerX.toFixed(3)} · centerY {draft.centerY.toFixed(3)}</div>
          <div>poseHeight {draft.poseHeight.toFixed(3)} · rotation {draft.rotationDeg.toFixed(1)}° · {draft.flipX ? 'flipX' : 'normal'}</div>
          <div className="mt-1 text-white/35">The rectangle is a relative subject box; no pixel dimensions are saved.</div>
        </div>
      </div>
    </div>
  );
}

function PresetCard({ preset, onEdit, onDuplicate, onDelete, onMoveUp, onMoveDown }: { preset: StudioFramingPresetSummary; onEdit: () => void; onDuplicate: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void }) {
  return (
    <Card className="group overflow-hidden border-white/10 bg-white/[0.035] text-white transition hover:border-white/25 hover:bg-white/[0.06]">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-base font-semibold">{preset.title}</div><div className="mt-1 text-xs text-white/45">{preset.orientation} · {aspectLabel(preset.aspectRatio)}</div></div>
          <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
            <Button type="button" size="icon" variant="ghost" onClick={onMoveUp} className="h-8 w-8 text-white/60 hover:bg-white/[0.06] hover:text-white"><ArrowUp className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" onClick={onMoveDown} className="h-8 w-8 text-white/60 hover:bg-white/[0.06] hover:text-white"><ArrowDown className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" onClick={onDuplicate} className="h-8 w-8 text-white/60 hover:bg-white/[0.06] hover:text-white"><Copy className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 text-white/60 hover:bg-red-500/15 hover:text-red-200"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        <PlacementPreview preset={preset} />
        <div className="grid grid-cols-2 gap-2 text-xs text-white/55"><span>center {preset.centerX.toFixed(2)}, {preset.centerY.toFixed(2)}</span><span>height {preset.poseHeight.toFixed(2)}</span><span>rot {preset.rotationDeg.toFixed(0)}°</span><span>{preset.flipX ? 'flipped' : 'not flipped'}</span></div>
        <div className="line-clamp-2 text-xs text-white/40">{preset.helperPrompt || preset.description || 'No helper prompt yet.'}</div>
        {preset.tags.length ? <div className="flex flex-wrap gap-1">{preset.tags.slice(0, 5).map((tag) => <span key={tag} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/45">{tag}</span>)}</div> : null}
        <Button type="button" onClick={onEdit} variant="outline" className="w-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">Edit in 2D editor</Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">{label}</div>{children}</label>;
}

function SliderField({ label, value, min, max, step, onChange, suffix = '' }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; suffix?: string }) {
  return (
    <label className="block rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-white/35"><span>{label}</span><span className="font-mono normal-case tracking-normal text-white/60">{value.toFixed(step < 1 ? 2 : 0)}{suffix}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-blue-400" />
    </label>
  );
}

export default function FramingLibraryWorkspace() {
  const { activeWorkspaceId, addJob } = useStudio();
  const [presets, setPresets] = useState<StudioFramingPresetSummary[]>([]);
  const [query, setQuery] = useState('');
  const [orientation, setOrientation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FramingDraft>(DEFAULT_DRAFT);
  const [poses, setPoses] = useState<StudioPoseSummary[]>([]);
  const [previewPoseId, setPreviewPoseId] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewLaunchBusy, setPreviewLaunchBusy] = useState(false);
  const [previewLaunchMessage, setPreviewLaunchMessage] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<FramingPreviewResult | null>(null);

  const fetchJson = useCallback(async (url: string, fallback: string) => {
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : fallback);
    return data;
  }, []);

  const refresh = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ workspaceId: activeWorkspaceId });
      if (orientation) params.set('orientation', orientation);
      if (query.trim()) params.set('query', query.trim());
      const data = await fetchJson(`/api/studio/framing-presets?${params.toString()}`, 'Failed to fetch framing presets');
      setPresets(Array.isArray(data.presets) ? data.presets : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Framing Library');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, fetchJson, orientation, query]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!dialogOpen || !activeWorkspaceId) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchJson(`/api/studio/pose-library/poses?workspaceId=${encodeURIComponent(activeWorkspaceId)}&orientation=${encodeURIComponent(draft.orientation)}`, 'Failed to fetch poses for preview');
        if (cancelled) return;
        const nextPoses = Array.isArray(data.poses) ? data.poses : [];
        setPoses(nextPoses);
        setPreviewPoseId((current) => current && nextPoses.some((pose: StudioPoseSummary) => pose.id === current) ? current : nextPoses[0]?.id ?? '');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load poses for preview');
      }
    })();
    return () => { cancelled = true; };
  }, [activeWorkspaceId, dialogOpen, draft.orientation, fetchJson]);

  const grouped = useMemo(() => ({
    portrait: presets.filter((preset) => preset.orientation === 'portrait'),
    landscape: presets.filter((preset) => preset.orientation === 'landscape'),
    square: presets.filter((preset) => preset.orientation === 'square'),
  }), [presets]);

  function updateDraft(updater: (current: FramingDraft) => FramingDraft) {
    setDraft((current) => {
      const next = updater(current);
      return { ...next, aspectRatio: round(clamp(next.aspectRatio, 0.2, 4), 4), centerX: round(clamp(next.centerX, 0, 1)), centerY: round(clamp(next.centerY, 0, 1)), poseHeight: round(clamp(next.poseHeight, 0.05, 1.5)), rotationDeg: round(clamp(next.rotationDeg, -180, 180), 2) };
    });
  }

  function openCreate() {
    setEditingId(null);
    setDraft(DEFAULT_DRAFT);
    setPreviewResult(null);
    setDialogOpen(true);
  }

  function openEdit(preset: StudioFramingPresetSummary) {
    setEditingId(preset.id);
    setDraft(draftFromPreset(preset));
    setPreviewResult(null);
    setDialogOpen(true);
  }

  async function savePreset() {
    if (!activeWorkspaceId) return;
    const body = editingId ? payloadFromDraft(draft) : { workspaceId: activeWorkspaceId, ...payloadFromDraft(draft), title: draft.title || 'New framing preset' };
    const response = await fetch(editingId ? `/api/studio/framing-presets/${encodeURIComponent(editingId)}` : '/api/studio/framing-presets', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok || !data?.success) { setError(data?.error || 'Failed to save framing preset'); return; }
    setDialogOpen(false); await refresh();
  }


  async function renderFramingPreview() {
    if (!editingId || !previewPoseId) return;
    setPreviewBusy(true); setPreviewResult(null); setPreviewLaunchMessage(null); setError(null);
    try {
      const response = await fetch(`/api/studio/framing-presets/${encodeURIComponent(editingId)}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poseId: previewPoseId }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Failed to render framing preview');
      setPreviewResult(data as FramingPreviewResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to render framing preview');
    } finally {
      setPreviewBusy(false);
    }
  }

  async function launchZImagePreview() {
    if (!editingId || !previewPoseId || !previewResult || previewResult.mode !== 'openpose_control') return;
    const prompt = [previewResult.pose?.title, previewResult.helperPrompt || draft.helperPrompt].filter(Boolean).join('. ');
    const firstResponse = await fetch(`/api/studio/framing-presets/${encodeURIComponent(editingId)}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poseId: previewPoseId, launchPreview: true, prompt }),
    });
    const firstData = await firstResponse.json() as PreviewLaunchResult;
    const reason = firstData.reason || 'Launching a Z-Image ControlNet preview can spend generation budget. Continue?';
    if (!firstData.requiresConfirmation && (!firstResponse.ok || !firstData.success)) {
      throw new Error(firstData.error || 'Failed to prepare Z-Image preview launch');
    }
    if (!confirm(`${reason}\n\nThis will submit one RunPod Z-Image ControlNet job.`)) return;

    const response = await fetch(`/api/studio/framing-presets/${encodeURIComponent(editingId)}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poseId: previewPoseId, launchPreview: true, confirmLaunch: true, prompt }),
    });
    const data = await response.json() as PreviewLaunchResult;
    if (!response.ok || !data.success || !data.jobId) throw new Error(data.error || 'Failed to launch Z-Image preview');
    addJob({ id: data.jobId, modelId: 'z-image', type: 'image', status: 'queueing_up', prompt, createdAt: Date.now(), options: { use_controlnet: true, task_type: '', width: previewResult.width, height: previewResult.height } });
    setPreviewLaunchMessage(`Z-Image preview queued: ${data.jobId}`);
  }

  async function launchZImagePreviewWithState() {
    setPreviewLaunchBusy(true); setPreviewLaunchMessage(null); setError(null);
    try {
      await launchZImagePreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch Z-Image preview');
    } finally {
      setPreviewLaunchBusy(false);
    }
  }

  async function cleanFramingPreviews() {
    if (!editingId) return;
    if (!confirm('Delete preview/test assets for this framing preset only? Normal shot results are not touched.')) return;
    const response = await fetch(`/api/studio/framing-presets/${encodeURIComponent(editingId)}/preview`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok || !data?.success) { setError(data?.error || 'Failed to clean preview assets'); return; }
    setPreviewResult(null);
  }

  async function duplicatePreset(id: string) {
    const response = await fetch(`/api/studio/framing-presets/${encodeURIComponent(id)}/duplicate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await response.json();
    if (!response.ok || !data?.success) { setError(data?.error || 'Failed to duplicate framing preset'); return; }
    await refresh();
  }

  async function deletePreset(id: string) {
    if (!confirm('Delete this framing preset? Existing materialized runs/shots keep their saved snapshots.')) return;
    const response = await fetch(`/api/studio/framing-presets/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok || !data?.success) { setError(data?.error || 'Failed to delete framing preset'); return; }
    await refresh();
  }

  async function movePreset(preset: StudioFramingPresetSummary, direction: -1 | 1) {
    if (!activeWorkspaceId) return;
    const same = presets.filter((item) => item.orientation === preset.orientation);
    const index = same.findIndex((item) => item.id === preset.id);
    const target = same[index + direction];
    if (!target) return;
    const ids = same.map((item) => item.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + direction, 0, moved);
    const response = await fetch('/api/studio/framing-presets/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: activeWorkspaceId, ids }) });
    const data = await response.json();
    if (!response.ok || !data?.success) { setError(data?.error || 'Failed to reorder framing presets'); return; }
    await refresh();
  }

  function setOrientationDraft(next: StudioSessionPoseOrientation) {
    updateDraft((current) => ({ ...current, orientation: next, aspectRatio: defaultAspectRatio(next) }));
  }

  return (
    <div className="relative min-h-[calc(100vh-180px)] rounded-3xl border border-white/10 bg-white/[0.015] p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><div className="flex items-center gap-3 text-2xl font-semibold text-white"><Crop className="h-6 w-6 text-blue-200" />Framing Library</div><div className="mt-1 text-sm text-white/45">Desktop v1. Create relative framing presets for later run-level selection; mobile editor is out of scope.</div></div>
        <Button type="button" onClick={openCreate} className="bg-blue-500 text-white hover:bg-blue-400"><Plus className="mr-2 h-4 w-4" />New preset</Button>
      </div>
      <div className="mb-5 flex flex-wrap gap-3">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, prompt, tags…" className="max-w-sm border-white/10 bg-black/30 text-white placeholder:text-white/25" />
        <select value={orientation} onChange={(event) => setOrientation(event.target.value)} className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white"><option value="">All orientations</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option><option value="square">Square</option></select>
      </div>
      {error ? <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
      {loading ? <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-white/50">Loading Framing Library…</div> : presets.length === 0 ? <TileGrid><AddTile onClick={openCreate} /><div className="flex min-h-[260px] flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.025] p-6 text-white"><div className="text-base font-semibold">No framing presets yet</div><div className="mt-2 text-sm text-white/45">Create a preset with relative center, scale, rotation, flip and helper prompt. No pixel dimensions are stored.</div></div></TileGrid> : <div className="space-y-8">{(['portrait', 'landscape', 'square'] as const).map((key) => grouped[key].length ? <section key={key}><div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/40">{key}</div><TileGrid>{grouped[key].map((preset) => <PresetCard key={preset.id} preset={preset} onEdit={() => openEdit(preset)} onDuplicate={() => void duplicatePreset(preset.id)} onDelete={() => void deletePreset(preset.id)} onMoveUp={() => void movePreset(preset, -1)} onMoveDown={() => void movePreset(preset, 1)} />)}</TileGrid></section> : null)}</div>}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl border-white/10 bg-[#101014] text-white">
          <DialogHeader><DialogTitle>{editingId ? 'Edit framing preset' : 'New framing preset'}</DialogTitle></DialogHeader>
          <div className="grid max-h-[78vh] gap-5 overflow-y-auto pr-1 lg:grid-cols-[minmax(440px,1fr)_380px]">
            <FramingEditor draft={draft} onChange={updateDraft} />
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Field label="Title"><Input value={draft.title} onChange={(event) => updateDraft((current) => ({ ...current, title: event.target.value }))} className="border-white/10 bg-black/30 text-white" placeholder="Lower-left full body" /></Field>
                <Field label="Orientation"><select value={draft.orientation} onChange={(event) => setOrientationDraft(event.target.value as StudioSessionPoseOrientation)} className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white"><option value="portrait">Portrait</option><option value="landscape">Landscape</option><option value="square">Square</option></select></Field>
                <Field label="Aspect ratio"><Input type="number" step="0.01" min="0.2" max="4" value={draft.aspectRatio} onChange={(event) => updateDraft((current) => ({ ...current, aspectRatio: Number(event.target.value) }))} className="border-white/10 bg-black/30 text-white" /></Field>
                <Field label="Tags"><Input value={draft.tags} onChange={(event) => updateDraft((current) => ({ ...current, tags: event.target.value }))} className="border-white/10 bg-black/30 text-white" placeholder="lower-left, full-body" /></Field>
              </div>
              <SliderField label="Center X" value={draft.centerX} min={0} max={1} step={0.01} onChange={(value) => updateDraft((current) => ({ ...current, centerX: value }))} />
              <SliderField label="Center Y" value={draft.centerY} min={0} max={1} step={0.01} onChange={(value) => updateDraft((current) => ({ ...current, centerY: value }))} />
              <SliderField label="Pose height" value={draft.poseHeight} min={0.05} max={1.5} step={0.01} onChange={(value) => updateDraft((current) => ({ ...current, poseHeight: value }))} />
              <SliderField label="Rotation" value={draft.rotationDeg} min={-180} max={180} step={1} suffix="°" onChange={(value) => updateDraft((current) => ({ ...current, rotationDeg: value }))} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => updateDraft((current) => ({ ...current, flipX: !current.flipX }))} className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"><FlipHorizontal2 className="mr-2 h-4 w-4" />{draft.flipX ? 'Unflip X' : 'Flip X'}</Button>
                <Button type="button" variant="outline" onClick={() => updateDraft((current) => ({ ...current, centerX: 0.5, centerY: 0.58, poseHeight: 0.78, rotationDeg: 0, flipX: false }))} className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"><RotateCcw className="mr-2 h-4 w-4" />Reset placement</Button>
              </div>
              <Field label="Description"><Input value={draft.description} onChange={(event) => updateDraft((current) => ({ ...current, description: event.target.value }))} className="border-white/10 bg-black/30 text-white" /></Field>
              <label className="block"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Helper prompt</div><textarea value={draft.helperPrompt} onChange={(event) => updateDraft((current) => ({ ...current, helperPrompt: event.target.value }))} className="min-h-24 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" placeholder="lower-left full-body composition with extra negative space above" /></label>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-semibold text-cyan-100">Pose + framing test</div><div className="mt-1 text-xs text-cyan-100/60">Render a free control PNG first. Z-Image preview launch is optional and requires explicit confirmation.</div></div><Button type="button" variant="outline" onClick={() => void cleanFramingPreviews()} disabled={!editingId} className="border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]">Clean previews</Button></div>
                <div className="mt-3 grid gap-2"><select value={previewPoseId} onChange={(event) => { setPreviewPoseId(event.target.value); setPreviewResult(null); }} disabled={!editingId || poses.length === 0} className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white disabled:opacity-50">{poses.map((pose) => <option key={pose.id} value={pose.id}>{pose.title} · {pose.openPose.hasKeypoints ? 'OpenPose' : 'text-only'}</option>)}</select><Button type="button" onClick={() => void renderFramingPreview()} disabled={!editingId || !previewPoseId || previewBusy} className="bg-cyan-500 text-white hover:bg-cyan-400 disabled:opacity-50"><ImageIcon className="mr-2 h-4 w-4" />{previewBusy ? 'Rendering…' : editingId ? 'Render control preview' : 'Save preset before preview'}</Button></div>
                {!editingId ? <div className="mt-2 text-xs text-cyan-100/55">Save the preset first, then render a scoped preview asset.</div> : null}
                {previewResult ? <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/25">{previewResult.previewUrl ? <img src={previewResult.previewUrl} alt="OpenPose framing preview" className="max-h-80 w-full object-contain" /> : <div className="flex min-h-32 items-center justify-center p-4 text-center text-sm text-white/55">{previewResult.message || 'Text-only framing guidance will be used.'}</div>}<div className="space-y-2 p-3 text-xs text-white/55"><div>{previewResult.mode === 'openpose_control' ? `OpenPose control · ${previewResult.width}×${previewResult.height} · ${previewResult.pointCount ?? 0} body points` : 'Text-only fallback'}</div>{previewResult.helperPrompt ? <div className="text-white/40">Helper: {previewResult.helperPrompt}</div> : null}{previewResult.mode === 'openpose_control' ? <Button type="button" variant="outline" onClick={() => void launchZImagePreviewWithState()} disabled={previewLaunchBusy} className="mt-2 w-full border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 disabled:opacity-50">{previewLaunchBusy ? 'Launching…' : 'Launch Z-Image ControlNet preview…'}</Button> : null}{previewLaunchMessage ? <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-2 text-emerald-100">{previewLaunchMessage}</div> : null}</div></div> : null}
              </div>
              <Button type="button" onClick={() => void savePreset()} className="w-full bg-blue-500 text-white hover:bg-blue-400">{editingId ? 'Save changes' : 'Create preset'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
