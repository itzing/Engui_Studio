import { createHash } from 'node:crypto';
import poseLibraryDocument from './pose-library-v1.json';
import type { StudioSessionPoseFraming, StudioSessionPoseOrientation, StudioSessionPoseSnapshot } from './types';

export interface StudioSessionPoseLibraryRecord extends StudioSessionPoseSnapshot {}

export interface StudioSessionPoseLibrary {
  version: string;
  hash: string;
  categories: string[];
  poses: StudioSessionPoseLibraryRecord[];
}

const ALLOWED_ORIENTATIONS = new Set<StudioSessionPoseOrientation>(['portrait', 'landscape', 'square']);
const ALLOWED_FRAMINGS = new Set<StudioSessionPoseFraming>(['closeup', 'portrait', 'half_body', 'three_quarter', 'full_body']);
const FALLBACK_CATEGORY_ORDER = ['standing', 'portrait', 'sitting', 'kneeling', 'floor', 'movement'];

function normalizeCategory(input: unknown): string {
  if (typeof input !== 'string') return 'uncategorized';
  const normalized = input.trim().toLowerCase().replace(/\s+/g, '_');
  return normalized || 'uncategorized';
}

function normalizeOrientation(input: unknown): StudioSessionPoseOrientation {
  return typeof input === 'string' && ALLOWED_ORIENTATIONS.has(input as StudioSessionPoseOrientation)
    ? input as StudioSessionPoseOrientation
    : 'portrait';
}

function normalizeFraming(input: unknown): StudioSessionPoseFraming {
  return typeof input === 'string' && ALLOWED_FRAMINGS.has(input as StudioSessionPoseFraming)
    ? input as StudioSessionPoseFraming
    : 'portrait';
}

function normalizePoseRecord(input: unknown, fallbackIndex: number): StudioSessionPoseLibraryRecord | null {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : `pose-${fallbackIndex + 1}`;
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : `Pose ${fallbackIndex + 1}`;
  const prompt = typeof value.prompt === 'string' && value.prompt.trim() ? value.prompt.trim() : '';
  if (!prompt) return null;

  return {
    id,
    category: normalizeCategory(value.category),
    orientation: normalizeOrientation(value.orientation),
    framing: normalizeFraming(value.framing),
    name,
    prompt,
  };
}

function normalizePoseLibraryDocument(input: unknown): StudioSessionPoseLibrary {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const version = typeof value.version === 'string' && value.version.trim() ? value.version.trim() : 'v1';
  const sourcePoses = Array.isArray(value.poses) ? value.poses : [];
  const normalizedPoses = sourcePoses
    .map((item, index) => normalizePoseRecord(item, index))
    .filter((item): item is StudioSessionPoseLibraryRecord => item !== null);

  const poseIds = new Set<string>();
  const dedupedPoses = normalizedPoses.filter((pose) => {
    if (poseIds.has(pose.id)) return false;
    poseIds.add(pose.id);
    return true;
  });

  const categories = Array.from(new Set([
    ...FALLBACK_CATEGORY_ORDER,
    ...dedupedPoses.map((pose) => pose.category),
  ])).filter((category) => dedupedPoses.some((pose) => pose.category === category));

  const stablePayload = JSON.stringify({ version, poses: dedupedPoses });
  const hash = createHash('sha256').update(stablePayload).digest('hex');

  return {
    version,
    hash,
    categories,
    poses: dedupedPoses,
  };
}

const poseLibrary = normalizePoseLibraryDocument(poseLibraryDocument);

export function getStudioSessionPoseLibrary(): StudioSessionPoseLibrary {
  return poseLibrary;
}

export function getStudioSessionPoseCategories(): string[] {
  return poseLibrary.categories;
}

export function getStudioSessionPoseById(poseId: string): StudioSessionPoseLibraryRecord | null {
  const normalized = poseId.trim();
  return poseLibrary.poses.find((pose) => pose.id === normalized) ?? null;
}

export function getStudioSessionPosesByCategory(category: string): StudioSessionPoseLibraryRecord[] {
  const normalized = normalizeCategory(category);
  return poseLibrary.poses.filter((pose) => pose.category === normalized);
}
