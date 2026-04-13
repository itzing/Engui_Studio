export type VibePresetStatus = 'active' | 'trash';

export type VibeSortMode = 'updated_desc' | 'created_desc' | 'name_asc' | 'name_desc';

export interface VibePresetSummary {
  id: string;
  name: string;
  baseDescription: string;
  tags: string[];
  compatibleSceneTypes: string[];
  status: VibePresetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VibeExtractResult {
  name: string;
  baseDescription: string;
  tags: string[];
  compatibleSceneTypes: string[];
  confidence: 'low' | 'medium' | 'high';
}
