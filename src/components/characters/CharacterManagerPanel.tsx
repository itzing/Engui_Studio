'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CopyPlus, Download, Lock, LockOpen, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { characterTraitDefinitionMap, characterTraitDefinitionsByGroup } from '@/lib/characters/schema';
import type { CharacterSummary, CharacterTraitMap, CharacterVersionSummary } from '@/lib/characters/types';

type DraftCharacter = {
  id: string | null;
  name: string;
  gender: string;
  traits: CharacterTraitMap;
  editorState: Record<string, unknown>;
  previewStatusSummary: string | null;
  baseTraits: CharacterTraitMap;
};

type ModalState =
  | { kind: 'closed' }
  | { kind: 'basics' }
  | { kind: 'group'; groupId: string };

type ImportPreview = {
  name: string;
  gender: string;
  traits: CharacterTraitMap;
};

function createEmptyDraft(): DraftCharacter {
  return {
    id: null,
    name: '',
    gender: '',
    traits: {},
    editorState: {},
    previewStatusSummary: null,
    baseTraits: {},
  };
}

function buildDraft(character: CharacterSummary): DraftCharacter {
  return {
    id: character.id,
    name: character.name,
    gender: character.gender || '',
    traits: character.traits || {},
    editorState: character.editorState || {},
    previewStatusSummary: character.previewStatusSummary,
    baseTraits: character.traits || {},
  };
}

function buildDraftFromSnapshot(snapshot: {
  name: string;
  gender?: string | null;
  traits: CharacterTraitMap;
  editorState?: Record<string, unknown>;
}): DraftCharacter {
  return {
    id: null,
    name: snapshot.name,
    gender: snapshot.gender || '',
    traits: snapshot.traits || {},
    editorState: snapshot.editorState || {},
    previewStatusSummary: null,
    baseTraits: {},
  };
}

function traitsEqual(left: CharacterTraitMap, right: CharacterTraitMap) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function traitLabel(key: string) {
  return characterTraitDefinitionMap.get(key)?.label || key;
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function normalizeImportKey(rawKey: string) {
  return rawKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getEditableTraits(draft: DraftCharacter): CharacterTraitMap {
  const groupLocks = (draft.editorState?.groupLocks as Record<string, boolean> | undefined) || {};
  const uiTraitLocks = (draft.editorState?.uiTraitLocks as Record<string, boolean> | undefined) || {};
  const lockedVolatilityLevels = new Set(Array.isArray(draft.editorState?.lockedVolatilityLevels)
    ? draft.editorState.lockedVolatilityLevels.filter((value): value is string => typeof value === 'string')
    : []);

  const editableEntries = Object.entries(draft.traits).filter(([key]) => {
    const definition = characterTraitDefinitionMap.get(key);
    if (!definition) return false;
    if (groupLocks[definition.group]) return false;
    if (uiTraitLocks[key]) return false;
    if (lockedVolatilityLevels.has(definition.volatility)) return false;
    return true;
  });

  return Object.fromEntries(editableEntries);
}

function getGroupLocks(draft: DraftCharacter | null): Record<string, boolean> {
  return (draft?.editorState?.groupLocks as Record<string, boolean> | undefined) || {};
}

function getTraitLocks(draft: DraftCharacter | null): Record<string, boolean> {
  return (draft?.editorState?.uiTraitLocks as Record<string, boolean> | undefined) || {};
}

function parseImportText(input: string): ImportPreview {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ImportPreview = {
    name: '',
    gender: '',
    traits: {},
  };

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) continue;

    const rawKey = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!rawKey || !value) continue;

    const normalizedKey = normalizeImportKey(rawKey);

    if (normalizedKey === 'name') {
      parsed.name = value;
      continue;
    }

    if (normalizedKey === 'gender') {
      parsed.gender = value;
      continue;
    }

    parsed.traits[normalizedKey] = value;
  }

  return parsed;
}

type CharacterListMode = 'active' | 'trash';

export default function CharacterManagerPanel() {
  const { showToast } = useToast();
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [versions, setVersions] = useState<CharacterVersionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftCharacter | null>(null);
  const [modalState, setModalState] = useState<ModalState>({ kind: 'closed' });
  const [modalValues, setModalValues] = useState<Record<string, string>>({});
  const [importText, setImportText] = useState('');
  const [importOverrideName, setImportOverrideName] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [selectedCloneVersionId, setSelectedCloneVersionId] = useState<string | null>(null);
  const [assistantInstruction, setAssistantInstruction] = useState('');
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantNote, setAssistantNote] = useState<string | null>(null);
  const [selectedHistoryVersionId, setSelectedHistoryVersionId] = useState<string | null>(null);
  const [listMode, setListMode] = useState<CharacterListMode>('active');
  const [isTrashMutating, setIsTrashMutating] = useState(false);

  const importPreview = useMemo(() => parseImportText(importText), [importText]);
  const effectiveImportName = importOverrideName.trim() || importPreview.name.trim();

  const fetchCharacters = async (preferredCharacterId?: string | null) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/characters?includeDeleted=true`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load characters');
      }

      const nextCharacters = Array.isArray(data.characters) ? data.characters : [];
      setCharacters(nextCharacters);

      const nextSelectedId = preferredCharacterId === undefined
        ? (selectedCharacterId && nextCharacters.some((item: CharacterSummary) => item.id === selectedCharacterId)
          ? selectedCharacterId
          : nextCharacters[0]?.id || null)
        : preferredCharacterId;

      setSelectedCharacterId(nextSelectedId || null);

      if (nextSelectedId) {
        const selected = nextCharacters.find((item: CharacterSummary) => item.id === nextSelectedId);
        if (selected) {
          setDraft(buildDraft(selected));
          return;
        }
      }

      if (!nextSelectedId) {
        setDraft(createEmptyDraft());
      }
    } catch (nextError: any) {
      console.error('Failed to load characters:', nextError);
      setError(nextError?.message || 'Failed to load characters');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVersions = async (characterId: string) => {
    setIsLoadingVersions(true);

    try {
      const response = await fetch(`/api/characters/${characterId}/versions`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load versions');
      }

      const nextVersions = Array.isArray(data.versions) ? data.versions : [];
      setVersions(nextVersions);
      setSelectedCloneVersionId(nextVersions[0]?.id || null);
      setSelectedHistoryVersionId(nextVersions[0]?.id || null);
      return nextVersions;
    } catch (nextError: any) {
      console.error('Failed to load character versions:', nextError);
      showToast(nextError?.message || 'Failed to load versions', 'error');
      return [];
    } finally {
      setIsLoadingVersions(false);
    }
  };

  useEffect(() => {
    void fetchCharacters();
  }, []);

  useEffect(() => {
    if (!selectedCharacterId) {
      setVersions([]);
      setSelectedCloneVersionId(null);
      return;
    }

    void fetchVersions(selectedCharacterId);
  }, [selectedCharacterId]);

  const filteredCharacters = useMemo(() => {
    const query = search.trim().toLowerCase();
    const scopedCharacters = characters.filter((character) => listMode === 'trash' ? !!character.deletedAt : !character.deletedAt);
    if (!query) return scopedCharacters;

    return scopedCharacters.filter((character) => character.name.toLowerCase().includes(query));
  }, [characters, search, listMode]);

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === selectedCharacterId) || null,
    [characters, selectedCharacterId]
  );

  const activeCharacters = useMemo(() => characters.filter((character) => !character.deletedAt), [characters]);
  const trashedCharacters = useMemo(() => characters.filter((character) => !!character.deletedAt), [characters]);

  const selectedCloneVersion = useMemo(
    () => versions.find((version) => version.id === selectedCloneVersionId) || null,
    [versions, selectedCloneVersionId]
  );

  const selectedHistoryVersion = useMemo(
    () => versions.find((version) => version.id === selectedHistoryVersionId) || null,
    [versions, selectedHistoryVersionId]
  );

  const groupLocks = useMemo(() => getGroupLocks(draft), [draft]);
  const traitLocks = useMemo(() => getTraitLocks(draft), [draft]);

  const changedTraitKeys = useMemo(() => {
    if (!draft) return new Set<string>();
    const keys = new Set<string>([...Object.keys(draft.baseTraits), ...Object.keys(draft.traits)]);
    return new Set(Array.from(keys).filter((key) => draft.baseTraits[key] !== draft.traits[key]));
  }, [draft]);

  const editableTraits = useMemo(() => (draft ? getEditableTraits(draft) : {}), [draft]);

  const canSave = useMemo(() => {
    if (!draft) return false;
    if (!draft.name.trim()) return false;
    if (!draft.id) return true;
    return !traitsEqual(draft.baseTraits, draft.traits);
  }, [draft]);

  const toggleGroupLock = (groupId: string) => {
    if (!draft) return;
    const nextGroupLocks = { ...groupLocks, [groupId]: !groupLocks[groupId] };
    setDraft({
      ...draft,
      editorState: {
        ...draft.editorState,
        groupLocks: nextGroupLocks,
      },
    });
  };

  const toggleTraitLock = (traitKey: string) => {
    if (!draft) return;
    const nextTraitLocks = { ...traitLocks, [traitKey]: !traitLocks[traitKey] };
    setDraft({
      ...draft,
      editorState: {
        ...draft.editorState,
        uiTraitLocks: nextTraitLocks,
      },
    });
  };

  const openBasicsModal = () => {
    if (!draft) return;
    setModalValues({
      name: draft.name,
      gender: draft.gender,
    });
    setModalState({ kind: 'basics' });
  };

  const openGroupModal = (groupId: string) => {
    if (!draft) return;
    const group = characterTraitDefinitionsByGroup.find((item) => item.group.id === groupId);
    if (!group) return;

    setModalValues(
      Object.fromEntries(group.traits.map((trait) => [trait.key, draft.traits[trait.key] || '']))
    );
    setModalState({ kind: 'group', groupId });
  };

  const closeModal = () => {
    setModalState({ kind: 'closed' });
    setModalValues({});
  };

  const applyModal = () => {
    if (!draft) return;

    if (modalState.kind === 'basics') {
      setDraft({
        ...draft,
        name: (modalValues.name || '').trim(),
        gender: (modalValues.gender || '').trim(),
      });
      closeModal();
      return;
    }

    if (modalState.kind === 'group') {
      const nextTraits = { ...draft.traits };
      const group = characterTraitDefinitionsByGroup.find((item) => item.group.id === modalState.groupId);
      if (!group) return;

      for (const trait of group.traits) {
        const nextValue = (modalValues[trait.key] || '').trim();
        if (nextValue) {
          nextTraits[trait.key] = nextValue;
        } else {
          delete nextTraits[trait.key];
        }
      }

      setDraft({ ...draft, traits: nextTraits });
      closeModal();
    }
  };

  const selectCharacter = (character: CharacterSummary) => {
    setAssistantError(null);
    setAssistantNote(null);
    setSelectedCharacterId(character.id);
    setDraft(buildDraft(character));
  };

  const resetDraft = () => {
    if (!draft) return;
    setAssistantError(null);
    setAssistantNote(null);
    if (!draft.id) {
      setDraft(createEmptyDraft());
      return;
    }

    const persisted = characters.find((item) => item.id === draft.id);
    if (persisted) {
      setDraft(buildDraft(persisted));
    }
  };

  const startNewCharacter = () => {
    setAssistantError(null);
    setAssistantNote(null);
    setSelectedCharacterId(null);
    setDraft(createEmptyDraft());
  };

  const saveDraft = async () => {
    if (!draft || !canSave) return;
    setIsSaving(true);
    setAssistantError(null);
    setAssistantNote(null);

    try {
      const payload = {
        name: draft.name.trim(),
        gender: draft.gender.trim(),
        traits: draft.traits,
        editorState: draft.editorState,
        previewStatusSummary: draft.previewStatusSummary,
      };

      const response = await fetch(draft.id ? `/api/characters/${draft.id}` : '/api/characters', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save character');
      }

      const savedCharacter = data.character as CharacterSummary;
      showToast(draft.id ? 'Character version saved' : 'Character created', 'success');
      await fetchCharacters(savedCharacter.id);
    } catch (nextError: any) {
      console.error('Failed to save character:', nextError);
      showToast(nextError?.message || 'Failed to save character', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openImportDialog = () => {
    setImportText('');
    setImportOverrideName('');
    setIsImportDialogOpen(true);
  };

  const confirmImport = async () => {
    if (!effectiveImportName) {
      showToast('Import requires a name before confirmation', 'error');
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: effectiveImportName,
          gender: importPreview.gender,
          traits: importPreview.traits,
          editorState: {},
          previewStatusSummary: null,
          changeSummary: 'Initial import snapshot',
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to import character');
      }

      const savedCharacter = data.character as CharacterSummary;
      showToast('Character imported', 'success');
      setIsImportDialogOpen(false);
      setImportText('');
      setImportOverrideName('');
      await fetchCharacters(savedCharacter.id);
    } catch (nextError: any) {
      console.error('Failed to import character:', nextError);
      showToast(nextError?.message || 'Failed to import character', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const openCloneDialog = async () => {
    if (!selectedCharacter) {
      showToast('Select a saved character before cloning', 'error');
      return;
    }

    const loadedVersions = await fetchVersions(selectedCharacter.id);
    setCloneName(`${selectedCharacter.name} Copy`);
    setSelectedCloneVersionId(loadedVersions[0]?.id || selectedCharacter.currentVersionId || null);
    setIsCloneDialogOpen(true);
  };

  const confirmClone = async () => {
    if (!selectedCloneVersion) {
      showToast('Select a version to clone', 'error');
      return;
    }

    const nextName = cloneName.trim();
    if (!nextName) {
      showToast('Clone requires a new character name', 'error');
      return;
    }

    setIsCloning(true);

    try {
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nextName,
          gender: selectedCharacter?.gender || '',
          traits: selectedCloneVersion.traitsSnapshot,
          editorState: selectedCloneVersion.editorStateSnapshot,
          previewStatusSummary: null,
          changeSummary: `Cloned from version ${selectedCloneVersion.versionNumber}`,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to clone character');
      }

      const savedCharacter = data.character as CharacterSummary;
      showToast('Character cloned into a new record', 'success');
      setIsCloneDialogOpen(false);
      await fetchCharacters(savedCharacter.id);
      setDraft(buildDraftFromSnapshot({
        name: savedCharacter.name,
        gender: savedCharacter.gender,
        traits: savedCharacter.traits,
        editorState: savedCharacter.editorState,
      }));
      setSelectedCharacterId(savedCharacter.id);
    } catch (nextError: any) {
      console.error('Failed to clone character:', nextError);
      showToast(nextError?.message || 'Failed to clone character', 'error');
    } finally {
      setIsCloning(false);
    }
  };

  const applyHistoryVersionToDraft = (version: CharacterVersionSummary) => {
    if (!draft || !selectedCharacter) return;

    setAssistantError(null);
    setAssistantNote(`Applied version ${version.versionNumber} to draft. Save to create a new version if you want to keep it.`);
    setSelectedHistoryVersionId(version.id);
    setDraft({
      ...draft,
      name: selectedCharacter.name,
      gender: selectedCharacter.gender || draft.gender,
      traits: version.traitsSnapshot,
      editorState: version.editorStateSnapshot,
    });
  };

  const applyAssistantPatch = async () => {
    if (!draft) return;

    const instruction = assistantInstruction.trim();
    if (!instruction) {
      showToast('Assistant instruction is required', 'error');
      return;
    }

    if (Object.keys(editableTraits).length === 0) {
      showToast('No editable traits are available for assistant patching', 'error');
      return;
    }

    setIsAssistantLoading(true);
    setAssistantError(null);
    setAssistantNote(null);

    try {
      const response = await fetch('/api/characters/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          editableTraits,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Character Assistant request failed');
      }

      const allowedKeys = new Set(Object.keys(editableTraits));
      const nextTraits = { ...draft.traits };
      const changes = Array.isArray(data.changes) ? data.changes : [];
      let appliedCount = 0;
      let skippedCount = 0;

      for (const change of changes) {
        const key = typeof change?.key === 'string' ? change.key.trim() : '';
        const newValue = typeof change?.new_value === 'string' ? change.new_value.trim() : '';
        if (!key || !newValue) continue;

        if (!allowedKeys.has(key)) {
          skippedCount += 1;
          continue;
        }

        nextTraits[key] = newValue;
        appliedCount += 1;
      }

      setDraft({ ...draft, traits: nextTraits });
      setAssistantInstruction('');

      if (skippedCount > 0) {
        setAssistantNote('Some locked traits were skipped.');
      } else if (typeof data.summary === 'string' && data.summary.trim()) {
        setAssistantNote(data.summary.trim());
      } else {
        setAssistantNote(appliedCount > 0 ? 'Assistant patch applied to draft.' : 'Assistant returned no applicable changes.');
      }
    } catch (nextError: any) {
      console.error('Failed to apply character assistant patch:', nextError);
      setAssistantError(nextError?.message || 'Character Assistant request failed');
    } finally {
      setIsAssistantLoading(false);
    }
  };

  const modalTitle = modalState.kind === 'basics'
    ? 'Edit basics'
    : modalState.kind === 'group'
      ? `Edit ${characterTraitDefinitionsByGroup.find((item) => item.group.id === modalState.groupId)?.group.label || 'traits'}`
      : '';

  const legacyTraits = useMemo(() => {
    if (!draft) return [] as [string, string][];
    return Object.entries(draft.traits).filter(([key]) => !characterTraitDefinitionMap.has(key));
  }, [draft]);

  const draftTraitCount = draft ? Object.keys(draft.traits).length : 0;
  const dirtyTraitCount = changedTraitKeys.size;
  const currentVersion = selectedCharacter?.currentVersionId
    ? versions.find((version) => version.id === selectedCharacter.currentVersionId) || null
    : versions[0] || null;

  const moveCharacterToTrash = async () => {
    if (!selectedCharacter || selectedCharacter.deletedAt) return;
    if (!confirm(`Move ${selectedCharacter.name} to trash?`)) return;

    setIsTrashMutating(true);
    try {
      const response = await fetch(`/api/characters/${selectedCharacter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'soft_delete' }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to move character to trash');
      }

      showToast('Character moved to trash', 'success');
      setSelectedCharacterId(null);
      setDraft(createEmptyDraft());
      await fetchCharacters();
    } catch (nextError: any) {
      console.error('Failed to move character to trash:', nextError);
      showToast(nextError?.message || 'Failed to move character to trash', 'error');
    } finally {
      setIsTrashMutating(false);
    }
  };

  const restoreCharacterFromTrash = async () => {
    if (!selectedCharacter || !selectedCharacter.deletedAt) return;

    setIsTrashMutating(true);
    try {
      const response = await fetch(`/api/characters/${selectedCharacter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to restore character');
      }

      showToast('Character restored from trash', 'success');
      setListMode('active');
      await fetchCharacters(selectedCharacter.id);
    } catch (nextError: any) {
      console.error('Failed to restore character:', nextError);
      showToast(nextError?.message || 'Failed to restore character', 'error');
    } finally {
      setIsTrashMutating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Characters</div>
          <div className="text-xs text-muted-foreground">
            V1 foundation, create/edit/save, import, and clone flows.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={openImportDialog}>
            <Download className="w-3.5 h-3.5 mr-1" />
            Import
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={startNewCharacter}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            New
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void fetchCharacters()} title="Refresh characters">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search characters by name..."
        className="h-9 text-xs"
      />

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Active</div>
          <div className="mt-1 text-lg font-semibold">{activeCharacters.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Trash</div>
          <div className="mt-1 text-lg font-semibold">{trashedCharacters.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Dirty traits</div>
          <div className="mt-1 text-lg font-semibold">{dirtyTraitCount}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
        <div className="border-b border-border px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-muted/30 rounded-md p-0.5">
            {(['active', 'trash'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setListMode(mode)}
                className={`px-2 py-0.5 text-[10px] rounded-sm transition-all capitalize ${listMode === mode
                  ? 'bg-background shadow-sm text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground">{filteredCharacters.length} shown</div>
        </div>
        <div className="max-h-48 overflow-y-auto divide-y divide-border/70">
          {isLoading ? (
            <div className="px-4 py-6 text-xs text-muted-foreground">Loading characters...</div>
          ) : error ? (
            <div className="px-4 py-6 text-xs text-red-400">{error}</div>
          ) : filteredCharacters.length === 0 ? (
            <div className="px-4 py-6 text-xs text-muted-foreground">
              {search.trim()
                ? (listMode === 'trash' ? 'No trashed characters match this name.' : 'No characters match this name.')
                : (listMode === 'trash' ? 'Trash is empty.' : 'No saved characters yet.')}
            </div>
          ) : (
            filteredCharacters.map((character) => (
              <button
                key={character.id}
                type="button"
                onClick={() => selectCharacter(character)}
                className={`w-full px-4 py-3 text-left transition-colors ${selectedCharacterId === character.id
                  ? 'bg-muted/40'
                  : 'hover:bg-muted/20'
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{character.name}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {character.gender || 'Unspecified gender'} • {character.versionCount || 0} version{(character.versionCount || 0) === 1 ? '' : 's'}
                      {character.deletedAt ? ` • trashed ${formatDateTime(character.deletedAt)}` : ''}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
        <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-semibold">{draft?.name || 'Unsaved character draft'}</div>
              {selectedCharacter?.deletedAt && (
                <span className="rounded-full px-2 py-0.5 text-[10px] border border-amber-500/30 bg-amber-500/10 text-amber-200">
                  In trash
                </span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-[10px] border ${dirtyTraitCount > 0
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                : 'border-border bg-background/70 text-muted-foreground'
                }`}>
                {dirtyTraitCount > 0 ? `${dirtyTraitCount} unsaved change${dirtyTraitCount === 1 ? '' : 's'}` : 'No unsaved trait changes'}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {draft?.id ? 'Editing current saved character' : 'Nothing is persisted until Save'}
              {draft ? ` • ${draftTraitCount} saved-or-draft trait${draftTraitCount === 1 ? '' : 's'}` : ''}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedCharacter?.deletedAt ? (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={restoreCharacterFromTrash} disabled={isTrashMutating}>
                <Undo2 className="w-3.5 h-3.5 mr-1" />
                {isTrashMutating ? 'Restoring...' : 'Restore'}
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={openCloneDialog} disabled={!selectedCharacterId || isLoadingVersions}>
                  <CopyPlus className="w-3.5 h-3.5 mr-1" />
                  Clone
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs text-red-300 border-red-500/30 hover:text-red-200" onClick={moveCharacterToTrash} disabled={!selectedCharacterId || isTrashMutating}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  {isTrashMutating ? 'Deleting...' : 'Delete'}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetDraft} disabled={!draft}>
              <Undo2 className="w-3.5 h-3.5 mr-1" />
              Cancel
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={saveDraft} disabled={!canSave || isSaving || !!selectedCharacter?.deletedAt}>
              <Save className="w-3.5 h-3.5 mr-1" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {!draft ? (
          <div className="px-4 py-8 text-xs text-muted-foreground">Select a character or create a new one.</div>
        ) : (
          <div className="space-y-3 p-4">
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-medium">Basics</div>
                  <div className="text-[11px] text-muted-foreground">Top-level fields stay outside traits for display and indexing.</div>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openBasicsModal}>
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  Edit
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-background/70 px-2 py-2">
                  <div className="text-[10px] text-muted-foreground">Name</div>
                  <div className="mt-1 font-medium break-words">{draft.name || 'Required before first save'}</div>
                </div>
                <div className="rounded-md bg-background/70 px-2 py-2">
                  <div className="text-[10px] text-muted-foreground">Gender</div>
                  <div className="mt-1 font-medium break-words">{draft.gender || 'Optional'}</div>
                </div>
              </div>
            </div>

            {characterTraitDefinitionsByGroup.map(({ group, traits }) => {
              const filledTraits = traits.filter((trait) => draft.traits[trait.key]);
              const filledCount = filledTraits.length;
              const groupChanged = traits.some((trait) => changedTraitKeys.has(trait.key));
              const groupLocked = !!groupLocks[group.id];
              const groupEditableCount = traits.filter((trait) => draft.traits[trait.key] && !traitLocks[trait.key]).length;

              return (
                <div key={group.id} className={`rounded-lg border p-3 ${groupChanged ? 'border-blue-500/40 bg-blue-500/5' : 'border-border bg-muted/20'} ${groupLocked ? 'opacity-80' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-xs font-medium">{group.label}</div>
                        <button
                          type="button"
                          onClick={() => toggleGroupLock(group.id)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${groupLocked
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            }`}
                          title={groupLocked ? 'Unlock group for assistant editing' : 'Lock group from assistant editing'}
                        >
                          {groupLocked ? <Lock className="w-3 h-3" /> : <LockOpen className="w-3 h-3" />}
                          {groupLocked ? 'Group locked' : 'Group editable'}
                        </button>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{filledCount}/{traits.length} traits filled • {groupEditableCount} assistant-editable</div>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openGroupModal(group.id)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {filledTraits.map((trait) => {
                      const traitLocked = !!traitLocks[trait.key];
                      const traitBlockedByGroup = groupLocked;
                      const traitEditable = !traitLocked && !traitBlockedByGroup;

                      return (
                        <span
                          key={trait.key}
                          className={`rounded-full border px-2 py-0.5 text-[10px] ${traitEditable
                            ? changedTraitKeys.has(trait.key)
                              ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                              : 'border-border bg-background/70 text-muted-foreground'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                            }`}
                        >
                          {trait.label}: {draft.traits[trait.key]}
                          {!traitEditable ? ' 🔒' : ''}
                        </span>
                      );
                    })}
                    {filledCount === 0 && (
                      <span className="text-[11px] text-muted-foreground">No saved values in this group yet.</span>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-medium">Assistant draft edit</div>
                  <div className="text-[11px] text-muted-foreground">Uses only the editable trait subset and auto-applies to the transient draft.</div>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={applyAssistantPatch} disabled={isAssistantLoading || !assistantInstruction.trim()}>
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  {isAssistantLoading ? 'Applying...' : 'Apply patch'}
                </Button>
              </div>
              <textarea
                value={assistantInstruction}
                onChange={(event) => setAssistantInstruction(event.target.value)}
                placeholder="Describe what should change in the editable character traits..."
                className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(editableTraits).map(([key, value]) => (
                  <span key={key} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                    {traitLabel(key)}: {value}
                  </span>
                ))}
                {Object.keys(editableTraits).length === 0 && (
                  <span className="text-[11px] text-muted-foreground">No editable traits available. Locks or empty draft may be excluding everything.</span>
                )}
              </div>
              {assistantError && (
                <div className="text-[11px] text-red-400">{assistantError}</div>
              )}
              {assistantNote && !assistantError && (
                <div className="text-[11px] text-blue-300">{assistantNote}</div>
              )}
            </div>

            {selectedCharacter && (
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium">Version history</div>
                    <div className="text-[11px] text-muted-foreground">Current version is visible here, clone still uses explicit dialog flow.</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {isLoadingVersions ? 'Loading...' : `${versions.length} version${versions.length === 1 ? '' : 's'}`}
                  </div>
                </div>

                {currentVersion && (
                  <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[11px] text-blue-200">
                    Current saved version: v{currentVersion.versionNumber} • {formatDateTime(currentVersion.createdAt)}
                    <div className="mt-1 text-blue-100/90">{currentVersion.changeSummary}</div>
                  </div>
                )}

                {selectedHistoryVersion && (
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                    Selected history snapshot: v{selectedHistoryVersion.versionNumber} • {formatDateTime(selectedHistoryVersion.createdAt)}
                    <div className="mt-1 text-emerald-100/90">{selectedHistoryVersion.changeSummary}</div>
                  </div>
                )}

                <div className="max-h-56 overflow-y-auto space-y-2">
                  {versions.map((version) => (
                    <div key={version.id} className={`rounded-md border px-3 py-2 ${selectedCharacter.currentVersionId === version.id
                      ? 'border-blue-500/30 bg-blue-500/5'
                      : selectedHistoryVersionId === version.id
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-border bg-background/60'
                      }`}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium">Version {version.versionNumber}</span>
                        <span className="text-muted-foreground">{formatDateTime(version.createdAt)}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{version.changeSummary}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            setSelectedHistoryVersionId(version.id);
                            applyHistoryVersionToDraft(version);
                          }}
                        >
                          Apply to draft
                        </Button>
                        {selectedCharacter.currentVersionId === version.id && (
                          <span className="text-[10px] text-blue-300">Current saved</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {!isLoadingVersions && versions.length === 0 && (
                    <div className="text-[11px] text-muted-foreground">No saved versions yet.</div>
                  )}
                </div>
              </div>
            )}

            {legacyTraits.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="text-xs font-medium text-amber-200">Legacy or unsupported traits</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {legacyTraits.map(([key, value]) => (
                    <span key={key} className="rounded-full border border-amber-500/30 bg-background/70 px-2 py-0.5 text-[10px] text-amber-100">
                      {traitLabel(key)}: {value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/10 p-3 text-[11px] text-muted-foreground">
              Save creates a new immutable version only when traits changed. Import confirmation creates a new character immediately. Clone creates a new character from the selected saved version snapshot. Applying a history snapshot only updates the transient draft until you save. Delete moves a character to Trash via soft delete, and Trash only supports restore in this v1 flow. This UI only manages group locks and trait locks for assistant editability, not volatility locks.
            </div>
          </div>
        )}
      </div>

      <Dialog open={modalState.kind !== 'closed'} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            <DialogDescription>
              Manual editing is modal-based in v1, not free inline editing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {modalState.kind === 'basics' && (
              <>
                <div className="space-y-1.5">
                  <div className="text-xs font-medium">Name</div>
                  <Input value={modalValues.name || ''} onChange={(event) => setModalValues((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-medium">Gender</div>
                  <Input value={modalValues.gender || ''} onChange={(event) => setModalValues((prev) => ({ ...prev, gender: event.target.value }))} />
                </div>
              </>
            )}

            {modalState.kind === 'group' && characterTraitDefinitionsByGroup
              .find((item) => item.group.id === modalState.groupId)
              ?.traits.map((trait) => {
                const traitLocked = !!traitLocks[trait.key];
                const groupLocked = !!groupLocks[modalState.groupId];

                return (
                  <div key={trait.key} className="space-y-1.5 rounded-md border border-border/60 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-medium">{trait.label}</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleTraitLock(trait.key)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${traitLocked
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            }`}
                          title={traitLocked ? 'Unlock trait for assistant editing' : 'Lock trait from assistant editing'}
                        >
                          {traitLocked ? <Lock className="w-3 h-3" /> : <LockOpen className="w-3 h-3" />}
                          {traitLocked ? 'Trait locked' : 'Trait editable'}
                        </button>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {groupLocked ? 'Blocked by group lock' : traitLocked ? 'Excluded from assistant editing' : 'Available to assistant'}
                    </div>
                    <Input
                      value={modalValues[trait.key] || ''}
                      onChange={(event) => setModalValues((prev) => ({ ...prev, [trait.key]: event.target.value }))}
                      placeholder={`Enter ${trait.label.toLowerCase()}...`}
                    />
                  </div>
                );
              })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={applyModal}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import character from text</DialogTitle>
            <DialogDescription>
              Confirming import creates a new Character and initial CharacterVersion immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-medium">Import text</div>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder={['name: Mira', 'gender: female', 'eye_shape: almond', 'hair_color: black'].join('\n')}
                className="min-h-[260px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="text-xs font-medium">Resolved name</div>
                <Input value={importOverrideName} onChange={(event) => setImportOverrideName(event.target.value)} placeholder={importPreview.name || 'Set name if import text has no name'} />
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <div className="text-xs font-medium">Parsed preview</div>
                <div className="text-[11px] text-muted-foreground">Name: <span className="text-foreground">{effectiveImportName || 'Missing, confirmation blocked'}</span></div>
                <div className="text-[11px] text-muted-foreground">Gender: <span className="text-foreground">{importPreview.gender || 'Not provided'}</span></div>
                <div className="text-[11px] text-muted-foreground">Traits parsed: <span className="text-foreground">{Object.keys(importPreview.traits).length}</span></div>
                <div className="max-h-36 overflow-y-auto flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(importPreview.traits).map(([key, value]) => (
                    <span key={key} className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {traitLabel(key)}: {value}
                    </span>
                  ))}
                  {Object.keys(importPreview.traits).length === 0 && (
                    <span className="text-[11px] text-muted-foreground">No trait lines parsed yet.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmImport} disabled={!effectiveImportName || isImporting}>
              {isImporting ? 'Importing...' : 'Create from import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCloneDialogOpen} onOpenChange={setIsCloneDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Clone from saved version</DialogTitle>
            <DialogDescription>
              Cloning creates a new character using only the selected version&apos;s trait snapshot and editor state snapshot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="text-xs font-medium">New character name</div>
              <Input value={cloneName} onChange={(event) => setCloneName(event.target.value)} placeholder="Enter clone name..." />
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium">Available versions</div>
                <div className="text-[10px] text-muted-foreground">{versions.length} total</div>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-2">
                {versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => setSelectedCloneVersionId(version.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left ${selectedCloneVersionId === version.id
                      ? 'border-blue-500/40 bg-blue-500/10'
                      : 'border-border bg-background/60 hover:bg-muted/20'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium">Version {version.versionNumber}</span>
                      <span className="text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{version.changeSummary}</div>
                  </button>
                ))}
                {versions.length === 0 && (
                  <div className="text-[11px] text-muted-foreground">No saved versions available to clone.</div>
                )}
              </div>
            </div>

            {selectedCloneVersion && (
              <div className="rounded-lg border border-border bg-muted/10 p-3">
                <div className="text-xs font-medium">Clone preview</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(selectedCloneVersion.traitsSnapshot).map(([key, value]) => (
                    <span key={key} className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {traitLabel(key)}: {value}
                    </span>
                  ))}
                  {Object.keys(selectedCloneVersion.traitsSnapshot).length === 0 && (
                    <span className="text-[11px] text-muted-foreground">Selected version has no persisted traits.</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloneDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmClone} disabled={!selectedCloneVersion || !cloneName.trim() || isCloning}>
              {isCloning ? 'Cloning...' : 'Create clone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
