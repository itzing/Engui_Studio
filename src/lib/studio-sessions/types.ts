export type StudioSessionTemplateStatus = 'active' | 'archived';
export type StudioPortfolioStatus = 'active' | 'archived';
export type StudioPhotoSessionStatus = 'draft' | 'active' | 'review' | 'completed' | 'archived';
export type StudioCollectionStatus = 'draft' | 'final' | 'archived';
export type StudioSessionRunPresetStatus = 'active' | 'archived';
export type StudioSessionRunStatus = 'draft' | 'ready' | 'in_progress' | 'needs_review' | 'completed';
export type StudioSessionShotStatus = 'unassigned' | 'assigned' | 'queued' | 'running' | 'needs_review' | 'completed';
export type StudioSessionSquareSideSource = 'short' | 'long';
export type StudioSessionShotRevisionSourceKind = 'auto_pick' | 'manual_pick' | 'reshuffle';
export type StudioSessionAssetOriginKind = 'job_output' | 'reshoot' | 'variant';
export type StudioSessionVersionStatus = 'completed' | 'failed' | 'canceled';
export type StudioSessionVersionReviewState = 'unreviewed' | 'pick' | 'maybe' | 'reject' | 'hero' | 'needs_retry';
export type StudioSessionPoseOrientation = 'portrait' | 'landscape' | 'square';
export type StudioSessionPoseFraming = 'closeup' | 'portrait' | 'half_body' | 'three_quarter' | 'full_body';
export type StudioPoseCameraAngle = 'front' | 'three_quarter' | 'side' | 'back' | 'high' | 'low';
export type StudioPoseShotDistance = 'close' | 'medium' | 'wide';

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

export interface StudioPoseSetSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  poseIds: string[];
  tags: string[];
}

export interface StudioPosePreviewCandidateSummary {
  id: string;
  poseId: string;
  sourceJobId: string | null;
  assetUrl: string;
  thumbnailUrl: string | null;
  promptSnapshot: Record<string, unknown>;
  settingsSnapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StudioPoseLibrarySettingsSummary {
  id: string;
  workspaceId: string;
  subjectDescription: string;
  clothingDescription: string;
  backgroundDescription: string;
  stylePreset: string;
  previewAgeDescription: string;
  defaultVariantCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudioPoseCategorySummary {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  sortOrder: number;
  coverPoseId: string | null;
  coverImageUrl: string | null;
  poseCount: number;
  missingPreviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudioPoseOpenPoseSummary {
  hasOpenPoseImage: boolean;
  hasKeypoints: boolean;
  imageUrl: string | null;
  sourceImageUrl: string | null;
  sourceJobId: string | null;
  extractedAt: string | null;
}

export interface StudioPoseSummary {
  id: string;
  workspaceId: string;
  categoryId: string;
  categoryName: string;
  title: string;
  tags: string[];
  posePrompt: string;
  orientation: StudioSessionPoseOrientation;
  framing: StudioSessionPoseFraming;
  cameraAngle: StudioPoseCameraAngle;
  shotDistance: StudioPoseShotDistance;
  sortOrder: number;
  primaryPreviewId: string | null;
  primaryPreviewUrl: string | null;
  openPose: StudioPoseOpenPoseSummary;
  previewCandidates?: StudioPosePreviewCandidateSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface StudioFramingTransform {
  orientation: StudioSessionPoseOrientation;
  aspectRatio: number;
  centerX: number;
  centerY: number;
  poseHeight: number;
  rotationDeg: number;
  flipX: boolean;
  helperPrompt: string;
}

export interface StudioFramingPresetSummary extends StudioFramingTransform {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  tags: string[];
  previewImageUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudioRunFramingPolicy {
  fallbackPresetId: string | null;
  presetByOrientation: Partial<Record<StudioSessionPoseOrientation, string | null>>;
}

export interface StudioResolvedFramingSnapshot extends StudioFramingTransform {
  presetId: string | null;
  title: string;
}

export interface StudioRunSettingsDraft {
  name: string;
  poseSetId: string | null;
  count: number;
  positivePromptOverride: string;
  negativePromptOverride: string;
  generationSettings: StudioSessionGenerationSettingsSnapshot;
  resolutionPolicy: StudioSessionResolutionPolicy;
}

export interface StudioPortfolioSummary {
  id: string;
  workspaceId: string;
  characterId: string;
  characterName: string;
  characterGender: string | null;
  characterAge: string | null;
  characterPreviewUrl: string | null;
  coverCollectionItemId: string | null;
  coverImageUrl: string | null;
  name: string;
  description: string;
  status: StudioPortfolioStatus;
  sessionCount: number;
  collectionCount: number;
  selectedImageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudioPhotoSessionSummary {
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
  status: StudioPhotoSessionStatus;
  runCount: number;
  pickCount: number;
  maybeCount: number;
  rejectCount: number;
  heroVersionUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudioCollectionSummary {
  id: string;
  workspaceId: string;
  portfolioId: string;
  name: string;
  description: string;
  status: StudioCollectionStatus;
  itemCount: number;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudioCollectionItemSummary {
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
  originalUrl: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
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
  primaryPreviewUrl?: string | null;
  orientation: StudioSessionPoseOrientation;
  framing: StudioSessionPoseFraming;
  cameraAngle?: StudioPoseCameraAngle;
  shotDistance?: StudioPoseShotDistance;
  openPose?: StudioPoseOpenPoseSummary;
}

export interface StudioSessionPromptSnapshot {
  positivePrompt: string;
  negativePrompt: string;
  pieces: {
    character: string;
    characterAge: string;
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
  characterPrompt?: string;
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
  latestJobId?: string | null;
  latestJobStatus?: string | null;
  latestJobExecutionMs?: number | null;
  latestJobCreatedAt?: string | null;
  latestJobCompletedAt?: string | null;
  materializationStatus?: 'pending' | 'processing' | 'materialized' | 'failed' | null;
  materializationError?: string | null;
  materializationUpdatedAt?: string | null;
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
  reviewState: StudioSessionVersionReviewState;
  reviewNote: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudioSessionRunSummary {
  id: string;
  workspaceId: string;
  templateId: string | null;
  portfolioId: string | null;
  photoSessionId: string | null;
  poseSetId: string | null;
  name: string;
  runSettings: Record<string, unknown>;
  promptOverride: Record<string, unknown>;
  resolutionPolicy: Record<string, unknown>;
  count: number;
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
  totalExecutionMs?: number;
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
