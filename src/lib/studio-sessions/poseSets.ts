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

function normalizePoseSetCategory(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function createStudioPoseSetIdFromCategory(category: string): string {
  return `${CATEGORY_POSE_SET_PREFIX}${normalizePoseSetCategory(category)}`;
}

export function getStudioPoseSetCategoryFromId(poseSetId: string): string | null {
  const trimmed = poseSetId.trim();
  if (!trimmed.startsWith(CATEGORY_POSE_SET_PREFIX)) return null;
  const category = normalizePoseSetCategory(trimmed.slice(CATEGORY_POSE_SET_PREFIX.length));
  return category || null;
}

export function getStudioPoseSets(): StudioPoseSetSummary[] {
  return getStudioSessionPoseCategories().map((category) => {
    const poses = getStudioSessionPosesByCategory(category);
    const name = humanizePoseSetName(category);
    return {
      id: createStudioPoseSetIdFromCategory(category),
      name,
      description: `${name} poses from the Studio Session pose library.`,
      category,
      poseIds: poses.map((pose) => pose.id),
      tags: ['category', category],
    };
  });
}

export function getStudioPoseSetById(poseSetId: string): StudioPoseSetSummary | null {
  const category = getStudioPoseSetCategoryFromId(poseSetId);
  if (!category) return null;
  return getStudioPoseSets().find((poseSet) => poseSet.category === category) ?? null;
}

export function getStudioSessionPosesByPoseSetId(poseSetId: string) {
  const category = getStudioPoseSetCategoryFromId(poseSetId);
  return category ? getStudioSessionPosesByCategory(category) : [];
}

export function buildStudioRunShotSlotsFromPoseSet(input: { poseSetId: string; count: number }): Array<{ category: string; slotIndex: number; label: string }> {
  const poseSet = getStudioPoseSetById(input.poseSetId);
  if (!poseSet) return [];
  const count = Math.max(0, Math.min(50, Math.floor(input.count)));
  return Array.from({ length: count }, (_, slotIndex) => ({
    category: poseSet.category,
    slotIndex,
    label: buildStudioSessionShotLabel(poseSet.category, slotIndex),
  }));
}
