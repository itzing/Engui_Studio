'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, Filter, ImageIcon, Plus, SlidersHorizontal, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useStudio } from '@/lib/context/StudioContext';
import type { StudioPoseCategorySummary, StudioPoseSummary } from '@/lib/studio-sessions/types';

export type PoseLibraryRoute =
  | { level: 'poseLibrary'; view?: 'categories' | 'all' }
  | { level: 'poseLibraryCategory'; categoryId: string }
  | { level: 'poseLibraryPose'; categoryId: string; poseId: string };

type PoseDraft = {
  title: string;
  categoryId: string;
  tags: string;
  posePrompt: string;
  orientation: StudioPoseSummary['orientation'];
  framing: StudioPoseSummary['framing'];
  cameraAngle: StudioPoseSummary['cameraAngle'];
  shotDistance: StudioPoseSummary['shotDistance'];
};

function TileGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">{children}</div>;
}

function AddTile({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.025] text-white/60 transition hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-white"><div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><Plus className="h-8 w-8" /></div><div className="text-sm font-medium">{label}</div></button>;
}

function EmptyTile({ title, description }: { title: string; description: string }) {
  return <div className="flex min-h-[220px] flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.025] p-6 text-white"><div className="text-base font-semibold">{title}</div><div className="mt-2 text-sm text-white/45">{description}</div></div>;
}

function Toolbar({ open, onClose, query, onQueryChange, previewFilter, onPreviewFilterChange, variantCount, onVariantCountChange, onExport, onOpenImport, onBulkGenerate }: { open: boolean; onClose: () => void; query: string; onQueryChange: (value: string) => void; previewFilter: string; onPreviewFilterChange: (value: string) => void; variantCount: number; onVariantCountChange: (value: number) => void; onExport: () => void; onOpenImport: () => void; onBulkGenerate: () => void }) {
  return <div className={`absolute bottom-4 right-4 top-4 z-20 w-[320px] max-w-[calc(100%-2rem)] overflow-y-auto rounded-3xl border border-white/10 bg-[#101014]/95 p-4 shadow-2xl shadow-black/40 transition ${open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-8 opacity-0'}`}><div className="flex items-center justify-between"><div className="text-sm font-semibold text-white">Library tools</div><Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-white/60 hover:bg-white/[0.06] hover:text-white">Hide</Button></div><div className="mt-5 space-y-4"><label className="block"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Search</div><Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Title, prompt, tags…" className="border-white/10 bg-black/30 text-white" /></label><label className="block"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Preview</div><select value={previewFilter} onChange={(event) => onPreviewFilterChange(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white"><option value="">Any</option><option value="has">Has preview</option><option value="missing">Missing preview</option></select></label><label className="block"><div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/35">Preview variants</div><select value={variantCount} onChange={(event) => onVariantCountChange(Number(event.target.value))} className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white"><option value={1}>1</option><option value={2}>2</option><option value={4}>4</option><option value={8}>8</option></select></label><div className="grid gap-2"><Button type="button" variant="outline" onClick={onBulkGenerate} className="justify-start border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"><ImageIcon className="mr-2 h-4 w-4" />Bulk missing previews</Button><Button type="button" variant="outline" onClick={onExport} className="justify-start border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"><Download className="mr-2 h-4 w-4" />Export JSON</Button><Button type="button" variant="outline" onClick={onOpenImport} className="justify-start border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"><Upload className="mr-2 h-4 w-4" />Import JSON</Button></div></div></div>;
}

function PoseTile({ pose, categoryId, onDelete, onDuplicate, onMoveUp, onMoveDown, dragging, onDragStart, onDragOver, onDrop, onDragEnd }: { pose: StudioPoseSummary; categoryId: string; onDelete: () => void; onDuplicate: () => void; onMoveUp: () => void; onMoveDown: () => void; dragging?: boolean; onDragStart: () => void; onDragOver: (event: DragEvent) => void; onDrop: () => void; onDragEnd: () => void }) {
  const href = `/studio-sessions/pose-library/categories/${categoryId}/poses/${pose.id}`;
  return <Link href={href} draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={(event) => { event.preventDefault(); onDrop(); }} onDragEnd={onDragEnd} className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] transition hover:border-white/25 hover:bg-white/[0.06] ${dragging ? 'opacity-45 ring-2 ring-blue-400/60' : ''}`}><div className="absolute right-3 top-3 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100"><Button type="button" size="icon" variant="ghost" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onMoveUp(); }} className="h-8 w-8 bg-black/35 text-white/70 hover:bg-black/55 hover:text-white"><ArrowUp className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onMoveDown(); }} className="h-8 w-8 bg-black/35 text-white/70 hover:bg-black/55 hover:text-white"><ArrowDown className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDuplicate(); }} className="h-8 w-8 bg-black/35 text-white/70 hover:bg-black/55 hover:text-white"><Copy className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDelete(); }} className="h-8 w-8 bg-black/35 text-white/70 hover:bg-red-500/20 hover:text-red-200"><Trash2 className="h-4 w-4" /></Button></div><div className="aspect-[4/3] bg-black/30">{pose.primaryPreviewUrl ? <img src={pose.primaryPreviewUrl} alt={pose.title} className="h-full w-full object-contain" /> : <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white/45"><ImageIcon className="h-9 w-9" /><div className="text-xs uppercase tracking-[0.18em] text-blue-200/70">Missing preview</div></div>}</div><div className="space-y-2 p-4"><div className="truncate text-base font-semibold text-white">{pose.title}</div><div className="text-xs text-white/50">{pose.orientation} · {pose.framing} · {pose.cameraAngle} · {pose.openPose.hasKeypoints ? 'OpenPose' : 'text-only'}</div><div className="line-clamp-2 text-xs text-white/35">{pose.posePrompt || 'No pose prompt yet.'}</div></div></Link>;
}

function createDefaultPoseDraft(categoryId: string): PoseDraft {
  return { title: '', categoryId, tags: '', posePrompt: '', orientation: 'portrait', framing: 'full_body', cameraAngle: 'front', shotDistance: 'wide' };
}

export default function PoseLibraryWorkspace({ route }: { route: PoseLibraryRoute }) {
  const { activeWorkspaceId } = useStudio();
  const [categories, setCategories] = useState<StudioPoseCategorySummary[]>([]);
  const [poses, setPoses] = useState<StudioPoseSummary[]>([]);
  const [poseDetail, setPoseDetail] = useState<StudioPoseSummary | null>(null);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [previewFilter, setPreviewFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewCandidatesOpen, setPreviewCandidatesOpen] = useState(false);
  const [openPoseBusy, setOpenPoseBusy] = useState(false);
  const [openPoseModalOpen, setOpenPoseModalOpen] = useState(false);
  const [openPoseSourceFile, setOpenPoseSourceFile] = useState<File | null>(null);
  const [openPoseSourcePreviewUrl, setOpenPoseSourcePreviewUrl] = useState('');
  const [openPoseMessage, setOpenPoseMessage] = useState('');
  const [openPosePending, setOpenPosePending] = useState(false);
  const openPoseFileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newPoseOpen, setNewPoseOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace_all'>('merge');
  const [importText, setImportText] = useState('');
  const [variantCount, setVariantCount] = useState(4);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [draggingPoseId, setDraggingPoseId] = useState<string | null>(null);
  const [poseDraft, setPoseDraft] = useState<PoseDraft>(createDefaultPoseDraft(''));

  const selectedCategory = useMemo(() => route.level === 'poseLibraryCategory' || route.level === 'poseLibraryPose' ? categories.find((category) => category.id === route.categoryId) ?? null : null, [categories, route]);

  const fetchJson = useCallback(async (url: string, fallback: string) => {
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : fallback);
    return data;
  }, []);

  const refreshCategories = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const data = await fetchJson(`/api/studio/pose-library/categories?workspaceId=${encodeURIComponent(activeWorkspaceId)}`, 'Failed to fetch pose categories');
    setCategories(Array.isArray(data.categories) ? data.categories : []);
  }, [activeWorkspaceId, fetchJson]);

  const refreshPoses = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const params = new URLSearchParams({ workspaceId: activeWorkspaceId });
    if (route.level === 'poseLibraryCategory' || route.level === 'poseLibraryPose') params.set('categoryId', route.categoryId);
    if (query.trim()) params.set('query', query.trim());
    if (previewFilter) params.set('preview', previewFilter);
    const data = await fetchJson(`/api/studio/pose-library/poses?${params.toString()}`, 'Failed to fetch poses');
    setPoses(Array.isArray(data.poses) ? data.poses : []);
  }, [activeWorkspaceId, fetchJson, previewFilter, query, route]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        await refreshCategories();
        if (route.level !== 'poseLibrary' || route.view === 'all') await refreshPoses();
        if (route.level === 'poseLibraryPose') {
          const data = await fetchJson(`/api/studio/pose-library/poses/${encodeURIComponent(route.poseId)}`, 'Failed to fetch pose');
          if (!cancelled) setPoseDetail(data.pose ?? null);
        } else if (!cancelled) setPoseDetail(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Pose Library');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [fetchJson, refreshCategories, refreshPoses, route]);

  useEffect(() => {
    if (!openPosePending || route.level !== 'poseLibraryPose') return;
    if (poseDetail?.openPose.hasOpenPoseImage || poseDetail?.openPose.hasKeypoints) {
      setOpenPosePending(false);
      setOpenPoseMessage('OpenPose data saved to this pose.');
      return;
    }
    const timer = window.setInterval(() => { void refreshPoseDetail(route.poseId); }, 3000);
    return () => window.clearInterval(timer);
  }, [openPosePending, poseDetail?.openPose.hasOpenPoseImage, poseDetail?.openPose.hasKeypoints, route]);

  async function createCategory() {
    if (!activeWorkspaceId) return;
    const response = await fetch('/api/studio/pose-library/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: activeWorkspaceId, name: newCategoryName || 'New category' }) });
    const data = await response.json();
    if (!response.ok || !data?.success) { setError(data?.error || 'Failed to create category'); return; }
    setNewCategoryOpen(false); setNewCategoryName(''); await refreshCategories();
  }

  async function createPose() {
    if (!activeWorkspaceId) return;
    const response = await fetch('/api/studio/pose-library/poses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...poseDraft, workspaceId: activeWorkspaceId, tags: poseDraft.tags.split(',').map((tag) => tag.trim()).filter(Boolean), title: poseDraft.title || 'New pose' }) });
    const data = await response.json();
    if (!response.ok || !data?.success) { setError(data?.error || 'Failed to create pose'); return; }
    setNewPoseOpen(false); setPoseDraft(createDefaultPoseDraft(poseDraft.categoryId)); await Promise.all([refreshCategories(), refreshPoses()]);
  }

  async function deleteCategory(categoryId: string) {
    if (!confirm('Delete this category and all its library poses? Existing shots keep their snapshots.')) return;
    const response = await fetch(`/api/studio/pose-library/categories/${encodeURIComponent(categoryId)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok || !data?.success) { setError(data?.error || 'Failed to delete category'); return; }
    await refreshCategories();
  }

  async function deletePose(poseId: string) {
    if (!confirm('Delete this library pose and preview candidates? Existing shots keep their snapshots.')) return;
    const response = await fetch(`/api/studio/pose-library/poses/${encodeURIComponent(poseId)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok || !data?.success) { setError(data?.error || 'Failed to delete pose'); return; }
    await Promise.all([refreshCategories(), refreshPoses()]);
  }

  async function duplicatePose(poseId: string) {
    const response = await fetch(`/api/studio/pose-library/poses/${encodeURIComponent(poseId)}/duplicate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await response.json();
    if (!response.ok || !data?.success) { setError(data?.error || 'Failed to duplicate pose'); return; }
    await Promise.all([refreshCategories(), refreshPoses()]);
  }

  function reorderIds(ids: string[], sourceId: string, targetId: string) {
    const sourceIndex = ids.indexOf(sourceId);
    const targetIndex = ids.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return ids;
    const next = [...ids];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    return next;
  }

  async function saveCategoryOrder(ids: string[], fallback = categories) {
    if (!activeWorkspaceId) return;
    const byId = new Map(categories.map((category) => [category.id, category]));
    const next = ids.map((id) => byId.get(id)).filter((category): category is StudioPoseCategorySummary => Boolean(category));
    setCategories(next);
    const response = await fetch('/api/studio/pose-library/categories/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: activeWorkspaceId, ids }) });
    const data = await response.json();
    if (!response.ok || !data?.success) { setCategories(fallback); setError(data?.error || 'Failed to reorder categories'); return; }
    setCategories(Array.isArray(data.categories) ? data.categories : next);
  }

  async function moveCategory(categoryId: string, direction: -1 | 1) {
    const index = categories.findIndex((category) => category.id === categoryId);
    const target = categories[index + direction];
    if (!target) return;
    await saveCategoryOrder(reorderIds(categories.map((category) => category.id), categoryId, target.id));
  }

  async function dropCategory(targetId: string) {
    if (!draggingCategoryId || draggingCategoryId === targetId) return;
    await saveCategoryOrder(reorderIds(categories.map((category) => category.id), draggingCategoryId, targetId));
    setDraggingCategoryId(null);
  }

  async function savePoseOrder(categoryId: string, ids: string[]) {
    if (!activeWorkspaceId) return;
    const response = await fetch('/api/studio/pose-library/poses/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: activeWorkspaceId, categoryId, ids }) });
    const data = await response.json();
    if (!response.ok || !data?.success) { await refreshPoses(); setError(data?.error || 'Failed to reorder poses'); return; }
    await refreshPoses();
  }

  async function movePose(poseId: string, direction: -1 | 1) {
    const pose = poses.find((item) => item.id === poseId);
    if (!pose) return;
    const sameCategory = poses.filter((item) => item.categoryId === pose.categoryId);
    const index = sameCategory.findIndex((item) => item.id === poseId);
    const target = sameCategory[index + direction];
    if (!target) return;
    await savePoseOrder(pose.categoryId, reorderIds(sameCategory.map((item) => item.id), poseId, target.id));
  }

  async function dropPose(targetId: string) {
    if (!draggingPoseId || draggingPoseId === targetId) return;
    const source = poses.find((item) => item.id === draggingPoseId);
    const target = poses.find((item) => item.id === targetId);
    if (!source || !target || source.categoryId !== target.categoryId) { setDraggingPoseId(null); return; }
    const sameCategory = poses.filter((item) => item.categoryId === source.categoryId);
    await savePoseOrder(source.categoryId, reorderIds(sameCategory.map((item) => item.id), source.id, target.id));
    setDraggingPoseId(null);
  }

  async function refreshPoseDetail(poseId: string) {
    const data = await fetchJson(`/api/studio/pose-library/poses/${encodeURIComponent(poseId)}`, 'Failed to fetch pose');
    setPoseDetail(data.pose ?? null);
  }

  async function generatePosePreview() {
    if (!poseDetail) return;
    setPreviewBusy(true); setError(null);
    try {
      const response = await fetch(`/api/studio/pose-library/poses/${encodeURIComponent(poseDetail.id)}/previews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variantCount }) });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Failed to generate preview');
      setPoseDetail(data.pose ?? poseDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setPreviewBusy(false);
    }
  }

  async function setPrimaryPreview(candidateId: string) {
    const response = await fetch(`/api/studio/pose-library/previews/${encodeURIComponent(candidateId)}/set-primary`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok || !data?.success) { setError(data?.error || 'Failed to set primary preview'); return; }
    if (route.level === 'poseLibraryPose') await refreshPoseDetail(route.poseId);
  }

  async function deletePreview(candidateId: string) {
    const response = await fetch(`/api/studio/pose-library/previews/${encodeURIComponent(candidateId)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok || !data?.success) { setError(data?.error || 'Failed to delete preview'); return; }
    if (route.level === 'poseLibraryPose') await refreshPoseDetail(route.poseId);
  }

  function setOpenPoseSource(file: File | null) {
    if (!file) return;
    if (openPoseSourcePreviewUrl) URL.revokeObjectURL(openPoseSourcePreviewUrl);
    setOpenPoseSourceFile(file);
    setOpenPoseSourcePreviewUrl(URL.createObjectURL(file));
    setOpenPoseMessage('');
    setError(null);
  }

  function handleOpenPosePaste(event: React.ClipboardEvent) {
    const item = Array.from(event.clipboardData?.items || []).find((entry) => entry.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (!file) return;
    event.preventDefault();
    setOpenPoseSource(file);
  }

  async function uploadOpenPoseSourceFile() {
    if (!openPoseSourceFile) throw new Error('Select or paste an image first');
    const formData = new FormData();
    formData.append('file', openPoseSourceFile, openPoseSourceFile.name || 'openpose-source.png');
    const response = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await response.json();
    if (!response.ok || !data?.success || typeof data.url !== 'string') throw new Error(data?.error || 'Failed to upload source image');
    return data.url as string;
  }

  async function queueOpenPoseExtract(sourceImageUrl?: string, confirmReplace = false) {
    if (!poseDetail) return;
    setOpenPoseBusy(true); setError(null); setOpenPoseMessage('');
    try {
      const response = await fetch(`/api/studio/pose-library/poses/${encodeURIComponent(poseDetail.id)}/openpose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(sourceImageUrl ? { sourceImageUrl } : {}), ...(confirmReplace ? { confirmReplace: true } : {}) }),
      });
      const data = await response.json();
      if (data?.requiresConfirmation) {
        if (confirm('Pose already has OpenPose data. Replace it?')) await queueOpenPoseExtract(sourceImageUrl, true);
        return;
      }
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Failed to queue OpenPose extraction');
      setPoseDetail(data.pose ?? poseDetail);
      setOpenPoseModalOpen(false);
      setOpenPoseSourceFile(null);
      if (openPoseSourcePreviewUrl) { URL.revokeObjectURL(openPoseSourcePreviewUrl); setOpenPoseSourcePreviewUrl(''); }
      setOpenPosePending(true);
      setOpenPoseMessage(`OpenPose extraction queued${typeof data.jobId === 'string' ? `: ${data.jobId}` : ''}. Data will appear here after the job finishes.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue OpenPose extraction');
    } finally {
      setOpenPoseBusy(false);
    }
  }

  async function extractOpenPoseFromSelectedFile() {
    try {
      const sourceImageUrl = await uploadOpenPoseSourceFile();
      await queueOpenPoseExtract(sourceImageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload source image');
    }
  }

  function startOpenPoseExtraction() {
    if (!poseDetail) return;
    if (poseDetail.primaryPreviewUrl) { void queueOpenPoseExtract(); return; }
    setOpenPoseModalOpen(true);
  }

  async function exportLibrary() {
    if (!activeWorkspaceId) return;
    const params = new URLSearchParams({ workspaceId: activeWorkspaceId });
    if (route.level === 'poseLibraryCategory' || route.level === 'poseLibraryPose') params.set('categoryId', route.categoryId);
    const data = await fetchJson(`/api/studio/pose-library/export?${params.toString()}`, 'Failed to export Pose Library');
    const blob = new Blob([JSON.stringify(data.library, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedCategory?.name || 'studio-pose-library'}.json`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importLibrary() {
    if (!activeWorkspaceId) return;
    let library: unknown;
    try { library = JSON.parse(importText); } catch { setError('Import JSON is invalid'); return; }
    if (importMode === 'replace_all' && !confirm('Replace existing library/category structure? Existing shot snapshots stay functional, but library records and previews are deleted.')) return;
    const response = await fetch('/api/studio/pose-library/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: activeWorkspaceId, categoryId: route.level === 'poseLibraryCategory' || route.level === 'poseLibraryPose' ? route.categoryId : null, mode: importMode, library }) });
    const data = await response.json();
    if (!response.ok || !data?.success) { setError(data?.error || 'Failed to import Pose Library'); return; }
    setImportOpen(false); setImportText(''); await Promise.all([refreshCategories(), refreshPoses()]);
  }

  async function bulkGenerateMissingPreviews() {
    if (!activeWorkspaceId) return;
    const baseBody = { workspaceId: activeWorkspaceId, categoryId: route.level === 'poseLibraryCategory' || route.level === 'poseLibraryPose' ? route.categoryId : null, variantCount };
    const preview = await fetch('/api/studio/pose-library/previews/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(baseBody) });
    const previewData = await preview.json();
    if (!preview.ok || !previewData?.success) { setError(previewData?.error || 'Failed to estimate missing previews'); return; }
    if (!confirm(`${previewData.missingCount} poses × ${variantCount} variants = ${previewData.estimatedImages} images. Queue preview generation?`)) return;
    const response = await fetch('/api/studio/pose-library/previews/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...baseBody, confirmed: true }) });
    const data = await response.json();
    if (!response.ok || !data?.success) { setError(data?.error || 'Failed to queue bulk previews'); return; }
    await Promise.all([refreshCategories(), refreshPoses()]);
  }

  function openNewPose(categoryId?: string) {
    const defaultCategory = categoryId || selectedCategory?.id || categories[0]?.id || '';
    setPoseDraft(createDefaultPoseDraft(defaultCategory));
    setNewPoseOpen(true);
  }

  const showPoses = route.level === 'poseLibraryCategory' || route.level === 'poseLibraryPose' || route.view === 'all';
  const openPoseImageUrl = poseDetail?.openPose.imageUrl || null;

  return <div className="relative min-h-[calc(100vh-180px)] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.015] p-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><div className="text-2xl font-semibold text-white">{route.level === 'poseLibraryPose' ? poseDetail?.title || 'Pose' : selectedCategory?.name || (route.view === 'all' ? 'All poses' : 'Pose Library')}</div><div className="mt-1 text-sm text-white/45">{route.level === 'poseLibraryPose' ? 'Pose detail and preview candidates.' : showPoses ? `${poses.length} poses` : `${categories.length} categories`}</div></div><div className="flex gap-2"><Link href="/studio-sessions/pose-library/all"><Button type="button" variant="outline" className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">All poses</Button></Link><Button type="button" variant="outline" onClick={() => setToolbarOpen(true)} className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"><SlidersHorizontal className="mr-2 h-4 w-4" />Tools</Button></div></div>{error ? <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}{loading ? <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-white/50">Loading Pose Library…</div> : route.level === 'poseLibraryPose' ? <Card className="border-white/10 bg-white/[0.035] text-white"><CardContent className="space-y-5 p-6"><div className="grid gap-5 lg:grid-cols-[320px_1fr]"><div className="space-y-3"><div className="overflow-hidden rounded-3xl border border-white/10 bg-black/25">{poseDetail?.primaryPreviewUrl ? <img src={poseDetail.primaryPreviewUrl} alt={poseDetail.title} className="h-auto w-full object-contain" /> : openPoseImageUrl ? <img src={openPoseImageUrl} alt={`${poseDetail?.title || 'Pose'} OpenPose`} className="h-auto w-full object-contain" /> : <div className="flex aspect-[4/5] flex-col items-center justify-center gap-3 text-white/45"><ImageIcon className="h-10 w-10" /><span>Missing preview</span></div>}</div>{poseDetail?.primaryPreviewUrl && openPoseImageUrl ? <div className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-cyan-500/10"><img src={openPoseImageUrl} alt={`${poseDetail.title} OpenPose`} className="h-auto w-full object-contain" /><div className="px-3 py-2 text-xs text-cyan-100/65">OpenPose control</div></div> : null}<Button type="button" onClick={startOpenPoseExtraction} disabled={openPoseBusy || !poseDetail} className="w-full bg-cyan-500 text-white hover:bg-cyan-400 disabled:opacity-50">{openPoseBusy ? 'Queueing OpenPose…' : poseDetail?.primaryPreviewUrl ? 'Extract OpenPose from primary preview' : 'Extract OpenPose from image…'}</Button>{openPoseMessage ? <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100/70">{openPoseMessage}</div> : null}</div><div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Info label="Category" value={poseDetail?.categoryName} /><Info label="Orientation" value={poseDetail?.orientation} /><Info label="Framing" value={poseDetail?.framing} /><Info label="Camera angle" value={poseDetail?.cameraAngle} /><Info label="Shot distance" value={poseDetail?.shotDistance} /><Info label="OpenPose" value={poseDetail?.openPose.hasKeypoints ? 'Keypoints attached' : poseDetail?.openPose.hasOpenPoseImage ? 'Image only' : 'Text-only'} /></div><div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs uppercase tracking-[0.16em] text-white/35">Pose prompt</div><div className="mt-2 whitespace-pre-wrap text-sm text-white/75">{poseDetail?.posePrompt || 'Not set'}</div></div><div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => setPreviewCandidatesOpen((open) => !open)} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-2 text-sm font-semibold text-blue-100"><span>{previewCandidatesOpen ? '▾' : '▸'}</span><span>Preview candidates</span><span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[11px] text-blue-100/70">{poseDetail?.previewCandidates?.length ?? 0}</span></div><div className="mt-1 text-xs text-blue-100/60">Generate references for this pose. Existing shots keep saved pose snapshots.</div></button><Button type="button" onClick={() => void generatePosePreview()} disabled={previewBusy} className="bg-blue-500 text-white hover:bg-blue-400">{previewBusy ? 'Queueing…' : 'Generate preview'}</Button></div>{previewCandidatesOpen ? <div className="mt-4 flex flex-wrap gap-2">{poseDetail?.previewCandidates?.map((candidate) => <div key={candidate.id} className="w-28 overflow-hidden rounded-xl border border-white/10 bg-black/25"><img src={candidate.assetUrl || candidate.thumbnailUrl} alt="Pose preview candidate" className="h-auto w-full object-contain" /><div className="grid gap-1 p-1.5"><Button type="button" size="sm" variant="ghost" onClick={() => void setPrimaryPreview(candidate.id)} className="h-7 px-2 text-[11px] text-white/70 hover:bg-white/[0.06] hover:text-white">{candidate.id === poseDetail.primaryPreviewId ? 'Primary' : 'Set primary'}</Button><Button type="button" size="sm" variant="ghost" onClick={() => void deletePreview(candidate.id)} className="h-7 px-2 text-[11px] text-red-200/70 hover:bg-red-500/10 hover:text-red-100">Delete</Button></div></div>)}{!poseDetail?.previewCandidates?.length ? <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/45">No candidates yet.</div> : null}</div> : null}</div></div></div></CardContent></Card> : showPoses ? <TileGrid><AddTile label="New pose" onClick={() => openNewPose()} />{poses.map((pose) => <PoseTile key={pose.id} pose={pose} categoryId={pose.categoryId} dragging={draggingPoseId === pose.id} onDragStart={() => setDraggingPoseId(pose.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => void dropPose(pose.id)} onDragEnd={() => setDraggingPoseId(null)} onDelete={() => void deletePose(pose.id)} onDuplicate={() => void duplicatePose(pose.id)} onMoveUp={() => void movePose(pose.id, -1)} onMoveDown={() => void movePose(pose.id, 1)} />)}{poses.length === 0 ? <EmptyTile title="No poses yet" description="Create or import poses for this category." /> : null}</TileGrid> : <TileGrid><AddTile label="New category" onClick={() => setNewCategoryOpen(true)} />{categories.map((category) => <Link key={category.id} href={`/studio-sessions/pose-library/categories/${category.id}`} draggable onDragStart={() => setDraggingCategoryId(category.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void dropCategory(category.id); }} onDragEnd={() => setDraggingCategoryId(null)} className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] transition hover:border-white/25 hover:bg-white/[0.06] ${draggingCategoryId === category.id ? 'opacity-45 ring-2 ring-blue-400/60' : ''}`}><div className="absolute right-3 top-3 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100"><Button type="button" size="icon" variant="ghost" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void moveCategory(category.id, -1); }} className="h-8 w-8 bg-black/35 text-white/70 hover:bg-black/55 hover:text-white"><ArrowUp className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void moveCategory(category.id, 1); }} className="h-8 w-8 bg-black/35 text-white/70 hover:bg-black/55 hover:text-white"><ArrowDown className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void deleteCategory(category.id); }} className="h-8 w-8 bg-black/35 text-white/70 hover:bg-red-500/20 hover:text-red-200"><Trash2 className="h-4 w-4" /></Button></div><div className="aspect-[4/3] bg-black/30">{category.coverImageUrl ? <img src={category.coverImageUrl} alt={category.name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-white/35"><Filter className="h-10 w-10" /></div>}</div><div className="space-y-2 p-4"><div className="truncate text-base font-semibold text-white">{category.name}</div><div className="text-xs text-white/50">{category.poseCount} poses · {category.missingPreviewCount} missing previews</div><div className="line-clamp-2 text-xs text-white/35">{category.description || 'Pose Set category'}</div></div></Link>)}</TileGrid>}<Toolbar open={toolbarOpen} onClose={() => setToolbarOpen(false)} query={query} onQueryChange={setQuery} previewFilter={previewFilter} onPreviewFilterChange={setPreviewFilter} variantCount={variantCount} onVariantCountChange={setVariantCount} onExport={() => void exportLibrary()} onOpenImport={() => setImportOpen(true)} onBulkGenerate={() => void bulkGenerateMissingPreviews()} /><Dialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen}><DialogContent className="border-white/10 bg-[#101014] text-white"><DialogHeader><DialogTitle>New pose category</DialogTitle></DialogHeader><Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} className="border-white/10 bg-black/30 text-white" placeholder="Category name" /><Button onClick={() => void createCategory()} className="bg-blue-500 text-white hover:bg-blue-400">Create</Button></DialogContent></Dialog><Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent className="max-w-3xl border-white/10 bg-[#101014] text-white"><DialogHeader><DialogTitle>Import Pose Library JSON</DialogTitle></DialogHeader><div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-white/50"><pre className="whitespace-pre-wrap">{`{\n  "categories": [{\n    "name": "Standing",\n    "description": "Standing poses",\n    "poses": [{\n      "title": "Relaxed contrapposto",\n      "tags": ["standing", "relaxed"],\n      "orientation": "portrait",\n      "framing": "full_body",\n      "cameraAngle": "three_quarter",\n      "shotDistance": "wide",\n      "posePrompt": "The subject stands in a relaxed contrapposto stance..."\n    }]\n  }]\n}`}</pre></div><select value={importMode} onChange={(event) => setImportMode(event.target.value as 'merge' | 'replace_all')} className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white"><option value="merge">Merge as new records</option><option value="replace_all">Replace all in current scope</option></select><textarea value={importText} onChange={(event) => setImportText(event.target.value)} className="min-h-60 rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white" placeholder="Paste structure-only JSON here" /><Button onClick={() => void importLibrary()} className="bg-blue-500 text-white hover:bg-blue-400">Import</Button></DialogContent></Dialog><Dialog open={newPoseOpen} onOpenChange={setNewPoseOpen}><DialogContent className="max-w-2xl border-white/10 bg-[#101014] text-white"><DialogHeader><DialogTitle>New pose</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Input value={poseDraft.title} onChange={(event) => setPoseDraft((draft) => ({ ...draft, title: event.target.value }))} className="border-white/10 bg-black/30 text-white" placeholder="Pose title" /><select value={poseDraft.categoryId} onChange={(event) => setPoseDraft((draft) => ({ ...draft, categoryId: event.target.value }))} className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Input value={poseDraft.tags} onChange={(event) => setPoseDraft((draft) => ({ ...draft, tags: event.target.value }))} className="border-white/10 bg-black/30 text-white sm:col-span-2" placeholder="tags, comma separated" /><textarea value={poseDraft.posePrompt} onChange={(event) => setPoseDraft((draft) => ({ ...draft, posePrompt: event.target.value }))} className="min-h-28 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white sm:col-span-2" placeholder="Pose prompt" /><select value={poseDraft.orientation} onChange={(event) => setPoseDraft((draft) => ({ ...draft, orientation: event.target.value as PoseDraft['orientation'] }))} className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white"><option value="portrait">portrait</option><option value="landscape">landscape</option><option value="square">square</option></select><select value={poseDraft.framing} onChange={(event) => setPoseDraft((draft) => ({ ...draft, framing: event.target.value as PoseDraft['framing'] }))} className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white"><option value="full_body">full body</option><option value="three_quarter">three quarter</option><option value="half_body">upper/half body</option><option value="portrait">portrait</option></select></div><Button onClick={() => void createPose()} disabled={!poseDraft.categoryId} className="bg-blue-500 text-white hover:bg-blue-400">Create pose</Button></DialogContent></Dialog><Dialog open={openPoseModalOpen} onOpenChange={(open) => { if (!openPoseBusy) setOpenPoseModalOpen(open); }}><DialogContent className="max-w-2xl border-white/10 bg-[#101014] text-white"><DialogHeader><DialogTitle>Extract OpenPose from image</DialogTitle></DialogHeader><div className="space-y-3" onPaste={handleOpenPosePaste}><div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/55">No primary preview is available. Upload an image or press Ctrl+V to paste one, then extract OpenPose data into this pose.</div><div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" onClick={() => openPoseFileInputRef.current?.click()} disabled={openPoseBusy} className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">Choose image</Button><input ref={openPoseFileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => setOpenPoseSource(event.target.files?.[0] || null)} /><span className="text-xs text-white/45">or paste with Ctrl+V</span></div>{openPoseSourcePreviewUrl ? <img src={openPoseSourcePreviewUrl} alt="OpenPose source preview" className="max-h-80 rounded-2xl border border-white/10 object-contain" /> : <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/45">No image selected.</div>}</div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpenPoseModalOpen(false)} disabled={openPoseBusy} className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">Cancel</Button><Button type="button" onClick={() => void extractOpenPoseFromSelectedFile()} disabled={openPoseBusy || !openPoseSourceFile} className="bg-cyan-500 text-white hover:bg-cyan-400 disabled:opacity-50">{openPoseBusy ? 'Queueing…' : 'Extract'}</Button></div></DialogContent></Dialog></div>;
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</div><div className="mt-2 text-sm text-white/75">{value || 'Not set'}</div></div>;
}
