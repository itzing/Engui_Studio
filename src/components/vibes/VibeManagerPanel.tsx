'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardDocumentIcon, DocumentDuplicateIcon, PlusIcon, SparklesIcon, TrashIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { VibeExtractResult, VibePresetSummary, VibeSortMode } from '@/lib/vibes/types';

type VibeListMode = 'active' | 'trash';

type DraftVibe = {
  id: string | null;
  name: string;
  baseDescription: string;
  tags: string[];
  compatibleSceneTypes: string[];
  baseline: string;
};

type PendingNavigation =
  | { kind: 'select'; vibe: VibePresetSummary }
  | { kind: 'new' }
  | { kind: 'clone' }
  | { kind: 'switch_mode'; mode: VibeListMode }
  | { kind: 'close_manager' };

function emptyDraft(): DraftVibe {
  return {
    id: null,
    name: '',
    baseDescription: '',
    tags: [],
    compatibleSceneTypes: [],
    baseline: JSON.stringify({ name: '', baseDescription: '', tags: [], compatibleSceneTypes: [] }),
  };
}

function buildDraft(vibe: VibePresetSummary): DraftVibe {
  return {
    id: vibe.id,
    name: vibe.name,
    baseDescription: vibe.baseDescription,
    tags: [...vibe.tags],
    compatibleSceneTypes: [...vibe.compatibleSceneTypes],
    baseline: JSON.stringify({
      name: vibe.name,
      baseDescription: vibe.baseDescription,
      tags: vibe.tags,
      compatibleSceneTypes: vibe.compatibleSceneTypes,
    }),
  };
}

function cloneDraft(source: DraftVibe): DraftVibe {
  const nextName = source.name.trim() ? `${source.name.trim()} Copy` : 'Untitled Copy';
  return {
    id: null,
    name: nextName,
    baseDescription: source.baseDescription,
    tags: [...source.tags],
    compatibleSceneTypes: [...source.compatibleSceneTypes],
    baseline: JSON.stringify({ name: '', baseDescription: '', tags: [], compatibleSceneTypes: [] }),
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

function draftFingerprint(draft: DraftVibe | null): string {
  if (!draft) return '';
  return JSON.stringify({
    name: draft.name.trim(),
    baseDescription: draft.baseDescription.trim(),
    tags: draft.tags,
    compatibleSceneTypes: draft.compatibleSceneTypes,
  });
}

function matchesSearch(vibe: VibePresetSummary, query: string): boolean {
  if (!query) return true;
  const haystack = [vibe.name, vibe.baseDescription, ...vibe.tags, ...vibe.compatibleSceneTypes].join(' ').toLowerCase();
  return haystack.includes(query);
}

export default function VibeManagerPanel({ onRequestClose }: { onRequestClose?: () => void }) {
  const { showToast } = useToast();
  const [vibes, setVibes] = useState<VibePresetSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [listMode, setListMode] = useState<VibeListMode>('active');
  const [sortMode, setSortMode] = useState<VibeSortMode>('updated_desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftVibe>(emptyDraft());
  const [tagInput, setTagInput] = useState('');
  const [sceneTypeInput, setSceneTypeInput] = useState('');
  const [isExtractOpen, setIsExtractOpen] = useState(false);
  const [extractPrompt, setExtractPrompt] = useState('');
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [isDirtyGuardOpen, setIsDirtyGuardOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const filteredVibes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = vibes.filter((vibe) => matchesSearch(vibe, query));
    return [...filtered].sort((left, right) => {
      if (sortMode === 'name_asc') return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
      if (sortMode === 'name_desc') return right.name.localeCompare(left.name, undefined, { sensitivity: 'base' });
      if (sortMode === 'created_desc') return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }, [vibes, search, sortMode]);

  const selectedVibe = useMemo(() => vibes.find((item) => item.id === selectedId) || null, [vibes, selectedId]);
  const isDirty = useMemo(() => draftFingerprint(draft) !== draft.baseline, [draft]);
  const isValid = !!draft.name.trim() && !!draft.baseDescription.trim();
  const canSave = isDirty && isValid && listMode === 'active';

  const focusNameSoon = () => {
    window.requestAnimationFrame(() => nameInputRef.current?.focus());
  };

  const applyNavigation = (nav: PendingNavigation) => {
    if (nav.kind === 'select') {
      setSelectedId(nav.vibe.id);
      setDraft(buildDraft(nav.vibe));
      return;
    }

    if (nav.kind === 'new') {
      setSelectedId(null);
      setDraft(emptyDraft());
      focusNameSoon();
      return;
    }

    if (nav.kind === 'clone') {
      setSelectedId(null);
      setDraft(cloneDraft(draft));
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

  const loadVibes = async (mode: VibeListMode, preferredId?: string | null) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/vibes?status=${mode}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load vibes');
      }
      const nextVibes = Array.isArray(data.vibes) ? data.vibes : [];
      setVibes(nextVibes);
      const nextSelectedId = preferredId === undefined
        ? (selectedId && nextVibes.some((item) => item.id === selectedId) ? selectedId : nextVibes[0]?.id || null)
        : preferredId;
      setSelectedId(nextSelectedId || null);
      setDraft(nextSelectedId ? buildDraft(nextVibes.find((item) => item.id === nextSelectedId) || nextVibes[0]) : emptyDraft());
    } catch (error: any) {
      console.error('Failed to load vibes:', error);
      showToast(error?.message || 'Failed to load vibes', 'error');
      setVibes([]);
      setSelectedId(null);
      setDraft(emptyDraft());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadVibes(listMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listMode]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleSave = async (afterSave?: () => void) => {
    if (!canSave) return false;
    setIsSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        baseDescription: draft.baseDescription.trim(),
        tags: draft.tags,
        compatibleSceneTypes: draft.compatibleSceneTypes,
      };
      const response = await fetch(draft.id ? `/api/vibes/${draft.id}` : '/api/vibes', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save vibe');
      showToast(draft.id ? 'Vibe saved' : 'Vibe created', 'success');
      await loadVibes(listMode, data.vibe.id);
      afterSave?.();
      return true;
    } catch (error: any) {
      console.error('Failed to save vibe:', error);
      showToast(error?.message || 'Failed to save vibe', 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleTrashAction = async (action: 'soft_delete' | 'restore') => {
    if (!draft.id) return;
    try {
      const response = await fetch(`/api/vibes/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to update vibe');
      showToast(action === 'restore' ? 'Vibe restored' : 'Vibe moved to trash', 'success');
      await loadVibes(listMode, null);
    } catch (error: any) {
      console.error('Failed to update vibe:', error);
      showToast(error?.message || 'Failed to update vibe', 'error');
    }
  };

  const submitExtract = async () => {
    if (!extractPrompt.trim()) return;
    setIsExtracting(true);
    setExtractError(null);
    try {
      const response = await fetch('/api/vibes/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: extractPrompt }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to extract vibe');
      const extracted = data.extracted as VibeExtractResult;
      setSelectedId(null);
      setDraft({
        id: null,
        name: extracted.name || '',
        baseDescription: extracted.baseDescription || '',
        tags: Array.isArray(extracted.tags) ? extracted.tags : [],
        compatibleSceneTypes: Array.isArray(extracted.compatibleSceneTypes) ? extracted.compatibleSceneTypes : [],
        baseline: JSON.stringify({ name: '', baseDescription: '', tags: [], compatibleSceneTypes: [] }),
      });
      setIsExtractOpen(false);
      setExtractError(null);
    } catch (error: any) {
      console.error('Failed to extract vibe:', error);
      setExtractError(error?.message || 'Failed to extract vibe');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExtractKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      void submitExtract();
    }
  };

  const renderChipField = (
    label: string,
    values: string[],
    setValues: (next: string[]) => void,
    inputValue: string,
    setInputValue: (next: string) => void,
    disabled: boolean,
  ) => (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="rounded-lg border border-border bg-background p-2">
        <div className="mb-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-2 py-1 text-xs text-foreground">
              {value}
              {!disabled && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setValues(values.filter((item) => item !== value))}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        <Input
          value={inputValue}
          disabled={disabled}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              const next = applyChipInput(values, inputValue || event.key);
              setValues(next.values);
              if (next.reset) setInputValue('');
            } else if (event.key === 'Backspace' && !inputValue && values.length > 0) {
              setValues(values.slice(0, -1));
            }
          }}
          onBlur={() => {
            const next = applyChipInput(values, inputValue);
            setValues(next.values);
            if (next.reset) setInputValue('');
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
        <div className="flex w-[320px] flex-shrink-0 flex-col rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vibes" className="h-9" />
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as VibeSortMode)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
                <option value="updated_desc">Updated</option>
                <option value="created_desc">Created</option>
                <option value="name_asc">Name A-Z</option>
                <option value="name_desc">Name Z-A</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={listMode === 'active' ? 'secondary' : 'outline'} size="sm" onClick={() => requestNavigation({ kind: 'switch_mode', mode: 'active' })}>Active</Button>
              <Button variant={listMode === 'trash' ? 'secondary' : 'outline'} size="sm" onClick={() => requestNavigation({ kind: 'switch_mode', mode: 'trash' })}>Trash</Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="p-3 text-sm text-muted-foreground">Loading vibes...</div>
            ) : filteredVibes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="text-sm text-muted-foreground">No vibes yet</div>
                {listMode === 'active' && <Button size="sm" onClick={() => requestNavigation({ kind: 'new' })}><PlusIcon className="mr-2 h-4 w-4" />New</Button>}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredVibes.map((vibe) => (
                  <button
                    key={vibe.id}
                    type="button"
                    onClick={() => requestNavigation({ kind: 'select', vibe })}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${selectedId === vibe.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                  >
                    {vibe.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
            <Button size="sm" onClick={() => requestNavigation({ kind: 'new' })}><PlusIcon className="mr-2 h-4 w-4" />New</Button>
            <Button size="sm" variant="outline" onClick={() => requestNavigation({ kind: 'clone' })} disabled={listMode === 'trash'}><DocumentDuplicateIcon className="mr-2 h-4 w-4" />Clone</Button>
            {listMode === 'trash' ? (
              <Button size="sm" variant="outline" onClick={() => void handleTrashAction('restore')} disabled={!selectedVibe}><ArrowUturnLeftIcon className="mr-2 h-4 w-4" />Restore</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void handleTrashAction('soft_delete')} disabled={!selectedVibe || !draft.id}><TrashIcon className="mr-2 h-4 w-4" />Delete</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setIsExtractOpen(true)}><SparklesIcon className="mr-2 h-4 w-4" />Extract</Button>
            <div className="ml-auto flex items-center gap-3">
              <div className="text-xs text-muted-foreground">{isDirty ? 'Unsaved changes' : 'Saved'}</div>
              <Button size="sm" onClick={() => void handleSave()} disabled={!canSave || isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="mx-auto max-w-4xl space-y-5">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</div>
                <Input
                  ref={nameInputRef}
                  value={draft.name}
                  disabled={listMode === 'trash'}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Vibe name"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Base Description</div>
                <textarea
                  value={draft.baseDescription}
                  disabled={listMode === 'trash'}
                  onChange={(event) => setDraft((current) => ({ ...current, baseDescription: event.target.value }))}
                  placeholder="Describe the reusable vibe core"
                  className="min-h-[220px] w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {renderChipField('Tags', draft.tags, (next) => setDraft((current) => ({ ...current, tags: next })), tagInput, setTagInput, listMode === 'trash')}
              {renderChipField('Compatible Scene Types', draft.compatibleSceneTypes, (next) => setDraft((current) => ({ ...current, compatibleSceneTypes: next })), sceneTypeInput, setSceneTypeInput, listMode === 'trash')}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isExtractOpen} onOpenChange={(open) => {
        if (isExtracting) return;
        setIsExtractOpen(open);
        if (!open) setExtractError(null);
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base">Extract vibe from prompt</DialogTitle>
            <DialogDescription>
              This replaces the current editor draft with a new extracted draft.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              value={extractPrompt}
              onChange={(event) => setExtractPrompt(event.target.value)}
              onKeyDown={handleExtractKeyDown}
              disabled={isExtracting}
              className="min-h-[180px] w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Paste a prompt or rough vibe description"
            />
            {extractError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                <div className="flex items-start gap-3">
                  <div className="flex-1 whitespace-pre-wrap">{extractError}</div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-2 py-1 text-xs hover:bg-red-500/10"
                    onClick={async () => {
                      await navigator.clipboard.writeText(extractError);
                      showToast('Error copied', 'success');
                    }}
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExtractOpen(false)} disabled={isExtracting}>Cancel</Button>
            <Button onClick={() => void submitExtract()} disabled={isExtracting || !extractPrompt.trim()}>{isExtracting ? 'Extracting...' : 'Extract'}</Button>
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
            <Button variant="outline" onClick={() => {
              setIsDirtyGuardOpen(false);
              setPendingNavigation(null);
            }}>Cancel</Button>
            <Button variant="outline" onClick={() => {
              const next = pendingNavigation;
              setIsDirtyGuardOpen(false);
              setPendingNavigation(null);
              if (next) applyNavigation(next);
            }}>Discard</Button>
            <Button onClick={async () => {
              if (!canSave) {
                showToast('Name and Base Description are required before saving', 'error');
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
