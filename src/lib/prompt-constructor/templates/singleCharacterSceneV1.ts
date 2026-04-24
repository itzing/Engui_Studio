import { promptConstructorConstraints } from '@/lib/prompt-constructor/constraints';
import { normalizeRenderedPrompt, renderLabeledSentence } from '@/lib/prompt-constructor/normalization';
import type { ConstraintSnippet, SingleCharacterPromptState, TemplateDefinition, ValidationIssue } from '@/lib/prompt-constructor/types';

function createInitialState(): SingleCharacterPromptState {
  return {
    character: {
      appearance: '',
      outfit: '',
      expression: '',
      pose: '',
    },
    action: {
      mainAction: '',
    },
    composition: {
      shotType: '',
      cameraAngle: '',
      framing: '',
    },
    environment: {
      location: '',
      timeOfDay: '',
      lighting: '',
      background: '',
    },
    style: {
      style: '',
      detailLevel: '',
      palette: '',
      mood: '',
    },
  };
}

function validate(state: SingleCharacterPromptState, constraints: ConstraintSnippet[]): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];

  if (!state.character.appearance.trim()) {
    warnings.push({
      id: 'missing-appearance',
      level: 'warning',
      slotId: 'appearance',
      message: 'Appearance is empty, so the prompt may be too vague.',
    });
  }

  const characterParts = [
    state.character.appearance,
    state.character.outfit,
    state.character.expression,
    state.character.pose,
  ].filter((value) => value.trim().length > 0);

  if (characterParts.length === 0) {
    warnings.push({
      id: 'missing-character-block',
      level: 'warning',
      message: 'All character fields are empty.',
    });
  }

  if (constraints.length === 0) {
    warnings.push({
      id: 'missing-constraints',
      level: 'warning',
      message: 'No constraints are enabled.',
    });
  }

  const rendered = render(state, constraints);
  if (rendered.length < 80) {
    warnings.push({
      id: 'prompt-too-short',
      level: 'warning',
      message: 'Rendered prompt is very short and may not be useful.',
    });
  }

  if (/\{[^}]+\}/.test(rendered)) {
    warnings.push({
      id: 'unresolved-placeholders',
      level: 'warning',
      message: 'Rendered prompt still contains unresolved placeholder-like text.',
    });
  }

  return warnings;
}

export function render(state: SingleCharacterPromptState, constraints: ConstraintSnippet[]): string {
  const lines = [
    'Character portrait or single-character scene.',
    renderLabeledSentence('Character', [
      state.character.appearance,
      state.character.outfit,
      state.character.expression,
      state.character.pose,
    ]),
    renderLabeledSentence('Action', [state.action.mainAction]),
    renderLabeledSentence('Composition', [
      state.composition.shotType,
      state.composition.cameraAngle,
      state.composition.framing,
    ]),
    renderLabeledSentence('Environment', [
      state.environment.location,
      state.environment.timeOfDay,
      state.environment.lighting,
      state.environment.background,
    ]),
    renderLabeledSentence('Style', [
      state.style.style,
      state.style.detailLevel,
      state.style.palette,
      state.style.mood,
    ]),
    renderLabeledSentence('Constraints', constraints.map((constraint) => constraint.content)),
  ].filter(Boolean);

  return normalizeRenderedPrompt(lines.join('\n'));
}

export const singleCharacterSceneV1: TemplateDefinition<SingleCharacterPromptState> = {
  id: 'single_character_scene_v1',
  version: 1,
  title: 'Single Character Scene',
  sections: [
    { id: 'character', label: 'Character', slotIds: ['appearance', 'outfit', 'expression', 'pose'] },
    { id: 'action', label: 'Action', slotIds: ['mainAction'] },
    { id: 'composition', label: 'Composition', slotIds: ['shotType', 'cameraAngle', 'framing'] },
    { id: 'environment', label: 'Environment', slotIds: ['location', 'timeOfDay', 'lighting', 'background'] },
    { id: 'style', label: 'Style', slotIds: ['style', 'detailLevel', 'palette', 'mood'] },
  ],
  slots: [
    { id: 'appearance', label: 'Appearance', sectionId: 'character', type: 'library-text', required: true, libraryCategories: ['appearance'] },
    { id: 'outfit', label: 'Outfit', sectionId: 'character', type: 'library-text', libraryCategories: ['outfit'] },
    { id: 'expression', label: 'Expression', sectionId: 'character', type: 'library-text', libraryCategories: ['expression'] },
    { id: 'pose', label: 'Pose', sectionId: 'character', type: 'library-text', libraryCategories: ['pose'] },
    { id: 'mainAction', label: 'Main action', sectionId: 'action', type: 'library-text', libraryCategories: ['action'] },
    { id: 'shotType', label: 'Shot type', sectionId: 'composition', type: 'text' },
    { id: 'cameraAngle', label: 'Camera angle', sectionId: 'composition', type: 'text' },
    { id: 'framing', label: 'Framing', sectionId: 'composition', type: 'text' },
    { id: 'location', label: 'Location', sectionId: 'environment', type: 'library-text', libraryCategories: ['location'] },
    { id: 'timeOfDay', label: 'Time of day', sectionId: 'environment', type: 'library-text', libraryCategories: ['time-of-day'] },
    { id: 'lighting', label: 'Lighting', sectionId: 'environment', type: 'library-text', libraryCategories: ['lighting'] },
    { id: 'background', label: 'Background', sectionId: 'environment', type: 'library-text', libraryCategories: ['background'] },
    { id: 'style', label: 'Style', sectionId: 'style', type: 'library-text', libraryCategories: ['style'] },
    { id: 'detailLevel', label: 'Detail level', sectionId: 'style', type: 'library-text', libraryCategories: ['detail-level'] },
    { id: 'palette', label: 'Palette', sectionId: 'style', type: 'library-text', libraryCategories: ['palette'] },
    { id: 'mood', label: 'Mood', sectionId: 'style', type: 'library-text', libraryCategories: ['mood'] },
  ],
  createInitialState,
  render,
  validate,
};

export function getDefaultSingleCharacterConstraintIds(): string[] {
  return promptConstructorConstraints
    .filter((constraint) => constraint.applicableTemplateIds.includes('single_character_scene_v1'))
    .map((constraint) => constraint.id);
}
