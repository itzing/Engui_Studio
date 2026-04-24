'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowPathIcon, ClipboardDocumentIcon, DocumentDuplicateIcon, ExclamationTriangleIcon, GlobeAltIcon, MagnifyingGlassIcon, PhotoIcon, PlusIcon, SparklesIcon, SwatchIcon, UserIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useStudio } from '@/lib/context/StudioContext';
import { getPromptTemplate } from '@/lib/prompt-constructor/templateRegistry';
import { promptConstructorConstraints } from '@/lib/prompt-constructor/constraints';
import { resolveConstraintSnippets } from '@/lib/prompt-constructor/utils';
import { loadPromptBlocks } from '@/lib/prompt-constructor/providers';
import type { PromptBlock } from '@/lib/prompt-constructor/providers/types';
import type { PromptDocument, SingleCharacterPromptState } from '@/lib/prompt-constructor/types';

const template = getPromptTemplate('single_character_scene_v1');

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function cloneDocument(document: PromptDocument): PromptDocument {
  return {
    ...document,
    id: 'local-draft',
    title: document.title.trim() ? `${document.title.trim()} Copy` : 'Untitled Prompt Copy',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeLocalDraft(workspaceId: string | null): PromptDocument {
  const initialState = template?.createInitialState() ?? {
    character: { appearance: '', outfit: '', expression: '', pose: '' },
    action: { mainAction: '' },
    composition: { shotType: '', cameraAngle: '', framing: '' },
    environment: { location: '', timeOfDay: '', lighting: '', background: '' },
    style: { style: '', detailLevel: '', palette: '', mood: '' },
  };

  return {
    id: 'local-draft',
    workspaceId: workspaceId ?? '',
    title: 'Untitled Prompt',
    templateId: 'single_character_scene_v1',
    templateVersion: 1,
    state: initialState,
    enabledConstraintIds: promptConstructorConstraints
      .filter((constraint) => constraint.applicableTemplateIds.includes('single_character_scene_v1'))
      .map((constraint) => constraint.id),
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function setSlotValue(state: SingleCharacterPromptState, slotId: string, value: string): SingleCharacterPromptState {
  switch (slotId) {
    case 'appearance': return { ...state, character: { ...state.character, appearance: value } };
    case 'outfit': return { ...state, character: { ...state.character, outfit: value } };
    case 'expression': return { ...state, character: { ...state.character, expression: value } };
    case 'pose': return { ...state, character: { ...state.character, pose: value } };
    case 'mainAction': return { ...state, action: { ...state.action, mainAction: value } };
    case 'shotType': return { ...state, composition: { ...state.composition, shotType: value } };
    case 'cameraAngle': return { ...state, composition: { ...state.composition, cameraAngle: value } };
    case 'framing': return { ...state, composition: { ...state.composition, framing: value } };
    case 'location': return { ...state, environment: { ...state.environment, location: value } };
    case 'timeOfDay': return { ...state, environment: { ...state.environment, timeOfDay: value } };
    case 'lighting': return { ...state, environment: { ...state.environment, lighting: value } };
    case 'background': return { ...state, environment: { ...state.environment, background: value } };
    case 'style': return { ...state, style: { ...state.style, style: value } };
    case 'detailLevel': return { ...state, style: { ...state.style, detailLevel: value } };
    case 'palette': return { ...state, style: { ...state.style, palette: value } };
    case 'mood': return { ...state, style: { ...state.style, mood: value } };
    default: return state;
  }
}

function getSlotValue(state: SingleCharacterPromptState, slotId: string): string {
  switch (slotId) {
    case 'appearance': return state.character.appearance;
    case 'outfit': return state.character.outfit;
    case 'expression': return state.character.expression;
    case 'pose': return state.character.pose;
    case 'mainAction': return state.action.mainAction;
    case 'shotType': return state.composition.shotType;
    case 'cameraAngle': return state.composition.cameraAngle;
    case 'framing': return state.composition.framing;
    case 'location': return state.environment.location;
    case 'timeOfDay': return state.environment.timeOfDay;
    case 'lighting': return state.environment.lighting;
    case 'background': return state.environment.background;
    case 'style': return state.style.style;
    case 'detailLevel': return state.style.detailLevel;
    case 'palette': return state.style.palette;
    case 'mood': return state.style.mood;
    default: return '';
  }
}

const slotPresetChips: Record<string, string[]> = {
  appearance: ['young woman', 'adult man', 'elegant heroine', 'soft facial features'],
  outfit: ['light summer dress', 'tailored black suit', 'casual streetwear', 'flowing white blouse'],
  expression: ['soft smile', 'calm neutral expression', 'confident look', 'wistful gaze'],
  pose: ['standing naturally', 'sitting with one leg bent', 'turning slightly toward camera', 'hands loosely folded'],
  mainAction: ['adjusting her hair', 'looking out the window', 'holding a cup gently', 'walking slowly forward'],
  shotType: ['close-up', 'medium shot', 'full body shot', 'portrait framing'],
  cameraAngle: ['eye level', 'slightly low angle', 'slightly high angle', 'three-quarter view'],
  framing: ['balanced framing', 'centered subject', 'tight portrait crop', 'subject slightly off-center'],
  location: ['summer kitchen', 'city street', 'quiet bedroom', 'train station platform'],
  timeOfDay: ['morning', 'late afternoon', 'golden hour', 'night'],
  lighting: ['soft window light', 'warm sunset light', 'cinematic moody light', 'diffused natural light'],
  background: ['simple domestic background', 'blurred city lights', 'minimal studio backdrop', 'detailed interior background'],
  style: ['cinematic realism', 'high-end fashion editorial', 'stylized anime realism', 'painterly illustration'],
  detailLevel: ['high detail', 'very high detail', 'clean detail', 'refined texture detail'],
  palette: ['warm muted palette', 'cool desaturated palette', 'pastel palette', 'rich cinematic palette'],
  mood: ['intimate nostalgic mood', 'quiet melancholic mood', 'confident elegant mood', 'dreamy romantic mood'],
};

const sectionIcons: Record<string, typeof UserIcon> = {
  character: UserIcon,
  action: SparklesIcon,
  composition: PhotoIcon,
  environment: GlobeAltIcon,
  style: SwatchIcon,
  constraints: ExclamationTriangleIcon,
};

export default function PromptConstructorPageClient({ embedded = false }: { embedded?: boolean }) {
  const { activeWorkspaceId } = useStudio();
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<PromptDocument[]>([]);
  const [draft, setDraft] = useState<PromptDocument>(() => makeLocalDraft(activeWorkspaceId));
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSlotId, setActiveSlotId] = useState<string>('appearance');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryBlocks, setLibraryBlocks] = useState<PromptBlock[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [documentQuery, setDocumentQuery] = useState('');
  const [saveWarnings, setSaveWarnings] = useState<string[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [focusedSectionId, setFocusedSectionId] = useState<string>('character');
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setDraft((current) => current.workspaceId ? current : makeLocalDraft(activeWorkspaceId));
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId) return;

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/prompt-documents?workspaceId=${encodeURIComponent(activeWorkspaceId)}&templateId=single_character_scene_v1`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Failed to load prompt documents');
        if (cancelled) return;
        const items = Array.isArray(data.documents) ? data.documents as PromptDocument[] : [];
        setDocuments(items);
        if (items.length > 0 && draft.id === 'local-draft') {
          setDraft(items[0]);
        }
      } catch (error: any) {
        if (!cancelled) {
          console.warn('Prompt documents not available yet:', error);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLibraryLoading(true);
      try {
        const blocks = await loadPromptBlocks({
          slotId: activeSlotId,
          query: libraryQuery,
          workspaceId: activeWorkspaceId,
        });
        if (!cancelled) {
          setLibraryBlocks(blocks);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to load prompt blocks:', error);
          setLibraryBlocks([]);
        }
      } finally {
        if (!cancelled) setIsLibraryLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeSlotId, activeWorkspaceId, libraryQuery]);

  const draftFingerprint = useMemo(() => JSON.stringify({
    title: draft.title,
    state: draft.state,
    enabledConstraintIds: [...draft.enabledConstraintIds].sort(),
  }), [draft.enabledConstraintIds, draft.state, draft.title]);

  const persistedFingerprint = useMemo(() => {
    const persisted = documents.find((item) => item.id === draft.id);
    if (!persisted) return null;
    return JSON.stringify({
      title: persisted.title,
      state: persisted.state,
      enabledConstraintIds: [...persisted.enabledConstraintIds].sort(),
    });
  }, [documents, draft.id]);

  const isDirty = draft.id === 'local-draft' || persistedFingerprint !== draftFingerprint;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const filteredDocuments = useMemo(() => {
    const query = documentQuery.trim().toLowerCase();
    return documents.filter((document) => {
      if (!query) return true;
      return `${document.title} ${document.templateId}`.toLowerCase().includes(query);
    });
  }, [documentQuery, documents]);

  const renderedPrompt = useMemo(() => {
    if (!template) return '';
    return template.render(draft.state, resolveConstraintSnippets(draft.enabledConstraintIds, draft.templateId));
  }, [draft.enabledConstraintIds, draft.state, draft.templateId]);

  const warnings = useMemo(() => {
    if (!template) return [];
    const issues = template.validate(draft.state, resolveConstraintSnippets(draft.enabledConstraintIds, draft.templateId));
    if (!draft.title.trim()) {
      issues.unshift({ id: 'missing-title', level: 'warning', message: 'Document title is empty.' });
    }
    return issues;
  }, [draft.enabledConstraintIds, draft.state, draft.title, draft.templateId]);

  const sectionStats = useMemo(() => {
    if (!template) return [];
    return template.sections.map((section) => {
      const total = section.slotIds.length;
      const filled = section.slotIds.filter((slotId) => getSlotValue(draft.state, slotId).trim().length > 0).length;
      const hasWarning = warnings.some((warning) => warning.slotId && section.slotIds.includes(warning.slotId));
      return { ...section, total, filled, hasWarning };
    });
  }, [draft.state, warnings]);

  const activeSectionId = useMemo(() => {
    const slot = template?.slots.find((entry) => entry.id === activeSlotId);
    return focusedSectionId || slot?.sectionId || template?.sections[0]?.id || 'character';
  }, [activeSlotId, focusedSectionId]);

  const jumpToSection = (sectionId: string) => {
    setFocusedSectionId(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const firstSlotId = template?.sections.find((section) => section.id === sectionId)?.slotIds[0];
    if (firstSlotId) setActiveSlotId(firstSlotId);
  };

  const reloadDocuments = async (preferredId?: string) => {
    if (!activeWorkspaceId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/prompt-documents?workspaceId=${encodeURIComponent(activeWorkspaceId)}&templateId=single_character_scene_v1`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to load prompt documents');
      const items = Array.isArray(data.documents) ? data.documents as PromptDocument[] : [];
      setDocuments(items);
      if (preferredId) {
        const match = items.find((item) => item.id === preferredId);
        if (match) setDraft(match);
      }
    } catch (error) {
      console.warn('Failed to reload prompt documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectDocument = (next: PromptDocument) => {
    if (isDirty && draft.id !== next.id) {
      const confirmed = window.confirm('You have unsaved changes in the current prompt document. Switch documents anyway?');
      if (!confirmed) return;
    }
    setDraft(next);
    setSaveWarnings([]);
  };

  const handleSave = async () => {
    if (!activeWorkspaceId) {
      showToast('No active workspace available', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        workspaceId: activeWorkspaceId,
        title: draft.title,
        templateId: draft.templateId,
        templateVersion: draft.templateVersion,
        state: draft.state,
        enabledConstraintIds: draft.enabledConstraintIds,
      };

      const response = await fetch(draft.id === 'local-draft' ? '/api/prompt-documents' : `/api/prompt-documents/${draft.id}`, {
        method: draft.id === 'local-draft' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to save prompt document');

      const next = data.document as PromptDocument;
      setDocuments((current) => {
        const rest = current.filter((item) => item.id !== next.id);
        return [next, ...rest];
      });
      setDraft(next);
      setSaveWarnings(Array.isArray(data.warnings) ? data.warnings.map((warning: { message?: string }) => warning?.message || '').filter(Boolean) : []);
      showToast('Prompt document saved', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Failed to save prompt document', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = () => {
    if (isDirty) {
      const confirmed = window.confirm('Discard current unsaved changes and create a new prompt document?');
      if (!confirmed) return;
    }
    setDraft(makeLocalDraft(activeWorkspaceId));
    setSaveWarnings([]);
    window.requestAnimationFrame(() => titleInputRef.current?.focus());
  };

  const handleDuplicate = () => {
    setDraft(cloneDocument(draft));
    setSaveWarnings([]);
    window.requestAnimationFrame(() => titleInputRef.current?.focus());
  };

  const applyTextToActiveSlot = (content: string, mode: 'replace' | 'append') => {
    setDraft((current) => {
      const existing = getSlotValue(current.state, activeSlotId);
      const nextValue = mode === 'replace'
        ? content
        : [existing.trim(), content.trim()].filter(Boolean).join(', ');
      return {
        ...current,
        state: setSlotValue(current.state, activeSlotId, nextValue),
      };
    });
  };

  const applyLibraryBlock = (block: PromptBlock, mode: 'replace' | 'append') => {
    applyTextToActiveSlot(block.content, mode);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(renderedPrompt);
      showToast('Prompt copied', 'success');
    } catch {
      showToast('Failed to copy prompt', 'error');
    }
  };

  if (!template) {
    return <div className="p-6 text-white">Prompt template is unavailable.</div>;
  }

  return (
    <>
      <div className={`flex ${embedded ? 'h-full min-h-0' : 'h-screen min-h-screen'} bg-[#0b1020] text-white`}>
        <div className="flex w-full flex-col gap-4 p-4">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">Prompt Constructor v2</div>
                  <div className="mt-1 text-sm text-white/60">Desktop shell focused on slot editing, document actions, and on-demand prompt preview.</div>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/55">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 ${isDirty ? 'bg-amber-500/15 text-amber-200' : 'bg-emerald-500/15 text-emerald-200'}`}>
                    {isDirty ? 'Unsaved changes' : 'Saved'}
                  </span>
                  <span>{draft.id === 'local-draft' ? 'New document' : `Updated ${formatDate(draft.updatedAt)}`}</span>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(260px,320px)_minmax(260px,1fr)_auto]">
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/45">Document</div>
                  <div className="relative">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <Input
                      value={documentQuery}
                      onChange={(event) => setDocumentQuery(event.target.value)}
                      placeholder="Search documents"
                      className="h-10 border-white/15 bg-white/5 pl-9 text-white"
                    />
                  </div>
                  <select
                    value={draft.id === 'local-draft' ? '' : draft.id}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      const next = documents.find((document) => document.id === nextId);
                      if (next) selectDocument(next);
                    }}
                    className="h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white outline-none"
                  >
                    <option value="" className="bg-slate-900">Current draft</option>
                    {filteredDocuments.map((document) => (
                      <option key={document.id} value={document.id} className="bg-slate-900">
                        {document.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/45">Title</div>
                  <Input
                    ref={titleInputRef}
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Prompt document title"
                    className="h-10 border-white/15 bg-white/5 text-white"
                  />
                </div>

                <div className="flex flex-wrap items-end gap-2 xl:justify-end">
                  <Button variant="outline" size="sm" onClick={() => void reloadDocuments(draft.id !== 'local-draft' ? draft.id : undefined)} className="border-white/15 bg-transparent text-white hover:bg-white/10">
                    <ArrowPathIcon className={`mr-1 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDuplicate} className="border-white/15 bg-transparent text-white hover:bg-white/10">
                    <DocumentDuplicateIcon className="mr-1 h-4 w-4" />
                    Duplicate
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCreateNew} className="border-white/15 bg-transparent text-white hover:bg-white/10">
                    <PlusIcon className="mr-1 h-4 w-4" />
                    New
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setIsPreviewOpen(true)} className="border-white/15 bg-transparent text-white hover:bg-white/10">
                    <ClipboardDocumentIcon className="mr-1 h-4 w-4" />
                    Preview
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isSaving || !activeWorkspaceId}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[96px_minmax(0,1.35fr)_minmax(380px,0.85fr)]">
            <Card className="flex min-h-0 flex-col border-white/10 bg-white/5">
              <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-3">
                <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-white/40">Sections</div>
                {sectionStats.map((section) => {
                  const Icon = sectionIcons[section.id] || SparklesIcon;
                  const isActive = section.id === activeSectionId;
                  const isComplete = section.total > 0 && section.filled === section.total;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => jumpToSection(section.id)}
                      className={`rounded-xl border px-2 py-3 text-left transition-colors ${isActive ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100' : section.hasWarning ? 'border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15' : isComplete ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15' : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10'}`}
                    >
                      <div className="flex items-center justify-center">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-2 text-center text-[11px] font-medium leading-tight">{section.label}</div>
                      <div className="mt-1 text-center text-[10px] uppercase tracking-[0.12em] opacity-75">{section.filled}/{section.total}</div>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="mt-auto rounded-xl border border-white/10 bg-white/5 px-2 py-3 text-center text-[11px] text-white/70 transition-colors hover:bg-white/10"
                >
                  Preview
                </button>
              </CardContent>
            </Card>

            <Card className="flex min-h-0 flex-col border-white/10 bg-white/5">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="text-lg">Slots Editor</CardTitle>
                <div className="text-sm text-white/55">Main workspace for structured slot editing. The final prompt lives behind Preview now.</div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 pr-3">
                <div className="space-y-4">
                  {template.sections.map((section) => {
                    const isFocusedSection = section.id === activeSectionId;
                    const filledCount = section.slotIds.filter((slotId) => getSlotValue(draft.state, slotId).trim().length > 0).length;

                    return (
                      <div
                        key={section.id}
                        ref={(node) => {
                          sectionRefs.current[section.id] = node;
                        }}
                        className={`rounded-xl border bg-black/10 transition-colors ${isFocusedSection ? 'border-cyan-400/35 bg-cyan-500/5' : 'border-white/10 hover:bg-white/5'}`}
                      >
                        <button
                          type="button"
                          onClick={() => jumpToSection(section.id)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                        >
                          <div>
                            <div className="text-sm font-semibold text-white">{section.label}</div>
                            <div className="mt-1 text-xs text-white/45">
                              {isFocusedSection ? 'Editing this section now' : `Click to focus ${section.label.toLowerCase()}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/55">
                              {filledCount}/{section.slotIds.length}
                            </div>
                            <div className={`text-xs ${isFocusedSection ? 'text-cyan-300' : 'text-white/35'}`}>
                              {isFocusedSection ? 'Active' : 'Open'}
                            </div>
                          </div>
                        </button>

                        {isFocusedSection ? (
                          <div className="border-t border-white/10 px-4 pb-4 pt-4">
                            <div className="grid gap-4 xl:grid-cols-2">
                              {section.slotIds.map((slotId) => {
                                const slot = template.slots.find((entry) => entry.id === slotId);
                                if (!slot) return null;
                                const isActive = activeSlotId === slot.id;
                                return (
                                  <label key={slot.id} className="block rounded-lg border border-white/10 bg-white/5 p-3">
                                    <div className="mb-1 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-white/45">
                                      <span>{slot.label}</span>
                                      {isActive ? <span className="text-cyan-300">active</span> : null}
                                    </div>
                                    <Input
                                      value={getSlotValue(draft.state, slot.id)}
                                      onFocus={() => {
                                        setActiveSlotId(slot.id);
                                        setFocusedSectionId(section.id);
                                      }}
                                      onChange={(event) => {
                                        setActiveSlotId(slot.id);
                                        setFocusedSectionId(section.id);
                                        setDraft((current) => ({ ...current, state: setSlotValue(current.state, slot.id, event.target.value) }));
                                      }}
                                      placeholder={slot.placeholder || slot.label}
                                      className={`border-white/15 bg-white/5 text-white ${isActive ? 'ring-1 ring-cyan-400/60' : ''}`}
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="border-t border-white/10 px-4 py-3 text-sm text-white/55">
                            {section.slotIds.map((slotId) => {
                              const slot = template.slots.find((entry) => entry.id === slotId);
                              if (!slot) return null;
                              const value = getSlotValue(draft.state, slot.id).trim();
                              return (
                                <div key={slot.id} className="flex items-center justify-between gap-3 py-1">
                                  <span className="text-white/45">{slot.label}</span>
                                  <span className="max-w-[55%] truncate text-right text-white/70">{value || 'Empty'}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="flex min-h-0 flex-col border-white/10 bg-white/5">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="text-lg">Active Slot Helper</CardTitle>
                <div className="text-sm text-white/55">Everything on this side follows the currently active slot so you can insert ideas without leaving the editing context.</div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 pr-3">
                <div className="space-y-4">
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <div className="mb-2 text-xs uppercase tracking-[0.16em] text-cyan-200/70">Active Slot</div>
                    <div className="text-sm font-medium text-cyan-100">{template.slots.find((slot) => slot.id === activeSlotId)?.label || activeSlotId}</div>
                    <div className="mt-1 text-xs text-cyan-200/70">Section: {template.slots.find((slot) => slot.id === activeSlotId)?.sectionId || activeSectionId}</div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/10 p-3">
                    <div className="mb-3 text-xs uppercase tracking-[0.18em] text-white/45">Quick Presets</div>
                    {(slotPresetChips[activeSlotId] || []).length === 0 ? (
                      <div className="text-sm text-white/60">No quick presets for this slot yet.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(slotPresetChips[activeSlotId] || []).map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => applyTextToActiveSlot(chip, 'replace')}
                            className="rounded-full border border-cyan-400/25 bg-cyan-400/12 px-3 py-1.5 text-xs text-cyan-100 transition-colors hover:bg-cyan-400/20"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/10 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/45">Library Suggestions</div>
                      <div className="text-xs text-white/45">Insert into current slot</div>
                    </div>

                    <Input
                      value={libraryQuery}
                      onChange={(event) => setLibraryQuery(event.target.value)}
                      placeholder="Search library blocks"
                      className="mb-3 border-white/15 bg-white/5 text-white"
                    />

                    {isLibraryLoading ? (
                      <div className="rounded-lg border border-white/10 bg-black/10 p-4 text-sm text-white/60">Loading library…</div>
                    ) : libraryBlocks.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-white/15 bg-black/10 p-4 text-sm text-white/65">
                        No library blocks matched this slot yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {libraryBlocks.map((block) => (
                          <div key={block.id} className="rounded-lg border border-white/10 bg-black/10 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white">{block.label}</div>
                                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/40">{block.source} · {block.category}</div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => applyLibraryBlock(block, 'append')} className="border-white/15 bg-transparent text-white hover:bg-white/10">
                                  Append
                                </Button>
                                <Button type="button" size="sm" onClick={() => applyLibraryBlock(block, 'replace')}>
                                  Replace
                                </Button>
                              </div>
                            </div>
                            <div className="mt-3 text-sm leading-6 text-white/80">{block.content}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/10 p-3">
                    <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/45">Warnings</div>
                    {warnings.length === 0 && saveWarnings.length === 0 ? (
                      <div className="text-sm text-emerald-300">No validation warnings.</div>
                    ) : (
                      <ul className="space-y-1 text-sm text-amber-300">
                        {warnings.map((warning) => (
                          <li key={warning.id}>• {warning.message}</li>
                        ))}
                        {saveWarnings.map((warning, index) => (
                          <li key={`save-warning-${index}`}>• {warning}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/10 p-3">
                    <div className="mb-3 text-xs uppercase tracking-[0.18em] text-white/45">Constraints</div>
                    <div className="space-y-3">
                      {promptConstructorConstraints
                        .filter((constraint) => constraint.applicableTemplateIds.includes(draft.templateId))
                        .map((constraint) => {
                          const checked = draft.enabledConstraintIds.includes(constraint.id);
                          return (
                            <label key={constraint.id} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => setDraft((current) => ({
                                  ...current,
                                  enabledConstraintIds: event.target.checked
                                    ? [...current.enabledConstraintIds, constraint.id]
                                    : current.enabledConstraintIds.filter((id) => id !== constraint.id),
                                }))}
                                className="mt-1"
                              />
                              <div>
                                <div className="text-sm font-medium text-white">{constraint.label}</div>
                                <div className="text-sm text-white/60">{constraint.content}</div>
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="h-[90vh] w-[min(92vw,960px)] max-w-none border-white/10 bg-[#0b1020] p-0 text-white">
          <div className="flex h-full flex-col overflow-hidden">
            <DialogHeader className="border-b border-white/10 px-6 py-5 text-left">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle>Prompt Preview</DialogTitle>
                  <DialogDescription className="mt-1 text-white/60">
                    Final rendered prompt in a dedicated inspection surface, with scrolling, copy, and visible warnings.
                  </DialogDescription>
                </div>
                <div className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/55">
                  {draft.title || 'Untitled Prompt'}
                </div>
              </div>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="flex min-h-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">Rendered Prompt</div>
                    <div className="mt-1 text-sm text-white/55">Scrollable output, ready to copy.</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCopy} className="border-white/15 bg-transparent text-white hover:bg-white/10">
                    <ClipboardDocumentIcon className="mr-1 h-4 w-4" />
                    Copy Prompt
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-white/90">{renderedPrompt || 'Prompt preview will appear here.'}</pre>
                </div>
              </div>

              <div className="flex min-h-0 flex-col bg-white/5">
                <div className="border-b border-white/10 px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Preview Meta</div>
                  <div className="mt-2 space-y-2 text-sm text-white/70">
                    <div>Template: {draft.templateId}</div>
                    <div>Warnings: {warnings.length + saveWarnings.length}</div>
                    <div>Status: {isDirty ? 'Unsaved changes' : 'Saved'}</div>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  <div className="mb-3 text-xs uppercase tracking-[0.18em] text-white/45">Warnings</div>
                  {warnings.length === 0 && saveWarnings.length === 0 ? (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                      No validation warnings.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {warnings.map((warning) => (
                        <div key={warning.id} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                          {warning.message}
                        </div>
                      ))}
                      {saveWarnings.map((warning, index) => (
                        <div key={`preview-save-warning-${index}`} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                          {warning}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
