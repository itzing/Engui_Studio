import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
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
  StudioSessionAutoPickResult,
  StudioSessionPoseSnapshot,
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
  return { id: primary?.id ?? null, url: primary?.assetUrl || primary?.thumbnailUrl || null };
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
    openPose: {
      hasOpenPoseImage: typeof record.openPoseImageUrl === 'string' && record.openPoseImageUrl.trim().length > 0,
      hasKeypoints: typeof record.poseKeypointEncryptedJson === 'string' && record.poseKeypointEncryptedJson.trim().length > 0,
      imageUrl: typeof record.openPoseImageUrl === 'string' && record.openPoseImageUrl.trim() ? record.openPoseImageUrl : null,
      sourceImageUrl: typeof record.openPoseSourceImageUrl === 'string' && record.openPoseSourceImageUrl.trim() ? record.openPoseSourceImageUrl : null,
      sourceJobId: typeof record.openPoseSourceJobId === 'string' && record.openPoseSourceJobId.trim() ? record.openPoseSourceJobId : null,
      extractedAt: record.openPoseExtractedAt instanceof Date ? record.openPoseExtractedAt.toISOString() : null,
    },
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
  const candidates = await prisma.studioPosePreviewCandidate.findMany({ where: { pose: { categoryId } }, select: { assetUrl: true, thumbnailUrl: true } });
  await prisma.studioPoseCategory.delete({ where: { id: categoryId } });
  deletePreviewCandidateOutputs(candidates);
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
  if (input.posePrompt !== undefined || input.orientation !== undefined || input.cameraAngle !== undefined) {
    data.openPoseImageUrl = null;
    data.poseKeypointEncryptedJson = null;
    data.openPoseSourceImageUrl = null;
    data.openPoseSourceJobId = null;
    data.openPoseExtractedAt = null;
  }

  const staleCandidates = semanticChanged ? await prisma.studioPosePreviewCandidate.findMany({ where: { poseId }, select: { assetUrl: true, thumbnailUrl: true } }) : [];
  const pose = await prisma.$transaction(async (tx) => {
    if (semanticChanged) await tx.studioPosePreviewCandidate.deleteMany({ where: { poseId } });
    return tx.studioPose.update({ where: { id: poseId }, data, include: { category: true, previewCandidates: { orderBy: { createdAt: 'desc' } } } });
  });
  if (semanticChanged) deletePreviewCandidateOutputs(staleCandidates);
  return toStudioPoseSummary(pose, true);
}

export async function deleteStudioPose(poseId: string) {
  const existing = await prisma.studioPose.findUnique({ where: { id: poseId }, select: { id: true } });
  if (!existing) return null;
  const candidates = await prisma.studioPosePreviewCandidate.findMany({ where: { poseId }, select: { assetUrl: true, thumbnailUrl: true } });
  await prisma.studioPose.delete({ where: { id: poseId } });
  deletePreviewCandidateOutputs(candidates);
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
      openPoseImageUrl: existing.openPoseImageUrl,
      poseKeypointEncryptedJson: existing.poseKeypointEncryptedJson,
      openPoseSourceImageUrl: existing.openPoseSourceImageUrl,
      openPoseSourceJobId: existing.openPoseSourceJobId,
      openPoseExtractedAt: existing.openPoseExtractedAt,
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

function describeStudioPoseShotDistance(distance: StudioPoseShotDistance) {
  switch (distance) {
    case 'close':
      return 'Close shot: crop tightly around the face, shoulders, and upper chest; the body pose may be implied, with very little background or empty space.';
    case 'medium':
      return 'Medium shot: show the subject from roughly the waist or mid-thigh upward; the body fills most of the frame with moderate background space.';
    case 'wide':
    default:
      return 'Wide full-body shot: show the entire body from head to feet, including the stance, feet, and surrounding negative space; the subject should be smaller in frame than a medium shot.';
  }
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
    describeStudioPoseShotDistance(input.pose.shotDistance),
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
    if (candidate.pose.primaryPreviewId === candidateId) {
      const replacement = await tx.studioPosePreviewCandidate.findFirst({ where: { poseId: candidate.poseId, id: { not: candidateId } }, orderBy: { createdAt: 'desc' }, select: { id: true } });
      await tx.studioPose.update({ where: { id: candidate.poseId }, data: { primaryPreviewId: replacement?.id ?? null } });
    }
  });
  deletePreviewCandidateOutputs([{ assetUrl: candidate.assetUrl, thumbnailUrl: candidate.thumbnailUrl }]);
  return { id: candidateId, poseId: candidate.poseId };
}

function buildJobOutputUrls(job: { options?: unknown; resultUrl?: string | null }) {
  const options = typeof job.options === 'string'
    ? parseJson<Record<string, unknown>>(job.options, {})
    : (job.options && typeof job.options === 'object' ? job.options as Record<string, unknown> : {});
  const direct = [job.resultUrl, options.url, options.resultUrl, options.image, options.image_url, options.image_path, options.output_path, options.s3_path]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());
  const lists: string[] = [];
  for (const key of ['images', 'outputs', 'resultUrls'] as const) {
    const value = options[key];
    if (!Array.isArray(value)) continue;
    for (const item of value) if (typeof item === 'string' && item.trim()) lists.push(item.trim());
  }
  return Array.from(new Set([...direct, ...lists]));
}

function resolveLocalPathFromUrl(url: string): string | null {
  if (!url.startsWith('/')) return null;
  const normalized = url.split('?')[0];
  if (normalized.startsWith('/generations/') || normalized.startsWith('/results/')) return path.join(process.cwd(), 'public', normalized.replace(/^\//, ''));
  return null;
}

function deleteLocalPosePreviewOutput(url: string | null | undefined) {
  if (!url) return;
  const localPath = resolveLocalPathFromUrl(url);
  if (!localPath || !fs.existsSync(localPath)) return;
  const allowedRoot = path.join(process.cwd(), 'public', 'generations', 'studio-pose-library');
  const resolved = path.resolve(localPath);
  if (!resolved.startsWith(path.resolve(allowedRoot))) return;
  try {
    fs.unlinkSync(resolved);
    let dir = path.dirname(resolved);
    while (dir.startsWith(path.resolve(allowedRoot)) && dir !== path.resolve(allowedRoot)) {
      if (fs.readdirSync(dir).length > 0) break;
      fs.rmdirSync(dir);
      dir = path.dirname(dir);
    }
  } catch (error) {
    console.warn('Failed to delete local pose preview output:', error);
  }
}

function deletePreviewCandidateOutputs(candidates: Array<{ assetUrl: string; thumbnailUrl?: string | null }>) {
  for (const candidate of candidates) {
    deleteLocalPosePreviewOutput(candidate.assetUrl);
    if (candidate.thumbnailUrl && candidate.thumbnailUrl !== candidate.assetUrl) deleteLocalPosePreviewOutput(candidate.thumbnailUrl);
  }
}

function materializePosePreviewOutput(url: string, poseId: string, variant?: 'thumbnail' | 'openpose') {
  const localPath = resolveLocalPathFromUrl(url);
  if (!localPath || !fs.existsSync(localPath)) return url;
  try {
    const bytes = fs.readFileSync(localPath);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const ext = path.extname(url.split('?')[0]) || '.png';
    const dir = path.join(process.cwd(), 'public', 'generations', 'studio-pose-library', poseId);
    fs.mkdirSync(dir, { recursive: true });
    const suffix = variant === 'thumbnail' ? '--thumb' : variant === 'openpose' ? '--openpose' : '';
    const fileName = `${hash}${suffix}${ext}`;
    const dest = path.join(dir, fileName);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, bytes);
    return `/generations/studio-pose-library/${poseId}/${fileName}`;
  } catch (error) {
    console.warn('Studio pose preview materialization fallback: unable to copy output into pose library directory, using original output URL instead.', error);
    return url;
  }
}

export function toStudioSessionPoseSnapshot(pose: StudioPoseSummary): StudioSessionPoseSnapshot {
  return {
    id: pose.id,
    category: pose.categoryId,
    name: pose.title,
    prompt: pose.posePrompt,
    orientation: pose.orientation,
    framing: pose.framing,
    cameraAngle: pose.cameraAngle,
    shotDistance: pose.shotDistance,
    openPose: pose.openPose,
  };
}

function extractEncryptedPoseKeypoints(job: { options?: unknown }) {
  const options = typeof job.options === 'string'
    ? parseJson<Record<string, unknown>>(job.options, {})
    : (job.options && typeof job.options === 'object' ? job.options as Record<string, unknown> : {});
  const extraction = options.openPoseExtraction && typeof options.openPoseExtraction === 'object'
    ? options.openPoseExtraction as Record<string, unknown>
    : {};
  const candidates = [
    extraction.pose_keypoint_encrypted,
    extraction.poseKeypointEncrypted,
    options.pose_keypoint_encrypted,
    options.poseKeypointEncrypted,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') return JSON.stringify(candidate);
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

export async function clearStudioPoseOpenPoseData(poseId: string) {
  const pose = await prisma.studioPose.update({
    where: { id: poseId },
    data: {
      openPoseImageUrl: null,
      poseKeypointEncryptedJson: null,
      openPoseSourceImageUrl: null,
      openPoseSourceJobId: null,
      openPoseExtractedAt: null,
    },
    include: { category: true, previewCandidates: { orderBy: { createdAt: 'desc' } } },
  }).catch(() => null);
  return pose ? toStudioPoseSummary(pose, true) : null;
}

export async function queueStudioPoseOpenPoseExtraction(params: { poseId: string; jobId: string; sourceImageUrl: string }) {
  const pose = await prisma.studioPose.findUnique({ where: { id: params.poseId }, include: { category: true, previewCandidates: { orderBy: { createdAt: 'desc' } } } });
  if (!pose) throw new Error('Pose not found');
  return toStudioPoseSummary(pose, true);
}

export async function getStudioSessionPoseSnapshotById(workspaceId: string, poseId: string) {
  const pose = await prisma.studioPose.findFirst({ where: { id: poseId, workspaceId }, include: { category: true, previewCandidates: { orderBy: { createdAt: 'desc' } } } });
  return pose ? toStudioSessionPoseSnapshot(toStudioPoseSummary(pose)) : null;
}

export async function listStudioSessionPoseSnapshotsByCategory(workspaceId: string, categoryId: string) {
  const poses = await listStudioPoses({ workspaceId, categoryId });
  return poses.map(toStudioSessionPoseSnapshot);
}

export async function pickUniqueStudioPoseSnapshot(params: {
  workspaceId: string;
  category: string;
  autoAssignmentHistory?: string[];
  excludedPoseIds?: string[];
  includedPoseIds?: string[];
  preferredOrientation?: StudioSessionPoseOrientation | null;
  preferredFraming?: StudioSessionPoseFraming | null;
  rng?: () => number;
}): Promise<StudioSessionAutoPickResult> {
  const poses = await listStudioSessionPoseSnapshotsByCategory(params.workspaceId, params.category);
  const excluded = new Set([...(params.excludedPoseIds ?? []), ...(params.autoAssignmentHistory ?? [])]);
  const included = new Set(params.includedPoseIds ?? []);
  let available = poses.filter((pose) => !excluded.has(pose.id) && (included.size === 0 || included.has(pose.id)));
  if (available.length === 0 && (params.autoAssignmentHistory?.length ?? 0) > 0) {
    available = poses.filter((pose) => !(params.excludedPoseIds ?? []).includes(pose.id) && (included.size === 0 || included.has(pose.id)));
  }
  if (available.length === 0) return { pose: null, exhausted: true, exhaustedCategories: [params.category] };
  const scorePose = (pose: StudioSessionPoseSnapshot) => (params.preferredOrientation && pose.orientation === params.preferredOrientation ? 2 : 0)
    + (params.preferredFraming && pose.framing === params.preferredFraming ? 1 : 0);
  const bestScore = Math.max(...available.map(scorePose));
  const eligible = available.filter((pose) => scorePose(pose) === bestScore);
  const rng = params.rng ?? Math.random;
  const index = Math.min(eligible.length - 1, Math.max(0, Math.floor(rng() * eligible.length)));
  return { pose: eligible[index], exhausted: false, exhaustedCategories: [] };
}

export async function queueStudioPosePreviewGeneration(params: { poseId: string; jobId: string; promptSnapshot: string; settingsSnapshot: Record<string, unknown> }) {
  const pose = await prisma.studioPose.findUnique({ where: { id: params.poseId }, include: { category: true, previewCandidates: { orderBy: { createdAt: 'desc' } } } });
  if (!pose) throw new Error('Pose not found');
  await prisma.studioPose.update({ where: { id: params.poseId }, data: { primaryPreviewId: null } });
  return toStudioPoseSummary(pose, true);
}

export const studioPoseOpenPoseMaterializationHandler = {
  async materialize({ job, task, payload }: { job: any; task: any; payload: Record<string, unknown> }) {
    const pose = await prisma.studioPose.findUnique({ where: { id: task.targetId }, include: { category: true, previewCandidates: { orderBy: { createdAt: 'desc' } } } });
    if (!pose) return;
    const outputUrl = buildJobOutputUrls(job)[0];
    if (!outputUrl) throw new Error(`Completed OpenPose extraction job ${job.id} has no output URL`);
    const encryptedKeypoints = extractEncryptedPoseKeypoints(job);
    const openPoseImageUrl = materializePosePreviewOutput(outputUrl, task.targetId, 'openpose');
    await prisma.studioPose.update({
      where: { id: task.targetId },
      data: {
        openPoseImageUrl,
        poseKeypointEncryptedJson: encryptedKeypoints,
        openPoseSourceImageUrl: typeof payload.sourceImageUrl === 'string' && payload.sourceImageUrl.trim() ? payload.sourceImageUrl.trim() : null,
        openPoseSourceJobId: job.id,
        openPoseExtractedAt: new Date(),
      },
    });
  },

  async onSourceJobFailed({ task, sourceError }: { job: any; task: any; payload: Record<string, unknown>; sourceError: string }) {
    console.warn(`Studio pose OpenPose extraction failed for ${task.targetId}: ${sourceError}`);
  },
};

export const studioPosePreviewMaterializationHandler = {
  async materialize({ job, task, payload }: { job: any; task: any; payload: Record<string, unknown> }) {
    const pose = await prisma.studioPose.findUnique({ where: { id: task.targetId }, include: { category: true, previewCandidates: { orderBy: { createdAt: 'desc' } } } });
    if (!pose) return;
    const outputUrl = buildJobOutputUrls(job)[0];
    if (!outputUrl) throw new Error(`Completed pose preview job ${job.id} has no output URL`);
    const assetUrl = materializePosePreviewOutput(outputUrl, task.targetId);
    const thumbnailUrl = typeof job.thumbnailUrl === 'string' && job.thumbnailUrl.trim()
      ? materializePosePreviewOutput(job.thumbnailUrl.trim(), task.targetId, 'thumbnail')
      : assetUrl;
    const candidate = await prisma.studioPosePreviewCandidate.create({
      data: {
        workspaceId: pose.workspaceId,
        poseId: task.targetId,
        sourceJobId: job.id,
        assetUrl,
        thumbnailUrl,
        promptSnapshotJson: JSON.stringify({ prompt: typeof job.prompt === 'string' ? job.prompt : payload.promptSnapshot ?? null }),
        settingsSnapshotJson: JSON.stringify(payload.settingsSnapshot ?? {}),
      },
    });
    await prisma.studioPose.update({ where: { id: task.targetId }, data: { primaryPreviewId: candidate.id } });
  },

  async onSourceJobFailed({ task, sourceError }: { job: any; task: any; payload: Record<string, unknown>; sourceError: string }) {
    await prisma.studioPose.updateMany({ where: { id: task.targetId }, data: { primaryPreviewId: null } });
    console.warn(`Studio pose preview generation failed for ${task.targetId}: ${sourceError}`);
  },
};

export type StudioPoseLibraryExportPayload = {
  version: 1;
  exportedAt: string;
  categories: Array<{
    name: string;
    description: string;
    poses: Array<{
      title: string;
      tags: string[];
      posePrompt: string;
      orientation: StudioSessionPoseOrientation;
      framing: StudioSessionPoseFraming;
      cameraAngle: StudioPoseCameraAngle;
      shotDistance: StudioPoseShotDistance;
    }>;
  }>;
};

export async function exportStudioPoseLibrary(input: { workspaceId: string; categoryId?: string | null }): Promise<StudioPoseLibraryExportPayload> {
  await ensureStudioPoseLibrarySeeded(input.workspaceId);
  const categories = await prisma.studioPoseCategory.findMany({
    where: { workspaceId: input.workspaceId, ...(input.categoryId ? { id: input.categoryId } : {}) },
    include: { poses: { orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: categories.map((category) => ({
      name: category.name,
      description: category.description,
      poses: category.poses.map((pose) => ({
        title: pose.title,
        tags: parseJson<string[]>(pose.tagsJson, []),
        posePrompt: pose.posePrompt,
        orientation: normalizeOrientation(pose.orientation),
        framing: normalizeFraming(pose.framing),
        cameraAngle: normalizeCameraAngle(pose.cameraAngle),
        shotDistance: normalizeShotDistance(pose.shotDistance),
      })),
    })),
  };
}

function normalizeImportPayload(input: unknown): StudioPoseLibraryExportPayload {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const categories = Array.isArray(raw.categories) ? raw.categories : [];
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: categories.map((item) => {
      const category = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const poses = Array.isArray(category.poses) ? category.poses : [];
      return {
        name: readString(category.name, 'Imported category') || 'Imported category',
        description: readString(category.description),
        poses: poses.map((poseItem) => {
          const pose = poseItem && typeof poseItem === 'object' ? poseItem as Record<string, unknown> : {};
          return {
            title: readString(pose.title, 'Imported pose') || 'Imported pose',
            tags: readTags(pose.tags),
            posePrompt: readString(pose.posePrompt),
            orientation: normalizeOrientation(pose.orientation),
            framing: normalizeFraming(pose.framing),
            cameraAngle: normalizeCameraAngle(pose.cameraAngle),
            shotDistance: normalizeShotDistance(pose.shotDistance),
          };
        }),
      };
    }),
  };
}

export async function importStudioPoseLibrary(input: { workspaceId: string; payload: unknown; mode: 'merge' | 'replace_all'; categoryId?: string | null }) {
  const payload = normalizeImportPayload(input.payload);
  if (payload.categories.length === 0) return { error: 'Import payload must include at least one category' as const };

  const result = await prisma.$transaction(async (tx) => {
    if (input.mode === 'replace_all') {
      if (input.categoryId) await tx.studioPose.deleteMany({ where: { workspaceId: input.workspaceId, categoryId: input.categoryId } });
      else await tx.studioPoseCategory.deleteMany({ where: { workspaceId: input.workspaceId } });
    }

    let categoriesCreated = 0;
    let posesCreated = 0;
    const categoryCount = await tx.studioPoseCategory.count({ where: { workspaceId: input.workspaceId } });
    for (const [categoryIndex, category] of payload.categories.entries()) {
      const categoryRecord = input.categoryId && input.mode === 'replace_all' && categoryIndex === 0
        ? await tx.studioPoseCategory.update({ where: { id: input.categoryId }, data: { name: category.name, description: category.description } })
        : await tx.studioPoseCategory.create({ data: { workspaceId: input.workspaceId, slug: `${slugify(category.name, 'category')}-${Date.now()}-${categoryIndex}`, name: category.name, description: category.description, sortOrder: categoryCount + categoryIndex } });
      if (!(input.categoryId && input.mode === 'replace_all' && categoryIndex === 0)) categoriesCreated += 1;
      for (const [poseIndex, pose] of category.poses.entries()) {
        await tx.studioPose.create({ data: { workspaceId: input.workspaceId, categoryId: categoryRecord.id, slug: `${slugify(pose.title, 'pose')}-${Date.now()}-${categoryIndex}-${poseIndex}`, title: pose.title, tagsJson: JSON.stringify(pose.tags), posePrompt: pose.posePrompt, orientation: pose.orientation, framing: pose.framing, cameraAngle: pose.cameraAngle, shotDistance: pose.shotDistance, sortOrder: poseIndex } });
        posesCreated += 1;
      }
    }
    return { categoriesCreated, posesCreated };
  });

  return { imported: result };
}

export async function listStudioPosesMissingPreviews(input: { workspaceId: string; categoryId?: string | null; limit?: number }) {
  const poses = await listStudioPoses({ workspaceId: input.workspaceId, categoryId: input.categoryId ?? null, preview: 'missing' });
  return poses.slice(0, Math.max(1, Math.min(500, Math.floor(input.limit ?? 500))));
}
