export type StudioSessionTemplateStatus = 'active' | 'archived';
export type StudioSessionRunStatus = 'draft' | 'ready' | 'in_progress' | 'needs_review' | 'completed';
export type StudioSessionShotStatus = 'unassigned' | 'assigned' | 'queued' | 'running' | 'needs_review' | 'completed';
export type StudioSessionSquareSideSource = 'short' | 'long';
export type StudioSessionShotRevisionSourceKind = 'auto_pick' | 'manual_pick' | 'reshuffle';
export type StudioSessionAssetOriginKind = 'job_output' | 'reshoot' | 'variant';
export type StudioSessionVersionStatus = 'completed' | 'failed' | 'canceled';
export type StudioSessionPoseOrientation = 'portrait' | 'landscape' | 'square';
export type StudioSessionPoseFraming = 'closeup' | 'portrait' | 'half_body' | 'three_quarter' | 'full_body';

export interface StudioSessionTemplateCategoryRule {
  category: string;
  count: number;
  includedPoseIds: string[];
  excludedPoseIds: string[];
  preferredOrientation: StudioSessionPoseOrientation | null;
  preferredFraming: StudioSessionPoseFraming | null;
  fixedPoseIds: string[];
  weighting: Record<string, number> | null;
  futureOverrideConfig: Record<string, unknown> | null;
}

export interface StudioSessionResolutionPolicy {
  shortSidePx: number;
  longSidePx: number;
  squareSideSource: StudioSessionSquareSideSource;
}

export interface StudioSessionGenerationSettingsSnapshot {
  modelId?: string | null;
  sampler?: string | null;
  steps?: number | null;
  cfgScale?: number | null;
  cfg?: number | null;
  seed?: number | null;
  width?: number | null;
  height?: number | null;
  [key: string]: unknown;
}

export interface StudioSessionTemplateDraftState {
  name: string;
  characterId: string | null;
  characterAge: string;
  environmentText: string;
  outfitText: string;
  hairstyleText: string;
  positivePrompt: string;
  negativePrompt: string;
  generationSettings: StudioSessionGenerationSettingsSnapshot;
  resolutionPolicy: StudioSessionResolutionPolicy;
  categoryRules: StudioSessionTemplateCategoryRule[];
}

export interface StudioSessionTemplateSavedState extends StudioSessionTemplateDraftState {
  poseLibraryVersion: string;
  poseLibraryHash: string;
}

export interface StudioSessionTemplateSummary {
  id: string;
  workspaceId: string;
  name: string;
  characterId: string | null;
  status: StudioSessionTemplateStatus;
  resolutionPolicy: StudioSessionResolutionPolicy;
  generationSettings: StudioSessionGenerationSettingsSnapshot;
  categoryRules: StudioSessionTemplateCategoryRule[];
  canonicalState: StudioSessionTemplateSavedState;
  draftState: StudioSessionTemplateDraftState;
  createdAt: string;
  updatedAt: string;
}

export interface StudioSessionPoseSnapshot {
  id: string;
  category: string;
  name: string;
  prompt: string;
  orientation: StudioSessionPoseOrientation;
  framing: StudioSessionPoseFraming;
}

export interface StudioSessionPromptSnapshot {
  positivePrompt: string;
  negativePrompt: string;
  pieces: {
    character: string;
    environment: string;
    outfit: string;
    hairstyle: string;
    masterPositive: string;
    pose: string;
  };
}

export interface StudioSessionRunSnapshot extends StudioSessionTemplateSavedState {
  templateId: string | null;
  templateName: string;
}

export interface StudioSessionShotSummary {
  id: string;
  runId: string;
  workspaceId: string;
  category: string;
  slotIndex: number;
  label: string;
  status: StudioSessionShotStatus;
  skipped: boolean;
  selectionVersionId: string | null;
  currentRevisionId: string | null;
  autoAssignmentHistory: string[];
  activeJobId?: string | null;
  activeJobStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudioSessionShotRevisionSummary {
  id: string;
  workspaceId: string;
  shotId: string;
  revisionNumber: number;
  poseId: string;
  poseSnapshot: StudioSessionPoseSnapshot;
  derivedOrientation: StudioSessionPoseOrientation;
  derivedFraming: StudioSessionPoseFraming;
  assembledPromptSnapshot: StudioSessionPromptSnapshot;
  overrideFields: Record<string, unknown> | null;
  sourceKind: StudioSessionShotRevisionSourceKind;
  createdAt: string;
  updatedAt: string;
}

export interface StudioSessionShotVersionSummary {
  id: string;
  workspaceId: string;
  shotId: string;
  revisionId: string;
  sourceJobId: string | null;
  versionNumber: number;
  status: StudioSessionVersionStatus;
  originKind: StudioSessionAssetOriginKind;
  contentHash: string | null;
  originalUrl: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  generationSnapshot: Record<string, unknown> | null;
  hidden: boolean;
  rejected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudioSessionRunSummary {
  id: string;
  workspaceId: string;
  templateId: string | null;
  templateNameSnapshot: string;
  templateSnapshot: StudioSessionRunSnapshot;
  poseLibraryVersion: string;
  poseLibraryHash: string;
  status: StudioSessionRunStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudioSessionRunDetailSummary extends StudioSessionRunSummary {
  exhaustedCategories?: string[];
  activeJobCount?: number;
}

export interface StudioSessionRunAssembleResult {
  assignedShotIds: string[];
  exhaustedCategories: string[];
  skippedShotIds: string[];
}

export interface StudioSessionResolvedSize {
  width: number;
  height: number;
  orientation: StudioSessionPoseOrientation;
}

export interface StudioSessionAutoPickResult {
  pose: StudioSessionPoseSnapshot | null;
  exhausted: boolean;
  exhaustedCategories: string[];
}
