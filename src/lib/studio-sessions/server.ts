import { prisma } from '@/lib/prisma';
import {
  createDefaultStudioSessionTemplateDraftState,
  createStudioSessionSavedStateFromDraft,
  normalizeStudioSessionTemplateDraftState,
  serializeStudioSessionCategoryRule,
  toStudioSessionTemplateSummary,
} from './utils';
import type { StudioSessionTemplateDraftState } from './types';

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildTemplateStorageFields(draft: StudioSessionTemplateDraftState) {
  return {
    name: draft.name || 'Untitled Studio Session',
    characterId: draft.characterId,
    environmentText: draft.environmentText,
    outfitText: draft.outfitText,
    hairstyleText: draft.hairstyleText,
    positivePrompt: draft.positivePrompt,
    negativePrompt: draft.negativePrompt,
    generationSettingsJson: JSON.stringify(draft.generationSettings),
    shortSidePx: draft.resolutionPolicy.shortSidePx,
    longSidePx: draft.resolutionPolicy.longSidePx,
    squareSideSource: draft.resolutionPolicy.squareSideSource,
  };
}

export async function listStudioSessionTemplates(workspaceId: string, status: 'active' | 'archived' = 'active') {
  const templates = await prisma.studioSessionTemplate.findMany({
    where: { workspaceId, status },
    include: {
      categoryRules: {
        orderBy: [{ category: 'asc' }],
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  });

  return templates.map(toStudioSessionTemplateSummary);
}

export async function getStudioSessionTemplate(templateId: string) {
  const template = await prisma.studioSessionTemplate.findUnique({
    where: { id: templateId },
    include: {
      categoryRules: {
        orderBy: [{ category: 'asc' }],
      },
    },
  });

  return template ? toStudioSessionTemplateSummary(template) : null;
}

export async function createStudioSessionTemplate(input: { workspaceId: string; name?: string; draftState?: unknown; canonicalState?: unknown; characterId?: unknown; }) {
  const baseDraft = normalizeStudioSessionTemplateDraftState(input.draftState ?? createDefaultStudioSessionTemplateDraftState());
  const draftState: StudioSessionTemplateDraftState = {
    ...baseDraft,
    name: cleanString(input.name) || baseDraft.name,
    characterId: asNullableString(input.characterId) ?? baseDraft.characterId,
  };
  const canonicalState = createStudioSessionSavedStateFromDraft(input.canonicalState ?? draftState);

  const created = await prisma.studioSessionTemplate.create({
    data: {
      workspaceId: input.workspaceId,
      ...buildTemplateStorageFields(draftState),
      canonicalStateJson: JSON.stringify(canonicalState),
      draftStateJson: JSON.stringify(draftState),
      status: 'active',
      categoryRules: {
        create: canonicalState.categoryRules.map((rule) => serializeStudioSessionCategoryRule(rule)),
      },
    },
    include: {
      categoryRules: { orderBy: [{ category: 'asc' }] },
    },
  });

  return toStudioSessionTemplateSummary(created);
}

export async function updateStudioSessionTemplateDraft(templateId: string, draftInput: unknown, options: { name?: unknown; characterId?: unknown } = {}) {
  const existing = await prisma.studioSessionTemplate.findUnique({ where: { id: templateId } });
  if (!existing) return null;

  const mergedDraft = normalizeStudioSessionTemplateDraftState({
    ...createDefaultStudioSessionTemplateDraftState(),
    ...JSON.parse(existing.draftStateJson || '{}'),
    ...((draftInput && typeof draftInput === 'object') ? draftInput as Record<string, unknown> : {}),
    ...(options.name !== undefined ? { name: options.name } : {}),
    ...(options.characterId !== undefined ? { characterId: options.characterId } : {}),
  });

  const updated = await prisma.studioSessionTemplate.update({
    where: { id: templateId },
    data: {
      ...buildTemplateStorageFields(mergedDraft),
      draftStateJson: JSON.stringify(mergedDraft),
    },
    include: {
      categoryRules: { orderBy: [{ category: 'asc' }] },
    },
  });

  return toStudioSessionTemplateSummary(updated);
}

export async function saveStudioSessionTemplate(templateId: string, canonicalInput: unknown) {
  const existing = await prisma.studioSessionTemplate.findUnique({
    where: { id: templateId },
    include: { categoryRules: true },
  });
  if (!existing) return null;

  const canonicalState = createStudioSessionSavedStateFromDraft(canonicalInput ?? JSON.parse(existing.draftStateJson || '{}'));

  const updated = await prisma.studioSessionTemplate.update({
    where: { id: templateId },
    data: {
      ...buildTemplateStorageFields(canonicalState),
      canonicalStateJson: JSON.stringify(canonicalState),
      draftStateJson: JSON.stringify(canonicalState),
      categoryRules: {
        deleteMany: {},
        create: canonicalState.categoryRules.map((rule) => serializeStudioSessionCategoryRule(rule)),
      },
    },
    include: {
      categoryRules: { orderBy: [{ category: 'asc' }] },
    },
  });

  return toStudioSessionTemplateSummary(updated);
}

export async function cloneStudioSessionTemplate(templateId: string) {
  const existing = await prisma.studioSessionTemplate.findUnique({
    where: { id: templateId },
    include: { categoryRules: true },
  });
  if (!existing) return null;

  const canonicalState = createStudioSessionSavedStateFromDraft(JSON.parse(existing.canonicalStateJson || existing.draftStateJson || '{}'));
  const clonedDraft = {
    ...canonicalState,
    name: `${existing.name} Copy`,
  };
  const clonedCanonical = createStudioSessionSavedStateFromDraft(clonedDraft);

  const created = await prisma.studioSessionTemplate.create({
    data: {
      workspaceId: existing.workspaceId,
      ...buildTemplateStorageFields(clonedDraft),
      canonicalStateJson: JSON.stringify(clonedCanonical),
      draftStateJson: JSON.stringify(clonedDraft),
      status: 'active',
      categoryRules: {
        create: clonedCanonical.categoryRules.map((rule) => serializeStudioSessionCategoryRule(rule)),
      },
    },
    include: {
      categoryRules: { orderBy: [{ category: 'asc' }] },
    },
  });

  return toStudioSessionTemplateSummary(created);
}
