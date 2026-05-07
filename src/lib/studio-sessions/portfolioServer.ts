import { prisma } from '@/lib/prisma';
import { getStudioSessionPoseLibrary } from './poseLibrary';
import { buildStudioRunShotSlotsFromPoseSet, getStudioPoseSetById } from './poseSets';
import {
  createStudioSessionSavedStateFromDraft,
  normalizeStudioCollectionStatus,
  normalizeStudioPhotoSessionStatus,
  normalizeStudioPortfolioStatus,
  normalizeStudioSessionTemplateDraftState,
  normalizeStudioSessionVersionReviewState,
  toStudioCollectionItemSummary,
  toStudioCollectionSummary,
  toStudioPhotoSessionSummary,
  toStudioPortfolioSummary,
  toStudioSessionRunSummary,
  toStudioSessionShotVersionSummary,
} from './utils';
import type {
  StudioCollectionStatus,
  StudioPhotoSessionStatus,
  StudioPortfolioStatus,
  StudioRunSettingsDraft,
  StudioSessionGenerationSettingsSnapshot,
  StudioSessionResolutionPolicy,
  StudioSessionVersionReviewState,
} from './types';

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function readNullableString(value: unknown): string | null {
  const trimmed = readOptionalString(value);
  return trimmed ? trimmed : null;
}

function readCount(value: unknown, fallback = 5): number {
  return Math.max(1, Math.min(50, typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback));
}

function readGenerationSettings(value: unknown): StudioSessionGenerationSettingsSnapshot {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    modelId: typeof input.modelId === 'string' && input.modelId.trim() ? input.modelId.trim() : 'z-image',
    steps: typeof input.steps === 'number' ? Math.max(1, Math.floor(input.steps)) : 9,
    cfg: typeof input.cfg === 'number' ? input.cfg : 1,
    seed: typeof input.seed === 'number' ? Math.floor(input.seed) : -1,
    sampler: null,
    cfgScale: null,
    ...input,
  };
}

function readResolutionPolicy(value: unknown): StudioSessionResolutionPolicy {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    shortSidePx: typeof input.shortSidePx === 'number' ? Math.max(64, Math.floor(input.shortSidePx)) : 1024,
    longSidePx: typeof input.longSidePx === 'number' ? Math.max(64, Math.floor(input.longSidePx)) : 1536,
    squareSideSource: input.squareSideSource === 'long' ? 'long' : 'short',
  };
}

function readRunSettingsDraft(input: unknown): StudioRunSettingsDraft {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return {
    name: readOptionalString(value.name) ?? '',
    poseSetId: readNullableString(value.poseSetId),
    count: readCount(value.count),
    positivePromptOverride: readOptionalString(value.positivePromptOverride) ?? '',
    negativePromptOverride: readOptionalString(value.negativePromptOverride) ?? '',
    generationSettings: readGenerationSettings(value.generationSettings),
    resolutionPolicy: readResolutionPolicy(value.resolutionPolicy),
  };
}

async function assertWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  return Boolean(workspace);
}

function makePortfolioInclude() {
  return {
    character: { select: { name: true, gender: true, traits: true, previewStateJson: true } },
    coverCollectionItem: { include: { version: { select: { originalUrl: true, previewUrl: true, thumbnailUrl: true } } } },
    _count: { select: { sessions: true, collections: true } },
  } as const;
}

export async function listStudioPortfolios(input: { workspaceId: string; status?: StudioPortfolioStatus | 'all' }) {
  const status = input.status && input.status !== 'all' ? normalizeStudioPortfolioStatus(input.status) : null;
  const portfolios = await prisma.studioPortfolio.findMany({
    where: {
      workspaceId: input.workspaceId,
      ...(status ? { status } : {}),
    },
    include: makePortfolioInclude(),
    orderBy: [{ updatedAt: 'desc' }],
  });

  return portfolios.map(toStudioPortfolioSummary);
}

export async function createStudioPortfolio(input: { workspaceId: string; characterId: string; name?: unknown; description?: unknown }) {
  const [workspaceExists, character] = await Promise.all([
    assertWorkspace(input.workspaceId),
    prisma.character.findFirst({ where: { id: input.characterId, deletedAt: null }, select: { id: true, name: true } }),
  ]);
  if (!workspaceExists) return { error: 'Workspace not found' as const };
  if (!character) return { error: 'Character not found' as const };

  const portfolio = await prisma.studioPortfolio.create({
    data: {
      workspaceId: input.workspaceId,
      characterId: character.id,
      name: readOptionalString(input.name) || `${character.name || 'Character'} Portfolio`,
      description: readOptionalString(input.description) ?? '',
    },
    include: makePortfolioInclude(),
  });

  return { portfolio: toStudioPortfolioSummary(portfolio) };
}

export async function getStudioPortfolio(portfolioId: string) {
  const portfolio = await prisma.studioPortfolio.findUnique({
    where: { id: portfolioId },
    include: makePortfolioInclude(),
  });
  if (!portfolio) return null;
  const [sessions, collections] = await Promise.all([
    listStudioPhotoSessions({ portfolioId }),
    listStudioCollections({ portfolioId }),
  ]);
  return { portfolio: toStudioPortfolioSummary(portfolio), sessions, collections };
}

export async function updateStudioPortfolio(portfolioId: string, input: { name?: unknown; description?: unknown; status?: unknown; coverCollectionItemId?: unknown }) {
  const existing = await prisma.studioPortfolio.findUnique({ where: { id: portfolioId }, select: { id: true } });
  if (!existing) return null;
  const data: { name?: string; description?: string; status?: StudioPortfolioStatus; coverCollectionItemId?: string | null } = {};
  const name = readOptionalString(input.name);
  const description = readOptionalString(input.description);
  if (name) data.name = name;
  if (description !== undefined) data.description = description;
  if (input.status !== undefined) data.status = normalizeStudioPortfolioStatus(input.status);
  if (input.coverCollectionItemId !== undefined) {
    const coverCollectionItemId = readNullableString(input.coverCollectionItemId);
    if (!coverCollectionItemId) {
      data.coverCollectionItemId = null;
    } else {
      const item = await prisma.studioCollectionItem.findFirst({ where: { id: coverCollectionItemId, portfolioId }, select: { id: true } });
      if (!item) return { error: 'Cover item not found in this portfolio' as const };
      data.coverCollectionItemId = item.id;
    }
  }

  const portfolio = await prisma.studioPortfolio.update({ where: { id: portfolioId }, data, include: makePortfolioInclude() });
  return toStudioPortfolioSummary(portfolio);
}

function makePhotoSessionInclude() {
  return { _count: { select: { runs: true } } } as const;
}

export async function listStudioPhotoSessions(input: { portfolioId: string; status?: StudioPhotoSessionStatus | 'all' }) {
  const status = input.status && input.status !== 'all' ? normalizeStudioPhotoSessionStatus(input.status) : null;
  const sessions = await prisma.studioPhotoSession.findMany({
    where: { portfolioId: input.portfolioId, ...(status ? { status } : {}) },
    include: makePhotoSessionInclude(),
    orderBy: [{ updatedAt: 'desc' }],
  });
  return sessions.map(toStudioPhotoSessionSummary);
}

export async function createStudioPhotoSession(portfolioId: string, input: Record<string, unknown>) {
  const portfolio = await prisma.studioPortfolio.findUnique({ where: { id: portfolioId }, select: { id: true, workspaceId: true } });
  if (!portfolio) return null;
  const name = readOptionalString(input.name);
  const session = await prisma.studioPhotoSession.create({
    data: {
      workspaceId: portfolio.workspaceId,
      portfolioId: portfolio.id,
      name: name || 'Untitled session',
      settingText: readOptionalString(input.settingText) ?? '',
      lightingText: readOptionalString(input.lightingText) ?? '',
      vibeText: readOptionalString(input.vibeText) ?? '',
      outfitText: readOptionalString(input.outfitText) ?? '',
      hairstyleText: readOptionalString(input.hairstyleText) ?? '',
      negativePrompt: readOptionalString(input.negativePrompt) ?? '',
      notes: readOptionalString(input.notes) ?? '',
    },
    include: makePhotoSessionInclude(),
  });
  return toStudioPhotoSessionSummary(session);
}

export async function getStudioPhotoSession(sessionId: string) {
  const session = await prisma.studioPhotoSession.findUnique({ where: { id: sessionId }, include: makePhotoSessionInclude() });
  if (!session) return null;
  const [portfolio, runs] = await Promise.all([
    prisma.studioPortfolio.findUnique({ where: { id: session.portfolioId }, include: makePortfolioInclude() }),
    listStudioPhotoSessionRuns(sessionId),
  ]);
  return {
    session: toStudioPhotoSessionSummary(session),
    portfolio: portfolio ? toStudioPortfolioSummary(portfolio) : null,
    runs,
  };
}

export async function updateStudioPhotoSession(sessionId: string, input: Record<string, unknown>) {
  const existing = await prisma.studioPhotoSession.findUnique({ where: { id: sessionId }, select: { id: true } });
  if (!existing) return null;
  const data: Record<string, string> = {};
  for (const key of ['name', 'settingText', 'lightingText', 'vibeText', 'outfitText', 'hairstyleText', 'negativePrompt', 'notes']) {
    if (input[key] !== undefined) data[key] = readOptionalString(input[key]) ?? '';
  }
  if (input.status !== undefined) data.status = normalizeStudioPhotoSessionStatus(input.status);
  const session = await prisma.studioPhotoSession.update({ where: { id: sessionId }, data, include: makePhotoSessionInclude() });
  return toStudioPhotoSessionSummary(session);
}

export async function deleteStudioPhotoSession(sessionId: string) {
  const existing = await prisma.studioPhotoSession.findUnique({ where: { id: sessionId }, select: { id: true } });
  if (!existing) return null;
  await prisma.$transaction(async (tx) => {
    await tx.studioSessionRun.deleteMany({ where: { photoSessionId: sessionId } });
    await tx.studioPhotoSession.delete({ where: { id: sessionId } });
  });
  return { id: sessionId };
}

export async function listStudioPhotoSessionRuns(photoSessionId: string) {
  const runs = await prisma.studioSessionRun.findMany({
    where: { photoSessionId },
    orderBy: [{ updatedAt: 'desc' }],
  });
  return runs.map(toStudioSessionRunSummary);
}

export async function createStudioPhotoSessionRun(photoSessionId: string, input: Record<string, unknown>) {
  const session = await prisma.studioPhotoSession.findUnique({
    where: { id: photoSessionId },
    include: { portfolio: { include: { character: true } } },
  });
  if (!session) return { error: 'Session not found' as const };

  const draft = readRunSettingsDraft(input);
  if (!draft.poseSetId) return { error: 'poseSetId is required' as const };
  const poseSet = getStudioPoseSetById(draft.poseSetId);
  if (!poseSet) return { error: 'Pose set not found' as const };

  const library = getStudioSessionPoseLibrary();
  const categoryRules = [{
    category: poseSet.category,
    count: draft.count,
    includedPoseIds: poseSet.poseIds,
    excludedPoseIds: [],
    preferredOrientation: null,
    preferredFraming: null,
    fixedPoseIds: [],
    weighting: null,
    futureOverrideConfig: null,
  }];
  const canonicalState = createStudioSessionSavedStateFromDraft(normalizeStudioSessionTemplateDraftState({
    name: draft.name || poseSet.name,
    characterId: session.portfolio.characterId,
    characterAge: '',
    environmentText: [session.settingText, session.lightingText, session.vibeText].filter(Boolean).join(', '),
    outfitText: session.outfitText,
    hairstyleText: session.hairstyleText,
    positivePrompt: draft.positivePromptOverride,
    negativePrompt: [session.negativePrompt, draft.negativePromptOverride].filter(Boolean).join(', '),
    generationSettings: draft.generationSettings,
    resolutionPolicy: draft.resolutionPolicy,
    categoryRules,
  }));
  const slots = buildStudioRunShotSlotsFromPoseSet({ poseSetId: poseSet.id, count: draft.count });

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.studioSessionRun.create({
      data: {
        workspaceId: session.workspaceId,
        portfolioId: session.portfolioId,
        photoSessionId: session.id,
        poseSetId: poseSet.id,
        name: draft.name || poseSet.name,
        runSettingsJson: JSON.stringify(draft.generationSettings),
        promptOverrideJson: JSON.stringify({ positivePromptOverride: draft.positivePromptOverride, negativePromptOverride: draft.negativePromptOverride }),
        resolutionPolicyJson: JSON.stringify(draft.resolutionPolicy),
        count: draft.count,
        templateId: null,
        templateNameSnapshot: '',
        templateSnapshotJson: JSON.stringify({
          ...canonicalState,
          characterPrompt: '',
          portfolioId: session.portfolioId,
          photoSessionId: session.id,
          poseSetId: poseSet.id,
          poseSetName: poseSet.name,
          templateId: null,
          templateName: draft.name || poseSet.name,
        }),
        poseLibraryVersion: library.version,
        poseLibraryHash: library.hash,
        status: slots.length > 0 ? 'draft' : 'completed',
      },
    });
    if (slots.length > 0) {
      await tx.studioSessionShot.createMany({
        data: slots.map((slot) => ({
          workspaceId: session.workspaceId,
          runId: created.id,
          category: slot.category,
          slotIndex: slot.slotIndex,
          label: slot.label,
          status: 'unassigned',
          skipped: false,
          autoAssignmentHistoryJson: '[]',
        })),
      });
    }
    return created;
  });

  return { run: toStudioSessionRunSummary(run) };
}

export async function updateStudioRun(runId: string, input: Record<string, unknown>) {
  const run = await prisma.studioSessionRun.findUnique({ where: { id: runId } });
  if (!run) return { error: 'Run not found' as const };
  const activeShots = await prisma.studioSessionShot.count({ where: { runId, status: { in: ['queued', 'running'] } } });
  if (activeShots > 0) return { error: 'Cannot update a run while jobs are active' as const };

  const draft = readRunSettingsDraft({
    name: input.name ?? run.name,
    poseSetId: input.poseSetId ?? run.poseSetId,
    count: input.count ?? run.count,
    positivePromptOverride: input.positivePromptOverride,
    negativePromptOverride: input.negativePromptOverride,
    generationSettings: input.generationSettings ?? JSON.parse(run.runSettingsJson || '{}'),
    resolutionPolicy: input.resolutionPolicy ?? JSON.parse(run.resolutionPolicyJson || '{}'),
  });
  if (draft.poseSetId && !getStudioPoseSetById(draft.poseSetId)) return { error: 'Pose set not found' as const };

  const updated = await prisma.studioSessionRun.update({
    where: { id: runId },
    data: {
      name: draft.name,
      poseSetId: draft.poseSetId,
      count: draft.count,
      runSettingsJson: JSON.stringify(draft.generationSettings),
      promptOverrideJson: JSON.stringify({ positivePromptOverride: draft.positivePromptOverride, negativePromptOverride: draft.negativePromptOverride }),
      resolutionPolicyJson: JSON.stringify(draft.resolutionPolicy),
    },
  });
  return { run: toStudioSessionRunSummary(updated) };
}

export async function updateStudioVersionReview(input: { versionId: string; reviewState: StudioSessionVersionReviewState; reviewNote?: string }) {
  const state = normalizeStudioSessionVersionReviewState(input.reviewState);
  const version = await prisma.studioSessionShotVersion.findUnique({ where: { id: input.versionId } });
  if (!version) return null;
  const updated = await prisma.studioSessionShotVersion.update({
    where: { id: input.versionId },
    data: {
      reviewState: state,
      reviewNote: input.reviewNote ?? version.reviewNote ?? '',
      reviewedAt: new Date(),
      rejected: state === 'reject' ? true : version.rejected,
    },
  });
  return toStudioSessionShotVersionSummary(updated);
}

function makeCollectionInclude() {
  return { _count: { select: { items: true } } } as const;
}

export async function listStudioCollections(input: { portfolioId: string; status?: StudioCollectionStatus | 'all' }) {
  const status = input.status && input.status !== 'all' ? normalizeStudioCollectionStatus(input.status) : null;
  const collections = await prisma.studioCollection.findMany({
    where: { portfolioId: input.portfolioId, ...(status ? { status } : {}) },
    include: makeCollectionInclude(),
    orderBy: [{ updatedAt: 'desc' }],
  });
  return collections.map(toStudioCollectionSummary);
}

export async function createStudioCollection(portfolioId: string, input: Record<string, unknown>) {
  const portfolio = await prisma.studioPortfolio.findUnique({ where: { id: portfolioId }, select: { id: true, workspaceId: true } });
  if (!portfolio) return null;
  const collection = await prisma.studioCollection.create({
    data: {
      workspaceId: portfolio.workspaceId,
      portfolioId: portfolio.id,
      name: readOptionalString(input.name) || 'Untitled collection',
      description: readOptionalString(input.description) ?? '',
      status: input.status === 'final' ? 'final' : 'draft',
    },
    include: makeCollectionInclude(),
  });
  return toStudioCollectionSummary(collection);
}

export async function getStudioCollection(collectionId: string) {
  const collection = await prisma.studioCollection.findUnique({ where: { id: collectionId }, include: makeCollectionInclude() });
  if (!collection) return null;
  const items = await prisma.studioCollectionItem.findMany({
    where: { collectionId },
    include: { version: { select: { originalUrl: true, previewUrl: true, thumbnailUrl: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return { collection: toStudioCollectionSummary(collection), items: items.map(toStudioCollectionItemSummary) };
}

export async function updateStudioCollection(collectionId: string, input: Record<string, unknown>) {
  const existing = await prisma.studioCollection.findUnique({ where: { id: collectionId }, select: { id: true } });
  if (!existing) return null;
  const data: Record<string, string> = {};
  if (input.name !== undefined) data.name = readOptionalString(input.name) || 'Untitled collection';
  if (input.description !== undefined) data.description = readOptionalString(input.description) ?? '';
  if (input.status !== undefined) data.status = normalizeStudioCollectionStatus(input.status);
  const collection = await prisma.studioCollection.update({ where: { id: collectionId }, data, include: makeCollectionInclude() });
  return toStudioCollectionSummary(collection);
}

export async function addStudioCollectionItem(collectionId: string, input: Record<string, unknown>) {
  const versionId = readNullableString(input.versionId);
  if (!versionId) return { error: 'versionId is required' as const };
  const [collection, version] = await Promise.all([
    prisma.studioCollection.findUnique({ where: { id: collectionId } }),
    prisma.studioSessionShotVersion.findUnique({
      where: { id: versionId },
      include: { shot: { include: { run: true } } },
    }),
  ]);
  if (!collection) return { error: 'Collection not found' as const };
  if (!version || version.shot.run.portfolioId !== collection.portfolioId) return { error: 'Version not found in this portfolio' as const };

  const maxItem = await prisma.studioCollectionItem.findFirst({ where: { collectionId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
  const item = await prisma.studioCollectionItem.create({
    data: {
      workspaceId: collection.workspaceId,
      collectionId: collection.id,
      portfolioId: collection.portfolioId,
      photoSessionId: version.shot.run.photoSessionId,
      runId: version.shot.runId,
      shotId: version.shotId,
      versionId: version.id,
      sortOrder: (maxItem?.sortOrder ?? -1) + 1,
      caption: readOptionalString(input.caption) ?? '',
    },
    include: { version: { select: { originalUrl: true, previewUrl: true, thumbnailUrl: true } } },
  });
  return { item: toStudioCollectionItemSummary(item) };
}

export async function reorderStudioCollectionItems(collectionId: string, itemIds: unknown) {
  if (!Array.isArray(itemIds) || itemIds.some((item) => typeof item !== 'string')) return { error: 'itemIds array is required' as const };
  await prisma.$transaction(itemIds.map((id, index) => prisma.studioCollectionItem.update({ where: { id }, data: { sortOrder: index } })));
  return getStudioCollection(collectionId);
}

export async function deleteStudioCollectionItem(collectionId: string, itemId: string) {
  const item = await prisma.studioCollectionItem.findFirst({ where: { id: itemId, collectionId }, select: { id: true } });
  if (!item) return null;
  await prisma.studioCollectionItem.delete({ where: { id: itemId } });
  return { id: itemId };
}
