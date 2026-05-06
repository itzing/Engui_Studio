'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoRAManagementDialog } from '@/components/lora/LoRAManagementDialog';
import { type LoRAFile } from '@/components/lora/LoRASelector';
import { useStudio } from '@/lib/context/StudioContext';
import type {
  StudioSessionPoseSnapshot,
  StudioSessionRunDetailSummary,
  StudioSessionRunSummary,
  StudioSessionShotRevisionSummary,
  StudioSessionShotSummary,
  StudioSessionShotVersionSummary,
  StudioSessionTemplateDraftState,
  StudioSessionTemplateSummary,
} from '@/lib/studio-sessions/types';
import { listPrimaryStudioSessionVersions, selectPrimaryStudioSessionVersion, sortStudioSessionVersions } from '@/lib/studio-sessions/view';
import type { CharacterSummary } from '@/lib/characters/types';
import { sanitizeHydratedLoraParameterValues } from '@/lib/create/loraDraftSanitizer';
import { getModelById, getModelsByType } from '@/lib/models/modelConfig';

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

function cloneTemplateDraftState(input: StudioSessionTemplateDraftState): StudioSessionTemplateDraftState {
  return {
    ...input,
    generationSettings: { ...input.generationSettings },
    resolutionPolicy: { ...input.resolutionPolicy },
    categoryRules: input.categoryRules.map((rule) => ({
      ...rule,
      includedPoseIds: [...rule.includedPoseIds],
      excludedPoseIds: [...rule.excludedPoseIds],
      fixedPoseIds: [...rule.fixedPoseIds],
      weighting: rule.weighting ? { ...rule.weighting } : null,
      futureOverrideConfig: rule.futureOverrideConfig ? { ...rule.futureOverrideConfig } : null,
    })),
  };
}

function normalizeDraft(input: StudioSessionTemplateSummary | null): StudioSessionTemplateDraftState | null {
  if (!input) return null;
  return cloneTemplateDraftState(input.draftState);
}

function normalizeCanonicalState(input: StudioSessionTemplateSummary | null): StudioSessionTemplateDraftState | null {
  if (!input) return null;
  return cloneTemplateDraftState({
    name: input.canonicalState.name,
    characterId: input.canonicalState.characterId,
    characterAge: input.canonicalState.characterAge,
    environmentText: input.canonicalState.environmentText,
    outfitText: input.canonicalState.outfitText,
    hairstyleText: input.canonicalState.hairstyleText,
    positivePrompt: input.canonicalState.positivePrompt,
    negativePrompt: input.canonicalState.negativePrompt,
    generationSettings: input.canonicalState.generationSettings,
    resolutionPolicy: input.canonicalState.resolutionPolicy,
    categoryRules: input.canonicalState.categoryRules,
  });
}

function validateTemplateDraft(draft: StudioSessionTemplateDraftState): string | null {
  if (!draft.name.trim()) return 'Template name is required before explicit save.';
  if (draft.resolutionPolicy.shortSidePx < 64 || draft.resolutionPolicy.longSidePx < 64) return 'Resolution sides must be at least 64 px.';
  if (draft.resolutionPolicy.longSidePx < draft.resolutionPolicy.shortSidePx) return 'Long side must be greater than or equal to short side.';
  if (!draft.categoryRules.length) return 'At least one category rule is required.';
  const invalidRule = draft.categoryRules.find((rule) => rule.count < 0 || rule.count > 20);
  if (invalidRule) return `Category ${invalidRule.category} has an invalid count.`;
  const totalShots = draft.categoryRules.reduce((sum, rule) => sum + rule.count, 0);
  if (totalShots <= 0) return 'Saved templates must enable at least one category.';
  return null;
}

function getStudioSessionLoraWeightParamName(loraParamName: string) {
  return loraParamName === 'lora' ? 'loraWeight' : loraParamName.replace(/^lora/, 'loraWeight');
}

function groupShotsByCategory(shots: StudioSessionShotSummary[]) {
  const groups = new Map<string, StudioSessionShotSummary[]>();
  for (const shot of shots) {
    const current = groups.get(shot.category) || [];
    current.push(shot);
    groups.set(shot.category, current);
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, items]) => ({ category, shots: items.sort((a, b) => a.slotIndex - b.slotIndex) }));
}

function humanizeCategory(category: string) {
  return category.split(/[_\s-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function TemplatesTab({ workspaceId, onRunCreated, onOpenRuns }: { workspaceId: string | null; onRunCreated: () => void; onOpenRuns: () => void; }) {
  const [templates, setTemplates] = useState<StudioSessionTemplateSummary[]>([]);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StudioSessionTemplateDraftState | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [cloningTemplateId, setCloningTemplateId] = useState<string | null>(null);
  const [creatingRunTemplateId, setCreatingRunTemplateId] = useState<string | null>(null);
  const [savingCanonical, setSavingCanonical] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [editorMessage, setEditorMessage] = useState<string | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [showLoRADialog, setShowLoRADialog] = useState(false);
  const [showDesktopLoraSelector, setShowDesktopLoraSelector] = useState(false);
  const [availableLoras, setAvailableLoras] = useState<LoRAFile[]>([]);
  const [isLoadingLoras, setIsLoadingLoras] = useState(false);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressAutoSaveRef = useRef(false);

  const studioImageModels = useMemo(() => getModelsByType('image').filter((model) => model.inputs.includes('text') && model.id !== 'upscale'), []);
  const selectedTemplate = useMemo(() => templates.find((template) => template.id === selectedTemplateId) ?? null, [templates, selectedTemplateId]);
  const selectedCharacter = useMemo(() => characters.find((character) => character.id === draft?.characterId) ?? null, [characters, draft?.characterId]);
  const currentStudioModel = useMemo(() => getModelById(typeof draft?.generationSettings.modelId === 'string' ? draft.generationSettings.modelId : 'z-image') ?? getModelById('z-image') ?? studioImageModels[0], [draft?.generationSettings.modelId, studioImageModels]);
  const studioLoraParamNames = useMemo(() => (currentStudioModel?.parameters || []).filter((param) => param.type === 'lora-selector').map((param) => param.name), [currentStudioModel]);
  const isZImageStudioModel = currentStudioModel?.id === 'z-image';
  const zImageAddCap = 8;
  const zImageDynamicLoraParamNames = useMemo(() => {
    if (!isZImageStudioModel) return [];
    const names = new Set<string>(studioLoraParamNames);
    Object.keys(draft?.generationSettings || {})
      .filter((key) => /^lora\d*$/.test(key) && !/^loraWeight\d*$/.test(key))
      .forEach((key) => names.add(key));
    return Array.from(names).sort((a, b) => {
      const getIndex = (value: string) => value === 'lora' ? 1 : Number.parseInt(value.slice(4), 10);
      return getIndex(a) - getIndex(b);
    });
  }, [draft?.generationSettings, isZImageStudioModel, studioLoraParamNames]);
  const selectedZImageLoraSlots = useMemo(() => zImageDynamicLoraParamNames
    .map((paramName) => {
      const path = String(draft?.generationSettings[paramName] ?? '').trim();
      if (!path) return null;
      const matchedLoRA = availableLoras.find((lora) => lora.s3Path === path);
      const weightParamName = getStudioSessionLoraWeightParamName(paramName);
      const rawWeight = draft?.generationSettings[weightParamName];
      const weight = typeof rawWeight === 'number' ? rawWeight : Number(rawWeight ?? 1);
      return {
        paramName,
        path,
        matchedLoRA,
        weightParamName,
        weight: Number.isFinite(weight) ? weight : 1,
      };
    })
    .filter((slot): slot is NonNullable<typeof slot> => slot !== null), [availableLoras, draft?.generationSettings, zImageDynamicLoraParamNames]);
  const nextEmptyZImageLoraParam = useMemo(() => {
    if (!isZImageStudioModel) return null;
    for (let i = 1; i <= zImageAddCap; i += 1) {
      const name = i === 1 ? 'lora' : `lora${i}`;
      if (!String(draft?.generationSettings[name] ?? '').trim()) {
        return name;
      }
    }
    return null;
  }, [draft?.generationSettings, isZImageStudioModel]);
  const normalizedCanonicalState = useMemo(() => normalizeCanonicalState(selectedTemplate), [selectedTemplate]);
  const hasUnsavedDraftChanges = useMemo(() => !!selectedTemplate && !!draft && JSON.stringify(selectedTemplate.draftState) !== JSON.stringify(draft), [draft, selectedTemplate]);
  const hasUnsavedCanonicalChanges = useMemo(() => !!normalizedCanonicalState && !!draft && JSON.stringify(normalizedCanonicalState) !== JSON.stringify(draft), [draft, normalizedCanonicalState]);
  const totalShotCount = useMemo(() => draft?.categoryRules.reduce((sum, rule) => sum + rule.count, 0) ?? 0, [draft]);
  const validationError = useMemo(() => draft ? validateTemplateDraft(draft) : null, [draft]);

  const fetchTemplates = useCallback(async (nextWorkspaceId: string) => {
    setLoadingTemplates(true);
    setTemplatesError(null);
    try {
      const response = await fetch(`/api/studio-sessions/templates?workspaceId=${encodeURIComponent(nextWorkspaceId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to fetch Studio Session templates');
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
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to fetch characters');
      setCharacters(Array.isArray(data.characters) ? data.characters as CharacterSummary[] : []);
    } catch (error) {
      setCharacters([]);
      setEditorMessage(toErrorMessage(error, 'Failed to fetch characters'));
    } finally {
      setLoadingCharacters(false);
    }
  }, []);

  const fetchAvailableLoras = useCallback(async () => {
    if (!workspaceId || !currentStudioModel?.parameters.some((param) => param.type === 'lora-selector')) {
      setAvailableLoras([]);
      return;
    }

    setIsLoadingLoras(true);
    try {
      const response = await fetch(`/api/lora?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.success || !Array.isArray(data.loras)) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to fetch LoRAs');
      }
      setAvailableLoras(data.loras as LoRAFile[]);
      setDraft((current) => {
        if (!current) return current;
        const sanitized = sanitizeHydratedLoraParameterValues(
          currentStudioModel.id,
          current.generationSettings as Record<string, any>,
          (data.loras as LoRAFile[]).map((lora) => lora.s3Path),
        );
        if (!sanitized.changed) return current;
        return { ...current, generationSettings: sanitized.parameterValues || current.generationSettings };
      });
    } catch (error) {
      setAvailableLoras([]);
      setEditorMessage(toErrorMessage(error, 'Failed to fetch LoRAs'));
    } finally {
      setIsLoadingLoras(false);
    }
  }, [currentStudioModel, workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      setTemplates([]);
      setCharacters([]);
      setSelectedTemplateId(null);
      setDraft(null);
      setTemplatesError(null);
      setEditorMessage(null);
      setAutoSaveState('idle');
      setAvailableLoras([]);
      return;
    }
    void fetchTemplates(workspaceId);
    void fetchCharacters();
  }, [fetchCharacters, fetchTemplates, workspaceId]);

  useEffect(() => {
    if (currentStudioModel?.parameters.some((param) => param.type === 'lora-selector')) {
      void fetchAvailableLoras();
    } else {
      setAvailableLoras([]);
    }
  }, [currentStudioModel, fetchAvailableLoras, showLoRADialog]);

  useEffect(() => {
    suppressAutoSaveRef.current = true;
    setDraft(normalizeDraft(selectedTemplate));
    setEditorMessage(null);
    setAutoSaveState('idle');
  }, [selectedTemplateId, selectedTemplate]);

  const updateDraftGenerationSettings = useCallback((patch: Record<string, unknown>) => {
    setDraft((current) => current ? { ...current, generationSettings: { ...current.generationSettings, ...patch } } : current);
  }, []);

  const persistDraft = useCallback(async (nextDraft: StudioSessionTemplateDraftState, templateId: string, mode: 'draft' | 'save') => {
    const response = await fetch(`/api/studio-sessions/templates/${templateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, name: nextDraft.name, characterId: nextDraft.characterId, draftState: nextDraft, canonicalState: nextDraft }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success || !data.template) throw new Error(typeof data?.error === 'string' ? data.error : `Failed to ${mode === 'save' ? 'save template' : 'autosave draft'}`);
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
      if (!response.ok || !data?.success || !data.template) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to create template');
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
      if (!response.ok || !data?.success || !data.template) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to clone template');
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

  const handleCreateRun = useCallback(async (templateId: string) => {
    if (!workspaceId) return;
    setCreatingRunTemplateId(templateId);
    setTemplatesError(null);
    try {
      const response = await fetch('/api/studio-sessions/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, templateId }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success || !data.run) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to create run');
      setEditorMessage('Run created from canonical template snapshot.');
      onRunCreated();
      onOpenRuns();
    } catch (error) {
      setTemplatesError(toErrorMessage(error, 'Failed to create run'));
    } finally {
      setCreatingRunTemplateId(null);
    }
  }, [onOpenRuns, onRunCreated, workspaceId]);

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
      {!workspaceId ? <EmptyWorkspaceState /> : (
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="flex min-h-[720px] flex-col border-white/10 bg-white/5">
            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardDescription>Templates</CardDescription>
                  <CardTitle className="text-lg">Studio Session templates</CardTitle>
                </div>
                <Button size="sm" onClick={() => void handleCreateTemplate()} disabled={creatingTemplate}>{creatingTemplate ? 'Creating…' : 'New template'}</Button>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4 text-sm text-white/70">
              {templatesError ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{templatesError}</div> : null}
              {loadingTemplates ? <div className="rounded-lg border border-white/10 bg-black/10 px-4 py-8 text-center text-white/50">Loading templates…</div> : templates.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-white/50">No templates yet for this workspace.</div> : (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {templates.map((template) => {
                    const isSelected = template.id === selectedTemplateId;
                    const categoryCount = template.categoryRules.reduce((sum, rule) => sum + rule.count, 0);
                    const canCreateRun = template.id === selectedTemplateId ? !hasUnsavedCanonicalChanges && !validationError : true;
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
                          <Button size="sm" onClick={() => void handleCreateRun(template.id)} disabled={creatingRunTemplateId === template.id || !canCreateRun}>{creatingRunTemplateId === template.id ? 'Creating run…' : 'Create run'}</Button>
                        </div>
                        {isSelected && !canCreateRun ? <div className="mt-2 text-xs text-amber-300">Save the current template state before creating a run.</div> : null}
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
                  <div className={`rounded-full border px-2.5 py-1 ${autoSaveState === 'error' ? 'border-red-500/30 text-red-200' : autoSaveState === 'saving' ? 'border-blue-500/30 text-blue-200' : autoSaveState === 'saved' ? 'border-emerald-500/30 text-emerald-200' : 'border-white/10 text-white/55'}`}>Draft {autoSaveState === 'dirty' ? 'pending autosave' : autoSaveState}</div>
                  <Button size="sm" variant="outline" onClick={() => void handleExplicitSave()} disabled={!draft || savingCanonical || Boolean(validationError) || !hasUnsavedCanonicalChanges}>{savingCanonical ? 'Saving…' : 'Save template'}</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-white/70">
              {!selectedTemplate || !draft ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-white/50">Select or create a template to edit its base fields.</div> : (
                <div className="space-y-5">
                  {editorMessage ? <div className="rounded-lg border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/70">{editorMessage}</div> : null}
                  {validationError ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{validationError}</div> : null}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4 lg:col-span-2"><Label>Template name</Label><Input value={draft.name} onChange={(event) => setDraft((current) => current ? { ...current, name: event.target.value } : current)} placeholder="Session template name" /></label>
                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4"><Label>Character</Label><select value={draft.characterId ?? ''} onChange={(event) => setDraft((current) => current ? { ...current, characterId: event.target.value || null } : current)} className="h-10 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"><option value="">No character selected</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select><div className="mt-2 text-xs text-white/50">{loadingCharacters ? 'Loading characters…' : selectedCharacter ? `${selectedCharacter.name}${selectedCharacter.previewStatusSummary ? ` — ${selectedCharacter.previewStatusSummary}` : ''}` : 'Uses existing Character Manager records.'}</div></label>
                    <div className="rounded-lg border border-white/10 bg-black/10 p-4"><Label>Character snapshot note</Label><div className="text-sm text-white/70">{selectedCharacter ? <><div className="font-medium text-white">{selectedCharacter.name}</div><div className="mt-1 text-white/55">Gender: {selectedCharacter.gender || 'not set'}</div></> : 'Character link is optional at template stage.'}</div></div>
                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4"><Label>Character age</Label><Input value={draft.characterAge} onChange={(event) => setDraft((current) => current ? { ...current, characterAge: event.target.value } : current)} placeholder="e.g. 23" /></label>
                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4"><Label>Environment</Label><textarea value={draft.environmentText} onChange={(event) => setDraft((current) => current ? { ...current, environmentText: event.target.value } : current)} placeholder="Environment direction for the whole session" className="min-h-[110px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500" /></label>
                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4"><Label>Outfit</Label><textarea value={draft.outfitText} onChange={(event) => setDraft((current) => current ? { ...current, outfitText: event.target.value } : current)} placeholder="Reusable outfit direction" className="min-h-[110px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500" /></label>
                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4"><Label>Hairstyle</Label><textarea value={draft.hairstyleText} onChange={(event) => setDraft((current) => current ? { ...current, hairstyleText: event.target.value } : current)} placeholder="Reusable hairstyle direction" className="min-h-[110px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500" /></label>
                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4 lg:col-span-2"><Label>Master positive prompt</Label><textarea value={draft.positivePrompt} onChange={(event) => setDraft((current) => current ? { ...current, positivePrompt: event.target.value } : current)} placeholder="Base positive prompt for the whole session" className="min-h-[140px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500" /></label>
                    <label className="block rounded-lg border border-white/10 bg-black/10 p-4 lg:col-span-2"><Label>Master negative prompt</Label><textarea value={draft.negativePrompt} onChange={(event) => setDraft((current) => current ? { ...current, negativePrompt: event.target.value } : current)} placeholder="Base negative prompt for the whole session" className="min-h-[140px] w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500" /></label>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4">
                      <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3"><div><Label>Generation settings</Label><div className="text-xs text-white/50">Template-level defaults only. Draft autosave keeps them separate from canonical Save.</div></div></div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="block">
                            <Label>Model</Label>
                            <select
                              value={typeof draft.generationSettings.modelId === 'string' ? draft.generationSettings.modelId : 'z-image'}
                              onChange={(event) => updateDraftGenerationSettings({ modelId: event.target.value || 'z-image', steps: 9, cfg: 1, seed: -1, sampler: null, cfgScale: null, lora: '', loraWeight: 1, lora2: '', loraWeight2: 1, lora3: '', loraWeight3: 1, lora4: '', loraWeight4: 1, lora5: '', loraWeight5: 1, lora6: '', loraWeight6: 1, lora7: '', loraWeight7: 1, lora8: '', loraWeight8: 1 })}
                              className="h-10 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {studioImageModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                            </select>
                          </label>
                        </div>
                        {isZImageStudioModel ? (
                          <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-white">LoRAs</div>
                                <div className="text-xs text-white/50">Same template-level LoRA slots used for Create Image on Z-Image.</div>
                              </div>
                              <div className="text-xs text-white/50">{selectedZImageLoraSlots.length}/{zImageAddCap}</div>
                            </div>
                            {selectedZImageLoraSlots.length > 0 ? (
                              <div className="space-y-3">
                                {selectedZImageLoraSlots.map((slot) => (
                                  <div key={slot.paramName} className="rounded-lg border border-white/10 bg-black/10 p-3">
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-white">{slot.matchedLoRA?.fileName || slot.path.split('/').pop() || slot.path}</div>
                                        <div className="mt-1 text-xs text-white/50">Weight {slot.weight.toFixed(2)}</div>
                                      </div>
                                      <Button size="sm" variant="outline" onClick={() => updateDraftGenerationSettings({ [slot.paramName]: '', [slot.weightParamName]: 1 })}>Remove</Button>
                                    </div>
                                    <label className="block">
                                      <Label>Weight</Label>
                                      <Input
                                        type="number"
                                        step="0.1"
                                        min={-10}
                                        max={10}
                                        value={draft.generationSettings[slot.weightParamName] ?? 1}
                                        onChange={(event) => updateDraftGenerationSettings({ [slot.weightParamName]: Number(event.target.value) || 1 })}
                                      />
                                    </label>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-sm text-white/50">No LoRAs selected yet.</div>
                            )}
                            <div className="flex gap-2">
                              {nextEmptyZImageLoraParam ? <Button type="button" variant="outline" className="flex-1" onClick={() => setShowDesktopLoraSelector(true)}><Plus className="mr-2 h-4 w-4" />Add LoRA</Button> : null}
                              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowLoRADialog(true)}>Manage LoRAs</Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/10 p-4"><Label>Resolution policy</Label><div className="grid gap-4 md:grid-cols-3"><label className="block"><Label>Short side</Label><Input type="number" min={64} value={draft.resolutionPolicy.shortSidePx} onChange={(event) => setDraft((current) => current ? { ...current, resolutionPolicy: { ...current.resolutionPolicy, shortSidePx: Math.max(64, Number(event.target.value) || 64) } } : current)} /></label><label className="block"><Label>Long side</Label><Input type="number" min={64} value={draft.resolutionPolicy.longSidePx} onChange={(event) => setDraft((current) => current ? { ...current, resolutionPolicy: { ...current.resolutionPolicy, longSidePx: Math.max(64, Number(event.target.value) || 64) } } : current)} /></label><label className="block"><Label>Square source</Label><select value={draft.resolutionPolicy.squareSideSource} onChange={(event) => setDraft((current) => current ? { ...current, resolutionPolicy: { ...current.resolutionPolicy, squareSideSource: event.target.value === 'long' ? 'long' : 'short' } } : current)} className="h-10 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"><option value="short">Short side</option><option value="long">Long side</option></select></label></div></div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/10 p-4"><div className="flex items-start justify-between gap-3"><div><Label>Shot categories</Label><div className="text-xs text-white/50">0..20 per category. 0 disables the category for saved templates.</div></div><div className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/65">Total {totalShotCount}</div></div><div className="mt-4 max-h-[420px] space-y-4 overflow-y-auto pr-2">{draft.categoryRules.map((rule, index) => <div key={rule.category} className="rounded-lg border border-white/10 bg-white/[0.03] p-3"><div className="flex items-center justify-between gap-3"><div className="font-medium capitalize text-white">{rule.category.replace(/_/g, ' ')}</div><div className="text-sm text-white/70">{rule.count}</div></div><Slider value={[rule.count]} min={0} max={20} step={1} className="mt-3" onValueChange={(value) => setDraft((current) => current ? { ...current, categoryRules: current.categoryRules.map((item, itemIndex) => itemIndex === index ? { ...item, count: value[0] ?? 0 } : item) } : current)} /></div>)}</div></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      <Dialog open={showDesktopLoraSelector} onOpenChange={setShowDesktopLoraSelector}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-hidden border-white/10 bg-[#0b1020] p-0 text-white">
          <DialogHeader className="border-b border-white/10 px-6 py-4">
            <DialogTitle>Select LoRA</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              {isLoadingLoras ? (
                <div className="rounded-lg border border-white/10 px-4 py-6 text-sm text-white/50">Loading LoRAs…</div>
              ) : availableLoras.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-sm text-white/50">No LoRAs available yet.</div>
              ) : (
                availableLoras.map((lora) => (
                  <button
                    key={lora.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/10 px-3 py-3 text-left hover:border-blue-500/40 hover:bg-blue-500/5"
                    onClick={() => {
                      if (!nextEmptyZImageLoraParam) return;
                      updateDraftGenerationSettings({
                        [nextEmptyZImageLoraParam]: lora.s3Path,
                        [getStudioSessionLoraWeightParamName(nextEmptyZImageLoraParam)]: 1,
                      });
                      setShowDesktopLoraSelector(false);
                    }}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="truncate text-sm font-medium text-white">{lora.fileName}</div>
                      <div className="mt-1 truncate text-xs text-white/50">{lora.fileSize}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {showLoRADialog ? <LoRAManagementDialog open={showLoRADialog} onOpenChange={setShowLoRADialog} workspaceId={workspaceId || undefined} onLoRAUploaded={fetchAvailableLoras} /> : null}
    </div>
  );
}

function RunsTab({ workspaceId }: { workspaceId: string | null }) {
  const [runs, setRuns] = useState<StudioSessionRunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<StudioSessionRunDetailSummary | null>(null);
  const [shots, setShots] = useState<StudioSessionShotSummary[]>([]);
  const [revisions, setRevisions] = useState<StudioSessionShotRevisionSummary[]>([]);
  const [versions, setVersions] = useState<StudioSessionShotVersionSummary[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [assemblingRunId, setAssemblingRunId] = useState<string | null>(null);
  const [runningRunId, setRunningRunId] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [assigningShotId, setAssigningShotId] = useState<string | null>(null);
  const [runningShotId, setRunningShotId] = useState<string | null>(null);
  const [selectingVersionShotId, setSelectingVersionShotId] = useState<string | null>(null);
  const [reviewStateVersionId, setReviewStateVersionId] = useState<string | null>(null);
  const [skipShotId, setSkipShotId] = useState<string | null>(null);
  const [addingVersionToGalleryId, setAddingVersionToGalleryId] = useState<string | null>(null);
  const [versionCursorByShot, setVersionCursorByShot] = useState<Record<string, number>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerShot, setPickerShot] = useState<StudioSessionShotSummary | null>(null);
  const [pickerPoses, setPickerPoses] = useState<StudioSessionPoseSnapshot[]>([]);
  const [loadingPicker, setLoadingPicker] = useState(false);
  const [detailShotId, setDetailShotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingRuns(true);
    setError(null);
    try {
      const response = await fetch(`/api/studio-sessions/runs?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to fetch runs');
      const nextRuns = Array.isArray(data.runs) ? data.runs as StudioSessionRunSummary[] : [];
      setRuns(nextRuns);
      setSelectedRun((current) => current && nextRuns.some((run) => run.id === current.id)
        ? { ...current, ...nextRuns.find((run) => run.id === current.id)! }
        : (nextRuns[0] ? nextRuns[0] as StudioSessionRunDetailSummary : null));
    } catch (error) {
      setRuns([]);
      setSelectedRun(null);
      setShots([]);
      setRevisions([]);
      setVersions([]);
      setError(toErrorMessage(error, 'Failed to fetch runs'));
    } finally {
      setLoadingRuns(false);
    }
  }, [workspaceId]);

  const fetchRunDetail = useCallback(async (runId: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const response = await fetch(`/api/studio-sessions/runs/${runId}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.success || !data.run) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to fetch run');
      setSelectedRun(data.run as StudioSessionRunDetailSummary);
      setShots(Array.isArray(data.shots) ? data.shots as StudioSessionShotSummary[] : []);
      setRevisions(Array.isArray(data.revisions) ? data.revisions as StudioSessionShotRevisionSummary[] : []);
      setVersions(Array.isArray(data.versions) ? data.versions as StudioSessionShotVersionSummary[] : []);
    } catch (error) {
      setShots([]);
      setRevisions([]);
      setVersions([]);
      setError(toErrorMessage(error, 'Failed to fetch run detail'));
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const refreshSelectedRun = useCallback(async () => {
    if (selectedRun?.id) await fetchRunDetail(selectedRun.id);
    await fetchRuns();
  }, [fetchRunDetail, fetchRuns, selectedRun?.id]);

  const applyExhaustionFeedback = useCallback((categories: unknown) => {
    const values = Array.isArray(categories) ? categories.filter((value): value is string => typeof value === 'string' && value.trim().length > 0) : [];
    if (values.length > 0) {
      setInfoMessage(`Unique auto-pick pool exhausted for: ${values.map(humanizeCategory).join(', ')}.`);
    }
  }, []);

  const handleAutoPick = useCallback(async (shotId: string) => {
    setAssigningShotId(shotId);
    setError(null);
    setInfoMessage(null);
    try {
      const response = await fetch(`/api/studio-sessions/shots/${shotId}/auto-pick`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        applyExhaustionFeedback(data?.exhaustedCategories);
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to auto-pick pose');
      }
      applyExhaustionFeedback(data?.exhaustedCategories);
      await refreshSelectedRun();
    } catch (error) {
      setError(toErrorMessage(error, 'Failed to auto-pick pose'));
    } finally {
      setAssigningShotId(null);
    }
  }, [applyExhaustionFeedback, refreshSelectedRun]);

  const handleAssembleAll = useCallback(async () => {
    if (!selectedRun) return;
    setAssemblingRunId(selectedRun.id);
    setError(null);
    setInfoMessage(null);
    try {
      const response = await fetch(`/api/studio-sessions/runs/${selectedRun.id}/assemble`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to assemble run');
      if (Array.isArray(data?.assignedShotIds) && data.assignedShotIds.length > 0) {
        setInfoMessage(`Assigned ${data.assignedShotIds.length} slots.${Array.isArray(data?.exhaustedCategories) && data.exhaustedCategories.length ? ` Exhausted: ${data.exhaustedCategories.map(humanizeCategory).join(', ')}.` : ''}`);
      } else {
        applyExhaustionFeedback(data?.exhaustedCategories);
      }
      await refreshSelectedRun();
    } catch (error) {
      setError(toErrorMessage(error, 'Failed to assemble run'));
    } finally {
      setAssemblingRunId(null);
    }
  }, [applyExhaustionFeedback, refreshSelectedRun, selectedRun]);

  const handleReshuffle = useCallback(async (shotId: string) => {
    setAssigningShotId(shotId);
    setError(null);
    setInfoMessage(null);
    try {
      const response = await fetch(`/api/studio-sessions/shots/${shotId}/reshuffle`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        applyExhaustionFeedback(data?.exhaustedCategories);
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to reshuffle pose');
      }
      await refreshSelectedRun();
    } catch (error) {
      setError(toErrorMessage(error, 'Failed to reshuffle pose'));
    } finally {
      setAssigningShotId(null);
    }
  }, [applyExhaustionFeedback, refreshSelectedRun]);

  const handleSelectVersion = useCallback(async (shotId: string, versionId: string) => {
    setSelectingVersionShotId(shotId);
    setError(null);
    setInfoMessage(null);
    try {
      const response = await fetch(`/api/studio-sessions/shots/${shotId}/versions/${versionId}/select`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to select version');
      setInfoMessage('Selected version updated.');
      await refreshSelectedRun();
    } catch (error) {
      setError(toErrorMessage(error, 'Failed to select version'));
    } finally {
      setSelectingVersionShotId(null);
    }
  }, [refreshSelectedRun]);

  const handleUpdateVersionReviewState = useCallback(async (shotId: string, versionId: string, patch: { hidden?: boolean; rejected?: boolean }) => {
    setReviewStateVersionId(versionId);
    setError(null);
    setInfoMessage(null);
    try {
      const response = await fetch(`/api/studio-sessions/shots/${shotId}/versions/${versionId}/review-state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to update version state');
      setInfoMessage('Version review state updated.');
      await refreshSelectedRun();
    } catch (error) {
      setError(toErrorMessage(error, 'Failed to update version state'));
    } finally {
      setReviewStateVersionId(null);
    }
  }, [refreshSelectedRun]);

  const handleSkipShot = useCallback(async (shotId: string, skipped: boolean) => {
    setSkipShotId(shotId);
    setError(null);
    setInfoMessage(null);
    try {
      const response = await fetch(`/api/studio-sessions/shots/${shotId}/skip`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipped }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to update skip state');
      setInfoMessage(skipped ? 'Shot skipped.' : 'Shot restored.');
      await refreshSelectedRun();
    } catch (error) {
      setError(toErrorMessage(error, 'Failed to update skip state'));
    } finally {
      setSkipShotId(null);
    }
  }, [refreshSelectedRun]);

  const handleAddVersionToGallery = useCallback(async (shotId: string, versionId: string) => {
    setAddingVersionToGalleryId(versionId);
    setError(null);
    setInfoMessage(null);
    try {
      const response = await fetch(`/api/studio-sessions/shots/${shotId}/versions/${versionId}/add-to-gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'common' }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to add version to gallery');
      setInfoMessage(data.alreadyInGallery ? 'Version already exists in Gallery.' : 'Version added to Gallery.');
    } catch (error) {
      setError(toErrorMessage(error, 'Failed to add version to gallery'));
    } finally {
      setAddingVersionToGalleryId(null);
    }
  }, []);

  const handleRunShot = useCallback(async (shotId: string) => {
    setRunningShotId(shotId);
    setError(null);
    setInfoMessage(null);
    try {
      const response = await fetch(`/api/studio-sessions/shots/${shotId}/run`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to run shot');
      setInfoMessage(`Shot queued: ${data.jobId}`);
      await refreshSelectedRun();
    } catch (error) {
      setError(toErrorMessage(error, 'Failed to run shot'));
    } finally {
      setRunningShotId(null);
    }
  }, [refreshSelectedRun]);

  const handleRunAll = useCallback(async () => {
    if (!selectedRun) return;
    setRunningRunId(selectedRun.id);
    setError(null);
    setInfoMessage(null);
    try {
      const response = await fetch(`/api/studio-sessions/runs/${selectedRun.id}/run`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to run all shots');
      setInfoMessage(`Launched ${Array.isArray(data.launched) ? data.launched.length : 0} shot jobs.`);
      await refreshSelectedRun();
    } catch (error) {
      setError(toErrorMessage(error, 'Failed to run all shots'));
    } finally {
      setRunningRunId(null);
    }
  }, [refreshSelectedRun, selectedRun]);

  const handleDeleteRun = useCallback(async (runId: string) => {
    setDeletingRunId(runId);
    setError(null);
    setInfoMessage(null);
    try {
      const response = await fetch(`/api/studio-sessions/runs/${runId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to delete run');
      setInfoMessage('Run deleted.');
      setVersionCursorByShot({});
      setDetailShotId(null);
      await fetchRuns();
    } catch (error) {
      setError(toErrorMessage(error, 'Failed to delete run'));
    } finally {
      setDeletingRunId(null);
    }
  }, [fetchRuns]);

  const openManualPicker = useCallback(async (shot: StudioSessionShotSummary) => {
    setPickerShot(shot);
    setPickerOpen(true);
    setLoadingPicker(true);
    setPickerPoses([]);
    setError(null);
    try {
      const response = await fetch(`/api/studio-sessions/shots/${shot.id}/poses`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to load poses');
      setPickerPoses(Array.isArray(data.poses) ? data.poses as StudioSessionPoseSnapshot[] : []);
    } catch (error) {
      setError(toErrorMessage(error, 'Failed to load poses'));
    } finally {
      setLoadingPicker(false);
    }
  }, []);

  const handleManualPick = useCallback(async (poseId: string) => {
    if (!pickerShot) return;
    setAssigningShotId(pickerShot.id);
    setError(null);
    setInfoMessage(null);
    try {
      const response = await fetch(`/api/studio-sessions/shots/${pickerShot.id}/manual-pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poseId }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to assign manual pose');
      setPickerOpen(false);
      setPickerShot(null);
      setPickerPoses([]);
      await refreshSelectedRun();
    } catch (error) {
      setError(toErrorMessage(error, 'Failed to assign manual pose'));
    } finally {
      setAssigningShotId(null);
    }
  }, [pickerShot, refreshSelectedRun]);

  useEffect(() => {
    if (!workspaceId) {
      setRuns([]);
      setSelectedRun(null);
      setShots([]);
      setRevisions([]);
      setError(null);
      setInfoMessage(null);
      return;
    }
    void fetchRuns();
  }, [fetchRuns, workspaceId]);

  useEffect(() => {
    if (selectedRun?.id) void fetchRunDetail(selectedRun.id);
  }, [fetchRunDetail, selectedRun?.id]);

  const groupedShots = useMemo(() => groupShotsByCategory(shots), [shots]);
  const revisionMap = useMemo(() => new Map(revisions.map((revision) => [revision.shotId, revision])), [revisions]);
  const versionsByShot = useMemo(() => {
    const map = new Map<string, StudioSessionShotVersionSummary[]>();
    for (const version of listPrimaryStudioSessionVersions(versions)) {
      const current = map.get(version.shotId) ?? [];
      current.push(version);
      map.set(version.shotId, current);
    }
    return map;
  }, [versions]);
  const selectedVersionMap = useMemo(() => {
    const map = new Map<string, StudioSessionShotVersionSummary>();
    for (const shot of shots) {
      const match = selectPrimaryStudioSessionVersion({ shot, versions: versions.filter((version) => version.shotId === shot.id) });
      if (match) map.set(shot.id, match);
    }
    return map;
  }, [shots, versions]);
  const detailShot = useMemo(() => shots.find((shot) => shot.id === detailShotId) ?? null, [detailShotId, shots]);
  const detailShotVersions = useMemo(() => detailShot ? sortStudioSessionVersions(versions.filter((version) => version.shotId === detailShot.id)) : [], [detailShot, versions]);
  const detailSelectedVersion = useMemo(() => detailShot ? selectedVersionMap.get(detailShot.id) ?? null : null, [detailShot, selectedVersionMap]);
  const detailCurrentRevision = useMemo(() => detailShot?.currentRevisionId ? revisions.find((revision) => revision.id === detailShot.currentRevisionId) ?? null : null, [detailShot, revisions]);
  const detailCurrentRevisionVersions = useMemo(() => detailCurrentRevision ? detailShotVersions.filter((version) => version.revisionId === detailCurrentRevision.id) : [], [detailCurrentRevision, detailShotVersions]);
  const detailHistoricalRevisions = useMemo(() => {
    if (!detailShot) return [] as Array<{ revision: StudioSessionShotRevisionSummary; versions: StudioSessionShotVersionSummary[] }>;
    return revisions
      .filter((revision) => revision.shotId === detailShot.id && revision.id !== detailShot.currentRevisionId)
      .map((revision) => ({
        revision,
        versions: detailShotVersions.filter((version) => version.revisionId === revision.id),
      }))
      .sort((left, right) => right.revision.revisionNumber - left.revision.revisionNumber);
  }, [detailShot, detailShotVersions, revisions]);

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="flex min-h-[720px] flex-col border-white/10 bg-white/5">
          <CardHeader className="border-b border-white/10 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription>Runs</CardDescription>
                <CardTitle className="text-lg">Studio Session runs</CardTitle>
              </div>
              <Button size="sm" variant="outline" onClick={() => void fetchRuns()} disabled={loadingRuns}>{loadingRuns ? 'Refreshing…' : 'Refresh'}</Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4 text-sm text-white/70">
            {!workspaceId ? <EmptyWorkspaceState /> : error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : loadingRuns ? <div className="rounded-lg border border-white/10 bg-black/10 px-4 py-8 text-center text-white/50">Loading runs…</div> : runs.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-white/50">No runs yet. Create the first run from a saved template.</div> : (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {runs.map((run) => {
                  const isSelected = selectedRun?.id === run.id;
                  const totalSlots = run.templateSnapshot.categoryRules.reduce((sum, rule) => sum + rule.count, 0);
                  return (
                    <div key={run.id} className={`rounded-lg border p-3 transition ${isSelected ? 'border-blue-400/50 bg-blue-500/10' : 'border-white/10 bg-black/10 hover:bg-white/[0.04]'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white">{run.templateNameSnapshot || run.templateSnapshot.templateName}</div>
                          <div className="mt-1 text-xs text-white/50">Created {new Date(run.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-white/50">{run.status}</div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-white/55 sm:grid-cols-2">
                        <div>Snapshot: <span className="text-white/75">{run.poseLibraryVersion}</span></div>
                        <div>Slots: <span className="text-white/75">{totalSlots}</span></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant={isSelected ? 'secondary' : 'outline'} onClick={() => setSelectedRun(run as StudioSessionRunDetailSummary)}>{isSelected ? 'Opened' : 'Open run'}</Button>
                        <Button size="sm" variant="outline" onClick={() => void handleDeleteRun(run.id)} disabled={deletingRunId === run.id || (isSelected && (selectedRun?.activeJobCount ?? 0) > 0)}>{deletingRunId === run.id ? 'Deleting…' : 'Delete run'}</Button>
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
            <CardDescription>Run detail</CardDescription>
            <CardTitle className="text-lg">Assigned shot review and pose prep</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-white/70">
            {!selectedRun ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-white/50">Select a run to inspect its stable shot groups.</div> : loadingDetail ? <div className="rounded-lg border border-white/10 bg-black/10 px-4 py-8 text-center text-white/50">Loading run detail…</div> : (
              <div className="space-y-5">
                <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-medium text-white">{selectedRun.templateNameSnapshot || selectedRun.templateSnapshot.templateName}</div>
                      <div className="mt-1 text-xs text-white/50">Run {selectedRun.id}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <div className="rounded-full border border-white/10 px-2.5 py-1 text-white/65">Status {selectedRun.status}</div>
                      <div className="rounded-full border border-white/10 px-2.5 py-1 text-white/65">Pose library {selectedRun.poseLibraryVersion}</div>
                      <Button size="sm" onClick={() => void handleAssembleAll()} disabled={assemblingRunId === selectedRun.id || runningRunId === selectedRun.id}>{assemblingRunId === selectedRun.id ? 'Assembling…' : 'Assemble all'}</Button>
                      <Button size="sm" variant="outline" onClick={() => void handleRunAll()} disabled={runningRunId === selectedRun.id || assemblingRunId === selectedRun.id}>{runningRunId === selectedRun.id ? 'Launching…' : 'Run all'}</Button>
                      <Button size="sm" variant="outline" onClick={() => void handleDeleteRun(selectedRun.id)} disabled={deletingRunId === selectedRun.id || (selectedRun.activeJobCount ?? 0) > 0}>{deletingRunId === selectedRun.id ? 'Deleting…' : 'Delete run'}</Button>
                    </div>
                  </div>
                  {infoMessage ? <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{infoMessage}</div> : null}
                  {selectedRun.exhaustedCategories?.length ? <div className="mt-3 text-xs text-amber-300">Exhausted categories: {selectedRun.exhaustedCategories.map(humanizeCategory).join(', ')}.</div> : null}
                </div>
                {groupedShots.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-white/50">This run has no materialized shots yet.</div> : groupedShots.map((group) => (
                  <div key={group.category} className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-white/60">{humanizeCategory(group.category)}</div>
                      <div className="text-xs text-white/45">{group.shots.length} slots</div>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                      {group.shots.map((shot) => {
                        const revision = revisionMap.get(shot.id);
                        const shotVersions = versionsByShot.get(shot.id) ?? [];
                        const allShotVersions = versions.filter((version) => version.shotId === shot.id);
                        const selectedVersion = selectedVersionMap.get(shot.id);
                        const activeVersion = shotVersions.length > 0
                          ? shotVersions[Math.min(versionCursorByShot[shot.id] ?? 0, shotVersions.length - 1)]
                          : selectedVersion;
                        const promptPreview = revision?.assembledPromptSnapshot?.positivePrompt?.slice(0, 220) ?? '';
                        const exhaustedForShot = selectedRun.exhaustedCategories?.includes(shot.category) && !shot.currentRevisionId;
                        return (
                          <div key={shot.id} className={`rounded-lg border p-4 ${shot.skipped ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-black/10'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-white">{shot.label}</div>
                                <div className="mt-1 text-xs text-white/50">{humanizeCategory(shot.category)} · slot {shot.slotIndex + 1}</div>
                                {revision ? (
                                  <>
                                    <div className="mt-3 text-sm font-medium text-emerald-200">{revision.poseSnapshot.name}</div>
                                    <div className="mt-1 text-xs text-white/50">{revision.derivedOrientation} · {revision.derivedFraming} · rev {revision.revisionNumber}</div>
                                    {shot.activeJobId ? <div className="mt-2 text-xs text-sky-300">Active job: {shot.activeJobStatus} · {shot.activeJobId}</div> : null}
                                    {selectedVersion ? <div className="mt-2 text-xs text-emerald-300">Selected version v{selectedVersion.versionNumber}</div> : null}
                                    {activeVersion && activeVersion.id !== selectedVersion?.id ? <div className="mt-1 text-xs text-sky-300">Browsing version v{activeVersion.versionNumber}</div> : null}
                                  </>
                                ) : exhaustedForShot ? <div className="mt-2 text-xs text-amber-300">Unique auto-pick pool exhausted for this category.</div> : null}
                              </div>
                              <div className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-white/50">{shot.skipped ? 'skipped' : shot.status}</div>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-white/55">
                              <div>{shotVersions.length > 0 ? `Version ${Math.min((versionCursorByShot[shot.id] ?? 0) + 1, shotVersions.length)} of ${shotVersions.length}` : 'No visible versions yet'}</div>
                              {allShotVersions.some((version) => version.hidden || version.rejected) ? <div className="text-amber-300">{allShotVersions.filter((version) => version.hidden || version.rejected).length} hidden/rejected in history</div> : null}
                              {shotVersions.length > 1 ? (
                                <div className="flex gap-2">
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setVersionCursorByShot((current) => ({ ...current, [shot.id]: Math.max((current[shot.id] ?? 0) - 1, 0) }))}>Prev</Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setVersionCursorByShot((current) => ({ ...current, [shot.id]: Math.min((current[shot.id] ?? 0) + 1, Math.max(shotVersions.length - 1, 0)) }))}>Next</Button>
                                </div>
                              ) : null}
                            </div>
                            {activeVersion?.previewUrl ? (
                              <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                                <img src={activeVersion.previewUrl} alt={`${shot.label} version ${activeVersion.versionNumber}`} className="aspect-[4/5] w-full object-cover" />
                                <div className="border-t border-white/10 px-3 py-2 text-xs text-white/55">Version preview · v{activeVersion.versionNumber}</div>
                              </div>
                            ) : revision ? (
                              <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Prompt preview</div>
                                <div className="mt-2 text-sm text-white/75">{promptPreview || revision.poseSnapshot.prompt}</div>
                              </div>
                            ) : null}
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => void handleSkipShot(shot.id, !shot.skipped)} disabled={skipShotId === shot.id}>{skipShotId === shot.id ? 'Saving…' : shot.skipped ? 'Restore shot' : 'Skip shot'}</Button>
                              <Button size="sm" variant="outline" onClick={() => setDetailShotId(shot.id)} disabled={shot.skipped}>Open detail</Button>
                              <Button size="sm" variant="outline" onClick={() => void openManualPicker(shot)} disabled={assigningShotId === shot.id || shot.skipped}>{assigningShotId === shot.id ? 'Working…' : revision ? 'Replace pose' : 'Pick pose'}</Button>
                              {revision ? <Button size="sm" variant="outline" onClick={() => void handleReshuffle(shot.id)} disabled={assigningShotId === shot.id || runningShotId === shot.id || !!shot.activeJobId || shot.skipped}>{assigningShotId === shot.id ? 'Working…' : 'Reshuffle pose'}</Button> : <Button size="sm" onClick={() => void handleAutoPick(shot.id)} disabled={assigningShotId === shot.id || runningShotId === shot.id || shot.skipped}>{assigningShotId === shot.id ? 'Working…' : 'Auto pick'}</Button>}
                              {activeVersion ? <Button size="sm" variant="outline" onClick={() => void handleSelectVersion(shot.id, activeVersion.id)} disabled={selectingVersionShotId === shot.id || activeVersion.id === shot.selectionVersionId || shot.skipped}>{activeVersion.id === shot.selectionVersionId ? 'Selected' : selectingVersionShotId === shot.id ? 'Saving…' : 'Select version'}</Button> : null}
                              {activeVersion ? <Button size="sm" variant="outline" onClick={() => void handleUpdateVersionReviewState(shot.id, activeVersion.id, { hidden: !activeVersion.hidden })} disabled={reviewStateVersionId === activeVersion.id || shot.skipped}>{reviewStateVersionId === activeVersion.id ? 'Saving…' : activeVersion.hidden ? 'Unhide' : 'Hide'}</Button> : null}
                              {activeVersion ? <Button size="sm" variant="outline" onClick={() => void handleUpdateVersionReviewState(shot.id, activeVersion.id, { rejected: !activeVersion.rejected })} disabled={reviewStateVersionId === activeVersion.id || shot.skipped}>{reviewStateVersionId === activeVersion.id ? 'Saving…' : activeVersion.rejected ? 'Unreject' : 'Reject'}</Button> : null}
                              {activeVersion ? <Button size="sm" variant="outline" onClick={() => void handleAddVersionToGallery(shot.id, activeVersion.id)} disabled={addingVersionToGalleryId === activeVersion.id || shot.skipped}>{addingVersionToGalleryId === activeVersion.id ? 'Adding…' : 'Add to Gallery'}</Button> : null}
                              <Button size="sm" onClick={() => void handleRunShot(shot.id)} disabled={runningShotId === shot.id || !!shot.activeJobId || shot.skipped}>{shot.activeJobId ? 'Running…' : runningShotId === shot.id ? 'Launching…' : revision ? 'Launch shot job' : 'Launch shot job (auto-pick)'}</Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={detailShotId !== null} onOpenChange={(open) => { if (!open) setDetailShotId(null); }}>
        <DialogContent className="h-[90vh] w-[min(94vw,1400px)] max-w-none border-white/10 bg-[#0b1020] p-0 text-white">
          <DialogHeader className="border-b border-white/10 px-6 py-4 text-left">
            <DialogTitle>{detailShot ? `${detailShot.label} detail` : 'Shot detail'}</DialogTitle>
            <DialogDescription>
              {detailCurrentRevision
                ? `Current revision ${detailCurrentRevision.revisionNumber} stays primary. Older pose revisions remain available as separate history.`
                : 'Review versions and revision history for this shot.'}
            </DialogDescription>
          </DialogHeader>
          {!detailShot ? <div className="p-6 text-sm text-white/60">Shot not found.</div> : (
            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-h-0 overflow-y-auto p-6">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-medium text-white">Current revision</div>
                      {detailCurrentRevision ? (
                        <>
                          <div className="mt-2 text-sm text-emerald-200">{detailCurrentRevision.poseSnapshot.name}</div>
                          <div className="mt-1 text-xs text-white/50">rev {detailCurrentRevision.revisionNumber} · {detailCurrentRevision.derivedOrientation} · {detailCurrentRevision.derivedFraming}</div>
                          <div className="mt-2 text-sm text-white/70">{detailCurrentRevision.assembledPromptSnapshot.positivePrompt}</div>
                        </>
                      ) : <div className="mt-2 text-sm text-white/55">No current revision yet.</div>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {detailShot.skipped ? <div className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">Shot skipped</div> : null}
                      {detailSelectedVersion ? <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">Selected version v{detailSelectedVersion.versionNumber}</div> : null}
                      <Button size="sm" onClick={() => void handleRunShot(detailShot.id)} disabled={runningShotId === detailShot.id || !!detailShot.activeJobId || detailShot.skipped}>{detailShot.activeJobId ? 'Running…' : runningShotId === detailShot.id ? 'Launching…' : detailCurrentRevision ? 'Launch shot job' : 'Launch shot job (auto-pick)'}</Button>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-3 text-xs uppercase tracking-[0.16em] text-white/45">Versions in current revision</div>
                  {detailCurrentRevisionVersions.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-white/50">No versions have been materialized for the current revision yet.</div> : (
                    <div className="grid gap-4 xl:grid-cols-2">
                      {detailCurrentRevisionVersions.map((version) => (
                        <div key={version.id} className={`overflow-hidden rounded-xl border ${version.hidden || version.rejected ? 'border-amber-500/30 bg-amber-500/5 opacity-80' : 'border-white/10 bg-white/[0.03]'}`}>
                          {version.previewUrl ? <img src={version.previewUrl} alt={`${detailShot.label} version ${version.versionNumber}`} className="aspect-[4/5] w-full object-cover" /> : <div className="aspect-[4/5] bg-black/20" />}
                          <div className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-white">Version {version.versionNumber}</div>
                                <div className="mt-1 text-xs text-white/50">Same revision · source job {version.sourceJobId ?? '—'}</div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {detailShot.selectionVersionId === version.id ? <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">Selected</div> : null}
                                {version.hidden ? <div className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">Hidden</div> : null}
                                {version.rejected ? <div className="rounded-full border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-200">Rejected</div> : null}
                              </div>
                            </div>
                            <div className="text-xs text-white/60">This is a version change inside the same pose revision.</div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => void handleSelectVersion(detailShot.id, version.id)} disabled={selectingVersionShotId === detailShot.id || detailShot.selectionVersionId === version.id || version.hidden || version.rejected || detailShot.skipped}>{detailShot.selectionVersionId === version.id ? 'Selected' : selectingVersionShotId === detailShot.id ? 'Saving…' : 'Select version'}</Button>
                              <Button size="sm" variant="outline" onClick={() => void handleUpdateVersionReviewState(detailShot.id, version.id, { hidden: !version.hidden })} disabled={reviewStateVersionId === version.id || detailShot.skipped}>{reviewStateVersionId === version.id ? 'Saving…' : version.hidden ? 'Unhide' : 'Hide'}</Button>
                              <Button size="sm" variant="outline" onClick={() => void handleUpdateVersionReviewState(detailShot.id, version.id, { rejected: !version.rejected })} disabled={reviewStateVersionId === version.id || detailShot.skipped}>{reviewStateVersionId === version.id ? 'Saving…' : version.rejected ? 'Unreject' : 'Reject'}</Button>
                              <Button size="sm" variant="outline" onClick={() => void handleAddVersionToGallery(detailShot.id, version.id)} disabled={addingVersionToGalleryId === version.id || detailShot.skipped}>{addingVersionToGalleryId === version.id ? 'Adding…' : 'Add to Gallery'}</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto border-l border-white/10 bg-black/10 p-5">
                <div className="text-xs uppercase tracking-[0.16em] text-white/45">Revision history</div>
                <div className="mt-3 space-y-3">
                  {detailHistoricalRevisions.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-sm text-white/50">No older revisions yet.</div> : detailHistoricalRevisions.map(({ revision, versions }) => (
                    <div key={revision.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="font-medium text-white">Revision {revision.revisionNumber}</div>
                      <div className="mt-1 text-sm text-white/70">{revision.poseSnapshot.name}</div>
                      <div className="mt-1 text-xs text-white/50">{revision.derivedOrientation} · {revision.derivedFraming} · {revision.sourceKind}</div>
                      <div className="mt-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-xs text-white/65">
                        <div>Revision change: different pose snapshot/history branch.</div>
                        <div className="mt-1">Versions under this revision: {versions.length}</div>
                        {versions.some((version) => version.hidden || version.rejected) ? <div className="mt-1 text-amber-300">Contains hidden/rejected results in history.</div> : null}
                      </div>
                      {versions[0]?.previewUrl ? <img src={versions[0].previewUrl} alt={`${revision.poseSnapshot.name} latest version`} className="mt-3 aspect-[4/5] w-full rounded-lg object-cover" /> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-4xl border-white/10 bg-[#0b1020] text-white">
          <DialogHeader>
            <DialogTitle>Pick pose</DialogTitle>
            <DialogDescription>
              {pickerShot ? `Manual pose picker for ${pickerShot.label}. Poses stay limited to ${humanizeCategory(pickerShot.category)}.` : 'Choose a pose.'}
            </DialogDescription>
          </DialogHeader>
          {loadingPicker ? <div className="rounded-lg border border-white/10 bg-black/10 px-4 py-8 text-center text-white/50">Loading poses…</div> : (
            <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
              {pickerPoses.map((pose) => (
                <div key={pose.id} className="rounded-lg border border-white/10 bg-black/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{pose.name}</div>
                      <div className="mt-1 text-xs text-white/50">{pose.orientation} · {pose.framing}</div>
                    </div>
                    <Button size="sm" onClick={() => void handleManualPick(pose.id)} disabled={assigningShotId === pickerShot?.id}>{assigningShotId === pickerShot?.id ? 'Assigning…' : 'Use pose'}</Button>
                  </div>
                  <div className="mt-3 text-sm text-white/70">{pose.prompt}</div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function StudioSessionsPageClient() {
  const { activeWorkspaceId, workspaces } = useStudio();
  const [tab, setTab] = useState<'templates' | 'runs'>('templates');
  const effectiveWorkspaceId = useMemo(() => activeWorkspaceId || workspaces[0]?.id || null, [activeWorkspaceId, workspaces]);
  const [runsRefreshToken, setRunsRefreshToken] = useState(0);

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-white">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/45">Studio Sessions</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Studio Photo Session</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/60">Separate desktop workspace for reusable session templates and immutable run-based review flows.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/65">Active workspace: <span className="font-medium text-white">{effectiveWorkspaceId ?? 'none selected'}</span></div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
        <Tabs value={tab} onValueChange={(value) => setTab(value as 'templates' | 'runs')} className="flex min-h-0 flex-col gap-4">
          <TabsList className="w-fit bg-white/[0.05]"><TabsTrigger value="templates">Templates</TabsTrigger><TabsTrigger value="runs">Runs</TabsTrigger></TabsList>
          <TabsContent value="templates" className="mt-0"><TemplatesTab workspaceId={effectiveWorkspaceId} onRunCreated={() => setRunsRefreshToken((value) => value + 1)} onOpenRuns={() => setTab('runs')} /></TabsContent>
          <TabsContent value="runs" className="mt-0" forceMount hidden={tab !== 'runs'}><RunsTab key={`${effectiveWorkspaceId ?? 'none'}:${runsRefreshToken}`} workspaceId={effectiveWorkspaceId} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
