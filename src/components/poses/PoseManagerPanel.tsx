'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowPathIcon, ArrowUturnLeftIcon, ClipboardDocumentIcon, DocumentDuplicateIcon, PlusIcon, SparklesIcon, TrashIcon, UserIcon, UsersIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useStudio } from '@/lib/context/StudioContext';
import type { PoseCharacter, PoseExtractResult, PosePresetSummary } from '@/lib/poses/types';

type PoseListMode = 'active' | 'trash';
type CharacterCountFilter = 'all' | 1 | 2 | 3;

type DraftPose = {
  id: string | null;
  workspaceId: string | null;
  name: string;
  characterCount: 1 | 2 | 3;
  summary: string;
  posePrompt: string;
  tags: string[];
  source: 'manual' | 'extracted';
  sourceImageUrl: string | null;
  modelHint: string | null;
  characters: PoseCharacter[];
  relationship: {
    spatialLayout: string;
    interaction: string;
    contact: string;
    symmetry: string;
  } | null;
  baseline: string;
};

type PendingNavigation =
  | { kind: 'select'; pose: PosePresetSummary }
  | { kind: 'new' }
  | { kind: 'clone' }
  | { kind: 'switch_mode'; mode: PoseListMode };

function emptyCharacter(index: number): PoseCharacter {
  return {
    index,
    label: null,
    orientation: '',
    head: '',
    gaze: '',
    torso: '',
    armsHands: '',
    legsStance: '',
    expression: null,
  };
}

function makeCharacters(count: 1 | 2 | 3): PoseCharacter[] {
  return Array.from({ length: count }, (_, index) => emptyCharacter(index));
}

function emptyDraft(workspaceId: string | null): DraftPose {
  return {
    id: null,
    workspaceId,
    name: '',
    characterCount: 1,
    summary: '',
    posePrompt: '',
    tags: [],
    source: 'manual',
    sourceImageUrl: null,
    modelHint: null,
    characters: makeCharacters(1),
    relationship: null,
    baseline: JSON.stringify({ name: '', characterCount: 1, summary: '', posePrompt: '', tags: [], sourceImageUrl: null, modelHint: null, characters: makeCharacters(1), relationship: null }),
  };
}

function buildDraft(pose: PosePresetSummary): DraftPose {
  return {
    id: pose.id,
    workspaceId: pose.workspaceId,
    name: pose.name,
    characterCount: pose.characterCount,
    summary: pose.summary,
    posePrompt: pose.posePrompt,
    tags: [...pose.tags],
    source: pose.source,
    sourceImageUrl: pose.sourceImageUrl,
    modelHint: pose.modelHint,
    characters: pose.characters.map((character) => ({ ...character })),
    relationship: pose.relationship ? { ...pose.relationship } : null,
    baseline: JSON.stringify({
      name: pose.name,
      characterCount: pose.characterCount,
      summary: pose.summary,
      posePrompt: pose.posePrompt,
      tags: pose.tags,
      sourceImageUrl: pose.sourceImageUrl,
      modelHint: pose.modelHint,
      characters: pose.characters,
      relationship: pose.relationship,
    }),
  };
}

function cloneDraft(source: DraftPose): DraftPose {
  return {
    ...source,
    id: null,
    name: source.name.trim() ? `${source.name.trim()} Copy` : 'Untitled Pose Copy',
    baseline: JSON.stringify({ name: '', characterCount: source.characterCount, summary: '', posePrompt: '', tags: [], sourceImageUrl: null, modelHint: null, characters: makeCharacters(source.characterCount), relationship: source.characterCount > 1 ? { spatialLayout: '', interaction: '', contact: '', symmetry: '' } : null }),
  };
}

function normalizeChip(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function applyChipInput(current: string[], rawValue: string): { values: string[]; reset: boolean } {
  const normalized = normalizeChip(rawValue.replace(/,+$/, ''));
  if (!normalized) return { values: current, reset: rawValue.endsWith(',') };
  if (current.includes(normalized)) return { values: current, reset: true };
  return { values: [...current, normalized], reset: true };
}

function formatRelativeDate(value: string | null | undefined): string {
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

function draftFingerprint(draft: DraftPose | null): string {
  if (!draft) return '';
  return JSON.stringify({
    name: draft.name.trim(),
    characterCount: draft.characterCount,
    summary: draft.summary.trim(),
    posePrompt: draft.posePrompt.trim(),
    tags: draft.tags,
    sourceImageUrl: draft.sourceImageUrl,
    modelHint: draft.modelHint,
    characters: draft.characters,
    relationship: draft.relationship,
  });
}

function matchesSearch(pose: PosePresetSummary, query: string): boolean {
  if (!query) return true;
  const haystack = [pose.name, pose.summary, pose.posePrompt, ...pose.tags].join(' ').toLowerCase();
  return haystack.includes(query);
}

export default function PoseManagerPanel({ onRequestClose }: { onRequestClose?: () => void }) {
  const { activeWorkspaceId } = useStudio();
  const { showToast } = useToast();
  const [poses, setPoses] = useState<PosePresetSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [listMode, setListMode] = useState<PoseListMode>('active');
  const [countFilter, setCountFilter] = useState<CharacterCountFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftPose>(emptyDraft(activeWorkspaceId));
  const [tagInput, setTagInput] = useState('');
  const [isExtractOpen, setIsExtractOpen] = useState(false);
  const [extractImageUrl, setExtractImageUrl] = useState('');
  const [extractImageDataUrl, setExtractImageDataUrl] = useState<string>('');
  const [extractFileName, setExtractFileName] = useState('');
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [isDirtyGuardOpen, setIsDirtyGuardOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredPoses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return poses.filter((pose) => {
      if (!matchesSearch(pose, query)) return false;
      if (countFilter === 'all') return true;
      return pose.characterCount === countFilter;
    });
  }, [countFilter, poses, search]);

  const selectedPose = useMemo(() => poses.find((item) => item.id === selectedId) || null, [poses, selectedId]);
  const isDirty = useMemo(() => draftFingerprint(draft) !== draft.baseline, [draft]);
  const isValid = !!activeWorkspaceId && !!draft.name.trim() && !!draft.summary.trim() && !!draft.posePrompt.trim();
  const canSave = isDirty && isValid && listMode === 'active';

  const focusNameSoon = () => {
    window.requestAnimationFrame(() => nameInputRef.current?.focus());
  };

  const loadPoses = async (mode: PoseListMode, preferredId?: string | null) => {
    if (!activeWorkspaceId) {
      setPoses([]);
      setSelectedId(null);
      setDraft(emptyDraft(null));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/poses?workspaceId=${encodeURIComponent(activeWorkspaceId)}&status=${mode}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load poses');
      const nextPoses = Array.isArray(data.poses) ? data.poses as PosePresetSummary[] : [];
      setPoses(nextPoses);
      const nextSelectedId = preferredId === undefined
        ? (selectedId && nextPoses.some((item) => item.id === selectedId) ? selectedId : nextPoses[0]?.id || null)
        : preferredId;
      const nextSelectedPose = nextSelectedId ? nextPoses.find((item) => item.id === nextSelectedId) || null : null;
      setSelectedId(nextSelectedPose?.id || null);
      setDraft(nextSelectedPose ? buildDraft(nextSelectedPose) : emptyDraft(activeWorkspaceId));
      setTagInput('');
    } catch (error: any) {
      console.error('Failed to load poses:', error);
      showToast(error?.message || 'Failed to load poses', 'error');
      setPoses([]);
      setSelectedId(null);
      setDraft(emptyDraft(activeWorkspaceId));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPoses(listMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listMode, activeWorkspaceId]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    const handleRequestClose = () => {
      if (!isDirty) {
        onRequestClose?.();
        return;
      }
      setPendingNavigation(null);
      setIsDirtyGuardOpen(true);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const isSaveKey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's';
      if (!isSaveKey) return;
      event.preventDefault();
      if (canSave && !isSaving) {
        void handleSave();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pose-manager-request-close', handleRequestClose);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pose-manager-request-close', handleRequestClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canSave, isDirty, isSaving, onRequestClose]);

  const applyNavigation = (nav: PendingNavigation) => {
    if (nav.kind === 'select') {
      setSelectedId(nav.pose.id);
      setDraft(buildDraft(nav.pose));
      return;
    }
    if (nav.kind === 'new') {
      setSelectedId(null);
      setDraft(emptyDraft(activeWorkspaceId));
      setTagInput('');
      focusNameSoon();
      return;
    }
    if (nav.kind === 'clone') {
      setSelectedId(null);
      setDraft(cloneDraft(draft));
      setTagInput('');
      return;
    }
    if (nav.kind === 'switch_mode') {
      setListMode(nav.mode);
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

  const handleSave = async (afterSave?: () => void) => {
    if (!canSave || !activeWorkspaceId) return false;
    setIsSaving(true);
    try {
      const payload = {
        workspaceId: activeWorkspaceId,
        name: draft.name.trim(),
        characterCount: draft.characterCount,
        summary: draft.summary.trim(),
        posePrompt: draft.posePrompt.trim(),
        tags: draft.tags,
        source: draft.source,
        sourceImageUrl: draft.sourceImageUrl,
        modelHint: draft.modelHint,
        characters: draft.characters,
        relationship: draft.relationship,
      };
      const response = await fetch(draft.id ? `/api/poses/${draft.id}` : '/api/poses', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save pose');
      showToast(draft.id ? 'Pose saved' : 'Pose created', 'success');
      await loadPoses(listMode, data.pose.id);
      afterSave?.();
      return true;
    } catch (error: any) {
      console.error('Failed to save pose:', error);
      showToast(error?.message || 'Failed to save pose', 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleTrashAction = async (action: 'soft_delete' | 'restore') => {
    if (!draft.id) return;
    const currentId = draft.id;
    const currentIndex = poses.findIndex((item) => item.id === currentId);
    const fallbackSelection = poses[currentIndex + 1]?.id || poses[currentIndex - 1]?.id || null;

    try {
      const response = await fetch(`/api/poses/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to update pose');
      showToast(action === 'restore' ? 'Pose restored' : 'Pose moved to trash', 'success');
      await loadPoses(listMode, fallbackSelection);
    } catch (error: any) {
      console.error('Failed to update pose:', error);
      showToast(error?.message || 'Failed to update pose', 'error');
    }
  };

  const updateCharacterCount = (characterCount: 1 | 2 | 3) => {
    setDraft((current) => {
      const characters = current.characters.slice(0, characterCount).map((character, index) => ({ ...character, index }));
      while (characters.length < characterCount) {
        characters.push(emptyCharacter(characters.length));
      }
      return {
        ...current,
        characterCount,
        characters,
        relationship: characterCount === 1 ? null : (current.relationship || { spatialLayout: '', interaction: '', contact: '', symmetry: '' }),
      };
    });
  };

  const submitExtract = async () => {
    if (!extractImageUrl.trim() && !extractImageDataUrl) return;
    setIsExtracting(true);
    setExtractError(null);
    try {
      const response = await fetch('/api/poses/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: extractImageUrl.trim() || undefined,
          imageDataUrl: extractImageDataUrl || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to extract pose');
      const extracted = data.extracted as PoseExtractResult;
      setSelectedId(null);
      setDraft({
        id: null,
        workspaceId: activeWorkspaceId,
        name: extracted.summary || '',
        characterCount: extracted.characterCount,
        summary: extracted.summary || '',
        posePrompt: extracted.posePrompt || '',
        tags: Array.isArray(extracted.tags) ? extracted.tags : [],
        source: 'extracted',
        sourceImageUrl: extractImageUrl.trim() || extractImageDataUrl || null,
        modelHint: 'z-image',
        characters: Array.isArray(extracted.characters) ? extracted.characters : makeCharacters(extracted.characterCount),
        relationship: extracted.relationship,
        baseline: JSON.stringify({ name: '', characterCount: extracted.characterCount, summary: '', posePrompt: '', tags: [], sourceImageUrl: null, modelHint: null, characters: makeCharacters(extracted.characterCount), relationship: extracted.characterCount > 1 ? { spatialLayout: '', interaction: '', contact: '', symmetry: '' } : null }),
      });
      setTagInput('');
      setIsExtractOpen(false);
      setExtractError(null);
      setExtractImageUrl('');
      setExtractImageDataUrl('');
      setExtractFileName('');
    } catch (error: any) {
      console.error('Failed to extract pose:', error);
      setExtractError(error?.message || 'Failed to extract pose');
    } finally {
      setIsExtracting(false);
    }
  };

  const rebuildPromptFromFields = () => {
    const characterParts = draft.characters.map((character, index) => {
      const prefix = draft.characterCount === 1 ? 'one character' : `character ${index + 1}`;
      return [
        prefix,
        character.orientation,
        character.head,
        character.gaze,
        character.torso,
        character.armsHands,
        character.legsStance,
        character.expression,
      ].filter(Boolean).join(', ');
    });

    const relationshipPart = draft.relationship
      ? [draft.relationship.spatialLayout, draft.relationship.interaction, draft.relationship.contact, draft.relationship.symmetry].filter(Boolean).join(', ')
      : '';

    const nextPrompt = [...characterParts, relationshipPart].filter(Boolean).join(', ').trim();
    setDraft((current) => ({ ...current, posePrompt: nextPrompt }));
  };

  const onSelectExtractFile = async (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setExtractImageDataUrl(reader.result);
        setExtractFileName(file.name);
        setExtractImageUrl('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExtractPaste = (event: React.ClipboardEvent) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    void onSelectExtractFile(file);
  };

  const renderChipField = () => (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tags</div>
      <div className="rounded-lg border border-border bg-background p-2">
        <div className="mb-2 flex flex-wrap gap-2">
          {draft.tags.map((value) => (
            <span key={value} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-2 py-1 text-xs text-foreground">
              {value}
              {listMode !== 'trash' && (
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== value) }))}>×</button>
              )}
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
  );

  return (
    <>
      <div className="flex h-full gap-5">
        <div className="flex w-[340px] flex-shrink-0 flex-col rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4 space-y-3">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search poses" className="h-9" />
            <div className="flex items-center gap-2">
              <Button variant={listMode === 'active' ? 'secondary' : 'outline'} size="sm" onClick={() => requestNavigation({ kind: 'switch_mode', mode: 'active' })}>Active</Button>
              <Button variant={listMode === 'trash' ? 'secondary' : 'outline'} size="sm" onClick={() => requestNavigation({ kind: 'switch_mode', mode: 'trash' })}>Trash</Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant={countFilter === 'all' ? 'secondary' : 'outline'} size="sm" onClick={() => setCountFilter('all')}>All</Button>
              <Button variant={countFilter === 1 ? 'secondary' : 'outline'} size="sm" onClick={() => setCountFilter(1)}><UserIcon className="mr-1 h-4 w-4" />Single</Button>
              <Button variant={countFilter === 2 ? 'secondary' : 'outline'} size="sm" onClick={() => setCountFilter(2)}><UsersIcon className="mr-1 h-4 w-4" />Duo</Button>
              <Button variant={countFilter === 3 ? 'secondary' : 'outline'} size="sm" onClick={() => setCountFilter(3)}>Trio</Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="p-3 text-sm text-muted-foreground">Loading poses...</div>
            ) : filteredPoses.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="text-sm text-muted-foreground">{listMode === 'trash' ? 'Trash is empty' : 'No poses yet'}</div>
                {listMode === 'active' && <Button size="sm" onClick={() => requestNavigation({ kind: 'new' })}><PlusIcon className="mr-2 h-4 w-4" />New</Button>}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredPoses.map((pose) => (
                  <button key={pose.id} type="button" onClick={() => requestNavigation({ kind: 'select', pose })} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${selectedId === pose.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{pose.name}</span>
                      <Badge variant="outline" className="shrink-0">{pose.characterCount === 1 ? 'single' : pose.characterCount === 2 ? 'duo' : 'trio'}</Badge>
                    </div>
                    <div className="mt-1 truncate text-xs opacity-80">{pose.summary}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">{pose.source}</Badge>
                      {pose.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                      ))}
                      {pose.tags.length > 3 && <span className="text-[10px] opacity-70">+{pose.tags.length - 3}</span>}
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
              <Button size="sm" variant="outline" onClick={() => void handleTrashAction('restore')} disabled={!selectedPose}><ArrowUturnLeftIcon className="mr-2 h-4 w-4" />Restore</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void handleTrashAction('soft_delete')} disabled={!selectedPose || !draft.id}><TrashIcon className="mr-2 h-4 w-4" />Delete</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setIsExtractOpen(true)} disabled={listMode === 'trash' || !activeWorkspaceId}><SparklesIcon className="mr-2 h-4 w-4" />Extract</Button>
            <div className="ml-auto flex items-center gap-3">
              <div className="text-xs text-muted-foreground">{listMode === 'trash' ? 'Read-only trash view' : (isDirty ? 'Unsaved changes' : 'Saved')}{listMode !== 'trash' ? ' • Ctrl/Cmd+S' : ''}</div>
              <Button size="sm" onClick={() => void handleSave()} disabled={!canSave || isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="mx-auto max-w-5xl space-y-5">
              {!activeWorkspaceId && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Select or create a workspace before using Pose Manager.</div>
              )}

              {selectedPose && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-xs text-muted-foreground">
                  <Badge variant="outline">{selectedPose.source === 'extracted' ? 'extracted' : 'manual'}</Badge>
                  <Badge variant="outline">{selectedPose.characterCount === 1 ? 'single' : selectedPose.characterCount === 2 ? 'duo' : 'trio'}</Badge>
                  {selectedPose.modelHint && <Badge variant="outline">{selectedPose.modelHint}</Badge>}
                  <span>Updated {formatRelativeDate(selectedPose.updatedAt)}</span>
                  {selectedPose.sourceImageUrl && <span className="truncate">Has source image</span>}
                </div>
              )}

              {!selectedPose && !draft.name && listMode === 'active' && (
                <div className="rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                  Start with <span className="font-medium text-foreground">New</span> for manual authoring or <span className="font-medium text-foreground">Extract</span> to review a pose from an image before saving it.
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</div>
                    <Input ref={nameInputRef} value={draft.name} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Pose name" />
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</div>
                    <Input value={draft.summary} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="Short human-readable summary" />
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Character Count</div>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3].map((count) => (
                        <Button key={count} type="button" size="sm" variant={draft.characterCount === count ? 'secondary' : 'outline'} disabled={listMode === 'trash'} onClick={() => updateCharacterCount(count as 1 | 2 | 3)}>{count === 1 ? 'Single' : count === 2 ? 'Duo' : 'Trio'}</Button>
                      ))}
                    </div>
                  </div>

                  {renderChipField()}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Generated Pose Prompt</div>
                      <Button type="button" size="sm" variant="outline" disabled={listMode === 'trash'} onClick={rebuildPromptFromFields}>
                        <ArrowPathIcon className="mr-2 h-4 w-4" />
                        Rebuild from fields
                      </Button>
                    </div>
                    <textarea value={draft.posePrompt} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, posePrompt: event.target.value }))} placeholder="Detailed generated pose prompt" className="min-h-[220px] w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60" />
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Characters</div>
                    <div className="space-y-4">
                      {draft.characters.map((character, index) => (
                        <div key={index} className="rounded-xl border border-border bg-background p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-sm">Character {index + 1}</div>
                            <Input value={character.label || ''} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, characters: current.characters.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value || null } : item) }))} placeholder="Optional label" className="h-8 max-w-[180px]" />
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            {[
                              ['orientation', 'Orientation'],
                              ['head', 'Head'],
                              ['gaze', 'Gaze'],
                              ['torso', 'Torso'],
                              ['armsHands', 'Arms / Hands'],
                              ['legsStance', 'Legs / Stance'],
                              ['expression', 'Expression'],
                            ].map(([field, label]) => (
                              <div key={field} className="space-y-1">
                                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
                                <textarea value={(character as any)[field] || ''} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, characters: current.characters.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: event.target.value || (field === 'expression' ? null : '') } : item) }))} className="min-h-[72px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {draft.characterCount > 1 && draft.relationship && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Relationship</div>
                      <div className="rounded-xl border border-border bg-background p-4 grid gap-3 md:grid-cols-2">
                        {[
                          ['spatialLayout', 'Spatial Layout'],
                          ['interaction', 'Interaction'],
                          ['contact', 'Contact'],
                          ['symmetry', 'Symmetry'],
                        ].map(([field, label]) => (
                          <div key={field} className="space-y-1">
                            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
                            <textarea value={(draft.relationship as any)[field] || ''} disabled={listMode === 'trash'} onChange={(event) => setDraft((current) => ({ ...current, relationship: current.relationship ? { ...current.relationship, [field]: event.target.value } : current.relationship }))} className="min-h-[84px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isExtractOpen} onOpenChange={(open) => {
        if (isExtracting) return;
        setIsExtractOpen(open);
        if (!open) setExtractError(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Extract pose from image</DialogTitle>
            <DialogDescription>
              This replaces the current editor draft with a new extracted draft.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3" onPaste={handleExtractPaste}>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Extract builds a review draft only. Nothing is saved to the pose library until you press Save in the editor.
            </div>
            <div className="flex items-center gap-2">
              <Input value={extractImageUrl} onChange={(event) => { setExtractImageUrl(event.target.value); if (event.target.value) { setExtractImageDataUrl(''); setExtractFileName(''); } }} disabled={isExtracting} placeholder="Paste image URL" className="h-9" />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isExtracting}>Upload</Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void onSelectExtractFile(event.target.files?.[0] || null)} />
            </div>
            {extractFileName && <div className="text-xs text-muted-foreground">Selected file: {extractFileName}</div>}
            {extractImageDataUrl && <img src={extractImageDataUrl} alt="Extract preview" className="max-h-64 rounded-lg border border-border object-contain" />}
            {!extractImageDataUrl && !extractImageUrl.trim() && (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Paste an image URL, upload a reference image, or press Ctrl+V to paste one from the clipboard.
              </div>
            )}
            {extractError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                <div className="flex items-start gap-3">
                  <div className="flex-1 whitespace-pre-wrap">{extractError}</div>
                  <button type="button" className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-2 py-1 text-xs hover:bg-red-500/10" onClick={async () => { await navigator.clipboard.writeText(extractError); showToast('Error copied', 'success'); }}>
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExtractOpen(false)} disabled={isExtracting}>Cancel</Button>
            <Button onClick={() => void submitExtract()} disabled={isExtracting || (!extractImageUrl.trim() && !extractImageDataUrl)}>{isExtracting ? 'Extracting...' : 'Extract'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              Save this draft before leaving it, discard changes, or cancel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDirtyGuardOpen(false); setPendingNavigation(null); }}>Cancel</Button>
            <Button variant="outline" onClick={() => { const next = pendingNavigation; setIsDirtyGuardOpen(false); setPendingNavigation(null); if (next) applyNavigation(next); }}>Discard</Button>
            <Button onClick={async () => {
              if (!canSave) {
                showToast('Name, summary, and pose prompt are required before saving', 'error');
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
