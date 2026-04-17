export type ScenePresetStatus = 'active' | 'trash';
export type SceneAssemblyMode = 'template';

export interface SceneCharacterBindingSummary {
  id: string;
  slot: number;
  roleLabel: string | null;
  characterPresetId: string | null;
  characterName: string | null;
  overrideInstructions: string | null;
  brokenReference: boolean;
}

export interface ScenePresetSummary {
  id: string;
  workspaceId: string;
  name: string;
  summary: string;
  characterCount: 1 | 2 | 3;
  tags: string[];
  posePresetId: string | null;
  posePresetName: string | null;
  vibePresetId: string | null;
  vibePresetName: string | null;
  sceneInstructions: string;
  assemblyMode: SceneAssemblyMode;
  generatedScenePrompt: string;
  latestPreviewImageUrl: string | null;
  latestPreviewJobId: string | null;
  status: ScenePresetStatus;
  characterBindings: SceneCharacterBindingSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface SceneCharacterAssemblyInput {
  slot: number;
  roleLabel?: string | null;
  characterId: string | null;
  characterName?: string | null;
  resolvedCharacterPrompt: string;
  overrideInstructions?: string | null;
}

export interface SceneAssemblyInput {
  sceneName: string;
  sceneSummary: string;
  characterCount: 1 | 2 | 3;
  sceneInstructions: string;
  pose: {
    id: string;
    name: string;
    posePrompt: string;
    summary: string;
    characterCount: 1 | 2 | 3;
  } | null;
  vibe: {
    id: string;
    name: string;
    baseDescription: string;
    tags: string[];
  } | null;
  characters: SceneCharacterAssemblyInput[];
}

export interface SceneAssemblyResult {
  prompt: string;
  mode: SceneAssemblyMode;
  warnings: string[];
}
