'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowPathIcon, ArrowUturnLeftIcon, ClipboardDocumentIcon, DocumentDuplicateIcon, PlusIcon, TrashIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useStudio } from '@/lib/context/StudioContext';
import type { CharacterSummary } from '@/lib/characters/types';
import type { VibePresetSummary } from '@/lib/vibes/types';
import type { PosePresetSummary } from '@/lib/poses/types';
import type { SceneCharacterBindingSummary, ScenePresetSummary } from '@/lib/scenes/types';

type SceneListMode = 'active' | 'trash';
type CharacterCountFilter = 'all' | 1 | 2 | 3;

type DraftBinding = {
  id: string | null;
  slot: number;
  roleLabel: string;
  characterPresetId: string | null;
  overrideInstructions: string;
};

type DraftScene = {
  id: string | null;
  workspaceId: string | null;
  name: string;
  summary: string;
  characterCount: 1 | 2 | 3;
  tags: string[];
  posePresetId: string | null;
  vibePresetId: string | null;
  sceneInstructions: string;
  generatedScenePrompt: string;
  latestPreviewImageUrl: string | null;
  latestPreviewJobId: string | null;
  bindings: DraftBinding[];
  baseline: string;
};

type PendingNavigation =
  | { kind: 'select'; scene: ScenePresetSummary }
  | { kind: 'new' }
  | { kind: 'clone' }
  | { kind: 'switch_mode'; mode: SceneListMode }
  | { kind: 'close_manager' };

function normalizeChip(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function applyChipInput(current: string[], rawValue: string): { values: string[]; reset: boolean } {
  const normalized = normalizeChip(rawValue.replace(/,+$/, ''));
  if (!normalized) return { values: current, reset: rawValue.endsWith(',') };
  if (current.includes(normalized)) return { values: current, reset: true };
  return { values: [...current, normalized], reset: true };
}

function makeBindings(count: 1 | 2 | 3): DraftBinding[] {
  return Array.from({ length: count }, (_, index) => ({
    id: null,
    slot: index,
    roleLabel: '',
    characterPresetId: null,
    overrideInstructions: '',
  }));
}

function baselineFromDraft(draft: Omit<DraftScene, 'baseline'>): string {
  return JSON.stringify({
    name: draft.name.trim(),
    summary: draft.summary.trim(),
    characterCount: draft.characterCount,
    tags: draft.tags,
    posePresetId: draft.posePresetId,
    vibePresetId: draft.vibePresetId,
    sceneInstructions: draft.sceneInstructions.trim(),
    generatedScenePrompt: draft.generatedScenePrompt.trim(),
    latestPreviewImageUrl: draft.latestPreviewImageUrl,
    latestPreviewJobId: draft.latestPreviewJobId,
    bindings: draft.bindings.map((binding) => ({
      slot: binding.slot,
      roleLabel: binding.roleLabel.trim(),
      characterPresetId: binding.characterPresetId,
      overrideInstructions: binding.overrideInstructions.trim(),
    })),
  });
}

function emptyDraft(workspaceId: string | null): DraftScene {
  const draft = {
    id: null,
    workspaceId,
    name: '',
    summary: '',
    characterCount: 1 as 1,
    tags: [],
    posePresetId: null,
    vibePresetId: null,
    sceneInstructions: '',
    generatedScenePrompt: '',
    latestPreviewImageUrl: null,
    latestPreviewJobId: null,
    bindings: makeBindings(1),
  };

  return {
    ...draft,
    baseline: baselineFromDraft(draft),
  };
}

function buildDraft(scene: ScenePresetSummary): DraftScene {
  const draft = {
    id: scene.id,
    workspaceId: scene.workspaceId,
    name: scene.name,
    summary: scene.summary,
    characterCount: scene.characterCount,
    tags: [...scene.tags],
    posePresetId: scene.posePresetId,
    vibePresetId: scene.vibePresetId,
    sceneInstructions: scene.sceneInstructions,
    generatedScenePrompt: scene.generatedScenePrompt,
    latestPreviewImageUrl: scene.latestPreviewImageUrl,
    latestPreviewJobId: scene.latestPreviewJobId,
    bindings: scene.characterBindings.map((binding) => ({
      id: binding.id,
      slot: binding.slot,
      roleLabel: binding.roleLabel || '',
      characterPresetId: binding.characterPresetId,
      overrideInstructions: binding.overrideInstructions || '',
    })),
  };

  while (draft.bindings.length < draft.characterCount) {
    draft.bindings.push({
      id: null,
      slot: draft.bindings.length,
      roleLabel: '',
      characterPresetId: null,
      overrideInstructions: '',
    });
  }

  return {
    ...draft,
    baseline: baselineFromDraft(draft),
  };
}

function cloneDraft(source: DraftScene): DraftScene {
  const draft = {
    ...source,
    id: null,
    name: source.name.trim() ? `${source.name.trim()} Copy` : 'Untitled Scene Copy',
    latestPreviewImageUrl: null,
    latestPreviewJobId: null,
    bindings: source.bindings.map((binding, index) => ({ ...binding, id: null, slot: index })),
  };

  return {
    ...draft,
    baseline: baselineFromDraft({ ...draft, name: '', summary: '', generatedScenePrompt: '', latestPreviewImageUrl: null, latestPreviewJobId: null, tags: [], sceneInstructions: '', posePresetId: null, vibePresetId: null, bindings: makeBindings(draft.characterCount) }),
  };
}

function matchesSearch(scene: ScenePresetSummary, query: string): boolean {
  if (!query) return true;
  const haystack = [scene.name, scene.summary, scene.generatedScenePrompt, ...scene.tags].join(' ').toLowerCase();
  return haystack.includes(query);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function SceneManagerPanel({ onRequestClose }: { onRequestClose?: () => void }) {
  const { activeWorkspaceId } = useStudio();
  const { showToast } = useToast();

  const [scenes, setScenes] = useState<ScenePresetSummary[]>([]);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [poses, setPoses] = useState<PosePresetSummary[]>([]);
  const [vibes, setVibes] = useState<VibePresetSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssembling, setIsAssembling] = useState(false);
  const [search, setSearch] = useState('');
  const [listMode, setListMode] = useState<SceneListMode>('active');
  const [countFilter, setCountFilter] = useState<CharacterCountFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftScene>(emptyDraft(activeWorkspaceId));
  const [tagInput, setTagInput] = useState('');
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [isDirtyGuardOpen, setIsDirtyGuardOpen] = useState(false);
  const [assembleWarnings, setAssembleWarnings] = useState<string[]>([]);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const filteredScenes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scenes.filter((scene) => {
      if (!matchesSearch(scene, query)) return false;
      if (countFilter === 'all') return true;
      return scene.characterCount === countFilter;
    });
  }, [countFilter, scenes, search]);

  const selectedScene = useMemo(() => scenes.find((scene) => scene.id === selectedId) || null, [scenes, selectedId]);
  const isDirty = useMemo(() => baselineFromDraft({ ...draft, baseline: '' }) !== draft.baseline, [draft]);
  const hasBoundCharacter = useMemo(() => draft.bindings.some((binding) => !!binding.characterPresetId), [draft.bindings]);
  const isValid = !!activeWorkspaceId && !!draft.name.trim() && !!draft.summary.trim() && !!draft.generatedScenePrompt.trim() && hasBoundCharacter;
  const canSave = isDirty && isValid && listMode === 'active';

  const poseOptions = useMemo(
    () => poses.filter((pose) => pose.characterCount === draft.characterCount),
    [poses, draft.characterCount],
  );

  const focusNameSoon = () => {
    window.requestAnimationFrame(() => nameInputRef.current?.focus());
  };

  const refreshReferenceData = async () => {
    const [charactersResponse, posesResponse, vibesResponse] = await Promise.all([
      fetch('/api/characters', { cache: 'no-store' }),
      activeWorkspaceId ? fetch(`/api/poses?workspaceId=${encodeURIComponent(activeWorkspaceId)}&status=active`, { cache: 'no-store' }) : Promise.resolve(new Response(JSON.stringify({ success: true, poses: [] }))),
      fetch('/api/vibes?status=active', { cache: 'no-store' }),
    ]);

    const [charactersData, posesData, vibesData] = await Promise.all([
      charactersResponse.json(),
      posesResponse.json(),
      vibesResponse.json(),
    ]);

    setCharacters(Array.isArray(charactersData.characters) ? charactersData.characters : []);
    setPoses(Array.isArray(posesData.poses) ? posesData.poses : []);
    setVibes(Array.isArray(vibesData.vibes) ? vibesData.vibes : []);
  };

  const loadScenes = async (mode: SceneListMode, preferredId?: string | null) => {
    if (!activeWorkspaceId) {
      setScenes([]);
      setSelectedId(null);
      setDraft(emptyDraft(null));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/scenes?workspaceId=${encodeURIComponent(activeWorkspaceId)}&status=${mode}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load scenes');
      const nextScenes = Array.isArray(data.scenes) ? data.scenes as ScenePresetSummary[] : [];
      setScenes(nextScenes);
      const nextSelectedId = preferredId === undefined
        ? (selectedId && nextScenes.some((item) => item.id === selectedId) ? selectedId : nextScenes[0]?.id || null)
        : preferredId;
      const nextSelectedScene = nextSelectedId ? nextScenes.find((item) => item.id === nextSelectedId) || null : null;
      setSelectedId(nextSelectedScene?.id || null);
      setDraft(nextSelectedScene ? buildDraft(nextSelectedScene) : emptyDraft(activeWorkspaceId));
      setTagInput('');
      setAssembleWarnings([]);
      await refreshReferenceData();
    } catch (error: any) {
      console.error('Failed to load scenes:', error);
      showToast(error?.message || 'Failed to load scenes', 'error');
      setScenes([]);
      setSelectedId(null);
      setDraft(emptyDraft(activeWorkspaceId));
      setAssembleWarnings([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadScenes(listMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listMode, activeWorkspaceId]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    const handleRequestClose = () => {
      requestNavigation({ kind: 'close_manager' });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('scene-manager-request-close', handleRequestClose);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('scene-manager-request-close', handleRequestClose);
    };
  }, [isDirty]);

  const applyNavigation = (nav: PendingNavigation) => {
    if (nav.kind === 'select') {
      setSelectedId(nav.scene.id);
      setDraft(buildDraft(nav.scene));
      setAssembleWarnings([]);
      return;
    }
    if (nav.kind === 'new') {
      setSelectedId(null);
      setDraft(emptyDraft(activeWorkspaceId));
      setTagInput('');
      setAssembleWarnings([]);
      focusNameSoon();
      return;
    }
    if (nav.kind === 'clone') {
      setSelectedId(null);
      setDraft(cloneDraft(draft));
      setTagInput('');
      setAssembleWarnings([]);
      focusNameSoon();
      return;
    }
    if (nav.kind === 'switch_mode') {
      setListMode(nav.mode);
      return;
    }
    if (nav.kind === 'close_manager') {
      onRequestClose?.();
    }
  };

  const requestNavigation = (nav: PendingNavigation) => {
    if (!isDirty) {
      applyNavigation(nav);
      return;
    }
    setPendingNavigation(nav);
    setIsDirtyGuardOpen(true);
  };

  const updateCharacterCount = (characterCount: 1 | 2 | 3) => {
    setDraft((current) => {
      const bindings = current.bindings.slice(0, characterCount).map((binding, index) => ({ ...binding, slot: index }));
      while (bindings.length < characterCount) {
        bindings.push({ id: null, slot: bindings.length, roleLabel: '', characterPresetId: null, overrideInstructions: '' });
      }
      const nextPosePresetId = current.posePresetId && poses.some((pose) => pose.id === current.posePresetId && pose.characterCount === characterCount)
        ? current.posePresetId
        : null;
      return {
        ...current,
        characterCount,
        bindings,
        posePresetId: nextPosePresetId,
      };
    });
  };

  const handleAssemble = async () => {
    setIsAssembling(true);
    setAssembleWarnings([]);
    try {
      const response = await fetch('/api/scenes/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneName: draft.name,
          sceneSummary: draft.summary,
          characterCount: draft.characterCount,
          sceneInstructions: draft.sceneInstructions,
          posePresetId: draft.posePresetId,
          vibePresetId: draft.vibePresetId,
          characterBindings: draft.bindings.map((binding) => ({
            slot: binding.slot,
            roleLabel: binding.roleLabel || null,
            characterPresetId: binding.characterPresetId,
            overrideInstructions: binding.overrideInstructions || null,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to build scene prompt');
      setDraft((current) => ({ ...current, generatedScenePrompt: typeof data.prompt === 'string' ? data.prompt : '' }));
      setAssembleWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      showToast('Scene prompt rebuilt', 'success');
    } catch (error: any) {
      console.error('Failed to build scene prompt:', error);
      showToast(error?.message || 'Failed to build scene prompt', 'error');
    } finally {
      setIsAssembling(false);
    }
  };

  const handleSave = async (afterSave?: () => void) => {
    if (!canSave || !activeWorkspaceId) return false;
    setIsSaving(true);
    try {
      const payload = {
        workspaceId: activeWorkspaceId,
        name: draft.name.trim(),
        summary: draft.summary.trim(),
        characterCount: draft.characterCount,
        tags: draft.tags,
        posePresetId: draft.posePresetId,
        vibePresetId: draft.vibePresetId,
        sceneInstructions: draft.sceneInstructions.trim(),
        generatedScenePrompt: draft.generatedScenePrompt.trim(),
        latestPreviewImageUrl: draft.latestPreviewImageUrl,
        latestPreviewJobId: draft.latestPreviewJobId,
        characterBindings: draft.bindings.map((binding) => ({
          slot: binding.slot,
          roleLabel: binding.roleLabel.trim() || null,
          characterPresetId: binding.characterPresetId,
          overrideInstructions: binding.overrideInstructions.trim() || null,
        })),
      };
      const response = await fetch(draft.id ? `/api/scenes/${draft.id}` : '/api/scenes', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save scene');
      showToast(draft.id ? 'Scene saved' : 'Scene created', 'success');
      await loadScenes(listMode, data.scene.id);
      afterSave?.();
      return true;
    } catch (error: any) {
      console.error('Failed to save scene:', error);
      showToast(error?.message || 'Failed to save scene', 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleTrashAction = async (action: 'soft_delete' | 'restore') => {
    if (!draft.id) return;
    const currentId = draft.id;
    const currentIndex = scenes.findIndex((item) => item.id === currentId);
    const fallbackSelection = scenes[currentIndex + 1]?.id || scenes[currentIndex - 1]?.id || null;

    try {
      const response = await fetch(`/api/scenes/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to update scene');
      showToast(action === 'restore' ? 'Scene restored' : 'Scene moved to trash', 'success');
      await loadScenes(listMode, fallbackSelection);
    } catch (error: any) {
      console.error('Failed to update scene:', error);
      showToast(error?.message || 'Failed to update scene', 'error');
    }
  };

  const selectedPose = poses.find((pose) => pose.id === draft.posePresetId) || null;
  const selectedVibe = vibes.find((vibe) => vibe.id === draft.vibePresetId) || null;

  return (
    <>
      <div className="flex h-full gap-5">
        <div className="flex w-[340px] flex-shrink-0 flex-col rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4 space-y-3">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search scenes" className="h-9" />
            <div className="flex items-center gap-2">
              <Button variant={listMode === 'active' ? 'secondary' : 'outline'} size="sm" onClick={() => requestNavigation({ kind: 'switch_mode', mode: 'active' })}>Active</Button>
              <Button variant={listMode === 'trash' ? 'secondary' : 'outline'} size="sm" onClick={() => requestNavigation({ kind: 'switch_mode', mode: 'trash' })}>Trash</Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant={countFilter === 'all' ? 'secondary' : 'outline'} size="sm" onClick={() => setCountFilter('all')}>All</Button>
              <Button variant={countFilter === 1 ? 'secondary' : 'outline'} size="sm" onClick={() => setCountFilter(1)}>Single</Button>
              <Button variant={countFilter === 2 ? 'secondary' : 'outline'} size="sm" onClick={() => setCountFilter(2)}>Duo</Button>
              <Button variant={countFilter === 3 ? 'secondary' : 'outline'} size="sm" onClick={() => setCountFilter(3)}>Trio</Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="p-3 text-sm text-muted-foreground">Loading scenes...</div>
            ) : filteredScenes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="text-sm text-muted-foreground">{listMode === 'trash' ? 'Trash is empty' : 'No scenes yet'}</div>
                {listMode === 'active' && <Button size="sm" onClick={() => requestNavigation({ kind: 'new' })}><PlusIcon className="mr-2 h-4 w-4" />New</Button>}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredScenes.map((scene) => (
                  <button key={scene.id} type="button" onClick={() => requestNavigation({ kind: 'select', scene })} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${selectedId === scene.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{scene.name}</span>
                      <Badge variant="outline" className="shrink-0">{scene.characterCount === 1 ? 'single' : scene.characterCount === 2 ? 'duo' : 'trio'}</Badge>
                    </div>
                    <div className="mt-1 truncate text-xs opacity-80">{scene.summary}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {scene.posePresetName && <Badge variant="outline" className="text-[10px]">pose</Badge>}
                      {scene.vibePresetName && <Badge variant="outline" className="text-[10px]">vibe</Badge>}
                      {scene.tags.slice(0, 2).map((tag) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
            <Button size="sm" onClick={() => requestNavigation({ kind: 'new' })} disabled={listMode === 'trash'}><PlusIcon className="mr-2 h-4 w-4" />New</Button>
            <Button size="sm" variant="outline" onClick={() => requestNavigation({ kind: 'clone' })} disabled={listMode === 'trash' || !draft.name}><DocumentDuplicateIcon className="mr-2 h-4 w-4" />Clone</Button>
            {listMode === 'trash' ? (
              <Button size="sm" variant="outline" onClick={() => void handleTrashAction('restore')} disabled={!selectedScene}><ArrowUturnLeftIcon className="mr-2 h-4 w-4" />Restore</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void handleTrashAction('soft_delete')} disabled={!selectedScene || !draft.id}><TrashIcon className="mr-2 h-4 w-4" />Delete</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => void handleAssemble()} disabled={listMode === 'trash' || isAssembling}><ArrowPathIcon className="mr-2 h-4 w-4" />{isAssembling ? 'Building...' : 'Build prompt'}</Button>
            <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(draft.generatedScenePrompt || ''); showToast('Prompt copied', 'success'); }} disabled={!draft.generatedScenePrompt}><ClipboardDocumentIcon className="mr-2 h-4 w-4" />Copy prompt</Button>
            <div className="ml-auto flex items-center gap-3">
              <div className="text-xs text-muted-foreground">{listMode === 'trash' ? 'Read-only trash view' : (isDirty ? 'Unsaved changes' : 'Saved')}</div>
              <Button size="sm" onClick={() => void handleSave()} disabled={!canSave || isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="mx-auto max-w-6xl space-y-5">
              {!activeWorkspaceId && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Select or create a workspace before using Scene Manager.</div>
              )}

              {selectedScene && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-xs text-muted-foreground">
                  <Badge variant="outline">{selectedScene.characterCount === 1 ? 'single' : selectedScene.characterCount === 2 ? 'duo' : 'trio'}</Badge>
                  {selectedScene.posePresetName && <Badge variant="outline">pose linked</Badge>}
                  {selectedScene.vibePresetName && <Badge variant="outline">vibe linked</Badge>}
                  <span>Updated {formatDate(selectedScene.updatedAt)}</span>
                </div>
              )}

              {!selectedScene && !draft.name && listMode === 'active' && (
                <div className="rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                  Start with <span className="font-medium text-foreground">New</span>, bind characters into slots, optionally link a pose and vibe, then build the scene prompt.
                </div>
              )}

              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-5">
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scene name</div>
                      <Input ref={nameInputRef} value={draft.name} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Scene name" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</div>
                      <Input value={draft.summary} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="Short reusable summary" />
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-3">
                    <div className="space-y-2 lg:col-span-1">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Character count</div>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3].map((count) => (
                          <Button key={count} type="button" size="sm" variant={draft.characterCount === count ? 'secondary' : 'outline'} disabled={listMode === 'trash'} onClick={() => updateCharacterCount(count as 1 | 2 | 3)}>{count === 1 ? 'Single' : count === 2 ? 'Duo' : 'Trio'}</Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tags</div>
                      <div className="rounded-lg border border-border bg-background p-2">
                        <div className="mb-2 flex flex-wrap gap-2">
                          {draft.tags.map((value) => (
                            <span key={value} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-2 py-1 text-xs text-foreground">
                              {value}
                              {listMode !== 'trash' && <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== value) }))}>×</button>}
                            </span>
                          ))}
                        </div>
                        <Input
                          value={tagInput}
                          disabled={listMode === 'trash'}
                          onChange={(event) => setTagInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ',') {
                              event.preventDefault();
                              const next = applyChipInput(draft.tags, tagInput || event.key);
                              setDraft((current) => ({ ...current, tags: next.values }));
                              if (next.reset) setTagInput('');
                            } else if (event.key === 'Backspace' && !tagInput && draft.tags.length > 0) {
                              setDraft((current) => ({ ...current, tags: current.tags.slice(0, -1) }));
                            }
                          }}
                          onBlur={() => {
                            const next = applyChipInput(draft.tags, tagInput);
                            setDraft((current) => ({ ...current, tags: next.values }));
                            if (next.reset) setTagInput('');
                          }}
                          placeholder="Type and press Enter or comma"
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <UserGroupIcon className="h-4 w-4" />
                      Character slots
                    </div>
                    <div className="space-y-4">
                      {draft.bindings.map((binding, index) => {
                        const selectedCharacter = characters.find((character) => character.id === binding.characterPresetId) || null;
                        return (
                          <div key={index} className="rounded-xl border border-border bg-background p-4 space-y-3">
                            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Role label</div>
                                <Input value={binding.roleLabel} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, bindings: current.bindings.map((item, itemIndex) => itemIndex === index ? { ...item, roleLabel: event.target.value } : item) }))} placeholder={`Character ${index + 1}`} className="h-9" />
                              </div>
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Character preset</div>
                                <select value={binding.characterPresetId || ''} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, bindings: current.bindings.map((item, itemIndex) => itemIndex === index ? { ...item, characterPresetId: event.target.value || null } : item) }))} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                                  <option value="">Unbound</option>
                                  {characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground min-h-[44px]">
                              {selectedCharacter ? `${selectedCharacter.name}${selectedCharacter.gender ? `, ${selectedCharacter.gender}` : ''}` : 'No character selected for this slot yet.'}
                            </div>
                            <div className="space-y-1">
                              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Override instructions</div>
                              <textarea value={binding.overrideInstructions} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, bindings: current.bindings.map((item, itemIndex) => itemIndex === index ? { ...item, overrideInstructions: event.target.value } : item) }))} placeholder="Optional scene-specific override for this character slot" className="min-h-[84px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-xl border border-border bg-background p-4 space-y-4">
                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Linked pose</div>
                      <select value={draft.posePresetId || ''} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, posePresetId: event.target.value || null }))} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                        <option value="">No pose</option>
                        {poseOptions.map((pose) => <option key={pose.id} value={pose.id}>{pose.name}</option>)}
                      </select>
                      {selectedPose && <div className="text-xs text-muted-foreground">{selectedPose.summary}</div>}
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Linked vibe</div>
                      <select value={draft.vibePresetId || ''} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, vibePresetId: event.target.value || null }))} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                        <option value="">No vibe</option>
                        {vibes.map((vibe) => <option key={vibe.id} value={vibe.id}>{vibe.name}</option>)}
                      </select>
                      {selectedVibe && <div className="text-xs text-muted-foreground">{selectedVibe.baseDescription}</div>}
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scene instructions</div>
                      <textarea value={draft.sceneInstructions} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, sceneInstructions: event.target.value }))} placeholder="Director note for the whole scene" className="min-h-[150px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Generated scene prompt</div>
                      <Button type="button" size="sm" variant="outline" disabled={listMode === 'trash' || isAssembling} onClick={() => void handleAssemble()}>
                        <ArrowPathIcon className="mr-2 h-4 w-4" />
                        {isAssembling ? 'Building...' : 'Rebuild'}
                      </Button>
                    </div>
                    <textarea value={draft.generatedScenePrompt} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, generatedScenePrompt: event.target.value }))} placeholder="Template-assembled scene prompt" className="min-h-[280px] w-full rounded-lg border border-border bg-card px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60" />
                    {assembleWarnings.length > 0 && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                        <div className="font-medium mb-1">Assembly warnings</div>
                        <ul className="list-disc pl-5 space-y-1">
                          {assembleWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                        </ul>
                      </div>
                    )}
                    {!draft.generatedScenePrompt && (
                      <div className="rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                        Build the prompt after choosing scene inputs. You can still edit the result manually before saving.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isDirtyGuardOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDirtyGuardOpen(false);
          setPendingNavigation(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Unsaved changes</DialogTitle>
            <DialogDescription>
              Save this scene before leaving it, discard changes, or cancel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDirtyGuardOpen(false); setPendingNavigation(null); }}>Cancel</Button>
            <Button variant="outline" onClick={() => { const next = pendingNavigation; setIsDirtyGuardOpen(false); setPendingNavigation(null); if (next) applyNavigation(next); }}>Discard</Button>
            <Button onClick={async () => {
              if (!canSave) {
                showToast('Name, summary, prompt, and at least one bound character are required before saving', 'error');
                return;
              }
              const next = pendingNavigation;
              const saved = await handleSave(() => {
                setIsDirtyGuardOpen(false);
                setPendingNavigation(null);
                if (next) applyNavigation(next);
              });
              if (!saved) return;
            }} disabled={isSaving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
