'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useStudio } from '@/lib/context/StudioContext';
import type { StudioSessionTemplateDraftState, StudioSessionTemplateSummary } from '@/lib/studio-sessions/types';
import type { CharacterSummary } from '@/lib/characters/types';

function EmptyWorkspaceState() {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      Select or create a workspace before using Studio Sessions.
    </div>
  );
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-white/45">{children}</div>;
}

function normalizeDraft(input: StudioSessionTemplateSummary | null): StudioSessionTemplateDraftState | null {
  if (!input) return null;
  return {
    ...input.draftState,
    generationSettings: { ...input.draftState.generationSettings },
    resolutionPolicy: { ...input.draftState.resolutionPolicy },
    categoryRules: input.draftState.categoryRules.map((rule) => ({
      ...rule,
      includedPoseIds: [...rule.includedPoseIds],
      excludedPoseIds: [...rule.excludedPoseIds],
      fixedPoseIds: [...rule.fixedPoseIds],
      weighting: rule.weighting ? { ...rule.weighting } : null,
      futureOverrideConfig: rule.futureOverrideConfig ? { ...rule.futureOverrideConfig } : null,
    })),
  };
}

function validateTemplateDraft(draft: StudioSessionTemplateDraftState): string | null {
  if (!draft.name.trim()) return 'Template name is required before explicit save.';
  if (draft.resolutionPolicy.shortSidePx < 64 || draft.resolutionPolicy.longSidePx < 64) {
    return 'Resolution sides must be at least 64 px.';
  }
  if (draft.resolutionPolicy.longSidePx < draft.resolutionPolicy.shortSidePx) {
    return 'Long side must be greater than or equal to short side.';
  }
  if (!draft.categoryRules.length) return 'At least one category rule is required.';
  const invalidRule = draft.categoryRules.find((rule) => rule.count < 0 || rule.count > 20);
  if (invalidRule) return `Category ${invalidRule.category} has an invalid count.`;
  const totalShots = draft.categoryRules.reduce((sum, rule) => sum + rule.count, 0);
  if (totalShots <= 0) return 'Saved templates must enable at least one category.';
  return null;
}

function TemplatesTab({ workspaceId }: { workspaceId: string | null }) {
  const [templates, setTemplates] = useState<StudioSessionTemplateSummary[]>([]);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StudioSessionTemplateDraftState | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [cloningTemplateId, setCloningTemplateId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savingCanonical, setSavingCanonical] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [editorMessage, setEditorMessage] = useState<string | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressAutoSaveRef = useRef(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === draft?.characterId) ?? null,
    [characters, draft?.characterId],
  );

  const hasUnsavedDraftChanges = useMemo(() => {
    if (!selectedTemplate || !draft) return false;
    return JSON.stringify(selectedTemplate.draftState) !== JSON.stringify(draft);
  }, [draft, selectedTemplate]);

  const hasUnsavedCanonicalChanges = useMemo(() => {
    if (!selectedTemplate || !draft) return false;
    return JSON.stringify(selectedTemplate.canonicalState) !== JSON.stringify(draft);
  }, [draft, selectedTemplate]);

  const totalShotCount = useMemo(
    () => draft?.categoryRules.reduce((sum, rule) => sum + rule.count, 0) ?? 0,
    [draft],
  );

  const validationError = useMemo(() => (draft ? validateTemplateDraft(draft) : null), [draft]);

  const fetchTemplates = useCallback(async (nextWorkspaceId: string) => {
    setLoadingTemplates(true);
    setTemplatesError(null);
    try {
      const response = await fetch(`/api/studio-sessions/templates?workspaceId=${encodeURIComponent(nextWorkspaceId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to fetch Studio Session templates');
      }
      const nextTemplates = Array.isArray(data.templates) ? data.templates as StudioSessionTemplateSummary[] : [];
      setTemplates(nextTemplates);
      setSelectedTemplateId((current) => current && nextTemplates.some((template) => template.id === current) ? current : nextTemplates[0]?.id ?? null);
    } catch (error) {
      setTemplates([]);
      setSelectedTemplateId(null);
      setDraft(null);
      setTemplatesError(toErrorMessage(error, 'Failed to fetch Studio Session templates'));
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const fetchCharacters = useCallback(async () => {
    setLoadingCharacters(true);
    try {
      const response = await fetch('/api/characters', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to fetch characters');
      }
      setCharacters(Array.isArray(data.characters) ? data.characters as CharacterSummary[] : []);
    } catch (error) {
      setCharacters([]);
      setEditorMessage(toErrorMessage(error, 'Failed to fetch characters'));
    } finally {
      setLoadingCharacters(false);
    }
  }, []);

  useEffect(() => {
    if (!workspaceId) {
      setTemplates([]);
      setCharacters([]);
      setSelectedTemplateId(null);
      setDraft(null);
      setTemplatesError(null);
      setEditorMessage(null);
      setAutoSaveState('idle');
      return;
    }

    void fetchTemplates(workspaceId);
    void fetchCharacters();
  }, [fetchCharacters, fetchTemplates, workspaceId]);

  useEffect(() => {
    suppressAutoSaveRef.current = true;
    setDraft(normalizeDraft(selectedTemplate));
    setEditorMessage(null);
    setAutoSaveState('idle');
  }, [selectedTemplateId, selectedTemplate]);

  const persistDraft = useCallback(async (nextDraft: StudioSessionTemplateDraftState, templateId: string, mode: 'draft' | 'save') => {
    const response = await fetch(`/api/studio-sessions/templates/${templateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        name: nextDraft.name,
        characterId: nextDraft.characterId,
        draftState: nextDraft,
        canonicalState: nextDraft,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success || !data.template) {
      throw new Error(typeof data?.error === 'string' ? data.error : `Failed to ${mode === 'save' ? 'save template' : 'autosave draft'}`);
    }
    return data.template as StudioSessionTemplateSummary;
  }, []);

  const handleCreateTemplate = useCallback(async () => {
    if (!workspaceId) return;
    setCreatingTemplate(true);
    setTemplatesError(null);
    try {
      const response = await fetch('/api/studio-sessions/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, name: `New Session Template ${templates.length + 1}` }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success || !data.template) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to create template');
      }
      const created = data.template as StudioSessionTemplateSummary;
      setTemplates((current) => [created, ...current]);
      setSelectedTemplateId(created.id);
      setEditorMessage('Template created. Draft autosave is active; explicit Save updates canonical template state.');
    } catch (error) {
      setTemplatesError(toErrorMessage(error, 'Failed to create template'));
    } finally {
      setCreatingTemplate(false);
    }
  }, [templates.length, workspaceId]);

  const handleCloneTemplate = useCallback(async (templateId: string) => {
    setCloningTemplateId(templateId);
    setTemplatesError(null);
    try {
      const response = await fetch(`/api/studio-sessions/templates/${templateId}/clone`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data?.success || !data.template) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to clone template');
      }
      const cloned = data.template as StudioSessionTemplateSummary;
      setTemplates((current) => [cloned, ...current]);
      setSelectedTemplateId(cloned.id);
      setEditorMessage('Template cloned.');
    } catch (error) {
      setTemplatesError(toErrorMessage(error, 'Failed to clone template'));
    } finally {
      setCloningTemplateId(null);
    }
  }, []);

  const handleExplicitSave = useCallback(async () => {
    if (!selectedTemplateId || !draft || validationError) return;
    setSavingCanonical(true);
    setEditorMessage(null);
    try {
      const updated = await persistDraft(draft, selectedTemplateId, 'save');
      setTemplates((current) => current.map((template) => template.id === updated.id ? updated : template));
      suppressAutoSaveRef.current = true;
      setDraft(normalizeDraft(updated));
      setAutoSaveState('saved');
      setEditorMessage('Template saved. Create Run can now trust this canonical state.');
    } catch (error) {
      setAutoSaveState('error');
      setEditorMessage(toErrorMessage(error, 'Failed to save template'));
    } finally {
      setSavingCanonical(false);
    }
  }, [draft, persistDraft, selectedTemplateId, validationError]);

  useEffect(() => {
    if (!selectedTemplateId || !draft) return;
    if (suppressAutoSaveRef.current) {
      suppressAutoSaveRef.current = false;
      return;
    }
    if (!hasUnsavedDraftChanges) {
      setAutoSaveState('idle');
      return;
    }

    setAutoSaveState('dirty');
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);

    autoSaveTimeoutRef.current = setTimeout(() => {
      setAutoSaveState('saving');
      void persistDraft(draft, selectedTemplateId, 'draft')
        .then((updated) => {
          setTemplates((current) => current.map((template) => template.id === updated.id ? updated : template));
          suppressAutoSaveRef.current = true;
          setDraft(normalizeDraft(updated));
          setAutoSaveState('saved');
        })
        .catch((error) => {
          setAutoSaveState('error');
          setEditorMessage(toErrorMessage(error, 'Failed to autosave draft'));
        });
    }, 700);

    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [draft, hasUnsavedDraftChanges, persistDraft, selectedTemplateId]);

  return (
    <div className="space-y-4">
      {!workspaceId ? (
        <EmptyWorkspaceState />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="flex min-h-[720px] flex-col border-white/10 bg-white/5">
            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardDescription>Templates</CardDescription>
                  <CardTitle className="text-lg">Studio Session templates</CardTitle>
                </div>
                <Button size="sm" onClick={() => void handleCreateTemplate()} disabled={creatingTemplate}>
                  {creatingTemplate ? 'Creating…' : 'New template'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4 text-sm text-white/70">
              {templatesError ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{templatesError}</div> : null}
              {loadingTemplates ? (
                <div className="rounded-lg border border-white/10 bg-black/10 px-4 py-8 text-center text-white/50">Loading templates…</div>
              ) : templates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-white/50">No templates yet for this workspace.</div>
              ) : (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {templates.map((template) => {
                    const isSelected = template.id === selectedTemplateId;
                    const categoryCount = template.categoryRules.reduce((sum, rule) => sum + rule.count, 0);
                    return (
                      <div key={template.id} className={`rounded-lg border p-3 transition ${isSelected ? 'border-blue-400/50 bg-blue-500/10' : 'border-white/10 bg-black/10 hover:bg-white/[0.04]'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-white">{template.name || 'Untitled template'}</div>
                            <div className="mt-1 text-xs text-white/50">Updated {new Date(template.updatedAt).toLocaleString()}</div>
                          </div>
                          <div className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-white/50">{template.status}</div>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-white/55 sm:grid-cols-2">
                          <div>Character: <span className="text-white/75">{template.characterId ? 'linked' : 'none'}</span></div>
                          <div>Shot plan: <span className="text-white/75">{categoryCount} slots</span></div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant={isSelected ? 'secondary' : 'outline'} onClick={() => setSelectedTemplateId(template.id)}>{isSelected ? 'Opened' : 'Open'}</Button>
                          <Button size="sm" variant="outline" onClick={() => void handleCloneTemplate(template.id)} disabled={cloningTemplateId === template.id}>{cloningTemplateId === template.id ? 'Cloning…' : 'Clone'}</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex min-h-[720px] flex-col border-white/10 bg-white/5">
            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardDescription>Editor</CardDescription>
                  <CardTitle className="text-lg">Template planning and save model</CardTitle>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                  <div className={`rounded-full border px-2.5 py-1 ${autoSaveState === 'error' ? 'border-red-500/30 text-red-200' : autoSaveState === 'saving' ? 'border-blue-500/30 text-blue-200' : autoSaveState === 'saved' ? 'border-emerald-500/30 text-emerald-200' : 'border-white/10 text-white/55'}`}>
                    Draft {autoSaveState === 'dirty' ? 'pending autosave' : autoSaveState}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void handleExplicitSave()} disabled={!draft || savingCanonical || Boolean(validationError) || !hasUnsavedCanonicalChanges}>
                    {savingCanonical ? 'Saving…' : 'Save template'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-white/70">
              {!selectedTemplate || !draft ? (
                <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-white/50">Select or create a template to edit its base fields.</div>
              ) : (
                <div className="space-y-5">
                  {editorMessage ? <div className="rounded-lg border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/70">{editorMessage}</div> : null}
                  {validationError ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{validationError}</div> : null}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4 lg:col-span-2">
                      <Label>Template name</Label>
                      <Input value={draft.name} onChange={(event) => setDraft((current) => current ? { ...current, name: event.target.value } : current)} placeholder="Session template name" />
                    </label>

                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4">
                      <Label>Character</Label>
                      <select value={draft.characterId ?? ''} onChange={(event) => setDraft((current) => current ? { ...current, characterId: event.target.value || null } : current)} className="h-10 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">No character selected</option>
                        {characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
                      </select>
                      <div className="mt-2 text-xs text-white/50">{loadingCharacters ? 'Loading characters…' : selectedCharacter ? `${selectedCharacter.name}${selectedCharacter.previewStatusSummary ? ` — ${selectedCharacter.previewStatusSummary}` : ''}` : 'Uses existing Character Manager records.'}</div>
                    </label>

                    <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                      <Label>Character snapshot note</Label>
                      <div className="text-sm text-white/70">{selectedCharacter ? <><div className="font-medium text-white">{selectedCharacter.name}</div><div className="mt-1 text-white/55">Gender: {selectedCharacter.gender || 'not set'}</div></> : 'Character link is optional at template stage.'}</div>
                    </div>

                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4">
                      <Label>Environment</Label>
                      <textarea value={draft.environmentText} onChange={(event) => setDraft((current) => current ? { ...current, environmentText: event.target.value } : current)} placeholder="Environment direction for the whole session" className="min-h-[110px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </label>

                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4">
                      <Label>Outfit</Label>
                      <textarea value={draft.outfitText} onChange={(event) => setDraft((current) => current ? { ...current, outfitText: event.target.value } : current)} placeholder="Reusable outfit direction" className="min-h-[110px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </label>

                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4">
                      <Label>Hairstyle</Label>
                      <textarea value={draft.hairstyleText} onChange={(event) => setDraft((current) => current ? { ...current, hairstyleText: event.target.value } : current)} placeholder="Reusable hairstyle direction" className="min-h-[110px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </label>

                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4 lg:col-span-2">
                      <Label>Master positive prompt</Label>
                      <textarea value={draft.positivePrompt} onChange={(event) => setDraft((current) => current ? { ...current, positivePrompt: event.target.value } : current)} placeholder="Base positive prompt for the whole session" className="min-h-[140px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </label>

                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4 lg:col-span-2">
                      <Label>Master negative prompt</Label>
                      <textarea value={draft.negativePrompt} onChange={(event) => setDraft((current) => current ? { ...current, negativePrompt: event.target.value } : current)} placeholder="Base negative prompt for the whole session" className="min-h-[140px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </label>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4">
                      <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <Label>Generation settings</Label>
                            <div className="text-xs text-white/50">Template-level defaults only. Draft autosave keeps them separate from canonical Save.</div>
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="block">
                            <Label>Model ID</Label>
                            <Input value={typeof draft.generationSettings.modelId === 'string' ? draft.generationSettings.modelId : ''} onChange={(event) => setDraft((current) => current ? { ...current, generationSettings: { ...current.generationSettings, modelId: event.target.value || null } } : current)} placeholder="e.g. flux-dev" />
                          </label>
                          <label className="block">
                            <Label>Sampler</Label>
                            <Input value={typeof draft.generationSettings.sampler === 'string' ? draft.generationSettings.sampler : ''} onChange={(event) => setDraft((current) => current ? { ...current, generationSettings: { ...current.generationSettings, sampler: event.target.value || null } } : current)} placeholder="e.g. euler" />
                          </label>
                          <label className="block">
                            <Label>Steps</Label>
                            <Input type="number" min={1} value={typeof draft.generationSettings.steps === 'number' ? draft.generationSettings.steps : ''} onChange={(event) => setDraft((current) => current ? { ...current, generationSettings: { ...current.generationSettings, steps: event.target.value ? Number(event.target.value) : null } } : current)} placeholder="28" />
                          </label>
                          <label className="block">
                            <Label>CFG scale</Label>
                            <Input type="number" step="0.1" min={0} value={typeof draft.generationSettings.cfgScale === 'number' ? draft.generationSettings.cfgScale : ''} onChange={(event) => setDraft((current) => current ? { ...current, generationSettings: { ...current.generationSettings, cfgScale: event.target.value ? Number(event.target.value) : null } } : current)} placeholder="4.5" />
                          </label>
                          <label className="block">
                            <Label>Seed</Label>
                            <Input type="number" value={typeof draft.generationSettings.seed === 'number' ? draft.generationSettings.seed : ''} onChange={(event) => setDraft((current) => current ? { ...current, generationSettings: { ...current.generationSettings, seed: event.target.value ? Number(event.target.value) : null } } : current)} placeholder="Optional" />
                          </label>
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                        <Label>Resolution policy</Label>
                        <div className="grid gap-4 md:grid-cols-3">
                          <label className="block">
                            <Label>Short side</Label>
                            <Input type="number" min={64} value={draft.resolutionPolicy.shortSidePx} onChange={(event) => setDraft((current) => current ? { ...current, resolutionPolicy: { ...current.resolutionPolicy, shortSidePx: Math.max(64, Number(event.target.value) || 64) } } : current)} />
                          </label>
                          <label className="block">
                            <Label>Long side</Label>
                            <Input type="number" min={64} value={draft.resolutionPolicy.longSidePx} onChange={(event) => setDraft((current) => current ? { ...current, resolutionPolicy: { ...current.resolutionPolicy, longSidePx: Math.max(64, Number(event.target.value) || 64) } } : current)} />
                          </label>
                          <label className="block">
                            <Label>Square source</Label>
                            <select value={draft.resolutionPolicy.squareSideSource} onChange={(event) => setDraft((current) => current ? { ...current, resolutionPolicy: { ...current.resolutionPolicy, squareSideSource: event.target.value === 'long' ? 'long' : 'short' } } : current)} className="h-10 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500">
                              <option value="short">Short side</option>
                              <option value="long">Long side</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Label>Shot categories</Label>
                          <div className="text-xs text-white/50">0..20 per category. 0 disables the category for saved templates.</div>
                        </div>
                        <div className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/65">Total {totalShotCount}</div>
                      </div>
                      <div className="mt-4 max-h-[420px] space-y-4 overflow-y-auto pr-2">
                        {draft.categoryRules.map((rule, index) => (
                          <div key={rule.category} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium capitalize text-white">{rule.category.replace(/_/g, ' ')}</div>
                              <div className="text-sm text-white/70">{rule.count}</div>
                            </div>
                            <Slider value={[rule.count]} min={0} max={20} step={1} className="mt-3" onValueChange={(value) => setDraft((current) => current ? {
                              ...current,
                              categoryRules: current.categoryRules.map((item, itemIndex) => itemIndex === index ? { ...item, count: value[0] ?? 0 } : item),
                            } : current)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function RunsTab({ workspaceId }: { workspaceId: string | null }) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="border-b border-white/10 pb-4">
        <CardDescription>Runs</CardDescription>
        <CardTitle className="text-lg">Run workspace shell</CardTitle>
      </CardHeader>
      <CardContent className="p-4 text-sm text-white/70">
        {!workspaceId ? (
          <EmptyWorkspaceState />
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-white/50">
            Runs surface is reserved for ENGUI-228.* after template persistence is in place.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function StudioSessionsPageClient() {
  const { activeWorkspaceId, workspaces } = useStudio();
  const [tab, setTab] = useState<'templates' | 'runs'>('templates');

  const effectiveWorkspaceId = useMemo(() => activeWorkspaceId || workspaces[0]?.id || null, [activeWorkspaceId, workspaces]);

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-white">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/45">Studio Sessions</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Studio Photo Session</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/60">
              Separate desktop workspace for reusable session templates and immutable run-based review flows.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/65">
            Active workspace: <span className="font-medium text-white">{effectiveWorkspaceId ?? 'none selected'}</span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
        <Tabs value={tab} onValueChange={(value) => setTab(value as 'templates' | 'runs')} className="flex min-h-0 flex-col gap-4">
          <TabsList className="w-fit bg-white/[0.05]">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-0">
            <TemplatesTab workspaceId={effectiveWorkspaceId} />
          </TabsContent>

          <TabsContent value="runs" className="mt-0">
            <RunsTab workspaceId={effectiveWorkspaceId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
