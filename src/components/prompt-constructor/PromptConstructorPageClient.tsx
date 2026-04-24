'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownIcon, ArrowPathIcon, ArrowUpIcon, ClipboardDocumentIcon, DocumentDuplicateIcon, ExclamationTriangleIcon, GlobeAltIcon, MagnifyingGlassIcon, PhotoIcon, PlusIcon, SparklesIcon, SwatchIcon, TrashIcon, UserIcon, UsersIcon } from '@heroicons/react/24/outline';
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
import type { CharacterRelation, CharacterSlot, PromptDocument, PromptDocumentSummary, PromptState, SceneTemplateState, SingleCharacterPromptState } from '@/lib/prompt-constructor/types';

const defaultTemplateId = 'scene_template_v2';
const defaultTemplate = getPromptTemplate(defaultTemplateId);

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
  const initialState = defaultTemplate?.createInitialState() ?? {
    sceneSummary: { sceneType: '', mainEvent: '', notes: '', tags: [] },
    characterSlots: [],
    characterRelations: [],
    composition: { shotSize: '', cameraAngle: '', framing: '', subjectPlacement: '', foregroundPriority: '', backgroundPriority: '' },
    environment: { location: '', timeOfDay: '', lighting: '', weather: '', background: '', environmentDetails: '' },
    style: { medium: '', visualStyle: '', detailLevel: '', colorPalette: '', mood: '', renderingStyle: '' },
    constraints: { mustKeep: [], mustAvoid: [], consistencyRequirements: [], layoutConstraints: [], textConstraints: [] },
  };

  return {
    id: 'local-draft',
    workspaceId: workspaceId ?? '',
    title: 'Untitled Scene',
    templateId: defaultTemplateId,
    templateVersion: 1,
    state: initialState,
    enabledConstraintIds: promptConstructorConstraints
      .filter((constraint) => constraint.applicableTemplateIds.includes(defaultTemplateId))
      .map((constraint) => constraint.id),
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function isSceneTemplateState(state: PromptState): state is SceneTemplateState {
  return 'sceneSummary' in state && 'characterSlots' in state;
}

function createCharacterSlot(index: number): CharacterSlot {
  return {
    id: `char_${Date.now()}_${index}`,
    label: `Character ${String.fromCharCode(65 + index)}`,
    role: '',
    enabled: true,
    presetRef: null,
    posePresetRef: null,
    fields: {
      nameOrRole: '',
      ageBand: '',
      genderPresentation: '',
      appearance: '',
      outfit: '',
      expression: '',
      pose: '',
      localAction: '',
      props: [],
    },
    staging: {
      screenPosition: '',
      depthLayer: '',
      bodyOrientation: '',
      stance: '',
      relativePlacementNotes: '',
    },
  };
}

function createCharacterRelation(subjectId = '', targetId = ''): CharacterRelation {
  return {
    id: `rel_${Date.now()}`,
    subjectId,
    targetId,
    relationType: '',
    distance: '',
    eyeContact: '',
    bodyOrientation: '',
    contactDetails: '',
    relativePlacement: '',
    dramaticFocus: '',
    notes: '',
  };
}

function setSlotValue(state: PromptState, slotId: string, value: string): PromptState {
  if (isSceneTemplateState(state)) {
    switch (slotId) {
      case 'sceneType': return { ...state, sceneSummary: { ...state.sceneSummary, sceneType: value } };
      case 'mainEvent': return { ...state, sceneSummary: { ...state.sceneSummary, mainEvent: value } };
      case 'sceneNotes': return { ...state, sceneSummary: { ...state.sceneSummary, notes: value } };
      case 'sceneTags': return { ...state, sceneSummary: { ...state.sceneSummary, tags: value.split(',').map((item) => item.trim()).filter(Boolean) } };
      case 'shotSize': return { ...state, composition: { ...state.composition, shotSize: value } };
      case 'cameraAngle': return { ...state, composition: { ...state.composition, cameraAngle: value } };
      case 'framing': return { ...state, composition: { ...state.composition, framing: value } };
      case 'subjectPlacement': return { ...state, composition: { ...state.composition, subjectPlacement: value } };
      case 'foregroundPriority': return { ...state, composition: { ...state.composition, foregroundPriority: value } };
      case 'backgroundPriority': return { ...state, composition: { ...state.composition, backgroundPriority: value } };
      case 'location': return { ...state, environment: { ...state.environment, location: value } };
      case 'timeOfDay': return { ...state, environment: { ...state.environment, timeOfDay: value } };
      case 'lighting': return { ...state, environment: { ...state.environment, lighting: value } };
      case 'weather': return { ...state, environment: { ...state.environment, weather: value } };
      case 'background': return { ...state, environment: { ...state.environment, background: value } };
      case 'environmentDetails': return { ...state, environment: { ...state.environment, environmentDetails: value } };
      case 'medium': return { ...state, style: { ...state.style, medium: value } };
      case 'visualStyle': return { ...state, style: { ...state.style, visualStyle: value } };
      case 'detailLevel': return { ...state, style: { ...state.style, detailLevel: value } };
      case 'colorPalette': return { ...state, style: { ...state.style, colorPalette: value } };
      case 'mood': return { ...state, style: { ...state.style, mood: value } };
      case 'renderingStyle': return { ...state, style: { ...state.style, renderingStyle: value } };
      case 'mustKeep': return { ...state, constraints: { ...state.constraints, mustKeep: value.split(',').map((item) => item.trim()).filter(Boolean) } };
      case 'mustAvoid': return { ...state, constraints: { ...state.constraints, mustAvoid: value.split(',').map((item) => item.trim()).filter(Boolean) } };
      case 'consistencyRequirements': return { ...state, constraints: { ...state.constraints, consistencyRequirements: value.split(',').map((item) => item.trim()).filter(Boolean) } };
      case 'layoutConstraints': return { ...state, constraints: { ...state.constraints, layoutConstraints: value.split(',').map((item) => item.trim()).filter(Boolean) } };
      case 'textConstraints': return { ...state, constraints: { ...state.constraints, textConstraints: value.split(',').map((item) => item.trim()).filter(Boolean) } };
      default: return state;
    }
  }
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

function getSlotValue(state: PromptState, slotId: string): string {
  if (isSceneTemplateState(state)) {
    switch (slotId) {
      case 'sceneType': return state.sceneSummary.sceneType;
      case 'mainEvent': return state.sceneSummary.mainEvent;
      case 'sceneNotes': return state.sceneSummary.notes;
      case 'sceneTags': return state.sceneSummary.tags.join(', ');
      case 'shotSize': return state.composition.shotSize;
      case 'cameraAngle': return state.composition.cameraAngle;
      case 'framing': return state.composition.framing;
      case 'subjectPlacement': return state.composition.subjectPlacement;
      case 'foregroundPriority': return state.composition.foregroundPriority;
      case 'backgroundPriority': return state.composition.backgroundPriority;
      case 'location': return state.environment.location;
      case 'timeOfDay': return state.environment.timeOfDay;
      case 'lighting': return state.environment.lighting;
      case 'weather': return state.environment.weather;
      case 'background': return state.environment.background;
      case 'environmentDetails': return state.environment.environmentDetails;
      case 'medium': return state.style.medium;
      case 'visualStyle': return state.style.visualStyle;
      case 'detailLevel': return state.style.detailLevel;
      case 'colorPalette': return state.style.colorPalette;
      case 'mood': return state.style.mood;
      case 'renderingStyle': return state.style.renderingStyle;
      case 'mustKeep': return state.constraints.mustKeep.join(', ');
      case 'mustAvoid': return state.constraints.mustAvoid.join(', ');
      case 'consistencyRequirements': return state.constraints.consistencyRequirements.join(', ');
      case 'layoutConstraints': return state.constraints.layoutConstraints.join(', ');
      case 'textConstraints': return state.constraints.textConstraints.join(', ');
      default: return '';
    }
  }
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
  characters: UsersIcon,
  action: SparklesIcon,
  composition: PhotoIcon,
  environment: GlobeAltIcon,
  style: SwatchIcon,
  constraints: ExclamationTriangleIcon,
  sceneSummary: SparklesIcon,
  relations: UsersIcon,
};

export default function PromptConstructorPageClient({ embedded = false }: { embedded?: boolean }) {
  const { activeWorkspaceId } = useStudio();
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<PromptDocumentSummary[]>([]);
  const [draft, setDraft] = useState<PromptDocument>(() => makeLocalDraft(activeWorkspaceId));
  const template = useMemo(() => getPromptTemplate(draft.templateId), [draft.templateId]);
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
        const params = new URLSearchParams({
          workspaceId: activeWorkspaceId,
          templateId: defaultTemplateId,
        });
        if (documentQuery.trim()) params.set('query', documentQuery.trim());
        const response = await fetch(`/api/prompt-documents?${params.toString()}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Failed to load prompt documents');
        if (cancelled) return;
        const items = Array.isArray(data.documents) ? data.documents as PromptDocumentSummary[] : [];
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
  }, [activeWorkspaceId, documentQuery, draft.id]);

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

  const filteredDocuments = useMemo(() => documents, [documents]);

  const renderedPrompt = useMemo(() => {
    if (!template) return '';
    return template.render(draft.state, resolveConstraintSnippets(draft.enabledConstraintIds, draft.templateId));
  }, [draft.enabledConstraintIds, draft.state, draft.templateId]);

  const warnings = useMemo(() => {
    if (!template) return [];
    const issues = template.validate(draft.state, resolveConstraintSnippets(draft.enabledConstraintIds, draft.templateId));
    if (!draft.title.trim()) {
      issues.unshift({ id: 'missing-title', level: 'warning', message: 'Scene title is empty.' });
    }
    return issues;
  }, [draft.enabledConstraintIds, draft.state, draft.title, draft.templateId]);

  const activeSlotLabel = useMemo(() => {
    if (!template) return activeSlotId;
    if (activeSlotId.startsWith('characters.')) return 'Character field';
    if (activeSlotId.startsWith('relations.')) return 'Relation field';
    return template.slots.find((slot) => slot.id === activeSlotId)?.label || activeSlotId;
  }, [activeSlotId, template]);

  const sectionStats = useMemo(() => {
    if (!template) return [];
    return template.sections.map((section) => {
      let total = section.slotIds.length;
      let filled = section.slotIds.filter((slotId) => getSlotValue(draft.state, slotId).trim().length > 0).length;

      if (isSceneTemplateState(draft.state) && section.id === 'characters') {
        total = Math.max(draft.state.characterSlots.length, 1);
        filled = draft.state.characterSlots.filter((slot) => slot.enabled && [slot.label, slot.role, slot.fields.nameOrRole, slot.fields.appearance].some((value) => value.trim().length > 0)).length;
      }

      const hasWarning = warnings.some((warning) => warning.slotId && section.slotIds.includes(warning.slotId));
      return { ...section, total, filled, hasWarning };
    });
  }, [draft.state, template, warnings]);

  const activeSectionId = useMemo(() => {
    const slot = template?.slots.find((entry) => entry.id === activeSlotId);
    return focusedSectionId || slot?.sectionId || template?.sections[0]?.id || 'character';
  }, [activeSlotId, focusedSectionId, template]);

  const helperTitle = useMemo(() => {
    if (activeSectionId === 'characters') return 'Character Helper';
    if (activeSectionId === 'relations') return 'Relations Helper';
    if (activeSectionId === 'sceneSummary') return 'Scene Summary Helper';
    if (activeSectionId === 'composition') return 'Composition Helper';
    if (activeSectionId === 'environment') return 'Environment Helper';
    if (activeSectionId === 'style') return 'Style Helper';
    if (activeSectionId === 'constraints') return 'Constraints Helper';
    return 'Scene Helper';
  }, [activeSectionId]);

  const helperDescription = useMemo(() => {
    if (activeSectionId === 'characters') return 'Use this side to shape reusable character slots, presets, and staging hints.';
    if (activeSectionId === 'relations') return 'Use this side to keep multi-character interactions readable and intentional.';
    if (activeSectionId === 'sceneSummary') return 'Use this side to define the scene intent before filling details.';
    if (activeSectionId === 'composition') return 'Use this side to steer camera, framing, and subject placement.';
    if (activeSectionId === 'environment') return 'Use this side to lock in setting, time, lighting, and atmosphere.';
    if (activeSectionId === 'style') return 'Use this side to keep rendering and mood coherent across the whole scene.';
    if (activeSectionId === 'constraints') return 'Use this side to reinforce guardrails before generation.';
    return 'Everything on this side follows the active scene section.';
  }, [activeSectionId]);

  const helperQuickPresets = useMemo(() => {
    if (activeSectionId === 'relations') {
      return ['facing each other', 'locked eye contact', 'close distance', 'one character leaning toward the other'];
    }
    if (activeSectionId === 'sceneSummary') {
      return ['dramatic confrontation', 'quiet intimate moment', 'cinematic portrait scene', 'two-character conversation'];
    }
    if (activeSectionId === 'composition') {
      return ['medium shot', 'eye-level camera', 'clear silhouette separation', 'left-right subject placement'];
    }
    if (activeSectionId === 'environment') {
      return ['soft window light', 'late afternoon', 'lived-in interior', 'muted atmospheric background'];
    }
    if (activeSectionId === 'style') {
      return ['cinematic realism', 'semi-realistic illustration', 'high detail', 'muted palette'];
    }
    if (activeSectionId === 'constraints') {
      return ['no extra people', 'clear character separation', 'no duplicated limbs', 'readable subject focus'];
    }
    return slotPresetChips[activeSlotId] || [];
  }, [activeSectionId, activeSlotId]);

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
      const params = new URLSearchParams({
        workspaceId: activeWorkspaceId,
        templateId: defaultTemplateId,
      });
      if (documentQuery.trim()) params.set('query', documentQuery.trim());
      const response = await fetch(`/api/prompt-documents?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to load prompt documents');
      const items = Array.isArray(data.documents) ? data.documents as PromptDocumentSummary[] : [];
      setDocuments(items);
      if (preferredId) {
        const detailResponse = await fetch(`/api/prompt-documents/${preferredId}`, { cache: 'no-store' });
        const detailData = await detailResponse.json();
        if (detailResponse.ok && detailData.document) setDraft(detailData.document as PromptDocument);
      }
    } catch (error) {
      console.warn('Failed to reload prompt documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectDocument = async (next: PromptDocumentSummary) => {
    if (isDirty && draft.id !== next.id) {
      const confirmed = window.confirm('You have unsaved changes in the current scene. Switch scenes anyway?');
      if (!confirmed) return;
    }
    try {
      const response = await fetch(`/api/prompt-documents/${next.id}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to load scene');
      setDraft(data.document as PromptDocument);
      setSaveWarnings([]);
    } catch (error: any) {
      showToast(error?.message || 'Failed to load scene', 'error');
    }
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
      setDraft(next);
      setSaveWarnings(Array.isArray(data.warnings) ? data.warnings.map((warning: { message?: string }) => warning?.message || '').filter(Boolean) : []);
      await reloadDocuments(next.id);
      showToast('Scene saved', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Failed to save scene', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = () => {
    if (isDirty) {
      const confirmed = window.confirm('Discard current unsaved changes and create a new scene?');
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

  const updateCharacterSlot = (slotId: string, updater: (slot: CharacterSlot) => CharacterSlot) => {
    setDraft((current) => {
      if (!isSceneTemplateState(current.state)) return current;
      return {
        ...current,
        state: {
          ...current.state,
          characterSlots: current.state.characterSlots.map((slot) => slot.id === slotId ? updater(slot) : slot),
        },
      };
    });
  };

  const addCharacterSlot = () => {
    setDraft((current) => {
      if (!isSceneTemplateState(current.state)) return current;
      return {
        ...current,
        state: {
          ...current.state,
          characterSlots: [...current.state.characterSlots, createCharacterSlot(current.state.characterSlots.length)],
        },
      };
    });
  };

  const duplicateCharacterSlot = (slotId: string) => {
    setDraft((current) => {
      if (!isSceneTemplateState(current.state)) return current;
      const index = current.state.characterSlots.findIndex((slot) => slot.id === slotId);
      if (index < 0) return current;
      const source = current.state.characterSlots[index];
      const duplicate: CharacterSlot = {
        ...source,
        id: `char_${Date.now()}_${index}`,
        label: source.label.trim() ? `${source.label} Copy` : `Character ${String.fromCharCode(65 + index)} Copy`,
        fields: { ...source.fields, props: [...source.fields.props] },
        staging: { ...source.staging },
      };
      const next = [...current.state.characterSlots];
      next.splice(index + 1, 0, duplicate);
      return { ...current, state: { ...current.state, characterSlots: next } };
    });
  };

  const moveCharacterSlot = (slotId: string, direction: -1 | 1) => {
    setDraft((current) => {
      if (!isSceneTemplateState(current.state)) return current;
      const index = current.state.characterSlots.findIndex((slot) => slot.id === slotId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.state.characterSlots.length) return current;
      const next = [...current.state.characterSlots];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return { ...current, state: { ...current.state, characterSlots: next } };
    });
  };

  const removeCharacterSlot = (slotId: string) => {
    setDraft((current) => {
      if (!isSceneTemplateState(current.state) || current.state.characterSlots.length <= 1) return current;
      return {
        ...current,
        state: {
          ...current.state,
          characterSlots: current.state.characterSlots.filter((slot) => slot.id !== slotId),
          characterRelations: current.state.characterRelations.filter((relation) => relation.subjectId !== slotId && relation.targetId !== slotId),
        },
      };
    });
  };

  const addRelation = () => {
    setDraft((current) => {
      if (!isSceneTemplateState(current.state)) return current;
      const enabledSlots = current.state.characterSlots.filter((slot) => slot.enabled);
      const subjectId = enabledSlots[0]?.id || '';
      const targetId = enabledSlots[1]?.id || enabledSlots[0]?.id || '';
      return {
        ...current,
        state: {
          ...current.state,
          characterRelations: [...current.state.characterRelations, createCharacterRelation(subjectId, targetId)],
        },
      };
    });
  };

  const updateRelation = (relationId: string, updater: (relation: CharacterRelation) => CharacterRelation) => {
    setDraft((current) => {
      if (!isSceneTemplateState(current.state)) return current;
      return {
        ...current,
        state: {
          ...current.state,
          characterRelations: current.state.characterRelations.map((relation) => relation.id === relationId ? updater(relation) : relation),
        },
      };
    });
  };

  const removeRelation = (relationId: string) => {
    setDraft((current) => {
      if (!isSceneTemplateState(current.state)) return current;
      return {
        ...current,
        state: {
          ...current.state,
          characterRelations: current.state.characterRelations.filter((relation) => relation.id !== relationId),
        },
      };
    });
  };

  if (!template) {
    return <div className="p-6 text-white">Prompt template is unavailable.</div>;
  }

  return (
    <>
      <div className={`flex ${embedded ? 'h-full min-h-0' : 'h-screen min-h-screen'} bg-[#0b1020] text-white`}>
        <div className="flex w-full flex-col gap-3 p-4">
          <div className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 xl:grid-cols-[220px_minmax(220px,1fr)_auto]">
            <div className="min-w-0 space-y-2">
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <Input
                  value={documentQuery}
                  onChange={(event) => setDocumentQuery(event.target.value)}
                  placeholder="Search scenes"
                  className="h-9 border-white/15 bg-white/5 pl-9 text-white"
                />
              </div>
              <select
                value={draft.id === 'local-draft' ? '' : draft.id}
                onChange={(event) => {
                  const nextId = event.target.value;
                  const next = documents.find((document) => document.id === nextId);
                  if (next) selectDocument(next);
                }}
                className="h-9 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white outline-none"
              >
                <option value="" className="bg-slate-900">Current draft</option>
                {filteredDocuments.map((document) => (
                  <option key={document.id} value={document.id} className="bg-slate-900">
                    {document.title}{document.sceneType ? ` · ${document.sceneType}` : ''}{typeof document.characterCount === 'number' ? ` · ${document.characterCount} chars` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0 space-y-2">
              <Input
                ref={titleInputRef}
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Scene title"
                className="h-9 border-white/15 bg-white/5 text-white"
              />
              <div className="flex items-center gap-2 text-[11px] text-white/55">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${isDirty ? 'bg-amber-500/15 text-amber-200' : 'bg-emerald-500/15 text-emerald-200'}`}>
                  {isDirty ? 'Unsaved' : 'Saved'}
                </span>
                <span className="truncate">{draft.id === 'local-draft' ? 'New scene' : `Updated ${formatDate(draft.updatedAt)}`}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Button variant="outline" size="sm" onClick={() => void reloadDocuments(draft.id !== 'local-draft' ? draft.id : undefined)} className="h-9 border-white/15 bg-transparent px-3 text-white hover:bg-white/10">
                <ArrowPathIcon className={`mr-1 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleDuplicate} className="h-9 border-white/15 bg-transparent px-3 text-white hover:bg-white/10">
                <DocumentDuplicateIcon className="mr-1 h-4 w-4" />
                Duplicate
              </Button>
              <Button variant="outline" size="sm" onClick={handleCreateNew} className="h-9 border-white/15 bg-transparent px-3 text-white hover:bg-white/10">
                <PlusIcon className="mr-1 h-4 w-4" />
                New
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsPreviewOpen(true)} className="h-9 border-white/15 bg-transparent px-3 text-white hover:bg-white/10">
                <ClipboardDocumentIcon className="mr-1 h-4 w-4" />
                Preview
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving || !activeWorkspaceId} className="h-9 px-3">
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[68px_minmax(0,1.35fr)_minmax(380px,0.85fr)]">
            <Card className="flex min-h-0 flex-col border-white/10 bg-white/5">
              <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-2">
                {sectionStats.map((section) => {
                  const Icon = sectionIcons[section.id] || SparklesIcon;
                  const isActive = section.id === activeSectionId;
                  const filledMarks = Array.from({ length: section.total }, (_, index) => index < section.filled);
                  const baseTone = section.hasWarning
                    ? 'amber'
                    : section.filled === section.total
                      ? 'emerald'
                      : 'cyan';

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => jumpToSection(section.id)}
                      className={`rounded-lg border px-1.5 py-2 transition-colors ${isActive ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100' : section.hasWarning ? 'border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15' : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10'}`}
                    >
                      <div className="flex items-center justify-center">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="mt-1 flex items-center justify-center gap-0.5">
                        {filledMarks.map((filled, index) => (
                          <span
                            key={`${section.id}-mark-${index}`}
                            className={`inline-block h-[3px] w-2 rounded-full ${filled ? baseTone === 'amber' ? 'bg-amber-300' : baseTone === 'emerald' ? 'bg-emerald-300' : 'bg-cyan-300' : 'bg-white/15'}`}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="flex min-h-0 flex-col border-white/10 bg-white/5">
              <CardHeader className="border-b border-white/10 pb-3">
                <CardTitle className="text-base">Scene Editor</CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 pr-3">
                <div className="space-y-4">
                  {template.sections.map((section) => {
                    const isFocusedSection = section.id === activeSectionId;
                    const filledCount = isSceneTemplateState(draft.state) && section.id === 'relations'
                      ? draft.state.characterRelations.filter((relation) => [relation.relationType, relation.distance, relation.eyeContact, relation.relativePlacement, relation.notes].some((value) => value.trim().length > 0)).length
                      : section.slotIds.filter((slotId) => getSlotValue(draft.state, slotId).trim().length > 0).length;

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
                            {isSceneTemplateState(draft.state) && section.id === 'characters' ? (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm text-white/65">Dynamic character slots for this scene.</div>
                                  <Button type="button" size="sm" onClick={addCharacterSlot}>
                                    <PlusIcon className="mr-1 h-4 w-4" />
                                    Add character
                                  </Button>
                                </div>
                                {draft.state.characterSlots.map((slot, index) => (
                                  <div key={slot.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <div className="text-sm font-semibold text-white">{slot.label || `Character ${index + 1}`}</div>
                                        <div className="text-xs text-white/45">Slot #{index + 1}</div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/10 px-2 py-1 text-xs text-white/70">
                                          <input
                                            type="checkbox"
                                            checked={slot.enabled}
                                            onChange={(event) => updateCharacterSlot(slot.id, (current) => ({ ...current, enabled: event.target.checked }))}
                                          />
                                          Enabled
                                        </label>
                                        <Button type="button" variant="outline" size="sm" onClick={() => moveCharacterSlot(slot.id, -1)} disabled={index === 0} className="border-white/15 bg-transparent text-white hover:bg-white/10">
                                          <ArrowUpIcon className="h-4 w-4" />
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => moveCharacterSlot(slot.id, 1)} disabled={index === draft.state.characterSlots.length - 1} className="border-white/15 bg-transparent text-white hover:bg-white/10">
                                          <ArrowDownIcon className="h-4 w-4" />
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => duplicateCharacterSlot(slot.id)} className="border-white/15 bg-transparent text-white hover:bg-white/10">
                                          <DocumentDuplicateIcon className="h-4 w-4" />
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => removeCharacterSlot(slot.id)} disabled={draft.state.characterSlots.length <= 1} className="border-white/15 bg-transparent text-white hover:bg-white/10">
                                          <TrashIcon className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="grid gap-3 xl:grid-cols-2">
                                      {[
                                        ['label', 'Label', slot.label],
                                        ['role', 'Role', slot.role],
                                        ['characterPreset', 'Character preset ref', slot.presetRef?.name || ''],
                                        ['posePreset', 'Pose preset ref', slot.posePresetRef?.name || ''],
                                        ['nameOrRole', 'Name or role', slot.fields.nameOrRole],
                                        ['appearance', 'Appearance', slot.fields.appearance],
                                        ['outfit', 'Outfit', slot.fields.outfit],
                                        ['expression', 'Expression', slot.fields.expression],
                                        ['pose', 'Pose', slot.fields.pose],
                                        ['localAction', 'Local action', slot.fields.localAction],
                                        ['screenPosition', 'Screen position', slot.staging.screenPosition],
                                        ['depthLayer', 'Depth layer', slot.staging.depthLayer],
                                        ['bodyOrientation', 'Body orientation', slot.staging.bodyOrientation],
                                        ['stance', 'Stance', slot.staging.stance],
                                      ].map(([fieldId, label, value]) => (
                                        <label key={fieldId} className="block rounded-lg border border-white/10 bg-black/10 p-3">
                                          <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">{label}</div>
                                          <Input
                                            value={value}
                                            onFocus={() => {
                                              setActiveSlotId(`characters.${slot.id}.${fieldId}`);
                                              setFocusedSectionId('characters');
                                            }}
                                            onChange={(event) => {
                                              const nextValue = event.target.value;
                                              updateCharacterSlot(slot.id, (current) => {
                                                if (fieldId === 'label') return { ...current, label: nextValue };
                                                if (fieldId === 'role') return { ...current, role: nextValue };
                                                if (fieldId === 'characterPreset') return { ...current, presetRef: nextValue.trim() ? { id: current.presetRef?.id || '', name: nextValue } : null };
                                                if (fieldId === 'posePreset') return { ...current, posePresetRef: nextValue.trim() ? { id: current.posePresetRef?.id || '', name: nextValue } : null };
                                                if (fieldId === 'screenPosition') return { ...current, staging: { ...current.staging, screenPosition: nextValue } };
                                                if (fieldId === 'depthLayer') return { ...current, staging: { ...current.staging, depthLayer: nextValue } };
                                                if (fieldId === 'bodyOrientation') return { ...current, staging: { ...current.staging, bodyOrientation: nextValue } };
                                                if (fieldId === 'stance') return { ...current, staging: { ...current.staging, stance: nextValue } };
                                                return { ...current, fields: { ...current.fields, [fieldId]: nextValue } } as CharacterSlot;
                                              });
                                            }}
                                            className="border-white/15 bg-white/5 text-white"
                                          />
                                        </label>
                                      ))}
                                      <label className="block rounded-lg border border-white/10 bg-black/10 p-3 xl:col-span-2">
                                        <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">Relative placement notes</div>
                                        <Input
                                          value={slot.staging.relativePlacementNotes}
                                          onFocus={() => {
                                            setActiveSlotId(`characters.${slot.id}.relativePlacementNotes`);
                                            setFocusedSectionId('characters');
                                          }}
                                          onChange={(event) => updateCharacterSlot(slot.id, (current) => ({ ...current, staging: { ...current.staging, relativePlacementNotes: event.target.value } }))}
                                          className="border-white/15 bg-white/5 text-white"
                                        />
                                      </label>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : isSceneTemplateState(draft.state) && section.id === 'relations' ? (
                              <div className="space-y-4">
                                {draft.state.characterSlots.filter((slot) => slot.enabled).length <= 1 ? (
                                  <div className="rounded-xl border border-dashed border-white/15 bg-black/10 p-4 text-sm text-white/65">
                                    Add at least two enabled characters to define structured relations between them.
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-sm text-white/65">Structured character-to-character relationships for this scene.</div>
                                      <Button type="button" size="sm" onClick={addRelation}>
                                        <PlusIcon className="mr-1 h-4 w-4" />
                                        Add relation
                                      </Button>
                                    </div>
                                    {draft.state.characterRelations.length === 0 ? (
                                      <div className="rounded-xl border border-dashed border-white/15 bg-black/10 p-4 text-sm text-white/65">
                                        No relations yet. Add one so the scene can describe how characters interact.
                                      </div>
                                    ) : (
                                      draft.state.characterRelations.map((relation, index) => {
                                        const enabledSlots = draft.state.characterSlots.filter((slot) => slot.enabled);
                                        return (
                                          <div key={relation.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                                            <div className="mb-4 flex items-center justify-between gap-3">
                                              <div>
                                                <div className="text-sm font-semibold text-white">Relation #{index + 1}</div>
                                                <div className="text-xs text-white/45">Describe how one character relates to another.</div>
                                              </div>
                                              <Button type="button" variant="outline" size="sm" onClick={() => removeRelation(relation.id)} className="border-white/15 bg-transparent text-white hover:bg-white/10">
                                                <TrashIcon className="h-4 w-4" />
                                              </Button>
                                            </div>

                                            <div className="grid gap-3 xl:grid-cols-2">
                                              <label className="block rounded-lg border border-white/10 bg-black/10 p-3">
                                                <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">Subject</div>
                                                <select
                                                  value={relation.subjectId}
                                                  onFocus={() => {
                                                    setActiveSlotId(`relations.${relation.id}.subjectId`);
                                                    setFocusedSectionId('relations');
                                                  }}
                                                  onChange={(event) => updateRelation(relation.id, (current) => ({ ...current, subjectId: event.target.value }))}
                                                  className="h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white outline-none"
                                                >
                                                  <option value="" className="bg-slate-900">Select subject</option>
                                                  {enabledSlots.map((slot) => (
                                                    <option key={slot.id} value={slot.id} className="bg-slate-900">{slot.label || slot.id}</option>
                                                  ))}
                                                </select>
                                              </label>

                                              <label className="block rounded-lg border border-white/10 bg-black/10 p-3">
                                                <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">Target</div>
                                                <select
                                                  value={relation.targetId}
                                                  onFocus={() => {
                                                    setActiveSlotId(`relations.${relation.id}.targetId`);
                                                    setFocusedSectionId('relations');
                                                  }}
                                                  onChange={(event) => updateRelation(relation.id, (current) => ({ ...current, targetId: event.target.value }))}
                                                  className="h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white outline-none"
                                                >
                                                  <option value="" className="bg-slate-900">Select target</option>
                                                  {enabledSlots.map((slot) => (
                                                    <option key={slot.id} value={slot.id} className="bg-slate-900">{slot.label || slot.id}</option>
                                                  ))}
                                                </select>
                                              </label>

                                              {[
                                                ['relationType', 'Relation type', relation.relationType],
                                                ['distance', 'Distance', relation.distance],
                                                ['eyeContact', 'Eye contact', relation.eyeContact],
                                                ['bodyOrientation', 'Body orientation', relation.bodyOrientation],
                                                ['contactDetails', 'Contact details', relation.contactDetails],
                                                ['relativePlacement', 'Relative placement', relation.relativePlacement],
                                                ['dramaticFocus', 'Dramatic focus', relation.dramaticFocus],
                                              ].map(([fieldId, label, value]) => (
                                                <label key={fieldId} className="block rounded-lg border border-white/10 bg-black/10 p-3">
                                                  <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">{label}</div>
                                                  <Input
                                                    value={value}
                                                    onFocus={() => {
                                                      setActiveSlotId(`relations.${relation.id}.${fieldId}`);
                                                      setFocusedSectionId('relations');
                                                    }}
                                                    onChange={(event) => updateRelation(relation.id, (current) => ({ ...current, [fieldId]: event.target.value }))}
                                                    className="border-white/15 bg-white/5 text-white"
                                                  />
                                                </label>
                                              ))}

                                              <label className="block rounded-lg border border-white/10 bg-black/10 p-3 xl:col-span-2">
                                                <div className="mb-1 text-xs uppercase tracking-[0.16em] text-white/45">Notes</div>
                                                <Input
                                                  value={relation.notes}
                                                  onFocus={() => {
                                                    setActiveSlotId(`relations.${relation.id}.notes`);
                                                    setFocusedSectionId('relations');
                                                  }}
                                                  onChange={(event) => updateRelation(relation.id, (current) => ({ ...current, notes: event.target.value }))}
                                                  className="border-white/15 bg-white/5 text-white"
                                                />
                                              </label>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </>
                                )}
                              </div>
                            ) : (
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
                            )}
                          </div>
                        ) : (
                          <div className="border-t border-white/10 px-4 py-3 text-sm text-white/55">
                            {isSceneTemplateState(draft.state) && section.id === 'characters' ? (
                              <div className="space-y-1">
                                {draft.state.characterSlots.map((slot) => (
                                  <div key={slot.id} className="flex items-center justify-between gap-3 py-1">
                                    <span className="text-white/45">{slot.label || slot.id}</span>
                                    <span className="max-w-[55%] truncate text-right text-white/70">{[slot.role, slot.fields.nameOrRole, slot.fields.appearance].filter(Boolean).join(' · ') || 'Empty'}</span>
                                  </div>
                                ))}
                              </div>
                            ) : isSceneTemplateState(draft.state) && section.id === 'relations' ? (
                              <div className="space-y-1">
                                {draft.state.characterSlots.filter((slot) => slot.enabled).length <= 1 ? (
                                  <div className="py-1 text-white/55">Waiting for more than one enabled character.</div>
                                ) : draft.state.characterRelations.length === 0 ? (
                                  <div className="py-1 text-white/55">No relations yet.</div>
                                ) : (
                                  draft.state.characterRelations.map((relation) => (
                                    <div key={relation.id} className="flex items-center justify-between gap-3 py-1">
                                      <span className="text-white/45">{relation.relationType || 'Relation'}</span>
                                      <span className="max-w-[55%] truncate text-right text-white/70">{[relation.distance, relation.eyeContact, relation.relativePlacement].filter(Boolean).join(' · ') || 'Empty'}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            ) : (
                              section.slotIds.map((slotId) => {
                                const slot = template.slots.find((entry) => entry.id === slotId);
                                if (!slot) return null;
                                const value = getSlotValue(draft.state, slot.id).trim();
                                return (
                                  <div key={slot.id} className="flex items-center justify-between gap-3 py-1">
                                    <span className="text-white/45">{slot.label}</span>
                                    <span className="max-w-[55%] truncate text-right text-white/70">{value || 'Empty'}</span>
                                  </div>
                                );
                              })
                            )}
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
                <CardTitle className="text-lg">{helperTitle}</CardTitle>
                <div className="text-sm text-white/55">{helperDescription}</div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 pr-3">
                <div className="space-y-4">
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <div className="mb-2 text-xs uppercase tracking-[0.16em] text-cyan-200/70">Active Context</div>
                    <div className="text-sm font-medium text-cyan-100">{activeSlotLabel}</div>
                    <div className="mt-1 text-xs text-cyan-200/70">Section: {activeSectionId}</div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/10 p-3">
                    <div className="mb-3 text-xs uppercase tracking-[0.18em] text-white/45">Quick Presets</div>
                    {helperQuickPresets.length === 0 ? (
                      <div className="text-sm text-white/60">No quick presets for this slot yet.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {helperQuickPresets.map((chip) => (
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
                        No library blocks matched this scene context yet.
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
                  <DialogTitle>Scene Preview</DialogTitle>
                  <DialogDescription className="mt-1 text-white/60">
                    Final rendered scene prompt, warnings, and scene context in a dedicated inspection surface.
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
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">Rendered Scene Prompt</div>
                    <div className="mt-1 text-sm text-white/55">Scrollable output, ready to copy or inspect before generation.</div>
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
                    <div>Characters: {isSceneTemplateState(draft.state) ? draft.state.characterSlots.filter((slot) => slot.enabled).length : 1}</div>
                    <div>Relations: {isSceneTemplateState(draft.state) ? draft.state.characterRelations.length : 0}</div>
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
