import { prisma } from '@/lib/prisma';
import { getStudioSessionPoseLibrary } from './poseLibrary';
import type {
  StudioPoseCameraAngle,
  StudioPoseCategorySummary,
  StudioPoseLibrarySettingsSummary,
  StudioPosePreviewCandidateSummary,
  StudioPoseShotDistance,
  StudioPoseSummary,
  StudioSessionPoseFraming,
  StudioSessionPoseOrientation,
} from './types';

const ORIENTATIONS = new Set<StudioSessionPoseOrientation>(['portrait', 'landscape', 'square']);
const FRAMINGS = new Set<StudioSessionPoseFraming>(['closeup', 'portrait', 'half_body', 'three_quarter', 'full_body']);
const CAMERA_ANGLES = new Set<StudioPoseCameraAngle>(['front', 'three_quarter', 'side', 'back', 'high', 'low']);
const SHOT_DISTANCES = new Set<StudioPoseShotDistance>(['close', 'medium', 'wide']);

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => readString(item)).filter(Boolean)));
}

function slugify(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function normalizeOrientation(value: unknown): StudioSessionPoseOrientation {
  return typeof value === 'string' && ORIENTATIONS.has(value as StudioSessionPoseOrientation) ? value as StudioSessionPoseOrientation : 'portrait';
}

function normalizeFraming(value: unknown): StudioSessionPoseFraming {
  if (typeof value !== 'string') return 'full_body';
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (normalized === 'three_quarter_body') return 'three_quarter';
  if (normalized === 'upper_body') return 'half_body';
  return FRAMINGS.has(normalized as StudioSessionPoseFraming) ? normalized as StudioSessionPoseFraming : 'full_body';
}

function normalizeCameraAngle(value: unknown): StudioPoseCameraAngle {
  return typeof value === 'string' && CAMERA_ANGLES.has(value as StudioPoseCameraAngle) ? value as StudioPoseCameraAngle : 'front';
}

function normalizeShotDistance(value: unknown): StudioPoseShotDistance {
  return typeof value === 'string' && SHOT_DISTANCES.has(value as StudioPoseShotDistance) ? value as StudioPoseShotDistance : 'wide';
}

async function uniqueSlug(input: { workspaceId: string; categoryId?: string; base: string; kind: 'category' | 'pose'; excludeId?: string }) {
  const base = slugify(input.base, input.kind);
  for (let index = 0; index < 500; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const existing = input.kind === 'category'
      ? await prisma.studioPoseCategory.findFirst({ where: { workspaceId: input.workspaceId, slug: candidate, ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}) }, select: { id: true } })
      : await prisma.studioPose.findFirst({ where: { workspaceId: input.workspaceId, categoryId: input.categoryId, slug: candidate, ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}) }, select: { id: true } });
    if (!existing) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function toPreviewCandidateSummary(record: any): StudioPosePreviewCandidateSummary {
  return {
    id: record.id,
    poseId: record.poseId,
    sourceJobId: record.sourceJobId ?? null,
    assetUrl: record.assetUrl,
    thumbnailUrl: record.thumbnailUrl ?? null,
    promptSnapshot: parseJson(record.promptSnapshotJson, {}),
    settingsSnapshot: parseJson(record.settingsSnapshotJson, {}),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function resolvePrimaryPreview(record: any): { id: string | null; url: string | null } {
  const candidates = Array.isArray(record.previewCandidates) ? record.previewCandidates : [];
  const primary = candidates.find((candidate: any) => candidate.id === record.primaryPreviewId) ?? candidates[0] ?? null;
  return { id: primary?.id ?? null, url: primary?.thumbnailUrl || primary?.assetUrl || null };
}

export function toStudioPoseSummary(record: any, includeCandidates = false): StudioPoseSummary {
  const primary = resolvePrimaryPreview(record);
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    categoryId: record.categoryId,
    categoryName: record.category?.name ?? 'Uncategorized',
    title: record.title,
    tags: parseJson(record.tagsJson, []),
    posePrompt: record.posePrompt,
    orientation: normalizeOrientation(record.orientation),
    framing: normalizeFraming(record.framing),
    cameraAngle: normalizeCameraAngle(record.cameraAngle),
    shotDistance: normalizeShotDistance(record.shotDistance),
    sortOrder: record.sortOrder,
    primaryPreviewId: primary.id,
    primaryPreviewUrl: primary.url,
    previewCandidates: includeCandidates ? (record.previewCandidates ?? []).map(toPreviewCandidateSummary) : undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toStudioPoseCategorySummary(record: any): StudioPoseCategorySummary {
  const poses = Array.isArray(record.poses) ? record.poses : [];
  const coverPose = poses.find((pose: any) => pose.id === record.coverPoseId) ?? poses.find((pose: any) => resolvePrimaryPreview(pose).url) ?? null;
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    name: record.name,
    description: record.description,
    sortOrder: record.sortOrder,
    coverPoseId: record.coverPoseId ?? null,
    coverImageUrl: coverPose ? resolvePrimaryPreview(coverPose).url : null,
    poseCount: typeof record._count?.poses === 'number' ? record._count.poses : poses.length,
    missingPreviewCount: poses.filter((pose: any) => !resolvePrimaryPreview(pose).url).length,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toSettingsSummary(record: any): StudioPoseLibrarySettingsSummary {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    subjectDescription: record.subjectDescription,
    clothingDescription: record.clothingDescription,
    backgroundDescription: record.backgroundDescription,
    stylePreset: record.stylePreset,
    defaultVariantCount: record.defaultVariantCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function ensureStudioPoseLibrarySettings(workspaceId: string) {
  const record = await prisma.studioPoseLibrarySettings.upsert({
    where: { workspaceId },
    update: {},
    create: { workspaceId },
  });
  return toSettingsSummary(record);
}

export async function ensureStudioPoseLibrarySeeded(workspaceId: string) {
  const existing = await prisma.studioPoseCategory.count({ where: { workspaceId } });
  if (existing > 0) {
    await ensureStudioPoseLibrarySettings(workspaceId);
    return;
  }

  const library = getStudioSessionPoseLibrary();
  await prisma.$transaction(async (tx) => {
    await tx.studioPoseLibrarySettings.upsert({ where: { workspaceId }, update: {}, create: { workspaceId } });
    for (const [categoryIndex, category] of library.categories.entries()) {
      const categoryRecord = await tx.studioPoseCategory.create({
        data: {
          workspaceId,
          slug: slugify(category, `category-${categoryIndex + 1}`),
          name: category.split(/[_\s-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
          description: `${category} poses from the Studio pose library.`,
          sortOrder: categoryIndex,
        },
      });
      const poses = library.poses.filter((pose) => pose.category === category);
      for (const [poseIndex, pose] of poses.entries()) {
        await tx.studioPose.create({
          data: {
            workspaceId,
            categoryId: categoryRecord.id,
            slug: slugify(pose.id || pose.name, `pose-${poseIndex + 1}`),
            title: pose.name,
            tagsJson: JSON.stringify([category]),
            posePrompt: pose.prompt,
            orientation: pose.orientation,
            framing: pose.framing,
            cameraAngle: pose.cameraAngle ?? 'front',
            shotDistance: pose.shotDistance ?? 'wide',
            sortOrder: poseIndex,
          },
        });
      }
    }
  });
}

export async function listStudioPoseCategories(workspaceId: string) {
  await ensureStudioPoseLibrarySeeded(workspaceId);
  const categories = await prisma.studioPoseCategory.findMany({
    where: { workspaceId },
    include: {
      _count: { select: { poses: true } },
      poses: { include: { previewCandidates: { orderBy: { createdAt: 'desc' } } }, orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return categories.map(toStudioPoseCategorySummary);
}

export async function listStudioPoses(input: { workspaceId: string; categoryId?: string | null; query?: string | null; orientation?: string | null; framing?: string | null; cameraAngle?: string | null; preview?: 'has' | 'missing' | null }) {
  await ensureStudioPoseLibrarySeeded(input.workspaceId);
  const poses = await prisma.studioPose.findMany({
    where: {
      workspaceId: input.workspaceId,
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    },
    include: { category: true, previewCandidates: { orderBy: { createdAt: 'desc' } } },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  });
  const query = input.query?.trim().toLowerCase();
  return poses
    .map((pose) => toStudioPoseSummary(pose))
    .filter((pose) => !query || [pose.title, pose.posePrompt, pose.tags.join(' ')].join(' ').toLowerCase().includes(query))
    .filter((pose) => !input.orientation || pose.orientation === input.orientation)
    .filter((pose) => !input.framing || pose.framing === input.framing)
    .filter((pose) => !input.cameraAngle || pose.cameraAngle === input.cameraAngle)
    .filter((pose) => input.preview === 'has' ? Boolean(pose.primaryPreviewUrl) : input.preview === 'missing' ? !pose.primaryPreviewUrl : true);
}

export async function getStudioPoseCategory(categoryId: string) {
  const category = await prisma.studioPoseCategory.findUnique({
    where: { id: categoryId },
    include: {
      _count: { select: { poses: true } },
      poses: { include: { previewCandidates: { orderBy: { createdAt: 'desc' } } }, orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] },
    },
  });
  return category ? toStudioPoseCategorySummary(category) : null;
}

export async function getStudioPose(poseId: string) {
  const pose = await prisma.studioPose.findUnique({ where: { id: poseId }, include: { category: true, previewCandidates: { orderBy: { createdAt: 'desc' } } } });
  return pose ? toStudioPoseSummary(pose, true) : null;
}

export async function createStudioPoseCategory(workspaceId: string, input: Record<string, unknown>) {
  await ensureStudioPoseLibrarySeeded(workspaceId);
  const name = readString(input.name, 'New category') || 'New category';
  const count = await prisma.studioPoseCategory.count({ where: { workspaceId } });
  const category = await prisma.studioPoseCategory.create({
    data: {
      workspaceId,
      slug: await uniqueSlug({ workspaceId, base: name, kind: 'category' }),
      name,
      description: readString(input.description),
      sortOrder: typeof input.sortOrder === 'number' ? Math.floor(input.sortOrder) : count,
    },
    include: { _count: { select: { poses: true } }, poses: { include: { previewCandidates: true } } },
  });
  return toStudioPoseCategorySummary(category);
}

export async function updateStudioPoseCategory(categoryId: string, input: Record<string, unknown>) {
  const existing = await prisma.studioPoseCategory.findUnique({ where: { id: categoryId }, select: { id: true, workspaceId: true, name: true } });
  if (!existing) return null;
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = readString(input.name, existing.name) || existing.name;
    data.name = name;
    data.slug = await uniqueSlug({ workspaceId: existing.workspaceId, base: name, kind: 'category', excludeId: existing.id });
  }
  if (input.description !== undefined) data.description = readString(input.description);
  if (typeof input.sortOrder === 'number') data.sortOrder = Math.floor(input.sortOrder);
  if (input.coverPoseId !== undefined) data.coverPoseId = readString(input.coverPoseId) || null;
  const category = await prisma.studioPoseCategory.update({ where: { id: categoryId }, data, include: { _count: { select: { poses: true } }, poses: { include: { previewCandidates: true } } } });
  return toStudioPoseCategorySummary(category);
}

export async function deleteStudioPoseCategory(categoryId: string) {
  const existing = await prisma.studioPoseCategory.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!existing) return null;
  await prisma.studioPoseCategory.delete({ where: { id: categoryId } });
  return { id: categoryId };
}

export async function createStudioPose(workspaceId: string, input: Record<string, unknown>) {
  const categoryId = readString(input.categoryId);
  const category = await prisma.studioPoseCategory.findFirst({ where: { id: categoryId, workspaceId }, select: { id: true } });
  if (!category) return { error: 'Category not found' as const };
  const title = readString(input.title, 'New pose') || 'New pose';
  const count = await prisma.studioPose.count({ where: { workspaceId, categoryId } });
  const pose = await prisma.studioPose.create({
    data: {
      workspaceId,
      categoryId,
      slug: await uniqueSlug({ workspaceId, categoryId, base: title, kind: 'pose' }),
      title,
      tagsJson: JSON.stringify(readTags(input.tags)),
      posePrompt: readString(input.posePrompt),
      orientation: normalizeOrientation(input.orientation),
      framing: normalizeFraming(input.framing),
      cameraAngle: normalizeCameraAngle(input.cameraAngle),
      shotDistance: normalizeShotDistance(input.shotDistance),
      sortOrder: typeof input.sortOrder === 'number' ? Math.floor(input.sortOrder) : count,
    },
    include: { category: true, previewCandidates: true },
  });
  return { pose: toStudioPoseSummary(pose, true) };
}

export async function updateStudioPose(poseId: string, input: Record<string, unknown>) {
  const existing = await prisma.studioPose.findUnique({ where: { id: poseId }, include: { previewCandidates: true } });
  if (!existing) return null;
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = readString(input.title, existing.title) || existing.title;
    data.title = title;
    data.slug = await uniqueSlug({ workspaceId: existing.workspaceId, categoryId: existing.categoryId, base: title, kind: 'pose', excludeId: existing.id });
  }
  if (input.tags !== undefined) data.tagsJson = JSON.stringify(readTags(input.tags));
  if (input.categoryId !== undefined) {
    const categoryId = readString(input.categoryId);
    const category = await prisma.studioPoseCategory.findFirst({ where: { id: categoryId, workspaceId: existing.workspaceId }, select: { id: true } });
    if (!category) return { error: 'Category not found' as const };
    data.categoryId = categoryId;
  }
  const semanticChanged = input.posePrompt !== undefined || input.orientation !== undefined || input.framing !== undefined || input.cameraAngle !== undefined || input.shotDistance !== undefined;
  if (input.posePrompt !== undefined) data.posePrompt = readString(input.posePrompt);
  if (input.orientation !== undefined) data.orientation = normalizeOrientation(input.orientation);
  if (input.framing !== undefined) data.framing = normalizeFraming(input.framing);
  if (input.cameraAngle !== undefined) data.cameraAngle = normalizeCameraAngle(input.cameraAngle);
  if (input.shotDistance !== undefined) data.shotDistance = normalizeShotDistance(input.shotDistance);
  if (typeof input.sortOrder === 'number') data.sortOrder = Math.floor(input.sortOrder);
  if (semanticChanged) data.primaryPreviewId = null;

  const pose = await prisma.$transaction(async (tx) => {
    if (semanticChanged) await tx.studioPosePreviewCandidate.deleteMany({ where: { poseId } });
    return tx.studioPose.update({ where: { id: poseId }, data, include: { category: true, previewCandidates: { orderBy: { createdAt: 'desc' } } } });
  });
  return toStudioPoseSummary(pose, true);
}

export async function deleteStudioPose(poseId: string) {
  const existing = await prisma.studioPose.findUnique({ where: { id: poseId }, select: { id: true } });
  if (!existing) return null;
  await prisma.studioPose.delete({ where: { id: poseId } });
  return { id: poseId };
}

export async function duplicateStudioPose(poseId: string, input: Record<string, unknown> = {}) {
  const existing = await prisma.studioPose.findUnique({ where: { id: poseId }, include: { category: true } });
  if (!existing) return null;
  const targetCategoryId = readString(input.categoryId, existing.categoryId) || existing.categoryId;
  const category = await prisma.studioPoseCategory.findFirst({ where: { id: targetCategoryId, workspaceId: existing.workspaceId }, select: { id: true } });
  if (!category) return { error: 'Category not found' as const };
  const count = await prisma.studioPose.count({ where: { workspaceId: existing.workspaceId, categoryId: targetCategoryId } });
  const title = readString(input.title, `${existing.title} copy`) || `${existing.title} copy`;
  const pose = await prisma.studioPose.create({
    data: {
      workspaceId: existing.workspaceId,
      categoryId: targetCategoryId,
      slug: await uniqueSlug({ workspaceId: existing.workspaceId, categoryId: targetCategoryId, base: title, kind: 'pose' }),
      title,
      tagsJson: existing.tagsJson,
      posePrompt: existing.posePrompt,
      orientation: existing.orientation,
      framing: existing.framing,
      cameraAngle: existing.cameraAngle,
      shotDistance: existing.shotDistance,
      sortOrder: count,
    },
    include: { category: true, previewCandidates: true },
  });
  return { pose: toStudioPoseSummary(pose, true) };
}

export async function reorderStudioPoseCategories(workspaceId: string, ids: string[]) {
  await prisma.$transaction(ids.map((id, sortOrder) => prisma.studioPoseCategory.updateMany({ where: { id, workspaceId }, data: { sortOrder } })));
  return listStudioPoseCategories(workspaceId);
}

export async function reorderStudioPoses(workspaceId: string, categoryId: string, ids: string[]) {
  await prisma.$transaction(ids.map((id, sortOrder) => prisma.studioPose.updateMany({ where: { id, workspaceId, categoryId }, data: { sortOrder } })));
  return listStudioPoses({ workspaceId, categoryId });
}

export async function updateStudioPoseLibrarySettings(workspaceId: string, input: Record<string, unknown>) {
  const settings = await prisma.studioPoseLibrarySettings.upsert({
    where: { workspaceId },
    update: {
      ...(input.subjectDescription !== undefined ? { subjectDescription: readString(input.subjectDescription, 'adult neutral model') } : {}),
      ...(input.clothingDescription !== undefined ? { clothingDescription: readString(input.clothingDescription, 'simple fitted neutral clothing') } : {}),
      ...(input.backgroundDescription !== undefined ? { backgroundDescription: readString(input.backgroundDescription, 'neutral seamless studio background') } : {}),
      ...(input.stylePreset !== undefined ? { stylePreset: readString(input.stylePreset, 'realistic studio photo, softbox lighting') } : {}),
      ...(typeof input.defaultVariantCount === 'number' ? { defaultVariantCount: Math.max(1, Math.min(8, Math.floor(input.defaultVariantCount))) } : {}),
    },
    create: { workspaceId },
  });
  return toSettingsSummary(settings);
}

export function buildStudioPosePreviewPrompt(input: { pose: StudioPoseSummary; settings: StudioPoseLibrarySettingsSummary }) {
  return [
    input.settings.stylePreset,
    `Subject: ${input.settings.subjectDescription}`,
    `Wardrobe: ${input.settings.clothingDescription}`,
    `Background: ${input.settings.backgroundDescription}`,
    `Orientation: ${input.pose.orientation}`,
    `Framing: ${input.pose.framing}`,
    `Camera angle: ${input.pose.cameraAngle}`,
    `Shot distance: ${input.pose.shotDistance}`,
    `Pose: ${input.pose.posePrompt}`,
  ].filter((part) => part.trim()).join('\n');
}

export async function setStudioPosePrimaryPreview(candidateId: string) {
  const candidate = await prisma.studioPosePreviewCandidate.findUnique({ where: { id: candidateId }, select: { id: true, poseId: true } });
  if (!candidate) return null;
  const pose = await prisma.studioPose.update({ where: { id: candidate.poseId }, data: { primaryPreviewId: candidate.id }, include: { category: true, previewCandidates: { orderBy: { createdAt: 'desc' } } } });
  return toStudioPoseSummary(pose, true);
}

export async function deleteStudioPosePreviewCandidate(candidateId: string) {
  const candidate = await prisma.studioPosePreviewCandidate.findUnique({ where: { id: candidateId }, include: { pose: true } });
  if (!candidate) return null;
  await prisma.$transaction(async (tx) => {
    await tx.studioPosePreviewCandidate.delete({ where: { id: candidateId } });
    if (candidate.pose.primaryPreviewId === candidateId) await tx.studioPose.update({ where: { id: candidate.poseId }, data: { primaryPreviewId: null } });
  });
  return { id: candidateId, poseId: candidate.poseId };
}
