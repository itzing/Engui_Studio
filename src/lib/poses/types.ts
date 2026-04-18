export type PosePresetStatus = 'active' | 'trash';

export type PosePresetSource = 'manual' | 'extracted';

export interface PoseCharacter {
  index: number;
  label?: string | null;
  orientation: string;
  head: string;
  gaze: string;
  torso: string;
  armsHands: string;
  legsStance: string;
  expression?: string | null;
}

export interface PoseRelationship {
  spatialLayout: string;
  interaction: string;
  contact: string;
  symmetry: string;
}

export interface PosePresetSummary {
  id: string;
  workspaceId: string;
  name: string;
  characterCount: 1 | 2 | 3;
  summary: string;
  posePrompt: string;
  tags: string[];
  source: PosePresetSource;
  sourceImageUrl: string | null;
  modelHint: string | null;
  characters: PoseCharacter[];
  relationship: PoseRelationship | null;
  status: PosePresetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PoseExtractResult {
  characterCount: 1 | 2 | 3;
  summary: string;
  posePrompt: string;
  tags: string[];
  warnings?: string[];
  characters?: PoseCharacter[];
  relationship?: PoseRelationship | null;
  confidence: 'low' | 'medium' | 'high';
}
