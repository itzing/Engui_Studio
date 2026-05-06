import { prisma } from '@/lib/prisma';
import {
  assembleStudioSessionPrompt,
  buildStudioSessionShotSlotsFromRules,
  createDefaultStudioSessionTemplateDraftState,
  createStudioSessionSavedStateFromDraft,
  deriveStudioSessionRunStatus,
  pickUniqueStudioSessionPose,
  normalizeStudioSessionTemplateDraftState,
  serializeStudioSessionCategoryRule,
  toStudioSessionRunSummary,
  toStudioSessionShotRevisionSummary,
  toStudioSessionShotSummary,
  toStudioSessionTemplateSummary,
} from './utils';
import { getStudioSessionPoseById, getStudioSessionPosesByCategory } from './poseLibrary';
import type { StudioSessionRunAssembleResult, StudioSessionRunDetailSummary, StudioSessionRunSummary, StudioSessionTemplateDraftState } from './types';

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

async function collectRunAutoAssignmentHistory(runId: string, category?: string) {
  const shots = await prisma.studioSessionShot.findMany({
    where: {
      runId,
      ...(category ? { category } : {}),
    },
    select: {
      autoAssignmentHistoryJson: true,
    },
  });

  return Array.from(new Set(
    shots.flatMap((shot) => {
      try {
        return JSON.parse(shot.autoAssignmentHistoryJson || '[]') as string[];
      } catch {
        return [];
      }
    }),
  ));
}

async function collectRunExhaustedCategories(run: StudioSessionRunSummary, shots: Awaited<ReturnType<typeof prisma.studioSessionShot.findMany>>) {
  const exhausted = new Set<string>();
  for (const shot of shots) {
    if (shot.status !== 'unassigned') continue;
    const categoryRule = Array.isArray(run.templateSnapshot.categoryRules)
      ? run.templateSnapshot.categoryRules.find((rule) => rule.category === shot.category) ?? null
      : null;
    const pick = pickUniqueStudioSessionPose({
      category: shot.category,
      autoAssignmentHistory: await collectRunAutoAssignmentHistory(run.id, shot.category),
      excludedPoseIds: Array.isArray(categoryRule?.excludedPoseIds) ? categoryRule.excludedPoseIds : [],
      includedPoseIds: Array.isArray(categoryRule?.includedPoseIds) ? categoryRule.includedPoseIds : [],
      preferredOrientation: categoryRule?.preferredOrientation ?? null,
      preferredFraming: categoryRule?.preferredFraming ?? null,
    });
    if (!pick.pose) exhausted.add(shot.category);
  }
  return Array.from(exhausted).sort();
}

export async function getStudioSessionRun(runId: string) {
  const run = await syncStudioSessionRunStatus(runId);
  if (!run) return null;

  const shots = await prisma.studioSessionShot.findMany({
    where: { runId },
    orderBy: [{ category: 'asc' }, { slotIndex: 'asc' }],
  });
  const currentRevisionIds = shots.map((shot) => shot.currentRevisionId).filter((value): value is string => Boolean(value));
  const revisions = currentRevisionIds.length > 0
    ? await prisma.studioSessionShotRevision.findMany({ where: { id: { in: currentRevisionIds } } })
    : [];
  const exhaustedCategories = await collectRunExhaustedCategories(run, shots);

  return {
    run: {
      ...run,
      exhaustedCategories,
    } satisfies StudioSessionRunDetailSummary,
    shots: shots.map(toStudioSessionShotSummary),
    revisions: revisions.map(toStudioSessionShotRevisionSummary),
  };
}

export async function listStudioSessionShotPoses(shotId: string) {
  const shot = await prisma.studioSessionShot.findUnique({ where: { id: shotId } });
  if (!shot) return null;
  return {
    shot: toStudioSessionShotSummary(shot),
    poses: getStudioSessionPosesByCategory(shot.category),
  };
}

async function createStudioSessionShotRevision(params: {
  shotId: string;
  poseId: string;
  sourceKind: 'auto_pick' | 'manual_pick' | 'reshuffle';
  appendAutoHistory?: boolean;
}) {
  const shot = await prisma.studioSessionShot.findUnique({
    where: { id: params.shotId },
    include: { run: true },
  });
  if (!shot) return null;

  const pose = getStudioSessionPoseById(params.poseId);
  if (!pose || pose.category !== shot.category) return null;

  const snapshot = shot.run.templateSnapshotJson ? JSON.parse(shot.run.templateSnapshotJson) : {};
  const categoryRule = Array.isArray(snapshot.categoryRules)
    ? snapshot.categoryRules.find((rule: any) => rule?.category === shot.category) ?? null
    : null;
  const assembledPrompt = assembleStudioSessionPrompt({
    characterPrompt: '',
    environmentText: typeof snapshot.environmentText === 'string' ? snapshot.environmentText : '',
    outfitText: typeof snapshot.outfitText === 'string' ? snapshot.outfitText : '',
    hairstyleText: typeof snapshot.hairstyleText === 'string' ? snapshot.hairstyleText : '',
    positivePrompt: typeof snapshot.positivePrompt === 'string' ? snapshot.positivePrompt : '',
    negativePrompt: typeof snapshot.negativePrompt === 'string' ? snapshot.negativePrompt : '',
    pose,
  });

  const result = await prisma.$transaction(async (tx) => {
    const revisionCount = await tx.studioSessionShotRevision.count({ where: { shotId: shot.id } });
    const previousRevision = shot.currentRevisionId ? await tx.studioSessionShotRevision.findUnique({ where: { id: shot.currentRevisionId } }) : null;
    const inheritedOverrideFields = previousRevision?.overrideFieldsJson ?? null;
    const revision = await tx.studioSessionShotRevision.create({
      data: {
        workspaceId: shot.workspaceId,
        shotId: shot.id,
        revisionNumber: revisionCount + 1,
        poseId: pose.id,
        poseSnapshotJson: JSON.stringify(pose),
        derivedOrientation: pose.orientation,
        derivedFraming: pose.framing,
        assembledPromptSnapshotJson: JSON.stringify(assembledPrompt),
        overrideFieldsJson: categoryRule?.futureOverrideConfig ? JSON.stringify(categoryRule.futureOverrideConfig) : inheritedOverrideFields,
        sourceKind: params.sourceKind,
      },
    });

    const nextHistory = params.appendAutoHistory ? Array.from(new Set([...(JSON.parse(shot.autoAssignmentHistoryJson || '[]')), pose.id])) : JSON.parse(shot.autoAssignmentHistoryJson || '[]');
    await tx.studioSessionShot.update({
      where: { id: shot.id },
      data: {
        currentRevisionId: revision.id,
        status: 'assigned',
        autoAssignmentHistoryJson: JSON.stringify(nextHistory),
      },
    });

    return revision;
  });

  await syncStudioSessionRunStatus(shot.runId);
  return toStudioSessionShotRevisionSummary(result);
}

export async function autoPickStudioSessionShot(shotId: string) {
  const shot = await prisma.studioSessionShot.findUnique({
    where: { id: shotId },
    include: { run: true },
  });
  if (!shot) return null;

  const snapshot = shot.run.templateSnapshotJson ? JSON.parse(shot.run.templateSnapshotJson) : {};
  const categoryRule = Array.isArray(snapshot.categoryRules)
    ? snapshot.categoryRules.find((rule: any) => rule?.category === shot.category) ?? null
    : null;

  const pick = pickUniqueStudioSessionPose({
    category: shot.category,
    autoAssignmentHistory: await collectRunAutoAssignmentHistory(shot.runId, shot.category),
    excludedPoseIds: Array.isArray(categoryRule?.excludedPoseIds) ? categoryRule.excludedPoseIds : [],
    includedPoseIds: Array.isArray(categoryRule?.includedPoseIds) ? categoryRule.includedPoseIds : [],
    preferredOrientation: categoryRule?.preferredOrientation ?? null,
    preferredFraming: categoryRule?.preferredFraming ?? null,
  });

  if (!pick.pose) {
    return { exhausted: true, exhaustedCategories: [shot.category], revision: null };
  }

  const revision = await createStudioSessionShotRevision({ shotId, poseId: pick.pose.id, sourceKind: 'auto_pick', appendAutoHistory: true });
  return { exhausted: false, exhaustedCategories: [], revision };
}

export async function assembleStudioSessionRun(runId: string): Promise<StudioSessionRunAssembleResult | null> {
  const run = await prisma.studioSessionRun.findUnique({ where: { id: runId } });
  if (!run) return null;
  const shots = await prisma.studioSessionShot.findMany({
    where: { runId },
    orderBy: [{ category: 'asc' }, { slotIndex: 'asc' }],
  });
  const snapshot = run.templateSnapshotJson ? JSON.parse(run.templateSnapshotJson) : {};
  const historyByCategory = new Map<string, Set<string>>();
  for (const shot of shots) {
    const current = historyByCategory.get(shot.category) ?? new Set<string>();
    for (const poseId of (() => { try { return JSON.parse(shot.autoAssignmentHistoryJson || '[]') as string[]; } catch { return []; } })()) {
      current.add(poseId);
    }
    historyByCategory.set(shot.category, current);
  }

  const assignedShotIds: string[] = [];
  const skippedShotIds: string[] = [];
  const exhaustedCategories = new Set<string>();

  for (const shot of shots) {
    if (shot.skipped || shot.status !== 'unassigned') {
      skippedShotIds.push(shot.id);
      continue;
    }
    const categoryRule = Array.isArray(snapshot.categoryRules)
      ? snapshot.categoryRules.find((rule: any) => rule?.category === shot.category) ?? null
      : null;
    const categoryHistory = Array.from(historyByCategory.get(shot.category) ?? new Set<string>());
    const pick = pickUniqueStudioSessionPose({
      category: shot.category,
      autoAssignmentHistory: categoryHistory,
      excludedPoseIds: Array.isArray(categoryRule?.excludedPoseIds) ? categoryRule.excludedPoseIds : [],
      includedPoseIds: Array.isArray(categoryRule?.includedPoseIds) ? categoryRule.includedPoseIds : [],
      preferredOrientation: categoryRule?.preferredOrientation ?? null,
      preferredFraming: categoryRule?.preferredFraming ?? null,
    });
    if (!pick.pose) {
      exhaustedCategories.add(shot.category);
      continue;
    }
    await createStudioSessionShotRevision({ shotId: shot.id, poseId: pick.pose.id, sourceKind: 'auto_pick', appendAutoHistory: true });
    (historyByCategory.get(shot.category) ?? new Set<string>()).add(pick.pose.id);
    historyByCategory.set(shot.category, historyByCategory.get(shot.category) ?? new Set<string>([pick.pose.id]));
    historyByCategory.get(shot.category)?.add(pick.pose.id);
    assignedShotIds.push(shot.id);
  }

  return {
    assignedShotIds,
    skippedShotIds,
    exhaustedCategories: Array.from(exhaustedCategories).sort(),
  };
}

export async function reshuffleStudioSessionShot(shotId: string) {
  const shot = await prisma.studioSessionShot.findUnique({
    where: { id: shotId },
    include: { run: true },
  });
  if (!shot) return null;

  const snapshot = shot.run.templateSnapshotJson ? JSON.parse(shot.run.templateSnapshotJson) : {};
  const categoryRule = Array.isArray(snapshot.categoryRules)
    ? snapshot.categoryRules.find((rule: any) => rule?.category === shot.category) ?? null
    : null;
  const pick = pickUniqueStudioSessionPose({
    category: shot.category,
    autoAssignmentHistory: await collectRunAutoAssignmentHistory(shot.runId, shot.category),
    excludedPoseIds: Array.isArray(categoryRule?.excludedPoseIds) ? categoryRule.excludedPoseIds : [],
    includedPoseIds: Array.isArray(categoryRule?.includedPoseIds) ? categoryRule.includedPoseIds : [],
    preferredOrientation: categoryRule?.preferredOrientation ?? null,
    preferredFraming: categoryRule?.preferredFraming ?? null,
  });

  if (!pick.pose) {
    return { exhausted: true, exhaustedCategories: [shot.category], revision: null };
  }

  const revision = await createStudioSessionShotRevision({ shotId, poseId: pick.pose.id, sourceKind: 'reshuffle', appendAutoHistory: true });
  return { exhausted: false, exhaustedCategories: [], revision };
}

export async function manualPickStudioSessionShot(input: { shotId: string; poseId: string }) {
  const revision = await createStudioSessionShotRevision({ shotId: input.shotId, poseId: input.poseId, sourceKind: 'manual_pick', appendAutoHistory: false });
  return revision;
}
