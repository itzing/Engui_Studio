'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [editorMessage, setEditorMessage] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === draft?.characterId) ?? null,
    [characters, draft?.characterId],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedTemplate || !draft) return false;
    return JSON.stringify(selectedTemplate.draftState) !== JSON.stringify(draft);
  }, [draft, selectedTemplate]);

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
      setSelectedTemplateId((current) => {
        if (current && nextTemplates.some((template) => template.id === current)) return current;
        return nextTemplates[0]?.id ?? null;
      });
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
      return;
    }

    void fetchTemplates(workspaceId);
    void fetchCharacters();
  }, [fetchCharacters, fetchTemplates, workspaceId]);

  useEffect(() => {
    setDraft(normalizeDraft(selectedTemplate));
    setEditorMessage(null);
  }, [selectedTemplateId, selectedTemplate]);

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
      setDraft(normalizeDraft(created));
      setEditorMessage('Template created. You can edit the base fields now.');
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
      setDraft(normalizeDraft(cloned));
      setEditorMessage('Template cloned.');
    } catch (error) {
      setTemplatesError(toErrorMessage(error, 'Failed to clone template'));
    } finally {
      setCloningTemplateId(null);
    }
  }, []);

  const handleSaveDraft = useCallback(async () => {
    if (!selectedTemplateId || !draft) return;
    setSavingDraft(true);
    setEditorMessage(null);
    try {
      const response = await fetch(`/api/studio-sessions/templates/${selectedTemplateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          characterId: draft.characterId,
          draftState: draft,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success || !data.template) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to save template draft');
      }
      const updated = data.template as StudioSessionTemplateSummary;
      setTemplates((current) => current.map((template) => template.id === updated.id ? updated : template));
      setSelectedTemplateId(updated.id);
      setDraft(normalizeDraft(updated));
      setEditorMessage('Draft saved.');
    } catch (error) {
      setEditorMessage(toErrorMessage(error, 'Failed to save template draft'));
    } finally {
      setSavingDraft(false);
    }
  }, [draft, selectedTemplateId]);

  return (
    <div className="space-y-4">
      {!workspaceId ? (
        <EmptyWorkspaceState />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="flex min-h-[640px] flex-col border-white/10 bg-white/5">
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
              {templatesError ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {templatesError}
                </div>
              ) : null}
              {loadingTemplates ? (
                <div className="rounded-lg border border-white/10 bg-black/10 px-4 py-8 text-center text-white/50">Loading templates…</div>
              ) : templates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-white/50">
                  No templates yet for this workspace.
                </div>
              ) : (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {templates.map((template) => {
                    const isSelected = template.id === selectedTemplateId;
                    const categoryCount = template.categoryRules.reduce((sum, rule) => sum + rule.count, 0);
                    return (
                      <div
                        key={template.id}
                        className={`rounded-lg border p-3 transition ${isSelected ? 'border-blue-400/50 bg-blue-500/10' : 'border-white/10 bg-black/10 hover:bg-white/[0.04]'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-white">{template.name || 'Untitled template'}</div>
                            <div className="mt-1 text-xs text-white/50">Updated {new Date(template.updatedAt).toLocaleString()}</div>
                          </div>
                          <div className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-white/50">
                            {template.status}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-white/55 sm:grid-cols-2">
                          <div>Character: <span className="text-white/75">{template.characterId ? 'linked' : 'none'}</span></div>
                          <div>Shot plan: <span className="text-white/75">{categoryCount} slots</span></div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant={isSelected ? 'secondary' : 'outline'} onClick={() => setSelectedTemplateId(template.id)}>
                            {isSelected ? 'Opened' : 'Open'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void handleCloneTemplate(template.id)} disabled={cloningTemplateId === template.id}>
                            {cloningTemplateId === template.id ? 'Cloning…' : 'Clone'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex min-h-[640px] flex-col border-white/10 bg-white/5">
            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardDescription>Editor</CardDescription>
                  <CardTitle className="text-lg">Template base form</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {hasUnsavedChanges ? <div className="text-xs text-amber-300">Unsaved changes</div> : null}
                  <Button size="sm" onClick={() => void handleSaveDraft()} disabled={!draft || savingDraft || !hasUnsavedChanges}>
                    {savingDraft ? 'Saving…' : 'Save draft'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-white/70">
              {!selectedTemplate || !draft ? (
                <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-white/50">
                  Select or create a template to edit its base fields.
                </div>
              ) : (
                <div className="space-y-5">
                  {editorMessage ? (
                    <div className="rounded-lg border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/70">
                      {editorMessage}
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4 lg:col-span-2">
                      <Label>Template name</Label>
                      <Input
                        value={draft.name}
                        onChange={(event) => setDraft((current) => current ? { ...current, name: event.target.value } : current)}
                        placeholder="Session template name"
                      />
                    </label>

                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4">
                      <Label>Character</Label>
                      <select
                        value={draft.characterId ?? ''}
                        onChange={(event) => setDraft((current) => current ? { ...current, characterId: event.target.value || null } : current)}
                        className="h-10 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">No character selected</option>
                        {characters.map((character) => (
                          <option key={character.id} value={character.id}>{character.name}</option>
                        ))}
                      </select>
                      <div className="mt-2 text-xs text-white/50">
                        {loadingCharacters ? 'Loading characters…' : selectedCharacter ? `${selectedCharacter.name}${selectedCharacter.previewStatusSummary ? ` — ${selectedCharacter.previewStatusSummary}` : ''}` : 'Uses existing Character Manager records.'}
                      </div>
                    </label>

                    <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                      <Label>Character snapshot note</Label>
                      <div className="text-sm text-white/70">
                        {selectedCharacter ? (
                          <>
                            <div className="font-medium text-white">{selectedCharacter.name}</div>
                            <div className="mt-1 text-white/55">Gender: {selectedCharacter.gender || 'not set'}</div>
                          </>
                        ) : 'Character link is optional at template stage.'}
                      </div>
                    </div>

                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4">
                      <Label>Environment</Label>
                      <textarea
                        value={draft.environmentText}
                        onChange={(event) => setDraft((current) => current ? { ...current, environmentText: event.target.value } : current)}
                        placeholder="Environment direction for the whole session"
                        className="min-h-[110px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>

                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4">
                      <Label>Outfit</Label>
                      <textarea
                        value={draft.outfitText}
                        onChange={(event) => setDraft((current) => current ? { ...current, outfitText: event.target.value } : current)}
                        placeholder="Reusable outfit direction"
                        className="min-h-[110px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>

                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4">
                      <Label>Hairstyle</Label>
                      <textarea
                        value={draft.hairstyleText}
                        onChange={(event) => setDraft((current) => current ? { ...current, hairstyleText: event.target.value } : current)}
                        placeholder="Reusable hairstyle direction"
                        className="min-h-[110px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>

                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4 lg:col-span-2">
                      <Label>Master positive prompt</Label>
                      <textarea
                        value={draft.positivePrompt}
                        onChange={(event) => setDraft((current) => current ? { ...current, positivePrompt: event.target.value } : current)}
                        placeholder="Base positive prompt for the whole session"
                        className="min-h-[140px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>

                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4 lg:col-span-2">
                      <Label>Master negative prompt</Label>
                      <textarea
                        value={draft.negativePrompt}
                        onChange={(event) => setDraft((current) => current ? { ...current, negativePrompt: event.target.value } : current)}
                        placeholder="Base negative prompt for the whole session"
                        className="min-h-[140px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
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
