import { promptConstructorConstraints } from '@/lib/prompt-constructor/constraints';
import { getPromptTemplate } from '@/lib/prompt-constructor/templateRegistry';
import { createInitialSceneTemplateState, getDefaultSceneTemplateConstraintIds, serializeSceneSnapshot } from '@/lib/prompt-constructor/templates/sceneTemplateV2';
import { getDefaultSingleCharacterConstraintIds } from '@/lib/prompt-constructor/templates/singleCharacterSceneV1';
import type {
  CharacterRelation,
  CharacterSlot,
  ConstraintSnippet,
  PromptDocument,
  PromptDocumentStatus,
  PromptDocumentSummary,
  PromptState,
  PromptTemplateId,
  SceneSnapshot,
  SceneTemplateState,
  SingleCharacterPromptState,
} from '@/lib/prompt-constructor/types';

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.trim()).map((item) => item.trim())));
  }

  if (typeof value !== 'string' || !value) return [];

  try {
    const parsed = JSON.parse(value);
    return parseStringArray(parsed);
  } catch (error) {
    console.warn('Failed to parse prompt constructor string array:', error);
  }

  return [];
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseSingleCharacterState(value: string | null | undefined): SingleCharacterPromptState {
  const fallback: SingleCharacterPromptState = {
    character: { appearance: '', outfit: '', expression: '', pose: '' },
    action: { mainAction: '' },
    composition: { shotType: '', cameraAngle: '', framing: '' },
    environment: { location: '', timeOfDay: '', lighting: '', background: '' },
    style: { style: '', detailLevel: '', palette: '', mood: '' },
  };

  if (!value) return fallback;

  try {
    const data = asRecord(JSON.parse(value));

    return {
      character: {
        appearance: asString(data.character?.appearance),
        outfit: asString(data.character?.outfit),
        expression: asString(data.character?.expression),
        pose: asString(data.character?.pose),
      },
      action: {
        mainAction: asString(data.action?.mainAction),
      },
      composition: {
        shotType: asString(data.composition?.shotType),
        cameraAngle: asString(data.composition?.cameraAngle),
        framing: asString(data.composition?.framing),
      },
      environment: {
        location: asString(data.environment?.location),
        timeOfDay: asString(data.environment?.timeOfDay),
        lighting: asString(data.environment?.lighting),
        background: asString(data.environment?.background),
      },
      style: {
        style: asString(data.style?.style),
        detailLevel: asString(data.style?.detailLevel),
        palette: asString(data.style?.palette),
        mood: asString(data.style?.mood),
      },
    };
  } catch (error) {
    console.warn('Failed to parse prompt constructor state JSON:', error);
    return fallback;
  }
}

function parseCharacterSlot(value: unknown, index: number): CharacterSlot {
  const slot = asRecord(value);
  return {
    id: asString(slot.id) || `char_${index + 1}`,
    label: asString(slot.label) || `Character ${String.fromCharCode(65 + index)}`,
    role: asString(slot.role),
    enabled: slot.enabled !== false,
    presetRef: slot.presetRef && typeof slot.presetRef === 'object'
      ? {
        id: asString((slot.presetRef as Record<string, unknown>).id),
        name: asString((slot.presetRef as Record<string, unknown>).name),
      }
      : null,
    posePresetRef: slot.posePresetRef && typeof slot.posePresetRef === 'object'
      ? {
        id: asString((slot.posePresetRef as Record<string, unknown>).id),
        name: asString((slot.posePresetRef as Record<string, unknown>).name),
      }
      : null,
    fields: {
      nameOrRole: asString(slot.fields?.nameOrRole),
      ageBand: asString(slot.fields?.ageBand),
      genderPresentation: asString(slot.fields?.genderPresentation),
      appearance: asString(slot.fields?.appearance),
      useRandomCharacterAppearance: slot.fields?.useRandomCharacterAppearance === true,
      randomCharacterId: asString(slot.fields?.randomCharacterId),
      randomCharacterName: asString(slot.fields?.randomCharacterName),
      randomCharacterAppearance: asString(slot.fields?.randomCharacterAppearance),
      outfit: asString(slot.fields?.outfit),
      expression: asString(slot.fields?.expression),
      pose: asString(slot.fields?.pose),
      localAction: asString(slot.fields?.localAction),
      props: parseStringArray(slot.fields?.props),
    },
    staging: {
      screenPosition: asString(slot.staging?.screenPosition),
      depthLayer: asString(slot.staging?.depthLayer),
      bodyOrientation: asString(slot.staging?.bodyOrientation),
      stance: asString(slot.staging?.stance),
      relativePlacementNotes: asString(slot.staging?.relativePlacementNotes),
    },
  };
}

function parseCharacterRelation(value: unknown, index: number): CharacterRelation {
  const relation = asRecord(value);
  return {
    id: asString(relation.id) || `rel_${index + 1}`,
    subjectId: asString(relation.subjectId),
    targetId: asString(relation.targetId),
    relationType: asString(relation.relationType),
    distance: asString(relation.distance),
    eyeContact: asString(relation.eyeContact),
    bodyOrientation: asString(relation.bodyOrientation),
    contactDetails: asString(relation.contactDetails),
    relativePlacement: asString(relation.relativePlacement),
    dramaticFocus: asString(relation.dramaticFocus),
    notes: asString(relation.notes),
  };
}

function parseSceneTemplateState(value: string | null | undefined): SceneTemplateState {
  const fallback = createInitialSceneTemplateState();
  if (!value) return fallback;

  try {
    const data = asRecord(JSON.parse(value));
    const sceneSummary = asRecord(data.sceneSummary);
    const composition = asRecord(data.composition);
    const environment = asRecord(data.environment);
    const style = asRecord(data.style);
    const constraints = asRecord(data.constraints);

    return {
      schemaVersion: 1,
      sceneSummary: {
        sceneType: asString(sceneSummary.sceneType),
        mainEvent: asString(sceneSummary.mainEvent),
        notes: asString(sceneSummary.notes),
        tags: parseStringArray(sceneSummary.tags),
      },
      characterSlots: Array.isArray(data.characterSlots) && data.characterSlots.length > 0
        ? data.characterSlots.map((slot, index) => parseCharacterSlot(slot, index))
        : fallback.characterSlots,
      characterRelations: Array.isArray(data.characterRelations)
        ? data.characterRelations.map((relation, index) => parseCharacterRelation(relation, index))
        : [],
      composition: {
        shotSize: asString(composition.shotSize),
        cameraAngle: asString(composition.cameraAngle),
        framing: asString(composition.framing),
        subjectPlacement: asString(composition.subjectPlacement),
        foregroundPriority: asString(composition.foregroundPriority),
        backgroundPriority: asString(composition.backgroundPriority),
      },
      environment: {
        location: asString(environment.location),
        timeOfDay: asString(environment.timeOfDay),
        lighting: asString(environment.lighting),
        weather: asString(environment.weather),
        background: asString(environment.background),
        environmentDetails: asString(environment.environmentDetails),
      },
      style: {
        medium: asString(style.medium),
        visualStyle: asString(style.visualStyle),
        detailLevel: asString(style.detailLevel),
        colorPalette: asString(style.colorPalette),
        mood: asString(style.mood),
        renderingStyle: asString(style.renderingStyle),
      },
      constraints: {
        mustKeep: parseStringArray(constraints.mustKeep),
        mustAvoid: parseStringArray(constraints.mustAvoid),
        consistencyRequirements: parseStringArray(constraints.consistencyRequirements),
        layoutConstraints: parseStringArray(constraints.layoutConstraints),
        textConstraints: parseStringArray(constraints.textConstraints),
      },
    };
  } catch (error) {
    console.warn('Failed to parse scene template state JSON:', error);
    return fallback;
  }
}

export function normalizePromptDocumentStatus(input: unknown): PromptDocumentStatus {
  return input === 'trash' ? 'trash' : 'active';
}

export function normalizePromptDocumentTitle(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/\s+/g, ' ');
}

export function normalizePromptTemplateId(input: unknown): PromptTemplateId {
  return input === 'scene_template_v2' ? 'scene_template_v2' : 'single_character_scene_v1';
}

export function normalizePromptTemplateVersion(input: unknown): number {
  return input === 1 || input === '1' ? 1 : 1;
}

export function normalizePromptState(input: unknown, templateId: PromptTemplateId = 'single_character_scene_v1'): PromptState {
  if (typeof input === 'string') {
    return templateId === 'scene_template_v2' ? parseSceneTemplateState(input) : parseSingleCharacterState(input);
  }

  const serialized = JSON.stringify(input ?? {});
  return templateId === 'scene_template_v2' ? parseSceneTemplateState(serialized) : parseSingleCharacterState(serialized);
}

export function serializePromptState(input: unknown, templateId: PromptTemplateId = 'single_character_scene_v1'): string {
  return JSON.stringify(normalizePromptState(input, templateId));
}

export function normalizeConstraintIds(input: unknown, templateId: PromptTemplateId): string[] {
  const requested = parseStringArray(input);
  const allowed = new Set(
    promptConstructorConstraints
      .filter((constraint) => constraint.applicableTemplateIds.includes(templateId))
      .map((constraint) => constraint.id),
  );

  const normalized = Array.from(new Set(requested.filter((item): item is string => typeof item === 'string' && allowed.has(item))));
  if (normalized.length > 0) return normalized;
  if (templateId === 'single_character_scene_v1') return getDefaultSingleCharacterConstraintIds();
  if (templateId === 'scene_template_v2') return getDefaultSceneTemplateConstraintIds();
  return [];
}

export function serializeConstraintIds(input: unknown, templateId: PromptTemplateId): string {
  return JSON.stringify(normalizeConstraintIds(input, templateId));
}

export function resolveConstraintSnippets(constraintIds: string[], templateId: PromptTemplateId): ConstraintSnippet[] {
  const allowed = promptConstructorConstraints.filter((constraint) => constraint.applicableTemplateIds.includes(templateId));
  const index = new Map(allowed.map((constraint) => [constraint.id, constraint]));
  return constraintIds.map((id) => index.get(id)).filter((value): value is ConstraintSnippet => Boolean(value));
}

type PersistedPromptDocumentRecord = {
  id: string;
  workspaceId: string;
  title: string;
  templateId: string;
  templateVersion: number;
  stateJson: string;
  enabledConstraintIds: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export function toPromptDocument(record: PersistedPromptDocumentRecord): PromptDocument {
  const templateId = normalizePromptTemplateId(record.templateId);
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    title: record.title,
    templateId,
    templateVersion: normalizePromptTemplateVersion(record.templateVersion),
    state: normalizePromptState(record.stateJson, templateId),
    enabledConstraintIds: normalizeConstraintIds(record.enabledConstraintIds, templateId),
    status: normalizePromptDocumentStatus(record.status),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function buildRenderedPrompt(document: Pick<PromptDocument, 'templateId' | 'state' | 'enabledConstraintIds'>): string {
  const template = getPromptTemplate(document.templateId);
  if (!template) return '';
  const constraints = resolveConstraintSnippets(document.enabledConstraintIds, document.templateId);
  return template.render(document.state as never, constraints);
}

export function buildPromptValidation(document: Pick<PromptDocument, 'templateId' | 'state' | 'enabledConstraintIds' | 'title'>) {
  const template = getPromptTemplate(document.templateId);
  if (!template) {
    return [{ id: 'unknown-template', level: 'warning' as const, message: 'Unknown prompt template.' }];
  }

  const warnings = [...template.validate(document.state as never, resolveConstraintSnippets(document.enabledConstraintIds, document.templateId))];
  if (!document.title.trim()) {
    warnings.unshift({ id: 'missing-title', level: 'warning', message: 'Document title is empty.' });
  }
  return warnings;
}

export function convertSingleCharacterToSceneState(state: SingleCharacterPromptState): SceneTemplateState {
  const next = createInitialSceneTemplateState();
  const primaryCharacter = next.characterSlots[0];

  primaryCharacter.fields.appearance = state.character.appearance;
  primaryCharacter.fields.outfit = state.character.outfit;
  primaryCharacter.fields.expression = state.character.expression;
  primaryCharacter.fields.pose = state.character.pose;
  primaryCharacter.fields.localAction = state.action.mainAction;

  next.sceneSummary.sceneType = 'single character scene';
  next.sceneSummary.mainEvent = state.action.mainAction || 'single character portrait moment';
  next.composition.shotSize = state.composition.shotType;
  next.composition.cameraAngle = state.composition.cameraAngle;
  next.composition.framing = state.composition.framing;
  next.environment.location = state.environment.location;
  next.environment.timeOfDay = state.environment.timeOfDay;
  next.environment.lighting = state.environment.lighting;
  next.environment.background = state.environment.background;
  next.style.visualStyle = state.style.style;
  next.style.detailLevel = state.style.detailLevel;
  next.style.colorPalette = state.style.palette;
  next.style.mood = state.style.mood;

  return next;
}

export function migratePromptDocumentToSceneTemplate(document: PromptDocument): PromptDocument<SceneTemplateState> {
  if (document.templateId === 'scene_template_v2') {
    return {
      ...document,
      state: normalizePromptState(document.state, 'scene_template_v2') as SceneTemplateState,
    };
  }

  const legacyState = normalizePromptState(document.state, 'single_character_scene_v1') as SingleCharacterPromptState;
  return {
    ...document,
    templateId: 'scene_template_v2',
    templateVersion: 1,
    state: convertSingleCharacterToSceneState(legacyState),
    enabledConstraintIds: getDefaultSceneTemplateConstraintIds(),
  };
}

export function buildSceneSnapshot(document: Pick<PromptDocument<SceneTemplateState>, 'id' | 'title' | 'templateId' | 'state' | 'enabledConstraintIds'>): SceneSnapshot | null {
  if (document.templateId !== 'scene_template_v2') return null;

  return serializeSceneSnapshot({
    sourceDocumentId: document.id,
    sourceDocumentTitle: document.title,
    state: normalizePromptState(document.state, 'scene_template_v2') as SceneTemplateState,
    enabledConstraintIds: document.enabledConstraintIds,
  });
}

export function toPromptDocumentSummary(record: PersistedPromptDocumentRecord): PromptDocumentSummary {
  const templateId = normalizePromptTemplateId(record.templateId);
  const summary: PromptDocumentSummary = {
    id: record.id,
    workspaceId: record.workspaceId,
    title: record.title,
    templateId,
    templateVersion: normalizePromptTemplateVersion(record.templateVersion),
    status: normalizePromptDocumentStatus(record.status),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };

  if (templateId === 'scene_template_v2') {
    const state = normalizePromptState(record.stateJson, templateId) as SceneTemplateState;
    summary.sceneType = state.sceneSummary.sceneType;
    summary.tags = state.sceneSummary.tags;
    summary.characterCount = state.characterSlots.filter((slot) => slot.enabled).length;
    summary.relationCount = state.characterRelations.length;
  }

  if (templateId === 'single_character_scene_v1') {
    const state = normalizePromptState(record.stateJson, templateId) as SingleCharacterPromptState;
    summary.sceneType = 'legacy single character';
    summary.tags = ['legacy'];
    summary.characterCount = 1;
    summary.relationCount = 0;
    summary.title = summary.title.trim() ? `${summary.title} · Legacy` : 'Legacy scene';
  }

  return summary;
}
