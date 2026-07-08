import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { StudioSessionApiError } from '@/lib/studio-sessions/api';

const sequenceStatuses = ['draft', 'ready', 'rendering', 'rendered', 'failed'] as const;
const segmentStatuses = ['draft', 'queued', 'processing', 'completed', 'failed', 'stale'] as const;
const sourceModes = ['initial', 'previous_last_frame', 'gallery_asset', 'job_output', 'upload', 'manual_frame'] as const;
const sourceFrameRoles = ['first', 'last', 'custom'] as const;

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

function segmentCreateDefaults(orderIndex: number) {
  return {
    orderIndex,
    title: `Segment ${orderIndex + 1}`,
    sourceMode: orderIndex === 0 ? 'initial' : 'previous_last_frame',
    sourceFrameRole: 'last',
    status: 'draft',
    modelId: 'wan22',
    durationSeconds: 6,
  };
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
      defaultGenerationOptionsJson: toJsonString(input.defaultGenerationOptions ?? input.defaultGenerationOptionsJson, {}),
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
  const existing = await prisma.videoSequenceSegment.findFirst({ where: { id: segmentId, sequenceId }, select: { id: true } });
  if (!existing) throw new StudioSessionApiError(404, 'Video sequence segment not found');

  const segment = await prisma.videoSequenceSegment.update({
    where: { id: segmentId },
    data: segmentDataFromInput(input, {}),
  });
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
