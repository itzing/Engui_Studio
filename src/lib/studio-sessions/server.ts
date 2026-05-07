import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { toCharacterSummary } from '@/lib/characters/utils';
import { buildCharacterPromptFromSummary } from '@/lib/scenes/utils';
import {
  assembleStudioSessionPrompt,
  buildStudioSessionShotSlotsFromRules,
  createDefaultStudioSessionTemplateDraftState,
  createStudioSessionSavedStateFromDraft,
  deriveStudioSessionResolution,
  deriveStudioSessionRunStatus,
  pickUniqueStudioSessionPose,
  normalizeStudioSessionTemplateDraftState,
  serializeStudioSessionCategoryRule,
  toStudioSessionRunSummary,
  toStudioSessionShotRevisionSummary,
  toStudioSessionShotSummary,
  toStudioSessionShotVersionSummary,
  toStudioSessionTemplateSummary,
} from './utils';
import { getStudioSessionPoseById, getStudioSessionPosesByCategory } from './poseLibrary';
import { getModelById } from '@/lib/models/modelConfig';
import { RUNNING_JOB_STATUSES } from '@/lib/jobManagement';
import { queueGalleryDerivatives } from '@/lib/galleryDerivatives';
import { queueGalleryEnrichment } from '@/lib/galleryEnrichment';
import type { StudioSessionRunAssembleResult, StudioSessionRunDetailSummary, StudioSessionRunSummary, StudioSessionTemplateDraftState } from './types';

type StudioSessionJobContext = {
  workspaceId: string;
  runId: string;
  shotId: string;
  revisionId: string;
  templateId?: string | null;
  label?: string | null;
  executionMode?: string | null;
};

function parseJsonObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' ? value as Record<string, any> : {};
}

function parseStudioSessionContext(value: unknown): StudioSessionJobContext | null {
  const root = parseJsonObject(value);
  const context = root.studioSessionContext && typeof root.studioSessionContext === 'object'
    ? root.studioSessionContext as Record<string, unknown>
    : root;

  const workspaceId = typeof context.workspaceId === 'string' && context.workspaceId.trim() ? context.workspaceId.trim() : null;
  const runId = typeof context.runId === 'string' && context.runId.trim() ? context.runId.trim() : null;
  const shotId = typeof context.shotId === 'string' && context.shotId.trim() ? context.shotId.trim() : null;
  const revisionId = typeof context.revisionId === 'string' && context.revisionId.trim() ? context.revisionId.trim() : null;
  if (!workspaceId || !runId || !shotId || !revisionId) return null;

  return {
    workspaceId,
    runId,
    shotId,
    revisionId,
    templateId: typeof context.templateId === 'string' && context.templateId.trim() ? context.templateId.trim() : null,
    label: typeof context.label === 'string' && context.label.trim() ? context.label.trim() : null,
    executionMode: typeof context.executionMode === 'string' && context.executionMode.trim() ? context.executionMode.trim() : null,
  };
}

export async function ensureStudioSessionMaterializationTaskForJob(input: {
  jobId: string;
  options?: unknown;
  context?: StudioSessionJobContext | null;
}) {
  const context = input.context ?? parseStudioSessionContext(input.options);
  if (!context) return null;

  return prisma.studioSessionJobMaterialization.upsert({
    where: { jobId: input.jobId },
    update: {
      workspaceId: context.workspaceId,
      runId: context.runId,
      shotId: context.shotId,
      revisionId: context.revisionId,
    },
    create: {
      jobId: input.jobId,
      workspaceId: context.workspaceId,
      runId: context.runId,
      shotId: context.shotId,
      revisionId: context.revisionId,
      status: 'pending',
    },
  });
}

async function backfillStudioSessionMaterializationTasks(input: { runId?: string; limit?: number } = {}) {
  const jobs = await prisma.job.findMany({
    where: {
      AND: [
        { options: { contains: '\"studioSessionContext\"' } },
        ...(input.runId ? [{ options: { contains: `\"runId\":\"${input.runId}\"` } }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: input.limit ?? 200,
  });

  for (const job of jobs) {
    await ensureStudioSessionMaterializationTaskForJob({ jobId: job.id, options: job.options });
  }
}

export async function recoverStudioSessionMaterializationTasks(input: { runId?: string; limit?: number } = {}) {
  await backfillStudioSessionMaterializationTasks(input);

  const tasks = await prisma.studioSessionJobMaterialization.findMany({
    where: {
      status: { in: ['pending', 'processing', 'failed'] },
      ...(input.runId ? { runId: input.runId } : {}),
    },
    orderBy: [{ updatedAt: 'asc' }],
    take: input.limit ?? 200,
  });

  for (const task of tasks) {
    const job = await prisma.job.findUnique({ where: { id: task.jobId } });
    if (!job) continue;

    if (job.status === 'completed') {
      try {
        await materializeStudioSessionCompletedJob(job.id);
      } catch (error) {
        console.error('Studio Session recovery materialization failed', {
          jobId: job.id,
          taskId: task.id,
          error,
        });
      }
      continue;
    }

    if (job.status === 'failed') {
      const shot = await prisma.studioSessionShot.findUnique({ where: { id: task.shotId } });
      if (shot) {
        await prisma.studioSessionShot.update({
          where: { id: shot.id },
          data: {
            status: shot.currentRevisionId ? 'needs_review' : 'unassigned',
          },
        });
      }

      await prisma.studioSessionJobMaterialization.update({
        where: { jobId: task.jobId },
        data: {
          status: 'failed',
          lastError: job.error || 'Source job failed before materialization',
        },
      });
    }
  }
}

function normalizeUrlCandidate(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildJobOutputUrls(job: { options?: unknown; resultUrl?: string | null; thumbnailUrl?: string | null; type?: string | null }) {
  const options = parseJsonObject(job.options);
  const directCandidates = [
    normalizeUrlCandidate(job.resultUrl),
    normalizeUrlCandidate(options.url),
    normalizeUrlCandidate(options.resultUrl),
    normalizeUrlCandidate(options.image),
    normalizeUrlCandidate(options.image_url),
    normalizeUrlCandidate(options.image_path),
    normalizeUrlCandidate(options.video),
    normalizeUrlCandidate(options.video_url),
    normalizeUrlCandidate(options.video_path),
    normalizeUrlCandidate(options.audioUrl),
    normalizeUrlCandidate(options.output_path),
    normalizeUrlCandidate(options.s3_path),
  ].filter(Boolean) as string[];

  const listCandidates: string[] = [];
  for (const key of ['images', 'videos', 'outputs', 'resultUrls'] as const) {
    const value = options[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const normalized = normalizeUrlCandidate(item);
        if (normalized) listCandidates.push(normalized);
      }
    }
  }

  return Array.from(new Set([...directCandidates, ...listCandidates]));
}

function resolveLocalPathFromUrl(url: string): string | null {
  if (!url.startsWith('/')) return null;
  const normalized = url.split('?')[0];
  if (normalized.startsWith('/generations/')) return path.join(process.cwd(), 'public', normalized.replace(/^\//, ''));
  if (normalized.startsWith('/results/')) return path.join(process.cwd(), 'public', normalized.replace(/^\//, ''));
  return null;
}

function getExtensionFromUrl(url: string): string {
  const pathname = url.split('?')[0];
  const ext = path.extname(pathname);
  return ext || '.png';
}

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

async function resolveStudioSessionCharacterPrompt(snapshot: Record<string, any>): Promise<string> {
  if (typeof snapshot.characterPrompt === 'string' && snapshot.characterPrompt.trim()) {
    return snapshot.characterPrompt.trim();
  }

  const characterId = typeof snapshot.characterId === 'string' && snapshot.characterId.trim() ? snapshot.characterId.trim() : null;
  if (!characterId) return '';

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      _count: {
        select: {
          versions: true,
        },
      },
    },
  });

  if (!character || character.deletedAt) return '';
  return buildCharacterPromptFromSummary(toCharacterSummary(character), { includeName: false, includeGender: false });
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
  const characterPrompt = await resolveStudioSessionCharacterPrompt(canonicalState as Record<string, any>);
  const slots = buildStudioSessionShotSlotsFromRules(canonicalState.categoryRules);

  const created = await prisma.$transaction(async (tx) => {
    const run = await tx.studioSessionRun.create({
      data: {
        workspaceId: input.workspaceId,
        templateId: template.id,
        templateNameSnapshot: template.name,
        templateSnapshotJson: JSON.stringify({
          ...canonicalState,
          characterPrompt,
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

export async function deleteStudioSessionRun(runId: string) {
  const run = await prisma.studioSessionRun.findUnique({ where: { id: runId } });
  if (!run) return null;

  const activeJobs = await collectStudioSessionActiveJobs(runId);
  if (activeJobs.size > 0) {
    throw new Error('Cannot delete a run while shot jobs are still active');
  }

  await prisma.studioSessionRun.delete({ where: { id: runId } });
  return { id: runId };
}

async function collectStudioSessionActiveJobs(runId: string) {
  const latestJobs = await collectStudioSessionLatestJobs(runId);
  const activeStatuses = new Set([...Array.from(RUNNING_JOB_STATUSES), 'queueing_up', 'finalizing']);
  return new Set(
    Array.from(latestJobs.values())
      .filter((job) => activeStatuses.has(job.status))
      .map((job) => job.id),
  );
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

async function collectStudioSessionLatestJobs(runId: string) {
  const jobs = await prisma.job.findMany({
    where: {
      options: { contains: `"runId":"${runId}"` },
    },
    orderBy: { createdAt: 'desc' },
  });

  const byShotId = new Map<string, { id: string; status: string; executionMs: number | null; createdAt: string; completedAt: string | null }>();
  for (const job of jobs) {
    if (typeof job.options !== 'string') continue;
    try {
      const parsed = JSON.parse(job.options);
      const shotId = parsed?.studioSessionContext?.shotId;
      if (typeof shotId === 'string' && !byShotId.has(shotId)) {
        byShotId.set(shotId, {
          id: job.id,
          status: job.status,
          executionMs: typeof job.executionMs === 'number' && Number.isFinite(job.executionMs) ? job.executionMs : null,
          createdAt: job.createdAt.toISOString(),
          completedAt: job.completedAt ? job.completedAt.toISOString() : null,
        });
      }
    } catch {
      continue;
    }
  }
  return byShotId;
}

async function reconcileStudioSessionRunCompletedJobs(runId: string) {
  await recoverStudioSessionMaterializationTasks({ runId, limit: 200 });

  const jobs = await prisma.job.findMany({
    where: {
      options: { contains: `"runId":"${runId}"` },
    },
    orderBy: { createdAt: 'desc' },
  });

  const latestByShotId = new Map<string, { id: string; status: string }>();
  for (const job of jobs) {
    if (typeof job.options !== 'string') continue;
    try {
      const parsed = JSON.parse(job.options);
      const shotId = parsed?.studioSessionContext?.shotId;
      if (typeof shotId === 'string' && !latestByShotId.has(shotId)) {
        latestByShotId.set(shotId, { id: job.id, status: job.status });
      }
    } catch {
      continue;
    }
  }

  for (const [shotId, job] of latestByShotId) {
    if (job.status === 'completed') {
      await materializeStudioSessionCompletedJob(job.id);
      continue;
    }

    if (job.status === 'failed') {
      const shot = await prisma.studioSessionShot.findUnique({ where: { id: shotId } });
      if (!shot) continue;
      await prisma.studioSessionShot.update({
        where: { id: shotId },
        data: {
          status: shot.currentRevisionId ? 'needs_review' : 'unassigned',
        },
      });
    }
  }
}

export async function getStudioSessionRun(runId: string) {
  await reconcileStudioSessionRunCompletedJobs(runId);
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
  const versions = await prisma.studioSessionShotVersion.findMany({
    where: { shotId: { in: shots.map((shot) => shot.id) } },
    orderBy: [{ shotId: 'asc' }, { createdAt: 'desc' }],
  });
  const exhaustedCategories = await collectRunExhaustedCategories(run, shots);
  const latestJobs = await collectStudioSessionLatestJobs(runId);
  const materializationTasks = await prisma.studioSessionJobMaterialization.findMany({
    where: { runId },
    orderBy: [{ updatedAt: 'desc' }],
  });
  const materializationByShotId = new Map<string, typeof materializationTasks[number]>();
  for (const task of materializationTasks) {
    if (!materializationByShotId.has(task.shotId)) {
      materializationByShotId.set(task.shotId, task);
    }
  }
  const activeJobs = await collectStudioSessionActiveJobs(runId);
  const activeJobCount = activeJobs.size;
  const totalExecutionMs = versions.reduce((sum, version) => {
    const value = parseJsonObject(version.generationSnapshotJson).executionMs;
    return sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  }, 0);

  return {
    run: {
      ...run,
      exhaustedCategories,
      activeJobCount,
      totalExecutionMs,
    } satisfies StudioSessionRunDetailSummary,
    shots: shots.map((shot) => {
      const summary = toStudioSessionShotSummary(shot);
      const latestJob = latestJobs.get(shot.id);
      const isActive = latestJob ? activeStatuses.has(latestJob.status) : false;
      return {
        ...summary,
        activeJobId: isActive ? latestJob?.id ?? null : null,
        activeJobStatus: isActive ? latestJob?.status ?? null : null,
        latestJobId: latestJob?.id ?? null,
        latestJobStatus: latestJob?.status ?? null,
        latestJobExecutionMs: latestJob?.executionMs ?? null,
        latestJobCreatedAt: latestJob?.createdAt ?? null,
        latestJobCompletedAt: latestJob?.completedAt ?? null,
        materializationStatus: materializationByShotId.get(shot.id)?.status ?? null,
        materializationError: materializationByShotId.get(shot.id)?.lastError ?? null,
        materializationUpdatedAt: materializationByShotId.get(shot.id)?.updatedAt?.toISOString?.() ?? null,
      };
    }),
    revisions: revisions.map(toStudioSessionShotRevisionSummary),
    versions: versions.map(toStudioSessionShotVersionSummary),
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
  const characterPrompt = await resolveStudioSessionCharacterPrompt(snapshot);
  const categoryRule = Array.isArray(snapshot.categoryRules)
    ? snapshot.categoryRules.find((rule: any) => rule?.category === shot.category) ?? null
    : null;
  const assembledPrompt = assembleStudioSessionPrompt({
    characterPrompt,
    characterAge: typeof snapshot.characterAge === 'string' ? snapshot.characterAge : '',
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

function normalizeJobStatusToShotStatus(status: string): 'queued' | 'running' {
  return status === 'queueing_up' || status === 'queued' || status === 'in_queue' ? 'queued' : 'running';
}

async function ensureStudioSessionShotRevision(shotId: string) {
  const shot = await prisma.studioSessionShot.findUnique({ where: { id: shotId } });
  if (!shot) return null;
  if (shot.currentRevisionId) return shot.currentRevisionId;
  const autoPick = await autoPickStudioSessionShot(shotId);
  return autoPick?.revision?.id ?? null;
}

async function launchStudioSessionShotJob(shotId: string, executionMode: 'shot_run' | 'run_all' = 'shot_run') {
  const ensuredRevisionId = await ensureStudioSessionShotRevision(shotId);
  const shot = await prisma.studioSessionShot.findUnique({
    where: { id: shotId },
    include: { run: true },
  });
  if (!shot || !ensuredRevisionId) return null;

  const revision = await prisma.studioSessionShotRevision.findUnique({ where: { id: ensuredRevisionId } });
  if (!revision) return null;

  const snapshot = shot.run.templateSnapshotJson ? JSON.parse(shot.run.templateSnapshotJson) : {};
  const generationSettings = snapshot.generationSettings && typeof snapshot.generationSettings === 'object' ? snapshot.generationSettings as Record<string, unknown> : {};
  const modelId = typeof generationSettings.modelId === 'string' && generationSettings.modelId.trim() ? generationSettings.modelId.trim() : 'z-image';
  const model = getModelById(modelId);
  if (!model || model.type !== 'image') {
    throw new Error(`Unsupported Studio Session model: ${modelId}`);
  }

  const promptSnapshot = JSON.parse(revision.assembledPromptSnapshotJson || '{}');
  const resolvedSize = deriveStudioSessionResolution(snapshot.resolutionPolicy ?? { shortSidePx: 832, longSidePx: 1216, squareSideSource: 'short' }, revision.derivedOrientation as any);
  const formData = new FormData();
  formData.append('userId', 'user-with-settings');
  formData.append('workspaceId', shot.workspaceId);
  formData.append('modelId', modelId);
  formData.append('jobId', `${shot.id}-${Date.now()}`);
  formData.append('prompt', typeof promptSnapshot?.positivePrompt === 'string' ? promptSnapshot.positivePrompt : '');

  const studioSessionContext = {
    workspaceId: shot.workspaceId,
    runId: shot.runId,
    shotId: shot.id,
    revisionId: revision.id,
    templateId: shot.run.templateId,
    label: shot.label,
    executionMode,
  };
  formData.append('studioSessionContext', JSON.stringify(studioSessionContext));

  const parameterMap = new Map((model.parameters || []).map((parameter) => [parameter.name, parameter]));
  const requestedSeed = typeof generationSettings.seed === 'number' ? Math.floor(generationSettings.seed) : -1;
  const resolvedSeed = requestedSeed < 0 ? crypto.randomInt(1, 2 ** 31) : requestedSeed;
  const mergedSettings = {
    ...generationSettings,
    width: typeof generationSettings.width === 'number' ? generationSettings.width : resolvedSize.width,
    height: typeof generationSettings.height === 'number' ? generationSettings.height : resolvedSize.height,
    steps: typeof generationSettings.steps === 'number' ? generationSettings.steps : 9,
    cfg: typeof generationSettings.cfg === 'number' ? generationSettings.cfg : 1,
    seed: resolvedSeed,
    negativePrompt: typeof promptSnapshot?.negativePrompt === 'string' ? promptSnapshot.negativePrompt : (typeof generationSettings.negativePrompt === 'string' ? generationSettings.negativePrompt : ''),
  } as Record<string, unknown>;

  for (const [key, value] of Object.entries(mergedSettings)) {
    if (key === 'modelId' || value === undefined || value === null) continue;
    if (!parameterMap.has(key)) continue;
    formData.append(key, String(value));
  }

  const response = await fetch('http://127.0.0.1:3010/api/generate', {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();
  if (!response.ok || !data?.success || !data?.jobId) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to launch Studio Session job');
  }

  await prisma.studioSessionShot.update({
    where: { id: shot.id },
    data: {
      status: normalizeJobStatusToShotStatus(data.status || 'queueing_up'),
    },
  });
  await syncStudioSessionRunStatus(shot.runId);
  return { jobId: data.jobId as string, shotId: shot.id };
}

export async function runStudioSessionShot(shotId: string) {
  return launchStudioSessionShotJob(shotId, 'shot_run');
}

export async function runAllStudioSessionShots(runId: string) {
  const shots = await prisma.studioSessionShot.findMany({
    where: { runId, skipped: false },
    orderBy: [{ category: 'asc' }, { slotIndex: 'asc' }],
  });

  const launched: Array<{ shotId: string; jobId: string }> = [];
  const skippedShotIds: string[] = [];
  for (const shot of shots) {
    if (shot.status === 'queued' || shot.status === 'running') {
      skippedShotIds.push(shot.id);
      continue;
    }
    const result = await launchStudioSessionShotJob(shot.id, 'run_all');
    if (result) {
      launched.push(result);
    } else {
      skippedShotIds.push(shot.id);
    }
  }

  return { launched, skippedShotIds };
}

async function syncStudioSessionShotSelectionAfterVersionReviewState(shotId: string) {
  const shot = await prisma.studioSessionShot.findUnique({ where: { id: shotId } });
  if (!shot) return null;

  const selectedVersion = shot.selectionVersionId
    ? await prisma.studioSessionShotVersion.findUnique({ where: { id: shot.selectionVersionId } })
    : null;

  const shouldClearSelection = !selectedVersion || selectedVersion.hidden || selectedVersion.rejected || selectedVersion.status !== 'completed';
  await prisma.studioSessionShot.update({
    where: { id: shotId },
    data: {
      selectionVersionId: shouldClearSelection ? null : shot.selectionVersionId,
      status: shouldClearSelection ? 'needs_review' : 'completed',
    },
  });
  await syncStudioSessionRunStatus(shot.runId);
  return shouldClearSelection;
}

export async function addStudioSessionShotVersionToGallery(input: { shotId: string; versionId: string; bucket?: 'common' | 'draft' | 'upscale' }) {
  const version = await prisma.studioSessionShotVersion.findFirst({
    where: {
      id: input.versionId,
      shotId: input.shotId,
      status: 'completed',
    },
  });
  if (!version || !version.originalUrl || !version.contentHash) return null;

  const bucket = input.bucket ?? 'common';
  const existing = await prisma.galleryAsset.findFirst({
    where: {
      workspaceId: version.workspaceId,
      contentHash: version.contentHash,
      originalUrl: version.originalUrl,
      bucket,
      trashed: false,
    },
    orderBy: { addedToGalleryAt: 'desc' },
  });
  if (existing) {
    return { alreadyInGallery: true, asset: existing };
  }

  const asset = await prisma.galleryAsset.create({
    data: {
      workspaceId: version.workspaceId,
      type: 'image',
      bucket,
      originKind: 'job_output',
      sourceJobId: version.sourceJobId,
      sourceOutputId: version.id,
      contentHash: version.contentHash,
      originalUrl: version.originalUrl,
      previewUrl: version.previewUrl || version.originalUrl,
      thumbnailUrl: version.thumbnailUrl,
      generationSnapshot: JSON.stringify({
        ...(parseJsonObject(version.generationSnapshotJson)),
        studioSessionVersionId: version.id,
        studioSessionShotId: version.shotId,
        studioSessionRevisionId: version.revisionId,
      }),
      derivativeStatus: 'pending',
      enrichmentStatus: 'pending',
    },
  });

  queueGalleryDerivatives(asset.id);
  queueGalleryEnrichment(asset.id);
  return { alreadyInGallery: false, asset };
}

export async function updateStudioSessionShotSkipState(input: { shotId: string; skipped: boolean }) {
  const shot = await prisma.studioSessionShot.findUnique({ where: { id: input.shotId } });
  if (!shot) return null;

  const updated = await prisma.studioSessionShot.update({
    where: { id: input.shotId },
    data: {
      skipped: input.skipped,
      status: input.skipped ? 'completed' : (shot.selectionVersionId ? 'completed' : (shot.currentRevisionId ? 'needs_review' : 'unassigned')),
    },
  });
  await syncStudioSessionRunStatus(shot.runId);
  return updated;
}

export async function updateStudioSessionShotVersionReviewState(input: { shotId: string; versionId: string; hidden?: boolean; rejected?: boolean }) {
  const version = await prisma.studioSessionShotVersion.findFirst({
    where: {
      id: input.versionId,
      shotId: input.shotId,
    },
  });
  if (!version) return null;

  const updated = await prisma.studioSessionShotVersion.update({
    where: { id: version.id },
    data: {
      ...(input.hidden !== undefined ? { hidden: input.hidden } : {}),
      ...(input.rejected !== undefined ? { rejected: input.rejected } : {}),
    },
  });
  await syncStudioSessionShotSelectionAfterVersionReviewState(input.shotId);
  return updated;
}

export async function selectStudioSessionShotVersion(input: { shotId: string; versionId: string }) {
  const shot = await prisma.studioSessionShot.findUnique({ where: { id: input.shotId } });
  if (!shot) return null;

  const version = await prisma.studioSessionShotVersion.findFirst({
    where: {
      id: input.versionId,
      shotId: input.shotId,
      hidden: false,
      rejected: false,
      status: 'completed',
    },
  });
  if (!version) return null;

  await prisma.studioSessionShot.update({
    where: { id: shot.id },
    data: {
      selectionVersionId: version.id,
      status: 'completed',
    },
  });
  await syncStudioSessionRunStatus(shot.runId);
  return version;
}

export async function materializeStudioSessionCompletedJob(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'completed') return null;

  const options = parseJsonObject(job.options);
  const context = parseStudioSessionContext(options);
  if (!context) return null;

  const task = await ensureStudioSessionMaterializationTaskForJob({ jobId: job.id, options, context });
  if (task?.status === 'materialized') {
    const existingByTask = await prisma.studioSessionShotVersion.findFirst({ where: { sourceJobId: job.id } });
    if (existingByTask) return existingByTask;
  }

  if (task) {
    await prisma.studioSessionJobMaterialization.update({
      where: { jobId: job.id },
      data: {
        status: 'processing',
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        lastError: null,
      },
    });
  }

  try {
    const shot = await prisma.studioSessionShot.findUnique({ where: { id: context.shotId } });
    if (!shot) throw new Error(`Studio Session shot not found for job ${job.id}`);

    const existing = await prisma.studioSessionShotVersion.findFirst({ where: { sourceJobId: job.id } });
    if (existing) {
      if (task) {
        await prisma.studioSessionJobMaterialization.update({
          where: { jobId: job.id },
          data: {
            status: 'materialized',
            materializedAt: existing.createdAt,
            lastError: null,
          },
        });
      }
      return existing;
    }

    const outputUrl = buildJobOutputUrls(job)[0] ?? normalizeUrlCandidate(job.resultUrl);
    if (!outputUrl) throw new Error(`Completed Studio Session job ${job.id} has no output URL`);

    let contentHash: string | null = null;
    let originalUrl = outputUrl;
    const localPath = resolveLocalPathFromUrl(outputUrl);
    if (localPath && fs.existsSync(localPath)) {
      const bytes = fs.readFileSync(localPath);
      contentHash = crypto.createHash('sha256').update(bytes).digest('hex');
      try {
        const ext = getExtensionFromUrl(outputUrl);
        const dir = path.join(process.cwd(), 'public', 'generations', 'studio-sessions', context.workspaceId, context.runId, context.shotId);
        fs.mkdirSync(dir, { recursive: true });
        const fileName = `${contentHash}${ext}`;
        const dest = path.join(dir, fileName);
        if (!fs.existsSync(dest)) fs.writeFileSync(dest, bytes);
        originalUrl = `/generations/studio-sessions/${context.workspaceId}/${context.runId}/${context.shotId}/${fileName}`;
      } catch (error) {
        console.warn('Studio Session materialization fallback: unable to copy output into namespaced directory, using original output URL instead.', error);
      }
    }

    const latest = await prisma.studioSessionShotVersion.findFirst({
      where: { revisionId: context.revisionId },
      orderBy: { versionNumber: 'desc' },
    });
    const version = await prisma.studioSessionShotVersion.create({
      data: {
        workspaceId: context.workspaceId,
        shotId: context.shotId,
        revisionId: context.revisionId,
        sourceJobId: job.id,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        status: 'completed',
        originKind: 'job_output',
        contentHash,
        originalUrl,
        previewUrl: originalUrl,
        thumbnailUrl: job.thumbnailUrl,
        generationSnapshotJson: JSON.stringify({
          ...options,
          prompt: job.prompt || null,
          modelId: job.modelId || null,
          endpointId: job.endpointId || null,
          sourceJobId: job.id,
          executionMs: typeof job.executionMs === 'number' && Number.isFinite(job.executionMs) ? job.executionMs : null,
          completedAt: job.completedAt ? job.completedAt.toISOString() : null,
        }),
      },
    });

    const shouldAutoSelect = !shot.selectionVersionId;
    await prisma.studioSessionShot.update({
      where: { id: shot.id },
      data: {
        status: shouldAutoSelect ? 'completed' : 'needs_review',
        selectionVersionId: shouldAutoSelect ? version.id : shot.selectionVersionId,
      },
    });
    if (task) {
      await prisma.studioSessionJobMaterialization.update({
        where: { jobId: job.id },
        data: {
          status: 'materialized',
          materializedAt: new Date(),
          lastError: null,
        },
      });
    }
    await syncStudioSessionRunStatus(shot.runId);
    return version;
  } catch (error: any) {
    if (task) {
      await prisma.studioSessionJobMaterialization.update({
        where: { jobId: job.id },
        data: {
          status: 'failed',
          lastError: error?.message || 'Studio Session materialization failed',
        },
      });
    }
    throw error;
  }
}

export async function manualPickStudioSessionShot(input: { shotId: string; poseId: string }) {
  const revision = await createStudioSessionShotRevision({ shotId: input.shotId, poseId: input.poseId, sourceKind: 'manual_pick', appendAutoHistory: false });
  return revision;
}
