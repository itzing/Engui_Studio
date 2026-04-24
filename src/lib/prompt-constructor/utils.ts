import { promptConstructorConstraints } from '@/lib/prompt-constructor/constraints';
import { getPromptTemplate } from '@/lib/prompt-constructor/templateRegistry';
import type { ConstraintSnippet, PromptDocument, PromptDocumentStatus, SingleCharacterPromptState } from '@/lib/prompt-constructor/types';
import { getDefaultSingleCharacterConstraintIds } from '@/lib/prompt-constructor/templates/singleCharacterSceneV1';

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return Array.from(new Set(parsed.filter((item): item is string => typeof item === 'string' && item.trim()).map((item) => item.trim())));
    }
  } catch (error) {
    console.warn('Failed to parse prompt constructor string array:', error);
  }

  return [];
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
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const data = parsed as Record<string, any>;

    return {
      character: {
        appearance: typeof data.character?.appearance === 'string' ? data.character.appearance.trim() : '',
        outfit: typeof data.character?.outfit === 'string' ? data.character.outfit.trim() : '',
        expression: typeof data.character?.expression === 'string' ? data.character.expression.trim() : '',
        pose: typeof data.character?.pose === 'string' ? data.character.pose.trim() : '',
      },
      action: {
        mainAction: typeof data.action?.mainAction === 'string' ? data.action.mainAction.trim() : '',
      },
      composition: {
        shotType: typeof data.composition?.shotType === 'string' ? data.composition.shotType.trim() : '',
        cameraAngle: typeof data.composition?.cameraAngle === 'string' ? data.composition.cameraAngle.trim() : '',
        framing: typeof data.composition?.framing === 'string' ? data.composition.framing.trim() : '',
      },
      environment: {
        location: typeof data.environment?.location === 'string' ? data.environment.location.trim() : '',
        timeOfDay: typeof data.environment?.timeOfDay === 'string' ? data.environment.timeOfDay.trim() : '',
        lighting: typeof data.environment?.lighting === 'string' ? data.environment.lighting.trim() : '',
        background: typeof data.environment?.background === 'string' ? data.environment.background.trim() : '',
      },
      style: {
        style: typeof data.style?.style === 'string' ? data.style.style.trim() : '',
        detailLevel: typeof data.style?.detailLevel === 'string' ? data.style.detailLevel.trim() : '',
        palette: typeof data.style?.palette === 'string' ? data.style.palette.trim() : '',
        mood: typeof data.style?.mood === 'string' ? data.style.mood.trim() : '',
      },
    };
  } catch (error) {
    console.warn('Failed to parse prompt constructor state JSON:', error);
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

export function normalizePromptTemplateId(input: unknown): 'single_character_scene_v1' {
  return input === 'single_character_scene_v1' ? 'single_character_scene_v1' : 'single_character_scene_v1';
}

export function normalizePromptTemplateVersion(input: unknown): number {
  return input === 1 || input === '1' ? 1 : 1;
}

export function normalizePromptState(input: unknown): SingleCharacterPromptState {
  if (typeof input === 'string') {
    return parseSingleCharacterState(input);
  }
  return parseSingleCharacterState(JSON.stringify(input ?? {}));
}

export function serializePromptState(input: unknown): string {
  return JSON.stringify(normalizePromptState(input));
}

export function normalizeConstraintIds(input: unknown, templateId: string): string[] {
  const requested = Array.isArray(input) ? input : parseStringArray(typeof input === 'string' ? input : null);
  const allowed = new Set(
    promptConstructorConstraints
      .filter((constraint) => constraint.applicableTemplateIds.includes(templateId))
      .map((constraint) => constraint.id),
  );

  const normalized = Array.from(new Set(requested.filter((item): item is string => typeof item === 'string' && allowed.has(item))));
  if (normalized.length > 0) return normalized;
  if (templateId === 'single_character_scene_v1') return getDefaultSingleCharacterConstraintIds();
  return [];
}

export function serializeConstraintIds(input: unknown, templateId: string): string {
  return JSON.stringify(normalizeConstraintIds(input, templateId));
}

export function resolveConstraintSnippets(constraintIds: string[], templateId: string): ConstraintSnippet[] {
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
    state: normalizePromptState(record.stateJson),
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
  return template.render(document.state, constraints);
}

export function buildPromptValidation(document: Pick<PromptDocument, 'templateId' | 'state' | 'enabledConstraintIds' | 'title'>) {
  const template = getPromptTemplate(document.templateId);
  if (!template) {
    return [{ id: 'unknown-template', level: 'warning' as const, message: 'Unknown prompt template.' }];
  }

  const warnings = [...template.validate(document.state, resolveConstraintSnippets(document.enabledConstraintIds, document.templateId))];
  if (!document.title.trim()) {
    warnings.unshift({ id: 'missing-title', level: 'warning', message: 'Document title is empty.' });
  }
  return warnings;
}
