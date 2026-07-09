import type { Prisma } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { prisma } from '@/lib/prisma';
import { ffmpegService } from '@/lib/ffmpegService';
import { submitGenerationFormData } from '@/lib/generation/submitFormData';
import { StudioSessionApiError } from '@/lib/studio-sessions/api';

const sequenceStatuses = ['draft', 'ready', 'rendering', 'rendered', 'failed'] as const;
const segmentStatuses = ['draft', 'queued', 'processing', 'completed', 'failed', 'stale'] as const;
const sourceModes = ['initial', 'previous_last_frame', 'gallery_asset', 'job_output', 'upload', 'manual_frame'] as const;
const sourceFrameRoles = ['first', 'last', 'custom'] as const;
const sequenceFrameRoot = path.join(process.cwd(), 'public', 'generations', 'video-sequences');

type JsonFallback = Record<string, unknown> | unknown[];

function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asOptionalPositiveInt(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const next = Number(value);
  if (!Number.isInteger(next) || next <= 0) {
    throw new StudioSessionApiError(400, `${fieldName} must be a positive integer`);
  }
  return next;
}

function asOptionalNonNegativeInt(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const next = Number(value);
  if (!Number.isInteger(next) || next < 0) {
    throw new StudioSessionApiError(400, `${fieldName} must be a non-negative integer`);
  }
  return next;
}

function asOptionalNonNegativeNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) {
    throw new StudioSessionApiError(400, `${fieldName} must be a non-negative number`);
  }
  return next;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T, fieldName: string): T[number] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new StudioSessionApiError(400, `${fieldName} is invalid`);
  }
  return value as T[number];
}

function toJsonString(value: unknown, fallback: JsonFallback): string {
  if (value === undefined) return JSON.stringify(fallback);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return JSON.stringify(fallback);
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      throw new StudioSessionApiError(400, 'JSON fields must contain valid JSON');
    }
  }
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    throw new StudioSessionApiError(400, 'JSON fields must be serializable');
  }
}

function parseJsonField(value: string | null | undefined, fallback: JsonFallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function inferMimeFromPath(value: string) {
  const ext = path.extname(value.split('?')[0]).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

function readImageDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length >= 24 && bytes.toString('ascii', 1, 4) === 'PNG') {
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (!length || offset + 2 + length > bytes.length) return null;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        const height = bytes.readUInt16BE(offset + 5);
        const width = bytes.readUInt16BE(offset + 7);
        return width > 0 && height > 0 ? { width, height } : null;
      }
      offset += 2 + length;
    }
  }

  return null;
}

function resolveLocalPublicPath(url: string) {
  if (!url.startsWith('/')) return null;
  const normalized = url.split('?')[0].split('#')[0];
  if (!normalized.startsWith('/generations/') && !normalized.startsWith('/results/')) return null;
  const resolved = path.resolve(process.cwd(), 'public', normalized.replace(/^\/+/, ''));
  const publicRoot = path.resolve(process.cwd(), 'public');
  if (!resolved.startsWith(publicRoot)) return null;
  return resolved;
}

async function loadSourceImageBlob(sourceImageUrl: string) {
  const localPath = resolveLocalPublicPath(sourceImageUrl);
  if (localPath) {
    if (!fs.existsSync(localPath)) throw new StudioSessionApiError(400, `Source image does not exist: ${sourceImageUrl}`);
    const bytes = fs.readFileSync(localPath);
    return { blob: new Blob([bytes], { type: inferMimeFromPath(sourceImageUrl) }), filename: path.basename(localPath) || 'source.png', ...readImageDimensions(bytes) };
  }

  if (!/^https?:\/\//i.test(sourceImageUrl)) {
    throw new StudioSessionApiError(400, 'sourceImageUrl must be a local public /generations or /results URL, or an http(s) URL');
  }

  const response = await fetch(sourceImageUrl);
  if (!response.ok) throw new StudioSessionApiError(400, `Failed to fetch source image: ${response.status}`);
  const contentType = response.headers.get('content-type') || inferMimeFromPath(sourceImageUrl);
  const blob = await response.blob();
  const bytes = Buffer.from(await blob.arrayBuffer());
  return { blob: new Blob([bytes], { type: contentType }), filename: path.basename(new URL(sourceImageUrl).pathname) || 'source.png', ...readImageDimensions(bytes) };
}

function appendScalarFormValue(formData: FormData, key: string, value: unknown) {
  if (value === undefined || value === null || value === '') return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    formData.append(key, String(value));
  }
}

function positiveInteger(value: unknown) {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : null;
}

function aspectRatioFromDimensions(width: number, height: number) {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function stripResolutionOptions(options: Record<string, unknown>) {
  const next = { ...options };
  delete next.width;
  delete next.height;
  delete next.aspectRatio;
  return next;
}

function parseJsonObjectField(value: string | null | undefined): Record<string, unknown> {
  const parsed = parseJsonField(value, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function sequenceFramePublicUrl(workspaceId: string, sequenceId: string, segmentId: string, fileName: string) {
  return `/generations/video-sequences/${safePathSegment(workspaceId)}/${safePathSegment(sequenceId)}/${safePathSegment(segmentId)}/frames/${fileName}`;
}

function sequenceFrameOutputPath(workspaceId: string, sequenceId: string, segmentId: string, fileName: string) {
  return path.join(sequenceFrameRoot, safePathSegment(workspaceId), safePathSegment(sequenceId), safePathSegment(segmentId), 'frames', fileName);
}

function sequenceRenderPublicUrl(workspaceId: string, sequenceId: string, fileName: string) {
  return `/generations/video-sequences/${safePathSegment(workspaceId)}/${safePathSegment(sequenceId)}/final/${fileName}`;
}

function sequenceRenderOutputPath(workspaceId: string, sequenceId: string, fileName: string) {
  return path.join(sequenceFrameRoot, safePathSegment(workspaceId), safePathSegment(sequenceId), 'final', fileName);
}

function segmentCreateDefaults(orderIndex: number) {
  return {
    orderIndex,
    title: `Segment ${orderIndex + 1}`,
    sourceMode: orderIndex === 0 ? 'initial' : 'previous_last_frame',
    sourceFrameRole: 'last',
    status: 'draft',
    modelId: 'wan22',
    durationSeconds: 6,
    generationOptionsJson: JSON.stringify({ steps: 4 }),
  };
}

const generationRelevantSegmentFields = [
  'sourceMode',
  'sourceImageUrl',
  'sourceImageAssetId',
  'sourceJobId',
  'sourceSegmentId',
  'sourceFrameRole',
  'prompt',
  'negativePrompt',
  'motionPrompt',
  'continuityPrompt',
  'modelId',
  'endpointId',
  'loraConfigJson',
  'generationOptionsJson',
  'seed',
  'randomizeSeed',
  'durationSeconds',
] as const;

function hasGeneratedSegmentOutput(segment: { outputVideoUrl?: string | null; firstFrameUrl?: string | null; lastFrameUrl?: string | null; generationJobId?: string | null }) {
  return Boolean(segment.outputVideoUrl || segment.firstFrameUrl || segment.lastFrameUrl || segment.generationJobId);
}

function didGenerationRelevantInputChange(existing: Record<string, unknown>, data: Record<string, unknown>) {
  return generationRelevantSegmentFields.some((field) => (
    Object.prototype.hasOwnProperty.call(data, field) && data[field] !== existing[field]
  ));
}

export async function markDownstreamPreviousLastFrameSegmentsStale(sequenceId: string, upstreamOrderIndex: number) {
  const downstream = await prisma.videoSequenceSegment.findMany({
    where: { sequenceId, orderIndex: { gt: upstreamOrderIndex } },
    orderBy: { orderIndex: 'asc' },
    select: {
      id: true,
      status: true,
      sourceMode: true,
      sourceFrozen: true,
      outputVideoUrl: true,
      firstFrameUrl: true,
      lastFrameUrl: true,
      generationJobId: true,
    },
  });

  const staleIds: string[] = [];
  for (const segment of downstream) {
    if (segment.sourceMode !== 'previous_last_frame' || segment.sourceFrozen) break;
    if (hasGeneratedSegmentOutput(segment) && segment.status !== 'queued' && segment.status !== 'processing') {
      staleIds.push(segment.id);
    }
  }

  if (staleIds.length) {
    await prisma.videoSequenceSegment.updateMany({
      where: { id: { in: staleIds } },
      data: { status: 'stale' },
    });
  }

  return staleIds;
}

export function serializeVideoSegment(segment: any) {
  return {
    ...segment,
    loraConfig: parseJsonField(segment.loraConfigJson, {}),
    generationOptions: parseJsonField(segment.generationOptionsJson, {}),
    templateSnapshot: parseJsonField(segment.templateSnapshotJson, {}),
    generationSnapshot: parseJsonField(segment.generationSnapshotJson, {}),
  };
}

export function serializeVideoSequence(sequence: any) {
  return {
    ...sequence,
    defaultGenerationOptions: parseJsonField(sequence.defaultGenerationOptionsJson, {}),
    segments: Array.isArray(sequence.segments) ? sequence.segments.map(serializeVideoSegment) : undefined,
    segmentCount: sequence._count?.segments,
  };
}

export function serializeVideoSegmentTemplate(template: any) {
  return {
    ...template,
    variables: parseJsonField(template.variablesJson, []),
    loraConfig: parseJsonField(template.loraConfigJson, {}),
    generationOptions: parseJsonField(template.generationOptionsJson, {}),
  };
}

export async function listVideoSequences(workspaceId: string) {
  const sequences = await prisma.videoSequence.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { segments: true } } },
  });
  return sequences.map(serializeVideoSequence);
}

export async function createVideoSequence(workspaceId: string, input: Record<string, unknown>) {
  const title = asTrimmedString(input.title) ?? 'Untitled sequence';
  const sequence = await prisma.videoSequence.create({
    data: {
      workspaceId,
      title,
      description: asOptionalString(input.description) ?? '',
      status: enumValue(input.status, sequenceStatuses, 'status') ?? 'draft',
      aspectRatio: asOptionalString(input.aspectRatio) ?? '16:9',
      width: asOptionalPositiveInt(input.width, 'width') ?? 1280,
      height: asOptionalPositiveInt(input.height, 'height') ?? 720,
      targetFps: asOptionalPositiveInt(input.targetFps, 'targetFps') ?? 24,
      defaultModelId: asOptionalString(input.defaultModelId) ?? 'wan22',
      defaultGenerationOptionsJson: toJsonString(input.defaultGenerationOptions ?? input.defaultGenerationOptionsJson, { steps: 4 }),
    },
    include: {
      segments: { orderBy: { orderIndex: 'asc' } },
    },
  });
  return serializeVideoSequence(sequence);
}

export async function getVideoSequence(id: string) {
  const sequence = await prisma.videoSequence.findUnique({
    where: { id },
    include: {
      segments: { orderBy: { orderIndex: 'asc' } },
    },
  });
  return sequence ? serializeVideoSequence(sequence) : null;
}

export async function updateVideoSequence(id: string, input: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = asTrimmedString(input.title) ?? 'Untitled sequence';
  if (input.description !== undefined) data.description = asOptionalString(input.description) ?? '';
  if (input.status !== undefined) data.status = enumValue(input.status, sequenceStatuses, 'status');
  if (input.aspectRatio !== undefined) data.aspectRatio = asOptionalString(input.aspectRatio) ?? '16:9';
  if (input.width !== undefined) data.width = asOptionalPositiveInt(input.width, 'width');
  if (input.height !== undefined) data.height = asOptionalPositiveInt(input.height, 'height');
  if (input.targetFps !== undefined) data.targetFps = asOptionalPositiveInt(input.targetFps, 'targetFps');
  if (input.defaultModelId !== undefined) data.defaultModelId = asOptionalString(input.defaultModelId) ?? 'wan22';
  if (input.defaultGenerationOptions !== undefined || input.defaultGenerationOptionsJson !== undefined) {
    data.defaultGenerationOptionsJson = toJsonString(input.defaultGenerationOptions ?? input.defaultGenerationOptionsJson, {});
  }

  const sequence = await prisma.videoSequence.update({
    where: { id },
    data,
    include: {
      segments: { orderBy: { orderIndex: 'asc' } },
    },
  });
  return serializeVideoSequence(sequence);
}

export async function deleteVideoSequence(id: string) {
  await prisma.videoSequence.delete({ where: { id } });
  return true;
}

export async function createVideoSequenceSegment(sequenceId: string, input: Record<string, unknown>) {
  const sequence = await prisma.videoSequence.findUnique({ where: { id: sequenceId }, select: { id: true } });
  if (!sequence) throw new StudioSessionApiError(404, 'Video sequence not found');

  const count = await prisma.videoSequenceSegment.count({ where: { sequenceId } });
  const defaults = segmentCreateDefaults(count);
  const segment = await prisma.videoSequenceSegment.create({
    data: {
      sequenceId,
      ...defaults,
      ...segmentDataFromInput(input, defaults),
    },
  });
  return serializeVideoSegment(segment);
}

export async function updateVideoSequenceSegment(sequenceId: string, segmentId: string, input: Record<string, unknown>) {
  const existing = await prisma.videoSequenceSegment.findFirst({ where: { id: segmentId, sequenceId } });
  if (!existing) throw new StudioSessionApiError(404, 'Video sequence segment not found');

  const data = segmentDataFromInput(input, {});
  const outputVideoChanged = Object.prototype.hasOwnProperty.call(data, 'outputVideoUrl') && data.outputVideoUrl !== existing.outputVideoUrl;
  if (outputVideoChanged) {
    if (!Object.prototype.hasOwnProperty.call(data, 'firstFrameUrl')) data.firstFrameUrl = null;
    if (!Object.prototype.hasOwnProperty.call(data, 'lastFrameUrl')) data.lastFrameUrl = null;
  }
  const lastFrameChanged = Object.prototype.hasOwnProperty.call(data, 'lastFrameUrl') && data.lastFrameUrl !== existing.lastFrameUrl;
  if (hasGeneratedSegmentOutput(existing) && didGenerationRelevantInputChange(existing as unknown as Record<string, unknown>, data)) {
    data.status = 'stale';
  }

  const segment = await prisma.videoSequenceSegment.update({
    where: { id: segmentId },
    data,
  });
  if (lastFrameChanged) {
    await markDownstreamPreviousLastFrameSegmentsStale(sequenceId, existing.orderIndex);
  }
  if (outputVideoChanged && segment.outputVideoUrl) {
    return tryExtractVideoSequenceSegmentFrames(sequenceId, segmentId, segment);
  }
  return serializeVideoSegment(segment);
}

export async function applyGalleryAssetToVideoSequenceSegment(sequenceId: string, segmentId: string, input: Record<string, unknown>) {
  const assetId = asTrimmedString(input.assetId);
  const mode = enumValue(input.mode, ['initial_image', 'completed_video'] as const, 'mode');
  if (!assetId) throw new StudioSessionApiError(400, 'assetId is required');
  if (!mode) throw new StudioSessionApiError(400, 'mode is required');

  const existing = await prisma.videoSequenceSegment.findFirst({
    where: { id: segmentId, sequenceId },
    include: { sequence: { select: { workspaceId: true } } },
  });
  if (!existing) throw new StudioSessionApiError(404, 'Video sequence segment not found');

  const asset = await prisma.galleryAsset.findFirst({
    where: {
      id: assetId,
      workspaceId: existing.sequence.workspaceId,
      trashed: false,
    },
    select: {
      id: true,
      type: true,
      originalUrl: true,
      previewUrl: true,
      thumbnailUrl: true,
      sourceJobId: true,
    },
  });
  if (!asset) throw new StudioSessionApiError(404, 'Gallery asset not found');

  const data: Record<string, unknown> = {
    sourceMode: 'gallery_asset',
    sourceImageAssetId: asset.id,
    sourceJobId: asset.sourceJobId || null,
    sourceSegmentId: null,
    error: null,
  };

  if (mode === 'initial_image') {
    if (asset.type !== 'image') throw new StudioSessionApiError(400, 'Gallery image asset is required');
    data.sourceImageUrl = asset.originalUrl;
    data.sourceFrozen = false;
    if (hasGeneratedSegmentOutput(existing)) data.status = 'stale';
  } else {
    if (asset.type !== 'video') throw new StudioSessionApiError(400, 'Gallery video asset is required');
    if (existing.orderIndex !== 0) throw new StudioSessionApiError(400, 'Gallery video can only seed the first segment');
    const videoPath = resolveLocalPublicPath(asset.originalUrl);
    let videoResolution: { width: number; height: number } | null = null;
    if (videoPath && fs.existsSync(videoPath)) {
      try {
        const videoInfo = await ffmpegService.getVideoInfo(videoPath);
        videoResolution = { width: videoInfo.width, height: videoInfo.height };
      } catch (error) {
        console.warn('Failed to read gallery video dimensions for sequence resolution', {
          sequenceId,
          segmentId,
          assetId: asset.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    data.status = 'completed';
    data.sourceImageUrl = asset.thumbnailUrl || asset.previewUrl || null;
    data.sourceFrozen = true;
    data.outputVideoUrl = asset.originalUrl;
    data.firstFrameUrl = null;
    data.lastFrameUrl = null;
    data.generationJobId = null;
    data.generationSnapshotJson = toJsonString({
      source: 'gallery_asset',
      assetId: asset.id,
      originalUrl: asset.originalUrl,
    }, {});
    if (videoResolution) {
      await prisma.videoSequence.update({
        where: { id: sequenceId },
        data: {
          width: videoResolution.width,
          height: videoResolution.height,
          aspectRatio: aspectRatioFromDimensions(videoResolution.width, videoResolution.height),
        },
      });
    }
  }

  const lastFrameChanged = Object.prototype.hasOwnProperty.call(data, 'lastFrameUrl') && data.lastFrameUrl !== existing.lastFrameUrl;
  const segment = await prisma.videoSequenceSegment.update({
    where: { id: segmentId },
    data,
  });
  if (lastFrameChanged) {
    await markDownstreamPreviousLastFrameSegmentsStale(sequenceId, existing.orderIndex);
  }
  if (mode === 'completed_video' && segment.outputVideoUrl) {
    return tryExtractVideoSequenceSegmentFrames(sequenceId, segmentId, segment);
  }
  return serializeVideoSegment(segment);
}

export async function deleteVideoSequenceSegment(sequenceId: string, segmentId: string) {
  const existing = await prisma.videoSequenceSegment.findFirst({ where: { id: segmentId, sequenceId }, select: { id: true } });
  if (!existing) throw new StudioSessionApiError(404, 'Video sequence segment not found');

  await prisma.$transaction(async (tx) => {
    await tx.videoSequenceSegment.delete({ where: { id: segmentId } });
    const remaining = await tx.videoSequenceSegment.findMany({
      where: { sequenceId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    await Promise.all(remaining.map((segment, orderIndex) => (
      tx.videoSequenceSegment.update({ where: { id: segment.id }, data: { orderIndex } })
    )));
  });
  return true;
}

function segmentDataFromInput(input: Record<string, unknown>, defaults: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (input.orderIndex !== undefined) data.orderIndex = asOptionalNonNegativeInt(input.orderIndex, 'orderIndex') ?? 0;
  if (input.title !== undefined || defaults.title !== undefined) data.title = asTrimmedString(input.title) ?? defaults.title ?? 'Segment';
  if (input.status !== undefined || defaults.status !== undefined) data.status = enumValue(input.status, segmentStatuses, 'status') ?? defaults.status;
  if (input.sourceMode !== undefined || defaults.sourceMode !== undefined) data.sourceMode = enumValue(input.sourceMode, sourceModes, 'sourceMode') ?? defaults.sourceMode;
  if (input.sourceFrameRole !== undefined || defaults.sourceFrameRole !== undefined) data.sourceFrameRole = enumValue(input.sourceFrameRole, sourceFrameRoles, 'sourceFrameRole') ?? defaults.sourceFrameRole;
  if (input.sourceFrozen !== undefined) data.sourceFrozen = asOptionalBoolean(input.sourceFrozen) ?? false;
  if (input.sourceImageUrl !== undefined) data.sourceImageUrl = asOptionalString(input.sourceImageUrl) || null;
  if (input.sourceImageAssetId !== undefined) data.sourceImageAssetId = asOptionalString(input.sourceImageAssetId) || null;
  if (input.sourceJobId !== undefined) data.sourceJobId = asOptionalString(input.sourceJobId) || null;
  if (input.sourceSegmentId !== undefined) data.sourceSegmentId = asOptionalString(input.sourceSegmentId) || null;
  if (input.prompt !== undefined) data.prompt = asOptionalString(input.prompt) ?? '';
  if (input.negativePrompt !== undefined) data.negativePrompt = asOptionalString(input.negativePrompt) ?? '';
  if (input.motionPrompt !== undefined) data.motionPrompt = asOptionalString(input.motionPrompt) ?? '';
  if (input.continuityPrompt !== undefined) data.continuityPrompt = asOptionalString(input.continuityPrompt) ?? '';
  if (input.modelId !== undefined || defaults.modelId !== undefined) data.modelId = asOptionalString(input.modelId) ?? defaults.modelId ?? 'wan22';
  if (input.endpointId !== undefined) data.endpointId = asOptionalString(input.endpointId) || null;
  if (input.loraConfig !== undefined || input.loraConfigJson !== undefined) data.loraConfigJson = toJsonString(input.loraConfig ?? input.loraConfigJson, {});
  if (input.generationOptions !== undefined || input.generationOptionsJson !== undefined) data.generationOptionsJson = toJsonString(input.generationOptions ?? input.generationOptionsJson, {});
  if (input.seed !== undefined) data.seed = input.seed === null || input.seed === '' ? null : asOptionalNonNegativeInt(input.seed, 'seed');
  if (input.randomizeSeed !== undefined) data.randomizeSeed = asOptionalBoolean(input.randomizeSeed) ?? true;
  if (input.durationSeconds !== undefined || defaults.durationSeconds !== undefined) data.durationSeconds = asOptionalPositiveInt(input.durationSeconds, 'durationSeconds') ?? defaults.durationSeconds ?? 6;
  if (input.generationJobId !== undefined) data.generationJobId = asOptionalString(input.generationJobId) || null;
  if (input.outputVideoUrl !== undefined) data.outputVideoUrl = asOptionalString(input.outputVideoUrl) || null;
  if (input.firstFrameUrl !== undefined) data.firstFrameUrl = asOptionalString(input.firstFrameUrl) || null;
  if (input.lastFrameUrl !== undefined) data.lastFrameUrl = asOptionalString(input.lastFrameUrl) || null;
  if (input.templateId !== undefined) data.templateId = asOptionalString(input.templateId) || null;
  if (input.templateSnapshot !== undefined || input.templateSnapshotJson !== undefined) data.templateSnapshotJson = toJsonString(input.templateSnapshot ?? input.templateSnapshotJson, {});
  if (input.generationSnapshot !== undefined || input.generationSnapshotJson !== undefined) data.generationSnapshotJson = toJsonString(input.generationSnapshot ?? input.generationSnapshotJson, {});
  if (input.error !== undefined) data.error = asOptionalString(input.error) || null;
  return data;
}

export async function listVideoSegmentTemplates(workspaceId: string) {
  const templates = await prisma.videoSegmentTemplate.findMany({
    where: { workspaceId },
    orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
  });
  return templates.map(serializeVideoSegmentTemplate);
}

export async function createVideoSegmentTemplate(workspaceId: string, input: Record<string, unknown>) {
  const template = await prisma.videoSegmentTemplate.create({
    data: templateCreateDataFromInput(workspaceId, input),
  });
  return serializeVideoSegmentTemplate(template);
}

export async function updateVideoSegmentTemplate(id: string, input: Record<string, unknown>) {
  const template = await prisma.videoSegmentTemplate.update({
    where: { id },
    data: templateUpdateDataFromInput(input),
  });
  return serializeVideoSegmentTemplate(template);
}

export async function deleteVideoSegmentTemplate(id: string) {
  await prisma.videoSegmentTemplate.delete({ where: { id } });
  return true;
}

function templateCreateDataFromInput(workspaceId: string, input: Record<string, unknown>): Prisma.VideoSegmentTemplateUncheckedCreateInput {
  return {
    workspaceId,
    name: asTrimmedString(input.name) ?? 'Untitled template',
    category: asTrimmedString(input.category) ?? 'General',
    description: asOptionalString(input.description) ?? '',
    promptTemplate: asOptionalString(input.promptTemplate) ?? '',
    negativePromptTemplate: asOptionalString(input.negativePromptTemplate) ?? '',
    motionTemplate: asOptionalString(input.motionTemplate) ?? '',
    continuityTemplate: asOptionalString(input.continuityTemplate) ?? '',
    variablesJson: toJsonString(input.variables ?? input.variablesJson, []),
    loraConfigJson: toJsonString(input.loraConfig ?? input.loraConfigJson, {}),
    generationOptionsJson: toJsonString(input.generationOptions ?? input.generationOptionsJson, {}),
    defaultDurationSeconds: asOptionalPositiveInt(input.defaultDurationSeconds, 'defaultDurationSeconds') ?? 6,
    thumbnailUrl: asOptionalString(input.thumbnailUrl) || null,
    sourceSegmentId: asOptionalString(input.sourceSegmentId) || null,
  };
}

function templateUpdateDataFromInput(input: Record<string, unknown>): Prisma.VideoSegmentTemplateUncheckedUpdateInput {
  const data: Prisma.VideoSegmentTemplateUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = asTrimmedString(input.name) ?? 'Untitled template';
  if (input.category !== undefined) data.category = asTrimmedString(input.category) ?? 'General';
  if (input.description !== undefined) data.description = asOptionalString(input.description) ?? '';
  if (input.promptTemplate !== undefined) data.promptTemplate = asOptionalString(input.promptTemplate) ?? '';
  if (input.negativePromptTemplate !== undefined) data.negativePromptTemplate = asOptionalString(input.negativePromptTemplate) ?? '';
  if (input.motionTemplate !== undefined) data.motionTemplate = asOptionalString(input.motionTemplate) ?? '';
  if (input.continuityTemplate !== undefined) data.continuityTemplate = asOptionalString(input.continuityTemplate) ?? '';
  if (input.variables !== undefined || input.variablesJson !== undefined) data.variablesJson = toJsonString(input.variables ?? input.variablesJson, []);
  if (input.loraConfig !== undefined || input.loraConfigJson !== undefined) data.loraConfigJson = toJsonString(input.loraConfig ?? input.loraConfigJson, {});
  if (input.generationOptions !== undefined || input.generationOptionsJson !== undefined) data.generationOptionsJson = toJsonString(input.generationOptions ?? input.generationOptionsJson, {});
  if (input.defaultDurationSeconds !== undefined) data.defaultDurationSeconds = asOptionalPositiveInt(input.defaultDurationSeconds, 'defaultDurationSeconds') ?? 6;
  if (input.thumbnailUrl !== undefined) data.thumbnailUrl = asOptionalString(input.thumbnailUrl) || null;
  if (input.sourceSegmentId !== undefined) data.sourceSegmentId = asOptionalString(input.sourceSegmentId) || null;
  return data;
}

export async function insertSegmentFromTemplate(sequenceId: string, input: Record<string, unknown>) {
  const templateId = asTrimmedString(input.templateId);
  if (!templateId) throw new StudioSessionApiError(400, 'templateId is required');

  const [sequence, template, count] = await Promise.all([
    prisma.videoSequence.findUnique({ where: { id: sequenceId }, select: { id: true } }),
    prisma.videoSegmentTemplate.findUnique({ where: { id: templateId } }),
    prisma.videoSequenceSegment.count({ where: { sequenceId } }),
  ]);
  if (!sequence) throw new StudioSessionApiError(404, 'Video sequence not found');
  if (!template) throw new StudioSessionApiError(404, 'Video segment template not found');

  const defaults = segmentCreateDefaults(count);
  const templateSnapshot = serializeVideoSegmentTemplate(template);
  const segment = await prisma.videoSequenceSegment.create({
    data: {
      sequenceId,
      ...defaults,
      title: asTrimmedString(input.title) ?? template.name,
      prompt: template.promptTemplate,
      negativePrompt: template.negativePromptTemplate,
      motionPrompt: template.motionTemplate,
      continuityPrompt: template.continuityTemplate,
      loraConfigJson: template.loraConfigJson,
      generationOptionsJson: template.generationOptionsJson,
      durationSeconds: template.defaultDurationSeconds,
      templateId: template.id,
      templateSnapshotJson: JSON.stringify(templateSnapshot),
      sourceMode: count === 0 ? 'initial' : 'previous_last_frame',
    },
  });
  return serializeVideoSegment(segment);
}

export async function saveSegmentAsTemplate(sequenceId: string, segmentId: string, input: Record<string, unknown>) {
  const segment = await prisma.videoSequenceSegment.findFirst({
    where: { id: segmentId, sequenceId },
    include: { sequence: { select: { workspaceId: true } } },
  });
  if (!segment) throw new StudioSessionApiError(404, 'Video sequence segment not found');

  const template = await prisma.videoSegmentTemplate.create({
    data: {
      workspaceId: segment.sequence.workspaceId,
      name: asTrimmedString(input.name) ?? segment.title,
      category: asTrimmedString(input.category) ?? 'General',
      description: asOptionalString(input.description) ?? '',
      promptTemplate: segment.prompt,
      negativePromptTemplate: segment.negativePrompt,
      motionTemplate: segment.motionPrompt,
      continuityTemplate: segment.continuityPrompt,
      variablesJson: toJsonString(input.variables ?? [], []),
      loraConfigJson: segment.loraConfigJson,
      generationOptionsJson: segment.generationOptionsJson,
      defaultDurationSeconds: segment.durationSeconds,
      thumbnailUrl: segment.lastFrameUrl ?? segment.firstFrameUrl,
      sourceSegmentId: segment.id,
    },
  });
  return serializeVideoSegmentTemplate(template);
}

export async function resolveVideoSegmentSourceFrame(sequenceId: string, segmentId: string) {
  const segment = await prisma.videoSequenceSegment.findFirst({
    where: { id: segmentId, sequenceId },
    include: {
      sequence: true,
    },
  });
  if (!segment) throw new StudioSessionApiError(404, 'Video sequence segment not found');

  if (segment.sourceMode === 'previous_last_frame') {
    const previous = await prisma.videoSequenceSegment.findFirst({
      where: {
        sequenceId,
        orderIndex: segment.orderIndex - 1,
      },
      select: {
        id: true,
        lastFrameUrl: true,
        outputVideoUrl: true,
      },
    });
    if (!previous?.lastFrameUrl) {
      throw new StudioSessionApiError(400, 'Previous segment last frame is required before generating this segment');
    }
    return { segment, sequence: segment.sequence, sourceFrameUrl: previous.lastFrameUrl, sourceSegmentId: previous.id };
  }

  if (segment.sourceMode === 'manual_frame') {
    if (segment.sourceImageUrl) {
      return { segment, sequence: segment.sequence, sourceFrameUrl: segment.sourceImageUrl, sourceSegmentId: segment.sourceSegmentId ?? null };
    }
    throw new StudioSessionApiError(400, 'Manual frame source image is required before generating this segment');
  }

  if (segment.sourceImageUrl && segment.sourceMode !== 'job_output') {
    return { segment, sequence: segment.sequence, sourceFrameUrl: segment.sourceImageUrl, sourceSegmentId: segment.sourceSegmentId ?? null };
  }

  if (segment.sourceSegmentId) {
    const sourceSegment = await prisma.videoSequenceSegment.findFirst({
      where: { id: segment.sourceSegmentId },
      select: { id: true, lastFrameUrl: true, firstFrameUrl: true, sourceImageUrl: true },
    });
    const sourceFrameUrl = sourceSegment?.lastFrameUrl || sourceSegment?.firstFrameUrl || sourceSegment?.sourceImageUrl;
    if (sourceFrameUrl) return { segment, sequence: segment.sequence, sourceFrameUrl, sourceSegmentId: sourceSegment?.id ?? null };
  }

  if (segment.sourceJobId) {
    const sourceJob = await prisma.job.findUnique({
      where: { id: segment.sourceJobId },
      select: { id: true, resultUrl: true, thumbnailUrl: true, imageInputPath: true },
    });
    const sourceFrameUrl = sourceJob?.resultUrl || sourceJob?.thumbnailUrl || sourceJob?.imageInputPath;
    if (sourceFrameUrl) return { segment, sequence: segment.sequence, sourceFrameUrl, sourceJobId: sourceJob?.id ?? null };
  }

  if (segment.sourceImageUrl) {
    return { segment, sequence: segment.sequence, sourceFrameUrl: segment.sourceImageUrl, sourceSegmentId: null };
  }

  throw new StudioSessionApiError(400, 'Source frame is required before generating this segment');
}

export function buildVideoSegmentGenerationFormData(input: {
  sequence: any;
  segment: any;
  sourceFrameUrl: string;
  sourceImage: { blob: Blob; filename: string; width?: number; height?: number };
  userId?: string;
}) {
  const { sequence, segment, sourceFrameUrl, sourceImage, userId = 'user-with-settings' } = input;
  const formData = new FormData();
  const sequenceGenerationOptions = stripResolutionOptions(parseJsonObjectField(sequence.defaultGenerationOptionsJson));
  const segmentGenerationOptions = stripResolutionOptions(parseJsonObjectField(segment.generationOptionsJson));
  const generationOptions = {
    ...sequenceGenerationOptions,
    ...segmentGenerationOptions,
  };
  generationOptions.width = positiveInteger(sequence.width) ?? 1280;
  generationOptions.height = positiveInteger(sequence.height) ?? 720;
  const loraConfig = parseJsonObjectField(segment.loraConfigJson);
  const prompt = [segment.prompt, segment.motionPrompt, segment.continuityPrompt]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join('\n\n');

  formData.append('userId', userId);
  formData.append('workspaceId', sequence.workspaceId);
  formData.append('language', 'en');
  formData.append('modelId', segment.modelId || sequence.defaultModelId || 'wan22');
  formData.append('prompt', prompt);
  formData.append('negativePrompt', segment.negativePrompt || '');
  formData.append('randomizeSeed', String(segment.randomizeSeed));
  formData.append('image', sourceImage.blob, sourceImage.filename);

  if (segment.seed !== null && segment.seed !== undefined && !segment.randomizeSeed) {
    formData.append('seed', String(segment.seed));
  }

  if (generationOptions.length === undefined && sequence.targetFps && segment.durationSeconds) {
    formData.append('length', String(Math.max(81, Math.min(161, Math.round(sequence.targetFps * segment.durationSeconds)))));
  }

  for (const [key, value] of Object.entries(generationOptions)) {
    appendScalarFormValue(formData, key, value);
  }
  for (const [key, value] of Object.entries(loraConfig)) {
    appendScalarFormValue(formData, key, value);
  }

  return {
    formData,
    snapshot: {
      modelId: segment.modelId || sequence.defaultModelId || 'wan22',
      prompt,
      negativePrompt: segment.negativePrompt || '',
      sourceFrameUrl,
      generationOptions,
      loraConfig,
      seed: segment.seed,
      randomizeSeed: segment.randomizeSeed,
      durationSeconds: segment.durationSeconds,
    },
  };
}

export async function generateVideoSequenceSegment(sequenceId: string, segmentId: string, input: Record<string, unknown> = {}) {
  const { segment, sequence, sourceFrameUrl } = await resolveVideoSegmentSourceFrame(sequenceId, segmentId);
  const sourceImage = await loadSourceImageBlob(sourceFrameUrl);
  const { formData, snapshot } = buildVideoSegmentGenerationFormData({
    sequence,
    segment,
    sourceFrameUrl,
    sourceImage,
    userId: asTrimmedString(input.userId) ?? 'user-with-settings',
  });

  const response = await submitGenerationFormData(formData);
  const payload = await response.json().catch(() => ({}));
  const jobId = typeof payload?.jobId === 'string' ? payload.jobId : null;
  if (!response.ok || !payload?.success || !jobId) {
    const error = typeof payload?.error === 'string' ? payload.error : 'Failed to queue segment generation';
    const failed = await prisma.videoSequenceSegment.update({
      where: { id: segmentId },
      data: {
        status: 'failed',
        error,
        generationSnapshotJson: JSON.stringify({ ...snapshot, error }),
      },
    });
    return { segment: serializeVideoSegment(failed), jobId: null, status: 'FAILED', error };
  }

  const updated = await prisma.videoSequenceSegment.update({
    where: { id: segmentId },
    data: {
      status: 'queued',
      generationJobId: jobId,
      error: null,
      generationSnapshotJson: JSON.stringify({
        ...snapshot,
        jobId,
        runpodJobId: typeof payload.runpodJobId === 'string' ? payload.runpodJobId : null,
        queuedAt: new Date().toISOString(),
      }),
    },
  });
  if (hasGeneratedSegmentOutput(segment)) {
    await markDownstreamPreviousLastFrameSegmentsStale(sequenceId, segment.orderIndex);
  }

  return { segment: serializeVideoSegment(updated), jobId, status: payload.status || 'IN_QUEUE' };
}

type GenerateFromResult = {
  sequenceId: string;
  startSegmentId: string;
  action: 'queued' | 'waiting' | 'blocked' | 'failed' | 'completed';
  segment: ReturnType<typeof serializeVideoSegment> | null;
  jobId: string | null;
  message: string;
  processedSegmentIds: string[];
};

const generatableSegmentStatuses = new Set(['draft', 'failed', 'stale']);

function generateFromResult(input: GenerateFromResult) {
  return input;
}

async function ensurePreviousLastFrame(sequenceId: string, segment: any) {
  if (segment.sourceMode !== 'previous_last_frame') return null;

  const previous = await prisma.videoSequenceSegment.findFirst({
    where: { sequenceId, orderIndex: segment.orderIndex - 1 },
    select: {
      id: true,
      title: true,
      status: true,
      generationJobId: true,
      outputVideoUrl: true,
      lastFrameUrl: true,
    },
  });
  if (!previous) {
    throw new StudioSessionApiError(400, 'Previous segment is required before generating this segment');
  }

  if ((previous.status === 'queued' || previous.status === 'processing') && previous.generationJobId) {
    const synced = await syncVideoSequenceSegmentStatus(sequenceId, previous.id);
    return synced.segment;
  }

  if (previous.status === 'completed' && previous.outputVideoUrl && !previous.lastFrameUrl) {
    try {
      return await extractVideoSequenceSegmentFrames(sequenceId, previous.id);
    } catch (error) {
      console.warn('Failed to extract previous segment frames during generate-from', {
        sequenceId,
        segmentId: previous.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return serializeVideoSegment(previous);
}

export async function generateVideoSequenceFrom(sequenceId: string, input: Record<string, unknown> = {}): Promise<GenerateFromResult> {
  const startSegmentId = asTrimmedString(input.segmentId);
  if (!startSegmentId) throw new StudioSessionApiError(400, 'segmentId is required');

  const sequence = await prisma.videoSequence.findUnique({
    where: { id: sequenceId },
    include: { segments: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!sequence) throw new StudioSessionApiError(404, 'Video sequence not found');

  const startIndex = sequence.segments.findIndex((segment) => segment.id === startSegmentId);
  if (startIndex === -1) throw new StudioSessionApiError(404, 'Video sequence segment not found');

  const processedSegmentIds: string[] = [];
  for (const segment of sequence.segments.slice(startIndex)) {
    processedSegmentIds.push(segment.id);

    if (segment.status === 'completed') {
      if (segment.outputVideoUrl && (!segment.firstFrameUrl || !segment.lastFrameUrl)) {
        try {
          await extractVideoSequenceSegmentFrames(sequenceId, segment.id);
        } catch (error) {
          console.warn('Failed to extract completed segment frames during generate-from', {
            sequenceId,
            segmentId: segment.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      continue;
    }

    if ((segment.status === 'queued' || segment.status === 'processing') && segment.generationJobId) {
      const synced = await syncVideoSequenceSegmentStatus(sequenceId, segment.id);
      if (synced.segment.status === 'completed') continue;
      if (synced.segment.status === 'failed') {
        return generateFromResult({
          sequenceId,
          startSegmentId,
          action: 'failed',
          segment: synced.segment,
          jobId: synced.segment.generationJobId,
          message: 'Generation stopped because an in-flight segment failed',
          processedSegmentIds,
        });
      }
      return generateFromResult({
        sequenceId,
        startSegmentId,
        action: 'waiting',
        segment: synced.segment,
        jobId: synced.segment.generationJobId,
        message: 'Generation is waiting for the current segment job to complete',
        processedSegmentIds,
      });
    }

    if (!generatableSegmentStatuses.has(segment.status)) {
      return generateFromResult({
        sequenceId,
        startSegmentId,
        action: 'blocked',
        segment: serializeVideoSegment(segment),
        jobId: segment.generationJobId,
        message: `Generation stopped at unsupported segment status: ${segment.status}`,
        processedSegmentIds,
      });
    }

    const previous = await ensurePreviousLastFrame(sequenceId, segment);
    if (previous && (previous.status !== 'completed' || !previous.lastFrameUrl)) {
      return generateFromResult({
        sequenceId,
        startSegmentId,
        action: 'waiting',
        segment: previous,
        jobId: previous.generationJobId,
        message: 'Generation is waiting for the previous segment last frame',
        processedSegmentIds,
      });
    }

    const generated = await generateVideoSequenceSegment(sequenceId, segment.id, input);
    if (generated.error) {
      return generateFromResult({
        sequenceId,
        startSegmentId,
        action: 'failed',
        segment: generated.segment,
        jobId: generated.jobId,
        message: generated.error,
        processedSegmentIds,
      });
    }

    return generateFromResult({
      sequenceId,
      startSegmentId,
      action: 'queued',
      segment: generated.segment,
      jobId: generated.jobId,
      message: 'Queued the next eligible segment',
      processedSegmentIds,
    });
  }

  return generateFromResult({
    sequenceId,
    startSegmentId,
    action: 'completed',
    segment: null,
    jobId: null,
    message: 'No draft, failed, or stale segments remain from the selected segment',
    processedSegmentIds,
  });
}

export async function renderVideoSequenceFinal(sequenceId: string) {
  const sequence = await prisma.videoSequence.findUnique({
    where: { id: sequenceId },
    include: { segments: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!sequence) throw new StudioSessionApiError(404, 'Video sequence not found');
  if (!sequence.segments.length) throw new StudioSessionApiError(400, 'At least one completed segment is required before rendering');

  for (const segment of sequence.segments) {
    if (segment.status !== 'completed') {
      throw new StudioSessionApiError(400, `Segment ${segment.orderIndex + 1} is ${segment.status}; render requires every segment to be completed`);
    }
    if (!segment.outputVideoUrl) {
      throw new StudioSessionApiError(400, `Segment ${segment.orderIndex + 1} is missing an output video`);
    }
  }

  const inputPaths: string[] = [];
  for (const segment of sequence.segments) {
    const outputVideoUrl = segment.outputVideoUrl as string;
    const inputPath = resolveLocalPublicPath(outputVideoUrl);
    if (!inputPath || !fs.existsSync(inputPath)) {
      throw new StudioSessionApiError(400, `Segment ${segment.orderIndex + 1} output video must be a local /generations or /results file`);
    }
    inputPaths.push(inputPath);
  }

  const ffmpegAvailable = await ffmpegService.isFFmpegAvailable();
  if (!ffmpegAvailable) {
    throw new StudioSessionApiError(500, 'FFmpeg is not available for final sequence rendering');
  }

  const renderHash = crypto.createHash('md5')
    .update(sequence.segments.map((segment) => `${segment.id}:${segment.outputVideoUrl}`).join('|'))
    .digest('hex')
    .slice(0, 10);
  const fileName = `final-${renderHash}.mp4`;
  const finalVideoUrl = sequenceRenderPublicUrl(sequence.workspaceId, sequenceId, fileName);
  const outputPath = sequenceRenderOutputPath(sequence.workspaceId, sequenceId, fileName);

  await ffmpegService.concatenateVideos(inputPaths, outputPath);

  const updated = await prisma.videoSequence.update({
    where: { id: sequenceId },
    data: {
      status: 'rendered',
      finalVideoUrl,
      finalRenderJobId: null,
    },
    include: { segments: { orderBy: { orderIndex: 'asc' } } },
  });

  return serializeVideoSequence(updated);
}

export async function extractVideoSequenceSegmentFrames(sequenceId: string, segmentId: string) {
  const segment = await prisma.videoSequenceSegment.findFirst({
    where: { id: segmentId, sequenceId },
    include: { sequence: { select: { workspaceId: true } } },
  });
  if (!segment) throw new StudioSessionApiError(404, 'Video sequence segment not found');

  const outputVideoUrl = segment.outputVideoUrl;
  if (!outputVideoUrl) {
    throw new StudioSessionApiError(400, 'Segment output video is required before extracting frames');
  }

  const inputPath = resolveLocalPublicPath(outputVideoUrl);
  if (!inputPath || !fs.existsSync(inputPath)) {
    throw new StudioSessionApiError(400, 'Segment output video must be a local /generations or /results file before extracting frames');
  }

  const ffmpegAvailable = await ffmpegService.isFFmpegAvailable();
  if (!ffmpegAvailable) {
    throw new StudioSessionApiError(500, 'FFmpeg is not available for segment frame extraction');
  }

  const hash = crypto.createHash('md5').update(outputVideoUrl).digest('hex').slice(0, 8);
  const firstFileName = `first-${hash}.jpg`;
  const lastFileName = `last-${hash}.jpg`;
  const firstFrameUrl = sequenceFramePublicUrl(segment.sequence.workspaceId, sequenceId, segmentId, firstFileName);
  const lastFrameUrl = sequenceFramePublicUrl(segment.sequence.workspaceId, sequenceId, segmentId, lastFileName);
  const previousLastFrameUrl = segment.lastFrameUrl;

  await ffmpegService.extractVideoFrame(
    inputPath,
    sequenceFrameOutputPath(segment.sequence.workspaceId, sequenceId, segmentId, firstFileName),
    { position: 'first', format: 'jpg', quality: 3 },
  );
  await ffmpegService.extractVideoFrame(
    inputPath,
    sequenceFrameOutputPath(segment.sequence.workspaceId, sequenceId, segmentId, lastFileName),
    { position: 'last', format: 'jpg', quality: 3 },
  );

  const existingSnapshot = parseJsonObjectField(segment.generationSnapshotJson);
  const updated = await prisma.videoSequenceSegment.update({
    where: { id: segmentId },
    data: {
      firstFrameUrl,
      lastFrameUrl,
      error: null,
      generationSnapshotJson: JSON.stringify({
        ...existingSnapshot,
        frameExtraction: {
          firstFrameUrl,
          lastFrameUrl,
          extractedAt: new Date().toISOString(),
        },
      }),
    },
  });
  if (previousLastFrameUrl !== lastFrameUrl) {
    await markDownstreamPreviousLastFrameSegmentsStale(sequenceId, segment.orderIndex);
  }

  return serializeVideoSegment(updated);
}

async function tryExtractVideoSequenceSegmentFrames(sequenceId: string, segmentId: string, fallbackSegment: unknown) {
  try {
    return await extractVideoSequenceSegmentFrames(sequenceId, segmentId);
  } catch (error) {
    console.warn('Failed to auto-extract video sequence segment frames after output update', {
      sequenceId,
      segmentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return serializeVideoSegment(fallbackSegment as Parameters<typeof serializeVideoSegment>[0]);
  }
}

export async function pickManualFrameForVideoSequenceSegment(sequenceId: string, segmentId: string, input: Record<string, unknown>) {
  const timeSeconds = asOptionalNonNegativeNumber(input.timeSeconds, 'timeSeconds');
  if (timeSeconds === undefined) {
    throw new StudioSessionApiError(400, 'timeSeconds is required');
  }

  const segment = await prisma.videoSequenceSegment.findFirst({
    where: { id: segmentId, sequenceId },
    include: { sequence: { select: { workspaceId: true } } },
  });
  if (!segment) throw new StudioSessionApiError(404, 'Video sequence segment not found');
  if (segment.orderIndex <= 0) {
    throw new StudioSessionApiError(400, 'Manual frame picker requires a previous segment');
  }

  const previous = await prisma.videoSequenceSegment.findFirst({
    where: { sequenceId, orderIndex: segment.orderIndex - 1 },
    select: { id: true, outputVideoUrl: true },
  });
  if (!previous?.outputVideoUrl) {
    throw new StudioSessionApiError(400, 'Previous segment output video is required before picking a manual frame');
  }

  const inputPath = resolveLocalPublicPath(previous.outputVideoUrl);
  if (!inputPath || !fs.existsSync(inputPath)) {
    throw new StudioSessionApiError(400, 'Previous segment output video must be a local /generations or /results file before picking a manual frame');
  }

  const ffmpegAvailable = await ffmpegService.isFFmpegAvailable();
  if (!ffmpegAvailable) {
    throw new StudioSessionApiError(500, 'FFmpeg is not available for manual frame picking');
  }

  const timeKey = timeSeconds.toFixed(3);
  const hash = crypto.createHash('md5')
    .update(`${previous.outputVideoUrl}:${timeKey}:${segmentId}`)
    .digest('hex')
    .slice(0, 10);
  const fileName = `manual-${hash}.jpg`;
  const sourceImageUrl = sequenceFramePublicUrl(segment.sequence.workspaceId, sequenceId, segmentId, fileName);

  await ffmpegService.extractVideoFrame(
    inputPath,
    sequenceFrameOutputPath(segment.sequence.workspaceId, sequenceId, segmentId, fileName),
    { position: 'first', time: timeKey, format: 'jpg', quality: 3 },
  );

  const existingSnapshot = parseJsonObjectField(segment.generationSnapshotJson);
  const data: Record<string, unknown> = {
    sourceMode: 'manual_frame',
    sourceImageUrl,
    sourceImageAssetId: null,
    sourceJobId: null,
    sourceSegmentId: previous.id,
    sourceFrameRole: 'custom',
    sourceFrozen: false,
    error: null,
    generationSnapshotJson: JSON.stringify({
      ...existingSnapshot,
      manualFramePicker: {
        sourceSegmentId: previous.id,
        sourceVideoUrl: previous.outputVideoUrl,
        sourceImageUrl,
        timeSeconds,
        pickedAt: new Date().toISOString(),
      },
    }),
  };
  if (hasGeneratedSegmentOutput(segment)) {
    data.status = 'stale';
  }

  const updated = await prisma.videoSequenceSegment.update({
    where: { id: segmentId },
    data,
  });

  return serializeVideoSegment(updated);
}

function segmentStatusFromJob(jobStatus: string) {
  if (jobStatus === 'completed') return 'completed';
  if (jobStatus === 'failed') return 'failed';
  if (jobStatus === 'processing' || jobStatus === 'finalizing') return 'processing';
  if (jobStatus === 'queued' || jobStatus === 'queueing_up') return 'queued';
  return 'queued';
}

export async function syncVideoSequenceSegmentStatus(sequenceId: string, segmentId: string) {
  const segment = await prisma.videoSequenceSegment.findFirst({
    where: { id: segmentId, sequenceId },
  });
  if (!segment) throw new StudioSessionApiError(404, 'Video sequence segment not found');
  if (!segment.generationJobId) throw new StudioSessionApiError(400, 'Segment has no generation job to sync');

  const job = await prisma.job.findUnique({ where: { id: segment.generationJobId } });
  if (!job) throw new StudioSessionApiError(404, 'Generation job not found');

  const existingSnapshot = parseJsonObjectField(segment.generationSnapshotJson);
  const options = parseJsonObjectField(job.options);
  const nextStatus = segmentStatusFromJob(job.status);
  const error = nextStatus === 'failed'
    ? (job.error || (typeof options.error === 'string' ? options.error : null) || 'Job failed')
    : null;
  const outputVideoUrl = nextStatus === 'completed' ? job.resultUrl || segment.outputVideoUrl : segment.outputVideoUrl;

  const updated = await prisma.videoSequenceSegment.update({
    where: { id: segmentId },
    data: {
      status: nextStatus,
      error,
      outputVideoUrl,
      generationSnapshotJson: JSON.stringify({
        ...existingSnapshot,
        jobStatus: job.status,
        runpodJobId: job.runpodJobId || options.runpodJobId || null,
        endpointId: job.endpointId || options.endpointId || null,
        resultUrl: job.resultUrl || null,
        thumbnailUrl: job.thumbnailUrl || null,
        executionMs: job.executionMs || null,
        syncedAt: new Date().toISOString(),
      }),
    },
  });

  if (nextStatus === 'completed' && outputVideoUrl && (outputVideoUrl !== segment.outputVideoUrl || !updated.firstFrameUrl || !updated.lastFrameUrl)) {
    try {
      const frameSegment = await extractVideoSequenceSegmentFrames(sequenceId, segmentId);
      return { segment: frameSegment, job };
    } catch (error) {
      console.warn('Failed to extract video sequence segment frames during status sync', {
        sequenceId,
        segmentId,
        outputVideoUrl,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { segment: serializeVideoSegment(updated), job };
}
