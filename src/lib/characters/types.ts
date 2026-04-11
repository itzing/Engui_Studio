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

export type CharacterSummary = {
  id: string;
  name: string;
  gender: string | null;
  traits: CharacterTraitMap;
  editorState: CharacterEditorState;
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
