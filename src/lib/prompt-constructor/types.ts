export type PromptDocumentStatus = 'active' | 'trash';

export type PromptBlockCategory =
  | 'appearance'
  | 'outfit'
  | 'expression'
  | 'pose'
  | 'action'
  | 'location'
  | 'time-of-day'
  | 'lighting'
  | 'background'
  | 'style'
  | 'detail-level'
  | 'palette'
  | 'mood';

export type SlotType = 'text' | 'enum' | 'library-text' | 'dynamic-list';

export type PromptTemplateId = 'single_character_scene_v1' | 'scene_template_v2';

export type ConstraintSnippet = {
  id: string;
  label: string;
  content: string;
  applicableTemplateIds: PromptTemplateId[];
  tags: string[];
};

export type ValidationIssue = {
  id: string;
  level: 'warning';
  message: string;
  slotId?: string;
};

export type SectionDefinition = {
  id: string;
  label: string;
  slotIds: string[];
};

export type SlotDefinition = {
  id: string;
  label: string;
  sectionId: string;
  type: SlotType;
  required?: boolean;
  placeholder?: string;
  enumOptions?: Array<{ label: string; value: string }>;
  libraryCategories?: PromptBlockCategory[];
};

export type TemplateDefinition<TState> = {
  id: PromptTemplateId;
  version: number;
  title: string;
  sections: SectionDefinition[];
  slots: SlotDefinition[];
  createInitialState: () => TState;
  render: (state: TState, constraints: ConstraintSnippet[]) => string;
  validate: (state: TState, constraints: ConstraintSnippet[]) => ValidationIssue[];
};

export type SingleCharacterPromptState = {
  character: {
    appearance: string;
    outfit: string;
    expression: string;
    pose: string;
  };
  action: {
    mainAction: string;
  };
  composition: {
    shotType: string;
    cameraAngle: string;
    framing: string;
  };
  environment: {
    location: string;
    timeOfDay: string;
    lighting: string;
    background: string;
  };
  style: {
    style: string;
    detailLevel: string;
    palette: string;
    mood: string;
  };
};

export type SceneSummary = {
  sceneType: string;
  mainEvent: string;
  notes: string;
  tags: string[];
};

export type CharacterFields = {
  nameOrRole: string;
  ageBand: string;
  genderPresentation: string;
  appearance: string;
  outfit: string;
  expression: string;
  pose: string;
  localAction: string;
  props: string[];
};

export type CharacterStaging = {
  screenPosition: string;
  depthLayer: string;
  bodyOrientation: string;
  stance: string;
  relativePlacementNotes: string;
};

export type CharacterSlot = {
  id: string;
  label: string;
  role: string;
  enabled: boolean;
  presetRef: { id: string; name: string } | null;
  posePresetRef: { id: string; name: string } | null;
  fields: CharacterFields;
  staging: CharacterStaging;
};

export type CharacterRelation = {
  id: string;
  subjectId: string;
  targetId: string;
  relationType: string;
  distance: string;
  eyeContact: string;
  bodyOrientation: string;
  contactDetails: string;
  relativePlacement: string;
  dramaticFocus: string;
  notes: string;
};

export type CompositionBlock = {
  shotSize: string;
  cameraAngle: string;
  framing: string;
  subjectPlacement: string;
  foregroundPriority: string;
  backgroundPriority: string;
};

export type EnvironmentBlock = {
  location: string;
  timeOfDay: string;
  lighting: string;
  weather: string;
  background: string;
  environmentDetails: string;
};

export type StyleBlock = {
  medium: string;
  visualStyle: string;
  detailLevel: string;
  colorPalette: string;
  mood: string;
  renderingStyle: string;
};

export type ConstraintBlock = {
  mustKeep: string[];
  mustAvoid: string[];
  consistencyRequirements: string[];
  layoutConstraints: string[];
  textConstraints: string[];
};

export type SceneTemplateState = {
  schemaVersion: 1;
  sceneSummary: SceneSummary;
  characterSlots: CharacterSlot[];
  characterRelations: CharacterRelation[];
  composition: CompositionBlock;
  environment: EnvironmentBlock;
  style: StyleBlock;
  constraints: ConstraintBlock;
};

export type PromptState = SingleCharacterPromptState | SceneTemplateState;

export type SceneSnapshot = {
  schemaVersion: 1;
  templateId: 'scene_template_v2';
  sourceDocumentId: string | null;
  sourceDocumentTitle: string | null;
  capturedAt: string;
  state: SceneTemplateState;
  renderedPrompt: string;
  warnings: ValidationIssue[];
};

export type PromptDocument<TState = PromptState> = {
  id: string;
  workspaceId: string;
  title: string;
  templateId: PromptTemplateId;
  templateVersion: number;
  state: TState;
  enabledConstraintIds: string[];
  status: PromptDocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type PromptDocumentSummary = {
  id: string;
  workspaceId: string;
  title: string;
  templateId: PromptTemplateId;
  templateVersion: number;
  status: PromptDocumentStatus;
  createdAt: string;
  updatedAt: string;
  renderedPrompt?: string;
  sceneType?: string;
  tags?: string[];
  characterCount?: number;
  relationCount?: number;
};
