'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Crop, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useStudio } from '@/lib/context/StudioContext';
import type { StudioFramingPresetSummary, StudioSessionPoseOrientation } from '@/lib/studio-sessions/types';

export type FramingLibraryRoute = { level: 'framingLibrary' };

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
    tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
  };
}

function TileGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">{children}</div>;
}

function AddTile({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.025] text-white/60 transition hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-white"><div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><Plus className="h-8 w-8" /></div><div className="text-sm font-medium">New framing preset</div></button>;
}

function PlacementPreview({ preset }: { preset: Pick<StudioFramingPresetSummary, 'aspectRatio' | 'centerX' | 'centerY' | 'poseHeight' | 'rotationDeg' | 'flipX'> }) {
  const canvasClass = preset.aspectRatio >= 1.2 ? 'aspect-[3/2]' : preset.aspectRatio <= 0.8 ? 'aspect-[2/3]' : 'aspect-square';
  const skeletonHeight = Math.max(16, Math.min(140, preset.poseHeight * 120));
  return <div className={`relative mx-auto w-full max-w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-black ${canvasClass}`}><div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] bg-[size:25%_25%]" /><div className="absolute h-2 w-2 rounded-full bg-blue-300 shadow-[0_0_18px_rgba(147,197,253,.85)]" style={{ left: `${preset.centerX * 100}%`, top: `${preset.centerY * 100}%`, transform: 'translate(-50%, -50%)' }} /><div className="absolute left-1/2 top-1/2 w-[2px] origin-center rounded-full bg-cyan-300/80" style={{ height: skeletonHeight, left: `${preset.centerX * 100}%`, top: `${preset.centerY * 100}%`, transform: `translate(-50%, -50%) rotate(${preset.rotationDeg}deg) scaleX(${preset.flipX ? -1 : 1})` }}><span className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200 bg-cyan-400/70" /><span className="absolute left-1/2 top-[28%] h-10 w-16 -translate-x-1/2 border-t-2 border-cyan-300/80" /><span className="absolute bottom-[18%] left-1/2 h-12 w-14 -translate-x-1/2 border-b-2 border-cyan-300/80" /></div></div>;
}

function PresetCard({ preset, onEdit, onDuplicate, onDelete, onMoveUp, onMoveDown }: { preset: StudioFramingPresetSummary; onEdit: () => void; onDuplicate: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void }) {
  return <Card className="group overflow-hidden border-white/10 bg-white/[0.035] text-white transition hover:border-white/25 hover:bg-white/[0.06]"><CardContent className="space-y-4 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-base font-semibold">{preset.title}</div><div className="mt-1 text-xs text-white/45">{preset.orientation} · {aspectLabel(preset.aspectRatio)}</div></div><div className="flex gap-1 opacity-0 transition group-hover:opacity-100"><Button type="button" size="icon" variant="ghost" onClick={onMoveUp} className="h-8 w-8 text-white/60 hover:bg-white/[0.06] hover:text-white"><ArrowUp className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={onMoveDown} className="h-8 w-8 text-white/60 hover:bg-white/[0.06] hover:text-white"><ArrowDown className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={onDuplicate} className="h-8 w-8 text-white/60 hover:bg-white/[0.06] hover:text-white"><Copy className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 text-white/60 hover:bg-red-500/15 hover:text-red-200"><Trash2 className="h-4 w-4" /></Button></div></div><PlacementPreview preset={preset} /><div className="grid grid-cols-2 gap-2 text-xs text-white/55"><span>center {preset.centerX.toFixed(2)}, {preset.centerY.toFixed(2)}</span><span>height {preset.poseHeight.toFixed(2)}</span><span>rot {preset.rotationDeg.toFixed(0)}°</span><span>{preset.flipX ? 'flipped' : 'not flipped'}</span></div><div className="line-clamp-2 text-xs text-white/40">{preset.helperPrompt || preset.description || 'No helper prompt yet.'}</div>{preset.tags.length ? <div className="flex flex-wrap gap-1">{preset.tags.slice(0, 5).map((tag) => <span key={tag} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/45">{tag}</span>)}</div> : null}<Button type="button" onClick={onEdit} variant="outline" className="w-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">Edit</Button></CardContent></Card>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">{label}</div>{children}</label>;
}

export default function FramingLibraryWorkspace() {
  const { activeWorkspaceId } = useStudio();
  const [presets, setPresets] = useState<StudioFramingPresetSummary[]>([]);
  const [query, setQuery] = useState('');
  const [orientation, setOrientation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FramingDraft>(DEFAULT_DRAFT);

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

  const grouped = useMemo(() => ({
    portrait: presets.filter((preset) => preset.orientation === 'portrait'),
    landscape: presets.filter((preset) => preset.orientation === 'landscape'),
    square: presets.filter((preset) => preset.orientation === 'square'),
  }), [presets]);

  function openCreate() {
    setEditingId(null);
    setDraft(DEFAULT_DRAFT);
    setDialogOpen(true);
  }

  function openEdit(preset: StudioFramingPresetSummary) {
    setEditingId(preset.id);
    setDraft(draftFromPreset(preset));
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
    setDraft((current) => ({ ...current, orientation: next, aspectRatio: defaultAspectRatio(next) }));
  }

  return <div className="relative min-h-[calc(100vh-180px)] rounded-3xl border border-white/10 bg-white/[0.015] p-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-3 text-2xl font-semibold text-white"><Crop className="h-6 w-6 text-blue-200" />Framing Library</div><div className="mt-1 text-sm text-white/45">Desktop v1. Create relative framing presets for later run-level selection; mobile editor is out of scope.</div></div><Button type="button" onClick={openCreate} className="bg-blue-500 text-white hover:bg-blue-400"><Plus className="mr-2 h-4 w-4" />New preset</Button></div><div className="mb-5 flex flex-wrap gap-3"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, prompt, tags…" className="max-w-sm border-white/10 bg-black/30 text-white placeholder:text-white/25" /><select value={orientation} onChange={(event) => setOrientation(event.target.value)} className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white"><option value="">All orientations</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option><option value="square">Square</option></select></div>{error ? <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}{loading ? <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-white/50">Loading Framing Library…</div> : presets.length === 0 ? <TileGrid><AddTile onClick={openCreate} /><div className="flex min-h-[260px] flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.025] p-6 text-white"><div className="text-base font-semibold">No framing presets yet</div><div className="mt-2 text-sm text-white/45">Create a preset with relative center, scale, rotation, flip and helper prompt. No pixel dimensions are stored.</div></div></TileGrid> : <div className="space-y-8">{(['portrait', 'landscape', 'square'] as const).map((key) => grouped[key].length ? <section key={key}><div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/40">{key}</div><TileGrid>{grouped[key].map((preset) => <PresetCard key={preset.id} preset={preset} onEdit={() => openEdit(preset)} onDuplicate={() => void duplicatePreset(preset.id)} onDelete={() => void deletePreset(preset.id)} onMoveUp={() => void movePreset(preset, -1)} onMoveDown={() => void movePreset(preset, 1)} />)}</TileGrid></section> : null)}</div>}<Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-4xl border-white/10 bg-[#101014] text-white"><DialogHeader><DialogTitle>{editingId ? 'Edit framing preset' : 'New framing preset'}</DialogTitle></DialogHeader><div className="grid gap-5 lg:grid-cols-[260px_1fr]"><div className="rounded-3xl border border-white/10 bg-black/25 p-4"><PlacementPreview preset={draft} /><div className="mt-4 text-xs text-white/45">Preview is relative only. Actual generation dimensions are resolved later by run settings.</div></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Title"><Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="border-white/10 bg-black/30 text-white" placeholder="Lower-left full body" /></Field><Field label="Orientation"><select value={draft.orientation} onChange={(event) => setOrientationDraft(event.target.value as StudioSessionPoseOrientation)} className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white"><option value="portrait">Portrait</option><option value="landscape">Landscape</option><option value="square">Square</option></select></Field><Field label="Aspect ratio"><Input type="number" step="0.01" value={draft.aspectRatio} onChange={(event) => setDraft((current) => ({ ...current, aspectRatio: Number(event.target.value) }))} className="border-white/10 bg-black/30 text-white" /></Field><Field label="Tags"><Input value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} className="border-white/10 bg-black/30 text-white" placeholder="lower-left, full-body" /></Field><Field label="Center X"><Input type="number" step="0.01" value={draft.centerX} onChange={(event) => setDraft((current) => ({ ...current, centerX: Number(event.target.value) }))} className="border-white/10 bg-black/30 text-white" /></Field><Field label="Center Y"><Input type="number" step="0.01" value={draft.centerY} onChange={(event) => setDraft((current) => ({ ...current, centerY: Number(event.target.value) }))} className="border-white/10 bg-black/30 text-white" /></Field><Field label="Pose height"><Input type="number" step="0.01" value={draft.poseHeight} onChange={(event) => setDraft((current) => ({ ...current, poseHeight: Number(event.target.value) }))} className="border-white/10 bg-black/30 text-white" /></Field><Field label="Rotation"><Input type="number" step="1" value={draft.rotationDeg} onChange={(event) => setDraft((current) => ({ ...current, rotationDeg: Number(event.target.value) }))} className="border-white/10 bg-black/30 text-white" /></Field><Field label="Flip X"><select value={draft.flipX ? 'true' : 'false'} onChange={(event) => setDraft((current) => ({ ...current, flipX: event.target.value === 'true' }))} className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white"><option value="false">No</option><option value="true">Yes</option></select></Field><Field label="Description"><Input value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="border-white/10 bg-black/30 text-white" /></Field><label className="block sm:col-span-2"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Helper prompt</div><textarea value={draft.helperPrompt} onChange={(event) => setDraft((current) => ({ ...current, helperPrompt: event.target.value }))} className="min-h-24 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" placeholder="lower-left full-body composition with extra negative space above" /></label></div></div><Button type="button" onClick={() => void savePreset()} className="bg-blue-500 text-white hover:bg-blue-400">{editingId ? 'Save changes' : 'Create preset'}</Button></DialogContent></Dialog></div>;
}
