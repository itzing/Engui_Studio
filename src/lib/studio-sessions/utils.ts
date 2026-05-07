import { joinPromptFragments } from '@/lib/prompt-constructor/normalization';
import { createInitialSceneTemplateState, renderSceneTemplateV2 } from '@/lib/prompt-constructor/templates/sceneTemplateV2';
import type {
  StudioSessionAutoPickResult,
  StudioSessionPoseFraming,
  StudioSessionPoseOrientation,
  StudioSessionPoseSnapshot,
  StudioSessionPromptSnapshot,
  StudioSessionResolvedSize,
  StudioCollectionItemSummary,
  StudioCollectionStatus,
  StudioCollectionSummary,
  StudioPhotoSessionStatus,
  StudioPhotoSessionSummary,
  StudioPortfolioStatus,
  StudioPortfolioSummary,
  StudioSessionRunStatus,
  StudioSessionShotRevisionSummary,
  StudioSessionShotStatus,
  StudioSessionShotSummary,
  StudioSessionTemplateCategoryRule,
  StudioSessionTemplateDraftState,
  StudioSessionTemplateSavedState,
  StudioSessionTemplateStatus,
  StudioSessionTemplateSummary,
  StudioSessionVersionReviewState,
  StudioSessionVersionStatus,
  StudioSessionShotVersionSummary,
  StudioSessionRunSummary,
} from './types';
import { getStudioSessionPoseCategories, getStudioSessionPosesByCategory, getStudioSessionPoseLibrary } from './poseLibrary';

type PersistedTemplateRuleRecord = {
  category: string;
  count: number;
  includedPoseIdsJson: string | null;
  excludedPoseIdsJson: string | null;
  preferredOrientation: string | null;
  preferredFraming: string | null;
  fixedPoseIdsJson: string | null;
  weightingJson: string | null;
  futureOverrideConfigJson: string | null;
};

type PersistedTemplateRecord = {
  id: string;
  workspaceId: string;
  name: string;
  characterId: string | null;
  generationSettingsJson: string;
  shortSidePx: number;
  longSidePx: number;
  squareSideSource: string;
  canonicalStateJson: string;
  draftStateJson: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  categoryRules?: PersistedTemplateRuleRecord[];
};

type PersistedRunRecord = {
  id: string;
  workspaceId: string;
  templateId: string | null;
  portfolioId?: string | null;
  photoSessionId?: string | null;
  poseSetId?: string | null;
  name?: string | null;
  runSettingsJson?: string | null;
  promptOverrideJson?: string | null;
  resolutionPolicyJson?: string | null;
  count?: number | null;
  templateNameSnapshot: string;
  templateSnapshotJson: string;
  poseLibraryVersion: string;
  poseLibraryHash: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type PersistedShotRecord = {
  id: string;
  runId: string;
  workspaceId: string;
  category: string;
  slotIndex: number;
  label: string;
  status: string;
  skipped: boolean;
  selectionVersionId: string | null;
  currentRevisionId: string | null;
  autoAssignmentHistoryJson: string;
  createdAt: Date;
  updatedAt: Date;
};

type PersistedShotRevisionRecord = {
  id: string;
  workspaceId: string;
  shotId: string;
  revisionNumber: number;
  poseId: string;
  poseSnapshotJson: string;
  derivedOrientation: string;
  derivedFraming: string;
  assembledPromptSnapshotJson: string;
  overrideFieldsJson: string | null;
  sourceKind: string;
  createdAt: Date;
  updatedAt: Date;
};

type PersistedShotVersionRecord = {
  id: string;
  workspaceId: string;
  shotId: string;
  revisionId: string;
  sourceJobId: string | null;
  versionNumber: number;
  status: string;
  originKind: string;
  contentHash: string | null;
  originalUrl: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  generationSnapshotJson: string | null;
  hidden: boolean;
  rejected: boolean;
  reviewState?: string | null;
  reviewNote?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PersistedPortfolioRecord = {
  id: string;
  workspaceId: string;
  characterId: string;
  coverCollectionItemId?: string | null;
  name: string;
  description: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  character?: { name?: string | null; gender?: string | null; traits?: string | null; previewStateJson?: string | null } | null;
  coverCollectionItem?: { version?: { originalUrl?: string | null; previewUrl?: string | null; thumbnailUrl?: string | null } | null } | null;
  _count?: { sessions?: number; collections?: number };
  selectedImageCount?: number;
};

type PersistedPhotoSessionRecord = {
  id: string;
  workspaceId: string;
  portfolioId: string;
  name: string;
  settingText: string;
  lightingText: string;
  vibeText: string;
  outfitText: string;
  hairstyleText: string;
  negativePrompt: string;
  notes: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { runs?: number };
  reviewCounts?: Partial<Record<StudioSessionVersionReviewState, number>>;
  heroVersionUrl?: string | null;
};

type PersistedCollectionRecord = {
  id: string;
  workspaceId: string;
  portfolioId: string;
  name: string;
  description: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { items?: number };
  coverUrl?: string | null;
};

type PersistedCollectionItemRecord = {
  id: string;
  workspaceId: string;
  collectionId: string;
  portfolioId: string;
  photoSessionId: string | null;
  runId: string | null;
  shotId: string | null;
  versionId: string;
  sortOrder: number;
  caption: string;
  createdAt: Date;
  updatedAt: Date;
  version?: {
    originalUrl?: string | null;
    previewUrl?: string | null;
    thumbnailUrl?: string | null;
  } | null;
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('Failed to parse Studio Session JSON:', error);
    return fallback;
  }
}

function toStringArray(input: unknown): string[] {
  return Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function extractPreviewSlotUrl(slot: unknown): string | null {
  const value = slot && typeof slot === 'object' ? slot as Record<string, unknown> : {};
  for (const key of ['thumbnailUrl', 'previewUrl', 'imageUrl']) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

function extractCharacterPreviewUrl(previewStateJson: string | null | undefined): string | null {
  const previewState = parseJson<Record<string, unknown>>(previewStateJson, {});
  return extractPreviewSlotUrl(previewState.full_body)
    ?? extractPreviewSlotUrl(previewState.portrait)
    ?? extractPreviewSlotUrl(previewState.upper_body);
}

export function normalizeStudioSessionTemplateStatus(input: unknown): StudioSessionTemplateStatus {
  return input === 'archived' ? 'archived' : 'active';
}

export function normalizeStudioPortfolioStatus(input: unknown): StudioPortfolioStatus {
  return input === 'archived' ? 'archived' : 'active';
}

export function normalizeStudioPhotoSessionStatus(input: unknown): StudioPhotoSessionStatus {
  switch (input) {
    case 'active':
    case 'review':
    case 'completed':
    case 'archived':
      return input;
    default:
      return 'draft';
  }
}

export function normalizeStudioCollectionStatus(input: unknown): StudioCollectionStatus {
  switch (input) {
    case 'final':
    case 'archived':
      return input;
    default:
      return 'draft';
  }
}

export function normalizeStudioSessionVersionReviewState(input: unknown): StudioSessionVersionReviewState {
  switch (input) {
    case 'pick':
    case 'maybe':
    case 'reject':
    case 'hero':
    case 'needs_retry':
      return input;
    default:
      return 'unreviewed';
  }
}

export function normalizeStudioSessionRunStatus(input: unknown): StudioSessionRunStatus {
  switch (input) {
    case 'ready':
    case 'in_progress':
    case 'needs_review':
    case 'completed':
      return input;
    default:
      return 'draft';
  }
}

export function normalizeStudioSessionShotStatus(input: unknown): StudioSessionShotStatus {
  switch (input) {
    case 'assigned':
    case 'queued':
    case 'running':
    case 'needs_review':
    case 'completed':
      return input;
    default:
      return 'unassigned';
  }
}

export function normalizeStudioSessionVersionStatus(input: unknown): StudioSessionVersionStatus {
  switch (input) {
    case 'failed':
    case 'canceled':
      return input;
    default:
      return 'completed';
  }
}

export function normalizeStudioSessionOrientation(input: unknown): StudioSessionPoseOrientation {
  if (input === 'landscape' || input === 'square') return input;
  return 'portrait';
}

export function normalizeStudioSessionFraming(input: unknown): StudioSessionPoseFraming {
  if (input === 'closeup' || input === 'portrait' || input === 'half_body' || input === 'three_quarter' || input === 'full_body') {
    return input;
  }
  return 'portrait';
}

export function normalizeStudioSessionCategoryRule(input: unknown): StudioSessionTemplateCategoryRule {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return {
    category: typeof value.category === 'string' && value.category.trim() ? value.category.trim().toLowerCase() : 'uncategorized',
    count: Math.max(0, Math.min(20, typeof value.count === 'number' ? Math.floor(value.count) : 0)),
    includedPoseIds: toStringArray(value.includedPoseIds),
    excludedPoseIds: toStringArray(value.excludedPoseIds),
    preferredOrientation: typeof value.preferredOrientation === 'string' ? normalizeStudioSessionOrientation(value.preferredOrientation) : null,
    preferredFraming: typeof value.preferredFraming === 'string' ? normalizeStudioSessionFraming(value.preferredFraming) : null,
    fixedPoseIds: toStringArray(value.fixedPoseIds),
    weighting: value.weighting && typeof value.weighting === 'object' ? value.weighting as Record<string, number> : null,
    futureOverrideConfig: value.futureOverrideConfig && typeof value.futureOverrideConfig === 'object' ? value.futureOverrideConfig as Record<string, unknown> : null,
  };
}

export function serializeStudioSessionCategoryRule(input: StudioSessionTemplateCategoryRule): PersistedTemplateRuleRecord {
  return {
    category: input.category,
    count: input.count,
    includedPoseIdsJson: JSON.stringify(input.includedPoseIds),
    excludedPoseIdsJson: JSON.stringify(input.excludedPoseIds),
    preferredOrientation: input.preferredOrientation,
    preferredFraming: input.preferredFraming,
    fixedPoseIdsJson: JSON.stringify(input.fixedPoseIds),
    weightingJson: input.weighting ? JSON.stringify(input.weighting) : null,
    futureOverrideConfigJson: input.futureOverrideConfig ? JSON.stringify(input.futureOverrideConfig) : null,
  };
}

export function createDefaultStudioSessionTemplateDraftState(): StudioSessionTemplateDraftState {
  return {
    name: '',
    characterId: null,
    characterAge: '',
    environmentText: '',
    outfitText: '',
    hairstyleText: '',
    positivePrompt: '',
    negativePrompt: '',
    generationSettings: {
      modelId: 'z-image',
      steps: 9,
      cfg: 1,
      seed: -1,
    },
    resolutionPolicy: {
      shortSidePx: 1024,
      longSidePx: 1536,
      squareSideSource: 'short',
    },
    categoryRules: getStudioSessionPoseCategories().map((category) => normalizeStudioSessionCategoryRule({ category, count: 5 })),
  };
}

export function createStudioSessionSavedStateFromDraft(input: unknown): StudioSessionTemplateSavedState {
  const draft = normalizeStudioSessionTemplateDraftState(input);
  const library = getStudioSessionPoseLibrary();
  return {
    ...draft,
    poseLibraryVersion: library.version,
    poseLibraryHash: library.hash,
  };
}

export function normalizeStudioSessionTemplateDraftState(input: unknown): StudioSessionTemplateDraftState {
  const fallback = createDefaultStudioSessionTemplateDraftState();
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const categoryRuleMap = new Map(getStudioSessionPoseCategories().map((category) => [category, normalizeStudioSessionCategoryRule({ category, count: 5 })]));
  const providedRules = Array.isArray(value.categoryRules) ? value.categoryRules.map(normalizeStudioSessionCategoryRule) : [];
  for (const rule of providedRules) categoryRuleMap.set(rule.category, rule);

  return {
    name: typeof value.name === 'string' ? value.name.trim() : fallback.name,
    characterId: typeof value.characterId === 'string' && value.characterId.trim() ? value.characterId.trim() : null,
    characterAge: typeof value.characterAge === 'string' ? value.characterAge.trim() : fallback.characterAge,
    environmentText: typeof value.environmentText === 'string' ? value.environmentText.trim() : fallback.environmentText,
    outfitText: typeof value.outfitText === 'string' ? value.outfitText.trim() : fallback.outfitText,
    hairstyleText: typeof value.hairstyleText === 'string' ? value.hairstyleText.trim() : fallback.hairstyleText,
    positivePrompt: typeof value.positivePrompt === 'string' ? value.positivePrompt.trim() : fallback.positivePrompt,
    negativePrompt: typeof value.negativePrompt === 'string' ? value.negativePrompt.trim() : fallback.negativePrompt,
    generationSettings: value.generationSettings && typeof value.generationSettings === 'object'
      ? {
          ...fallback.generationSettings,
          ...(value.generationSettings as Record<string, unknown>),
          modelId: typeof (value.generationSettings as Record<string, unknown>).modelId === 'string' && ((value.generationSettings as Record<string, unknown>).modelId as string).trim()
            ? ((value.generationSettings as Record<string, unknown>).modelId as string).trim()
            : fallback.generationSettings.modelId,
          steps: typeof (value.generationSettings as Record<string, unknown>).steps === 'number'
            ? Math.max(1, Math.floor((value.generationSettings as Record<string, unknown>).steps as number))
            : fallback.generationSettings.steps,
          cfg: typeof (value.generationSettings as Record<string, unknown>).cfg === 'number'
            ? (value.generationSettings as Record<string, unknown>).cfg as number
            : fallback.generationSettings.cfg,
          seed: typeof (value.generationSettings as Record<string, unknown>).seed === 'number'
            ? Math.floor((value.generationSettings as Record<string, unknown>).seed as number)
            : fallback.generationSettings.seed,
          sampler: null,
          cfgScale: null,
        }
      : fallback.generationSettings,
    resolutionPolicy: {
      shortSidePx: typeof value.resolutionPolicy === 'object' && value.resolutionPolicy && typeof (value.resolutionPolicy as Record<string, unknown>).shortSidePx === 'number'
        ? Math.max(64, Math.floor((value.resolutionPolicy as Record<string, unknown>).shortSidePx as number))
        : fallback.resolutionPolicy.shortSidePx,
      longSidePx: typeof value.resolutionPolicy === 'object' && value.resolutionPolicy && typeof (value.resolutionPolicy as Record<string, unknown>).longSidePx === 'number'
        ? Math.max(64, Math.floor((value.resolutionPolicy as Record<string, unknown>).longSidePx as number))
        : fallback.resolutionPolicy.longSidePx,
      squareSideSource: typeof value.resolutionPolicy === 'object' && value.resolutionPolicy && (value.resolutionPolicy as Record<string, unknown>).squareSideSource === 'long' ? 'long' : 'short',
    },
    categoryRules: Array.from(categoryRuleMap.values()),
  };
}

export function toStudioSessionTemplateSummary(record: PersistedTemplateRecord): StudioSessionTemplateSummary {
  const canonicalState = createStudioSessionSavedStateFromDraft(parseJson(record.canonicalStateJson, parseJson(record.draftStateJson, {})));
  const draftState = normalizeStudioSessionTemplateDraftState(parseJson(record.draftStateJson, canonicalState));
  const ruleSource = (record.categoryRules || []).map((rule) => normalizeStudioSessionCategoryRule({
    category: rule.category,
    count: rule.count,
    includedPoseIds: parseJson(rule.includedPoseIdsJson, []),
    excludedPoseIds: parseJson(rule.excludedPoseIdsJson, []),
    preferredOrientation: rule.preferredOrientation,
    preferredFraming: rule.preferredFraming,
    fixedPoseIds: parseJson(rule.fixedPoseIdsJson, []),
    weighting: parseJson(rule.weightingJson, null),
    futureOverrideConfig: parseJson(rule.futureOverrideConfigJson, null),
  }));

  return {
    id: record.id,
    workspaceId: record.workspaceId,
    name: record.name,
    characterId: record.characterId,
    status: normalizeStudioSessionTemplateStatus(record.status),
    resolutionPolicy: canonicalState.resolutionPolicy,
    generationSettings: canonicalState.generationSettings,
    categoryRules: ruleSource.length > 0 ? ruleSource : canonicalState.categoryRules,
    canonicalState,
    draftState,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toStudioPortfolioSummary(record: PersistedPortfolioRecord): StudioPortfolioSummary {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    characterId: record.characterId,
    characterName: record.character?.name ?? 'Untitled character',
    characterGender: record.character?.gender ?? null,
    characterAge: parseJson<Record<string, unknown>>(record.character?.traits, {}).age?.toString() ?? null,
    characterPreviewUrl: extractCharacterPreviewUrl(record.character?.previewStateJson),
    coverCollectionItemId: record.coverCollectionItemId ?? null,
    coverImageUrl: record.coverCollectionItem?.version?.previewUrl ?? record.coverCollectionItem?.version?.thumbnailUrl ?? record.coverCollectionItem?.version?.originalUrl ?? null,
    name: record.name,
    description: record.description,
    status: normalizeStudioPortfolioStatus(record.status),
    sessionCount: record._count?.sessions ?? 0,
    collectionCount: record._count?.collections ?? 0,
    selectedImageCount: record.selectedImageCount ?? 0,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toStudioPhotoSessionSummary(record: PersistedPhotoSessionRecord): StudioPhotoSessionSummary {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    portfolioId: record.portfolioId,
    name: record.name,
    settingText: record.settingText,
    lightingText: record.lightingText,
    vibeText: record.vibeText,
    outfitText: record.outfitText,
    hairstyleText: record.hairstyleText,
    negativePrompt: record.negativePrompt,
    notes: record.notes,
    status: normalizeStudioPhotoSessionStatus(record.status),
    runCount: record._count?.runs ?? 0,
    pickCount: record.reviewCounts?.pick ?? 0,
    maybeCount: record.reviewCounts?.maybe ?? 0,
    rejectCount: record.reviewCounts?.reject ?? 0,
    heroVersionUrl: record.heroVersionUrl ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toStudioCollectionSummary(record: PersistedCollectionRecord): StudioCollectionSummary {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    portfolioId: record.portfolioId,
    name: record.name,
    description: record.description,
    status: normalizeStudioCollectionStatus(record.status),
    itemCount: record._count?.items ?? 0,
    coverUrl: record.coverUrl ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toStudioCollectionItemSummary(record: PersistedCollectionItemRecord): StudioCollectionItemSummary {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    collectionId: record.collectionId,
    portfolioId: record.portfolioId,
    photoSessionId: record.photoSessionId,
    runId: record.runId,
    shotId: record.shotId,
    versionId: record.versionId,
    sortOrder: record.sortOrder,
    caption: record.caption,
    originalUrl: record.version?.originalUrl ?? null,
    previewUrl: record.version?.previewUrl ?? null,
    thumbnailUrl: record.version?.thumbnailUrl ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toStudioSessionRunSummary(record: PersistedRunRecord): StudioSessionRunSummary {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    templateId: record.templateId,
    portfolioId: record.portfolioId ?? null,
    photoSessionId: record.photoSessionId ?? null,
    poseSetId: record.poseSetId ?? null,
    name: record.name ?? '',
    runSettings: parseJson(record.runSettingsJson, {}),
    promptOverride: parseJson(record.promptOverrideJson, {}),
    resolutionPolicy: parseJson(record.resolutionPolicyJson, {}),
    count: record.count ?? 0,
    templateNameSnapshot: record.templateNameSnapshot,
    templateSnapshot: parseJson(record.templateSnapshotJson, {}) as StudioSessionRunSummary['templateSnapshot'],
    poseLibraryVersion: record.poseLibraryVersion,
    poseLibraryHash: record.poseLibraryHash,
    status: normalizeStudioSessionRunStatus(record.status),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toStudioSessionShotSummary(record: PersistedShotRecord): StudioSessionShotSummary {
  return {
    id: record.id,
    runId: record.runId,
    workspaceId: record.workspaceId,
    category: record.category,
    slotIndex: record.slotIndex,
    label: record.label,
    status: normalizeStudioSessionShotStatus(record.status),
    skipped: record.skipped,
    selectionVersionId: record.selectionVersionId,
    currentRevisionId: record.currentRevisionId,
    autoAssignmentHistory: parseJson(record.autoAssignmentHistoryJson, []),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toStudioSessionShotRevisionSummary(record: PersistedShotRevisionRecord): StudioSessionShotRevisionSummary {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    shotId: record.shotId,
    revisionNumber: record.revisionNumber,
    poseId: record.poseId,
    poseSnapshot: parseJson<StudioSessionPoseSnapshot | null>(record.poseSnapshotJson, null) ?? {
      id: record.poseId,
      category: 'uncategorized',
      name: record.poseId,
      prompt: '',
      orientation: normalizeStudioSessionOrientation(record.derivedOrientation),
      framing: normalizeStudioSessionFraming(record.derivedFraming),
    },
    derivedOrientation: normalizeStudioSessionOrientation(record.derivedOrientation),
    derivedFraming: normalizeStudioSessionFraming(record.derivedFraming),
    assembledPromptSnapshot: parseJson<StudioSessionPromptSnapshot | null>(record.assembledPromptSnapshotJson, null) ?? {
      positivePrompt: '',
      negativePrompt: '',
      pieces: {
        character: '',
        characterAge: '',
        environment: '',
        outfit: '',
        hairstyle: '',
        masterPositive: '',
        pose: '',
      },
    },
    overrideFields: parseJson(record.overrideFieldsJson, null),
    sourceKind: record.sourceKind === 'manual_pick' || record.sourceKind === 'reshuffle' ? record.sourceKind : 'auto_pick',
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toStudioSessionShotVersionSummary(record: PersistedShotVersionRecord): StudioSessionShotVersionSummary {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    shotId: record.shotId,
    revisionId: record.revisionId,
    sourceJobId: record.sourceJobId,
    versionNumber: record.versionNumber,
    status: normalizeStudioSessionVersionStatus(record.status),
    originKind: record.originKind === 'variant' || record.originKind === 'reshoot' ? record.originKind : 'job_output',
    contentHash: record.contentHash,
    originalUrl: record.originalUrl,
    previewUrl: record.previewUrl,
    thumbnailUrl: record.thumbnailUrl,
    generationSnapshot: parseJson(record.generationSnapshotJson, null),
    hidden: record.hidden,
    rejected: record.rejected,
    reviewState: normalizeStudioSessionVersionReviewState(record.reviewState),
    reviewNote: record.reviewNote ?? '',
    reviewedAt: record.reviewedAt ? record.reviewedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function deriveStudioSessionResolution(policy: { shortSidePx: number; longSidePx: number; squareSideSource: 'short' | 'long' }, orientation: StudioSessionPoseOrientation): StudioSessionResolvedSize {
  if (orientation === 'landscape') {
    return { width: policy.longSidePx, height: policy.shortSidePx, orientation };
  }
  if (orientation === 'square') {
    const side = policy.squareSideSource === 'long' ? policy.longSidePx : policy.shortSidePx;
    return { width: side, height: side, orientation };
  }
  return { width: policy.shortSidePx, height: policy.longSidePx, orientation };
}

function formatStudioSessionCharacterAge(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\d+/);
  if (!match) return trimmed;
  return `${match[0]}yo`;
}

function buildStudioSessionPromptState(input: {
  characterPrompt: string;
  characterAge: string;
  environmentText: string;
  outfitText: string;
  hairstyleText: string;
  positivePrompt: string;
  pose: Pick<StudioSessionPoseSnapshot, 'prompt'>;
}) {
  const state = createInitialSceneTemplateState();
  const slot = state.characterSlots[0];
  const formattedAge = formatStudioSessionCharacterAge(input.characterAge);
  const trimmedHairstyle = input.hairstyleText.trim();

  slot.fields.nameOrRole = '';
  slot.fields.ageBand = formattedAge;
  slot.fields.appearance = joinPromptFragments([
    input.characterPrompt.trim(),
    trimmedHairstyle ? `Hair: ${trimmedHairstyle}` : '',
  ]);
  slot.fields.outfit = input.outfitText.trim();
  slot.fields.pose = input.pose.prompt.trim();

  state.sceneSummary.sceneType = 'studio photo session';
  state.environment.background = input.environmentText.trim();
  state.style.visualStyle = input.positivePrompt.trim();

  return state;
}

export function assembleStudioSessionPrompt(input: {
  characterPrompt: string;
  characterAge: string;
  environmentText: string;
  outfitText: string;
  hairstyleText: string;
  positivePrompt: string;
  negativePrompt: string;
  pose: Pick<StudioSessionPoseSnapshot, 'prompt'>;
}): StudioSessionPromptSnapshot {
  const pieces = {
    character: input.characterPrompt.trim(),
    characterAge: formatStudioSessionCharacterAge(input.characterAge),
    environment: input.environmentText.trim(),
    outfit: input.outfitText.trim(),
    hairstyle: input.hairstyleText.trim(),
    masterPositive: input.positivePrompt.trim(),
    pose: input.pose.prompt.trim(),
  };

  return {
    positivePrompt: renderSceneTemplateV2(buildStudioSessionPromptState(input), []),
    negativePrompt: input.negativePrompt.trim(),
    pieces,
  };
}

export function deriveStudioSessionRunStatus(input: { shots: Array<Pick<StudioSessionShotSummary, 'skipped' | 'status' | 'selectionVersionId'>> }): StudioSessionRunStatus {
  const relevantShots = input.shots.filter((shot) => !shot.skipped);
  if (relevantShots.length === 0) return 'completed';
  const withSelection = relevantShots.filter((shot) => !!shot.selectionVersionId).length;
  const hasActive = relevantShots.some((shot) => shot.status === 'queued' || shot.status === 'running');
  const hasReviewable = relevantShots.some((shot) => shot.status === 'needs_review' || shot.status === 'completed' || !!shot.selectionVersionId);
  const hasAssigned = relevantShots.some((shot) => shot.status !== 'unassigned');

  if (withSelection === relevantShots.length) return 'completed';
  if (hasReviewable) return 'needs_review';
  if (hasActive) return 'in_progress';
  if (hasAssigned) return 'ready';
  return 'draft';
}

function humanizeCategoryLabel(category: string): string {
  return category
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildStudioSessionShotLabel(category: string, slotIndex: number): string {
  return `${humanizeCategoryLabel(category)} ${slotIndex + 1}`;
}

export function pickUniqueStudioSessionPose(params: {
  category: string;
  autoAssignmentHistory: string[];
  excludedPoseIds?: string[];
  includedPoseIds?: string[];
  preferredOrientation?: StudioSessionPoseOrientation | null;
  preferredFraming?: StudioSessionPoseFraming | null;
}): StudioSessionAutoPickResult {
  const available = getStudioSessionPosesByCategory(params.category)
    .filter((pose) => !params.excludedPoseIds?.includes(pose.id))
    .filter((pose) => !params.autoAssignmentHistory.includes(pose.id))
    .filter((pose) => !params.includedPoseIds || params.includedPoseIds.length === 0 || params.includedPoseIds.includes(pose.id));

  const prioritized = available.sort((left, right) => {
    const leftScore = (params.preferredOrientation && left.orientation === params.preferredOrientation ? 2 : 0)
      + (params.preferredFraming && left.framing === params.preferredFraming ? 1 : 0);
    const rightScore = (params.preferredOrientation && right.orientation === params.preferredOrientation ? 2 : 0)
      + (params.preferredFraming && right.framing === params.preferredFraming ? 1 : 0);
    return rightScore - leftScore || left.id.localeCompare(right.id);
  });

  if (prioritized.length === 0) {
    return {
      pose: null,
      exhausted: true,
      exhaustedCategories: [params.category],
    };
  }

  return {
    pose: prioritized[0],
    exhausted: false,
    exhaustedCategories: [],
  };
}

export function buildStudioSessionShotSlotsFromRules(rules: StudioSessionTemplateCategoryRule[]): Array<{ category: string; slotIndex: number; label: string }> {
  return rules
    .filter((rule) => rule.count > 0)
    .sort((left, right) => left.category.localeCompare(right.category))
    .flatMap((rule) => Array.from({ length: rule.count }, (_, slotIndex) => ({
      category: rule.category,
      slotIndex,
      label: buildStudioSessionShotLabel(rule.category, slotIndex),
    })));
}
