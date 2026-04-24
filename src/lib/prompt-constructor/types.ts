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

export type SlotType = 'text' | 'enum' | 'library-text';

export type ConstraintSnippet = {
  id: string;
  label: string;
  content: string;
  applicableTemplateIds: string[];
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
  id: string;
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

export type PromptDocument<TState = SingleCharacterPromptState> = {
  id: string;
  workspaceId: string;
  title: string;
  templateId: string;
  templateVersion: number;
  state: TState;
  enabledConstraintIds: string[];
  status: PromptDocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type PromptDocumentSummary = PromptDocument;
