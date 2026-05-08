import { prisma } from '@/lib/prisma';
import type { StudioFramingPresetSummary, StudioSessionPoseOrientation } from './types';

const ORIENTATIONS = new Set<StudioSessionPoseOrientation>(['portrait', 'landscape', 'square']);
const DEFAULT_ASPECT_RATIOS: Record<StudioSessionPoseOrientation, number> = {
  portrait: 2 / 3,
  landscape: 3 / 2,
  square: 1,
};

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
  return Array.from(new Set(value.map((item) => readString(item)).filter(Boolean))).slice(0, 30);
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeStudioFramingOrientation(value: unknown): StudioSessionPoseOrientation {
  return typeof value === 'string' && ORIENTATIONS.has(value as StudioSessionPoseOrientation) ? value as StudioSessionPoseOrientation : 'portrait';
}

export function getDefaultStudioFramingAspectRatio(orientation: StudioSessionPoseOrientation) {
  return DEFAULT_ASPECT_RATIOS[orientation];
}

export function normalizeStudioFramingRotationDeg(value: unknown) {
  const raw = readFiniteNumber(value) ?? 0;
  const normalized = ((((raw + 180) % 360) + 360) % 360) - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function normalizeAspectRatio(value: unknown, orientation: StudioSessionPoseOrientation) {
  const raw = readFiniteNumber(value) ?? getDefaultStudioFramingAspectRatio(orientation);
  return clamp(raw, 0.25, 4);
}

function normalizeCenter(value: unknown, fallback: number) {
  return clamp(readFiniteNumber(value) ?? fallback, -0.5, 1.5);
}

function normalizePoseHeight(value: unknown) {
  return clamp(readFiniteNumber(value) ?? 0.78, 0.05, 2);
}

export function toStudioFramingPresetSummary(record: any): StudioFramingPresetSummary {
  const orientation = normalizeStudioFramingOrientation(record.orientation);
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    title: record.title,
    description: record.description ?? '',
    tags: parseJson(record.tagsJson, []),
    orientation,
    aspectRatio: normalizeAspectRatio(record.aspectRatio, orientation),
    centerX: normalizeCenter(record.centerX, 0.5),
    centerY: normalizeCenter(record.centerY, 0.58),
    poseHeight: normalizePoseHeight(record.poseHeight),
    rotationDeg: normalizeStudioFramingRotationDeg(record.rotationDeg),
    flipX: record.flipX === true,
    helperPrompt: record.helperPrompt ?? '',
    previewImageUrl: record.previewImageUrl ?? null,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function buildDefaultStudioFramingPreset(orientationInput: unknown = 'portrait'): Omit<StudioFramingPresetSummary, 'id' | 'workspaceId' | 'sortOrder' | 'createdAt' | 'updatedAt'> {
  const orientation = normalizeStudioFramingOrientation(orientationInput);
  return {
    title: 'Default centered',
    description: '',
    tags: [],
    orientation,
    aspectRatio: getDefaultStudioFramingAspectRatio(orientation),
    centerX: 0.5,
    centerY: 0.58,
    poseHeight: 0.78,
    rotationDeg: 0,
    flipX: false,
    helperPrompt: 'centered full-body composition',
    previewImageUrl: null,
  };
}

function buildFramingPresetData(input: Record<string, unknown>, fallback?: StudioFramingPresetSummary) {
  const orientation = input.orientation !== undefined ? normalizeStudioFramingOrientation(input.orientation) : fallback?.orientation ?? 'portrait';
  return {
    title: readString(input.title, fallback?.title ?? 'Untitled framing preset') || 'Untitled framing preset',
    description: readString(input.description, fallback?.description ?? ''),
    tagsJson: JSON.stringify(input.tags !== undefined ? readTags(input.tags) : fallback?.tags ?? []),
    orientation,
    aspectRatio: normalizeAspectRatio(input.aspectRatio, orientation),
    centerX: normalizeCenter(input.centerX, fallback?.centerX ?? 0.5),
    centerY: normalizeCenter(input.centerY, fallback?.centerY ?? 0.58),
    poseHeight: normalizePoseHeight(input.poseHeight ?? fallback?.poseHeight),
    rotationDeg: normalizeStudioFramingRotationDeg(input.rotationDeg ?? fallback?.rotationDeg),
    flipX: input.flipX === undefined ? fallback?.flipX ?? false : input.flipX === true,
    helperPrompt: readString(input.helperPrompt, fallback?.helperPrompt ?? ''),
    previewImageUrl: input.previewImageUrl === null ? null : readString(input.previewImageUrl, fallback?.previewImageUrl ?? '') || null,
  };
}

export async function listStudioFramingPresets(input: { workspaceId: string; orientation?: unknown; query?: unknown }): Promise<StudioFramingPresetSummary[]> {
  const query = readString(input.query).toLowerCase();
  const orientation = typeof input.orientation === 'string' && ORIENTATIONS.has(input.orientation as StudioSessionPoseOrientation) ? input.orientation as StudioSessionPoseOrientation : null;
  const records = await prisma.studioFramingPreset.findMany({
    where: { workspaceId: input.workspaceId, ...(orientation ? { orientation } : {}) },
    orderBy: [{ orientation: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const summaries = records.map(toStudioFramingPresetSummary);
  if (!query) return summaries;
  return summaries.filter((preset) => {
    const haystack = `${preset.title} ${preset.description} ${preset.helperPrompt} ${preset.tags.join(' ')}`.toLowerCase();
    return haystack.includes(query);
  });
}

export async function getStudioFramingPreset(id: string): Promise<StudioFramingPresetSummary | null> {
  const record = await prisma.studioFramingPreset.findUnique({ where: { id } });
  return record ? toStudioFramingPresetSummary(record) : null;
}

export async function createStudioFramingPreset(workspaceId: string, input: Record<string, unknown>): Promise<StudioFramingPresetSummary> {
  const orientation = normalizeStudioFramingOrientation(input.orientation);
  const count = await prisma.studioFramingPreset.count({ where: { workspaceId, orientation } });
  const data = buildFramingPresetData(input, buildDefaultStudioFramingPreset(orientation) as StudioFramingPresetSummary);
  const record = await prisma.studioFramingPreset.create({ data: { workspaceId, ...data, sortOrder: count } });
  return toStudioFramingPresetSummary(record);
}

export async function updateStudioFramingPreset(id: string, input: Record<string, unknown>): Promise<StudioFramingPresetSummary | null> {
  const existing = await getStudioFramingPreset(id);
  if (!existing) return null;
  const data = buildFramingPresetData(input, existing);
  const record = await prisma.studioFramingPreset.update({ where: { id }, data });
  return toStudioFramingPresetSummary(record);
}

export async function deleteStudioFramingPreset(id: string): Promise<{ id: string } | null> {
  const existing = await prisma.studioFramingPreset.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return null;
  await prisma.studioFramingPreset.delete({ where: { id } });
  return existing;
}

export async function duplicateStudioFramingPreset(id: string, input: Record<string, unknown> = {}): Promise<StudioFramingPresetSummary | null> {
  const existing = await getStudioFramingPreset(id);
  if (!existing) return null;
  const count = await prisma.studioFramingPreset.count({ where: { workspaceId: existing.workspaceId, orientation: existing.orientation } });
  const data = buildFramingPresetData({ ...existing, ...input, title: readString(input.title, `${existing.title} Copy`) }, existing);
  const record = await prisma.studioFramingPreset.create({ data: { workspaceId: existing.workspaceId, ...data, sortOrder: count } });
  return toStudioFramingPresetSummary(record);
}

export async function reorderStudioFramingPresets(workspaceId: string, ids: string[]): Promise<StudioFramingPresetSummary[]> {
  const records = await prisma.studioFramingPreset.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true } });
  const validIds = ids.filter((id, index) => ids.indexOf(id) === index && records.some((record) => record.id === id));
  await prisma.$transaction(validIds.map((id, index) => prisma.studioFramingPreset.update({ where: { id }, data: { sortOrder: index } })));
  return listStudioFramingPresets({ workspaceId });
}
