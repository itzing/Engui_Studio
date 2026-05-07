export type CharacterTraitMap = Record<string, string>;

export type CharacterEditorState = {
  groupLocks?: Record<string, boolean>;
  uiTraitLocks?: Record<string, boolean>;
  lockedVolatilityLevels?: string[];
  expandedGroups?: string[];
  selectedPreviewTab?: string | null;
  selectedViewMode?: string | null;
  [key: string]: unknown;
};

export const CHARACTER_PREVIEW_SLOTS = ['portrait', 'upper_body', 'full_body'] as const;

export type CharacterPreviewSlot = (typeof CHARACTER_PREVIEW_SLOTS)[number];
export type CharacterPreviewStatus = 'idle' | 'queued' | 'running' | 'ready' | 'failed';

export type CharacterPreviewSlotState = {
  slot: CharacterPreviewSlot;
  status: CharacterPreviewStatus;
  jobId: string | null;
  imageUrl: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  promptSnapshot: string | null;
  updatedAt: string | null;
};

export type CharacterPreviewState = Record<CharacterPreviewSlot, CharacterPreviewSlotState>;

export type CharacterSummary = {
  id: string;
  name: string;
  gender: string | null;
  traits: CharacterTraitMap;
  editorState: CharacterEditorState;
  previewState?: CharacterPreviewState;
  primaryPreviewImageUrl?: string | null;
  primaryPreviewThumbnailUrl?: string | null;
  currentVersionId: string | null;
  previewStatusSummary: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  versionCount?: number;
};

export type CharacterVersionSummary = {
  id: string;
  characterId: string;
  traitsSnapshot: CharacterTraitMap;
  editorStateSnapshot: CharacterEditorState;
  versionNumber: number;
  changeSummary: string;
  createdAt: string;
};

export type CharacterExtractResult = {
  name: string;
  gender: string;
  summary: string;
  traits: CharacterTraitMap;
  confidence: 'low' | 'medium' | 'high';
  warnings: string[];
};
