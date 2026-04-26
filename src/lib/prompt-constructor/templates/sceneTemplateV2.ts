import { promptConstructorConstraints } from '@/lib/prompt-constructor/constraints';
import { cleanPromptFragment, joinPromptFragments, normalizeRenderedPrompt, renderLabeledSentence } from '@/lib/prompt-constructor/normalization';
import type {
  CharacterRelation,
  CharacterSlot,
  ConstraintSnippet,
  SceneSnapshot,
  SceneTemplateState,
  TemplateDefinition,
  ValidationIssue,
} from '@/lib/prompt-constructor/types';

function createCharacterSlot(index: number): CharacterSlot {
  const label = `Character ${String.fromCharCode(65 + index)}`;

  return {
    id: `char_${index + 1}`,
    label,
    role: '',
    enabled: true,
    presetRef: null,
    posePresetRef: null,
    fields: {
      nameOrRole: '',
      ageBand: '',
      genderPresentation: '',
      appearance: '',
      useRandomCharacterAppearance: false,
      randomCharacterId: '',
      randomCharacterName: '',
      randomCharacterAppearance: '',
      outfit: '',
      expression: '',
      pose: '',
      localAction: '',
      props: [],
    },
    staging: {
      screenPosition: '',
      depthLayer: '',
      bodyOrientation: '',
      stance: '',
      relativePlacementNotes: '',
    },
  };
}

export function createInitialSceneTemplateState(): SceneTemplateState {
  return {
    schemaVersion: 1,
    sceneSummary: {
      sceneType: '',
      mainEvent: '',
      notes: '',
      tags: [],
    },
    characterSlots: [createCharacterSlot(0)],
    characterRelations: [],
    composition: {
      shotSize: '',
      cameraAngle: '',
      framing: '',
      subjectPlacement: '',
      foregroundPriority: '',
      backgroundPriority: '',
    },
    environment: {
      location: '',
      timeOfDay: '',
      lighting: '',
      weather: '',
      background: '',
      environmentDetails: '',
    },
    style: {
      medium: '',
      visualStyle: '',
      detailLevel: '',
      colorPalette: '',
      mood: '',
      renderingStyle: '',
    },
    constraints: {
      mustKeep: [],
      mustAvoid: [],
      consistencyRequirements: [],
      layoutConstraints: [],
      textConstraints: [],
    },
  };
}

function formatCharacterAge(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\d+/);
  if (!match) return trimmed;
  return `${match[0]}yo`;
}

function resolveRenderedGender(value: string, ageValue: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  const ageMatch = ageValue.trim().match(/\d+/);
  const age = ageMatch ? Number.parseInt(ageMatch[0], 10) : null;
  if (age !== null && Number.isFinite(age) && age < 18) {
    if (normalized === 'male') return 'boy';
    if (normalized === 'female') return 'girl';
  }
  return normalized;
}

function renderCharacterSlot(slot: CharacterSlot, index: number): string {
  const formattedAge = formatCharacterAge(slot.fields.ageBand);
  const formattedGender = resolveRenderedGender(slot.fields.genderPresentation, slot.fields.ageBand);
  const effectiveName = slot.fields.useRandomCharacterAppearance
    ? slot.fields.randomCharacterName.trim()
    : slot.fields.nameOrRole.trim();
  const effectiveAppearance = slot.fields.useRandomCharacterAppearance
    ? slot.fields.randomCharacterAppearance.trim()
    : slot.fields.appearance.trim();
  const formattedName = effectiveName;
  const formattedRole = slot.role.trim() ? `Role: ${slot.role.trim()}` : '';
  const formattedExpression = slot.fields.expression.trim() ? `Face expression: ${slot.fields.expression.trim()}` : '';
  const formattedPose = slot.fields.pose.trim() ? `Pose: ${slot.fields.pose.trim()}` : '';

  const parts = [
    formattedName,
    formattedRole,
    formattedAge,
    formattedGender,
    formattedExpression,
    cleanPromptFragment(effectiveAppearance),
    cleanPromptFragment(slot.fields.outfit),
    formattedPose,
    cleanPromptFragment(slot.fields.localAction),
    joinPromptFragments(slot.fields.props),
    cleanPromptFragment(slot.staging.screenPosition),
    cleanPromptFragment(slot.staging.depthLayer),
    cleanPromptFragment(slot.staging.bodyOrientation),
    cleanPromptFragment(slot.staging.stance),
    cleanPromptFragment(slot.staging.relativePlacementNotes),
  ].filter(Boolean);

  if (parts.length === 0) return '';
  return `Character ${index + 1}: ${parts[0]}\n${parts.slice(1).join('\n')}.`;
}

function renderRelation(relation: CharacterRelation, slotIndex: Map<string, string>): string {
  const subjectLabel = slotIndex.get(relation.subjectId) || relation.subjectId;
  const targetLabel = slotIndex.get(relation.targetId) || relation.targetId;

  return joinPromptFragments([
    `${subjectLabel} ${relation.relationType || 'relates to'} ${targetLabel}`,
    relation.distance,
    relation.eyeContact,
    relation.bodyOrientation,
    relation.contactDetails,
    relation.relativePlacement,
    relation.dramaticFocus,
    relation.notes,
  ]);
}

function buildConstraintParts(state: SceneTemplateState, constraints: ConstraintSnippet[]): string[] {
  return [
    ...state.constraints.mustKeep,
    ...state.constraints.mustAvoid,
    ...state.constraints.consistencyRequirements,
    ...state.constraints.layoutConstraints,
    ...state.constraints.textConstraints,
    ...constraints.map((constraint) => constraint.content),
  ]
    .map((item) => cleanPromptFragment(item))
    .filter(Boolean);
}

export function renderSceneTemplateV2(state: SceneTemplateState, constraints: ConstraintSnippet[]): string {
  const enabledSlots = state.characterSlots.filter((slot) => slot.enabled);
  const slotIndex = new Map(enabledSlots.map((slot, index) => [slot.id, slot.label.trim() || `Character ${index + 1}`]));

  const lines = [
    renderLabeledSentence('Scene', [state.sceneSummary.sceneType, state.sceneSummary.mainEvent, state.sceneSummary.notes]),
    ...enabledSlots.map((slot, index) => renderCharacterSlot(slot, index)),
    renderLabeledSentence(
      'Interaction',
      state.characterRelations
        .filter((relation) => slotIndex.has(relation.subjectId) && slotIndex.has(relation.targetId))
        .map((relation) => renderRelation(relation, slotIndex)),
    ),
    renderLabeledSentence('Composition', [
      state.composition.shotSize,
      state.composition.cameraAngle,
      state.composition.framing,
      state.composition.subjectPlacement,
      state.composition.foregroundPriority,
      state.composition.backgroundPriority,
    ]),
    renderLabeledSentence('Environment', [
      state.environment.location,
      state.environment.timeOfDay,
      state.environment.lighting,
      state.environment.weather,
      state.environment.background,
      state.environment.environmentDetails,
    ]),
    renderLabeledSentence('Style', [
      state.style.medium,
      state.style.visualStyle,
      state.style.detailLevel,
      state.style.colorPalette,
      state.style.mood,
      state.style.renderingStyle,
    ]),
    renderLabeledSentence('Constraints', buildConstraintParts(state, constraints)),
  ].filter(Boolean);

  return normalizeRenderedPrompt(lines.join('\n'));
}

export function validateSceneTemplateV2(state: SceneTemplateState, constraints: ConstraintSnippet[]): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];
  const enabledSlots = state.characterSlots.filter((slot) => slot.enabled);
  const enabledIds = new Set(enabledSlots.map((slot) => slot.id));

  if (enabledSlots.length === 0) {
    warnings.push({
      id: 'missing-enabled-character-slots',
      level: 'warning',
      message: 'Scene has no enabled character slots.',
    });
  }

  enabledSlots.forEach((slot) => {
    const slotIdentity = [
      slot.role,
      slot.fields.useRandomCharacterAppearance ? slot.fields.randomCharacterName : slot.fields.nameOrRole,
      slot.fields.useRandomCharacterAppearance ? slot.fields.randomCharacterAppearance : slot.fields.appearance,
    ].some((value) => value.trim().length > 0);
    if (!slotIdentity) {
      warnings.push({
        id: `thin-character-slot-${slot.id}`,
        level: 'warning',
        slotId: slot.id,
        message: `${slot.label || slot.id} has almost no identifying data.`,
      });
    }
  });

  state.characterRelations.forEach((relation) => {
    if (!enabledIds.has(relation.subjectId) || !enabledIds.has(relation.targetId)) {
      warnings.push({
        id: `broken-relation-${relation.id}`,
        level: 'warning',
        slotId: relation.subjectId,
        message: 'A character relation points to a missing or disabled slot.',
      });
    }
  });

  if (enabledSlots.length > 1 && state.characterRelations.length === 0) {
    warnings.push({
      id: 'missing-relations',
      level: 'warning',
      message: 'Multi-character scenes should define at least one relation between characters.',
    });
  }

  if (enabledSlots.length > 1 && !state.composition.subjectPlacement.trim()) {
    warnings.push({
      id: 'missing-subject-placement',
      level: 'warning',
      message: 'Multi-character scene is missing subject placement guidance.',
    });
  }

  const rendered = renderSceneTemplateV2(state, constraints);
  if (rendered.length < 140) {
    warnings.push({
      id: 'prompt-too-thin',
      level: 'warning',
      message: 'Rendered scene prompt is still structurally thin.',
    });
  }

  if (buildConstraintParts(state, constraints).length === 0) {
    warnings.push({
      id: 'missing-constraints',
      level: 'warning',
      message: 'Scene has no explicit constraints yet.',
    });
  }

  return warnings;
}

export function serializeSceneSnapshot(input: {
  sourceDocumentId?: string | null;
  sourceDocumentTitle?: string | null;
  state: SceneTemplateState;
  enabledConstraintIds?: string[];
}): SceneSnapshot {
  const applicableConstraints = promptConstructorConstraints.filter(
    (constraint) => constraint.applicableTemplateIds.includes('scene_template_v2')
      && (input.enabledConstraintIds ?? []).includes(constraint.id),
  );
  const warnings = validateSceneTemplateV2(input.state, applicableConstraints);

  return {
    schemaVersion: 1,
    templateId: 'scene_template_v2',
    sourceDocumentId: input.sourceDocumentId ?? null,
    sourceDocumentTitle: input.sourceDocumentTitle ?? null,
    capturedAt: new Date().toISOString(),
    state: JSON.parse(JSON.stringify(input.state)) as SceneTemplateState,
    renderedPrompt: renderSceneTemplateV2(input.state, applicableConstraints),
    warnings,
  };
}

export const sceneTemplateV2: TemplateDefinition<SceneTemplateState> = {
  id: 'scene_template_v2',
  version: 1,
  title: 'Scene Template',
  sections: [
    { id: 'sceneSummary', label: 'Scene Summary', slotIds: ['sceneType', 'mainEvent', 'sceneNotes', 'sceneTags'] },
    { id: 'characters', label: 'Characters', slotIds: ['characterSlots'] },
    { id: 'relations', label: 'Relations', slotIds: ['characterRelations'] },
    { id: 'composition', label: 'Composition', slotIds: ['shotSize', 'cameraAngle', 'framing', 'subjectPlacement', 'foregroundPriority', 'backgroundPriority'] },
    { id: 'environment', label: 'Environment', slotIds: ['location', 'timeOfDay', 'lighting', 'weather', 'background', 'environmentDetails'] },
    { id: 'style', label: 'Style', slotIds: ['medium', 'visualStyle', 'detailLevel', 'colorPalette', 'mood', 'renderingStyle'] },
    { id: 'constraints', label: 'Constraints', slotIds: ['mustKeep', 'mustAvoid', 'consistencyRequirements', 'layoutConstraints', 'textConstraints'] },
  ],
  slots: [
    { id: 'sceneType', label: 'Scene type', sectionId: 'sceneSummary', type: 'text' },
    { id: 'mainEvent', label: 'Main event', sectionId: 'sceneSummary', type: 'text', required: true },
    { id: 'sceneNotes', label: 'Notes', sectionId: 'sceneSummary', type: 'text' },
    { id: 'sceneTags', label: 'Tags', sectionId: 'sceneSummary', type: 'text' },
    { id: 'characterSlots', label: 'Character slots', sectionId: 'characters', type: 'dynamic-list' },
    { id: 'characterRelations', label: 'Character relations', sectionId: 'relations', type: 'dynamic-list' },
    { id: 'shotSize', label: 'Shot size', sectionId: 'composition', type: 'text' },
    { id: 'cameraAngle', label: 'Camera angle', sectionId: 'composition', type: 'text' },
    { id: 'framing', label: 'Framing', sectionId: 'composition', type: 'text' },
    { id: 'subjectPlacement', label: 'Subject placement', sectionId: 'composition', type: 'text' },
    { id: 'foregroundPriority', label: 'Foreground priority', sectionId: 'composition', type: 'text' },
    { id: 'backgroundPriority', label: 'Background priority', sectionId: 'composition', type: 'text' },
    { id: 'location', label: 'Location', sectionId: 'environment', type: 'text' },
    { id: 'timeOfDay', label: 'Time of day', sectionId: 'environment', type: 'text' },
    { id: 'lighting', label: 'Lighting', sectionId: 'environment', type: 'text' },
    { id: 'weather', label: 'Weather', sectionId: 'environment', type: 'text' },
    { id: 'background', label: 'Background', sectionId: 'environment', type: 'text' },
    { id: 'environmentDetails', label: 'Environment details', sectionId: 'environment', type: 'text' },
    { id: 'medium', label: 'Medium', sectionId: 'style', type: 'text' },
    { id: 'visualStyle', label: 'Visual style', sectionId: 'style', type: 'text' },
    { id: 'detailLevel', label: 'Detail level', sectionId: 'style', type: 'text' },
    { id: 'colorPalette', label: 'Color palette', sectionId: 'style', type: 'text' },
    { id: 'mood', label: 'Mood', sectionId: 'style', type: 'text' },
    { id: 'renderingStyle', label: 'Rendering style', sectionId: 'style', type: 'text' },
    { id: 'mustKeep', label: 'Must keep', sectionId: 'constraints', type: 'dynamic-list' },
    { id: 'mustAvoid', label: 'Must avoid', sectionId: 'constraints', type: 'dynamic-list' },
    { id: 'consistencyRequirements', label: 'Consistency requirements', sectionId: 'constraints', type: 'dynamic-list' },
    { id: 'layoutConstraints', label: 'Layout constraints', sectionId: 'constraints', type: 'dynamic-list' },
    { id: 'textConstraints', label: 'Text constraints', sectionId: 'constraints', type: 'dynamic-list' },
  ],
  createInitialState: createInitialSceneTemplateState,
  render: renderSceneTemplateV2,
  validate: validateSceneTemplateV2,
};

export function getDefaultSceneTemplateConstraintIds(): string[] {
  return promptConstructorConstraints
    .filter((constraint) => constraint.applicableTemplateIds.includes('scene_template_v2'))
    .map((constraint) => constraint.id);
}
