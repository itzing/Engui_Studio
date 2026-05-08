import { listStudioPoseCategories, listStudioPoses } from './poseLibraryServer';
import { getStudioSessionPoseCategories, getStudioSessionPosesByCategory } from './poseLibrary';
import type { StudioPoseSetSummary } from './types';
import { buildStudioSessionShotLabel } from './utils';

const CATEGORY_POSE_SET_PREFIX = 'category:';

function humanizePoseSetName(category: string): string {
  return category
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeStaticCategory(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function createStudioPoseSetIdFromCategory(category: string): string {
  return `${CATEGORY_POSE_SET_PREFIX}${category.trim()}`;
}

export function getStudioPoseSetCategoryFromId(poseSetId: string): string | null {
  const trimmed = poseSetId.trim();
  if (!trimmed.startsWith(CATEGORY_POSE_SET_PREFIX)) return null;
  const category = trimmed.slice(CATEGORY_POSE_SET_PREFIX.length).trim();
  return category || null;
}

function getStaticStudioPoseSets(): StudioPoseSetSummary[] {
  return getStudioSessionPoseCategories().map((category) => {
    const poses = getStudioSessionPosesByCategory(category);
    const name = humanizePoseSetName(category);
    return {
      id: createStudioPoseSetIdFromCategory(normalizeStaticCategory(category)),
      name,
      description: `${name} poses from the Studio Session pose library.`,
      category: normalizeStaticCategory(category),
      poseIds: poses.map((pose) => pose.id),
      tags: ['category', category],
    };
  });
}

async function getPersistedStudioPoseSets(workspaceId: string): Promise<StudioPoseSetSummary[]> {
  const categories = await listStudioPoseCategories(workspaceId);
  return Promise.all(categories.map(async (category) => {
    const poses = await listStudioPoses({ workspaceId, categoryId: category.id });
    return {
      id: createStudioPoseSetIdFromCategory(category.id),
      name: category.name,
      description: category.description || `${category.name} poses from the Studio pose library.`,
      category: category.id,
      poseIds: poses.map((pose) => pose.id),
      tags: ['category', category.name, category.id],
    };
  }));
}

export function getStudioPoseSets(): StudioPoseSetSummary[];
export function getStudioPoseSets(workspaceId: string): Promise<StudioPoseSetSummary[]>;
export function getStudioPoseSets(workspaceId?: string): StudioPoseSetSummary[] | Promise<StudioPoseSetSummary[]> {
  return workspaceId ? getPersistedStudioPoseSets(workspaceId) : getStaticStudioPoseSets();
}

export function getStudioPoseSetById(poseSetId: string): StudioPoseSetSummary | null;
export function getStudioPoseSetById(workspaceId: string, poseSetId: string): Promise<StudioPoseSetSummary | null>;
export function getStudioPoseSetById(first: string, second?: string): StudioPoseSetSummary | null | Promise<StudioPoseSetSummary | null> {
  if (second === undefined) {
    const category = getStudioPoseSetCategoryFromId(first);
    if (!category) return null;
    return getStaticStudioPoseSets().find((poseSet) => poseSet.category === category) ?? null;
  }
  const workspaceId = first;
  const poseSetId = second;
  const category = getStudioPoseSetCategoryFromId(poseSetId);
  if (!category) return Promise.resolve(null);
  return getPersistedStudioPoseSets(workspaceId).then((poseSets) => poseSets.find((poseSet) => poseSet.category === category) ?? null);
}

export function getStudioSessionPosesByPoseSetId(poseSetId: string) {
  const category = getStudioPoseSetCategoryFromId(poseSetId);
  return category ? getStudioSessionPosesByCategory(category) : [];
}

export function buildStudioRunShotSlotsFromPoseSet(input: { poseSetId: string; count: number }): Array<{ category: string; slotIndex: number; label: string }>;
export function buildStudioRunShotSlotsFromPoseSet(input: { workspaceId: string; poseSetId: string; count: number }): Promise<Array<{ category: string; slotIndex: number; label: string }>>;
export function buildStudioRunShotSlotsFromPoseSet(input: { workspaceId?: string; poseSetId: string; count: number }): Array<{ category: string; slotIndex: number; label: string }> | Promise<Array<{ category: string; slotIndex: number; label: string }>> {
  const count = Math.max(0, Math.min(50, Math.floor(input.count)));
  if (!input.workspaceId) {
    const poseSet = getStudioPoseSetById(input.poseSetId);
    if (!poseSet) return [];
    return Array.from({ length: count }, (_, slotIndex) => ({
      category: poseSet.category,
      slotIndex,
      label: buildStudioSessionShotLabel(poseSet.category, slotIndex),
    }));
  }
  return getStudioPoseSetById(input.workspaceId, input.poseSetId).then((poseSet) => {
    if (!poseSet) return [];
    return Array.from({ length: count }, (_, slotIndex) => ({
      category: poseSet.category,
      slotIndex,
      label: buildStudioSessionShotLabel(poseSet.name, slotIndex),
    }));
  });
}
