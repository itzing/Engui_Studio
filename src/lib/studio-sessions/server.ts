import { prisma } from '@/lib/prisma';
import {
  buildStudioSessionShotSlotsFromRules,
  createDefaultStudioSessionTemplateDraftState,
  createStudioSessionSavedStateFromDraft,
  deriveStudioSessionRunStatus,
  normalizeStudioSessionTemplateDraftState,
  serializeStudioSessionCategoryRule,
  toStudioSessionRunSummary,
  toStudioSessionTemplateSummary,
} from './utils';
import type { StudioSessionRunSummary, StudioSessionTemplateDraftState } from './types';

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

async function syncStudioSessionRunStatus(runId: string): Promise<StudioSessionRunSummary | null> {
  const run = await prisma.studioSessionRun.findUnique({
    where: { id: runId },
    include: {
      shots: {
        orderBy: [{ category: 'asc' }, { slotIndex: 'asc' }],
      },
    },
  });
  if (!run) return null;

  const derivedStatus = deriveStudioSessionRunStatus({
    shots: run.shots.map((shot) => ({
      skipped: shot.skipped,
      status: shot.status as any,
      selectionVersionId: shot.selectionVersionId,
    })),
  });

  const updated = run.status === derivedStatus
    ? run
    : await prisma.studioSessionRun.update({
        where: { id: runId },
        data: { status: derivedStatus },
        include: {
          shots: {
            orderBy: [{ category: 'asc' }, { slotIndex: 'asc' }],
          },
        },
      });

  return toStudioSessionRunSummary(updated);
}

export async function createStudioSessionRun(input: { workspaceId: string; templateId: string }) {
  const template = await prisma.studioSessionTemplate.findUnique({
    where: { id: input.templateId },
    include: { categoryRules: { orderBy: [{ category: 'asc' }] } },
  });
  if (!template || template.workspaceId !== input.workspaceId) return null;

  const canonicalState = createStudioSessionSavedStateFromDraft(JSON.parse(template.canonicalStateJson || '{}'));
  const slots = buildStudioSessionShotSlotsFromRules(canonicalState.categoryRules);

  const created = await prisma.$transaction(async (tx) => {
    const run = await tx.studioSessionRun.create({
      data: {
        workspaceId: input.workspaceId,
        templateId: template.id,
        templateNameSnapshot: template.name,
        templateSnapshotJson: JSON.stringify({
          ...canonicalState,
          templateId: template.id,
          templateName: template.name,
        }),
        poseLibraryVersion: canonicalState.poseLibraryVersion,
        poseLibraryHash: canonicalState.poseLibraryHash,
        status: slots.length > 0 ? 'draft' : 'completed',
      },
    });

    if (slots.length > 0) {
      await tx.studioSessionShot.createMany({
        data: slots.map((slot) => ({
          workspaceId: input.workspaceId,
          runId: run.id,
          category: slot.category,
          slotIndex: slot.slotIndex,
          label: slot.label,
          status: 'unassigned',
          skipped: false,
          autoAssignmentHistoryJson: '[]',
        })),
      });
    }

    return run;
  });

  return syncStudioSessionRunStatus(created.id);
}

export async function listStudioSessionRuns(workspaceId: string, status?: string) {
  const runs = await prisma.studioSessionRun.findMany({
    where: {
      workspaceId,
      ...(status && status !== 'all' ? { status } : {}),
    },
    include: {
      shots: {
        orderBy: [{ category: 'asc' }, { slotIndex: 'asc' }],
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  });

  const summaries = await Promise.all(runs.map(async (run) => {
    const derivedStatus = deriveStudioSessionRunStatus({
      shots: run.shots.map((shot) => ({
        skipped: shot.skipped,
        status: shot.status as any,
        selectionVersionId: shot.selectionVersionId,
      })),
    });
    const effective = run.status === derivedStatus
      ? run
      : await prisma.studioSessionRun.update({ where: { id: run.id }, data: { status: derivedStatus } });
    return toStudioSessionRunSummary(effective);
  }));

  return status && status !== 'all' ? summaries.filter((run) => run.status === status) : summaries;
}

export async function getStudioSessionRun(runId: string) {
  return syncStudioSessionRunStatus(runId);
}
