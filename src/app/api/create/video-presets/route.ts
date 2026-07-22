import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { VideoCreatePreset } from '@/lib/create/videoPresets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TYPE_PREFIX = 'video-create:';

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Internal server error';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readOptions(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizePreset(input: unknown): VideoCreatePreset | null {
  if (!isRecord(input)) return null;
  const id = readString(input.id);
  const modelId = readString(input.modelId);
  const name = readString(input.name);
  if (!id || !modelId || !name) return null;

  return {
    id,
    modelId,
    name,
    prompt: typeof input.prompt === 'string' ? input.prompt : '',
    showAdvanced: input.showAdvanced === true,
    parameterValues: isRecord(input.parameterValues) ? input.parameterValues : {},
    createdAt: typeof input.createdAt === 'number' ? input.createdAt : Date.now(),
    updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : Date.now(),
  };
}

function toPreset(record: {
  id: string;
  name: string;
  type: string;
  options: string;
  createdAt: Date;
}): VideoCreatePreset | null {
  const options = readOptions(record.options);
  const modelId = record.type.startsWith(TYPE_PREFIX) ? record.type.slice(TYPE_PREFIX.length) : readString(options.modelId);
  if (!modelId) return null;

  return normalizePreset({
    id: record.id,
    modelId,
    name: record.name,
    prompt: options.prompt,
    showAdvanced: options.showAdvanced,
    parameterValues: options.parameterValues,
    createdAt: typeof options.createdAt === 'number' ? options.createdAt : record.createdAt.getTime(),
    updatedAt: typeof options.updatedAt === 'number' ? options.updatedAt : record.createdAt.getTime(),
  });
}

async function listPresets(workspaceId: string, modelId?: string): Promise<VideoCreatePreset[]> {
  const records = await prisma.preset.findMany({
    where: {
      userId: workspaceId,
      type: modelId ? `${TYPE_PREFIX}${modelId}` : { startsWith: TYPE_PREFIX },
    },
    orderBy: { createdAt: 'desc' },
  });

  return records
    .map(toPreset)
    .filter((preset): preset is VideoCreatePreset => !!preset)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = readString(searchParams.get('workspaceId'));
    const modelId = readString(searchParams.get('modelId'));
    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const presets = await listPresets(workspaceId, modelId || undefined);
    return NextResponse.json({ success: true, presets }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: unknown) {
    console.error('Failed to fetch video create presets:', error);
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workspaceId = readString(body?.workspaceId);
    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const inputs = Array.isArray(body?.presets) ? body.presets : [body?.preset];
    const presets = inputs
      .map(normalizePreset)
      .filter((preset): preset is VideoCreatePreset => !!preset);

    if (presets.length === 0) {
      return NextResponse.json({ success: false, error: 'preset is required' }, { status: 400 });
    }

    await prisma.$transaction(presets.map((preset) => prisma.preset.upsert({
      where: { id: preset.id },
      update: {
        userId: workspaceId,
        name: preset.name.trim(),
        type: `${TYPE_PREFIX}${preset.modelId}`,
        options: JSON.stringify({
          modelId: preset.modelId,
          prompt: preset.prompt,
          showAdvanced: preset.showAdvanced,
          parameterValues: preset.parameterValues,
          createdAt: preset.createdAt,
          updatedAt: preset.updatedAt,
        }),
      },
      create: {
        id: preset.id,
        userId: workspaceId,
        name: preset.name.trim(),
        type: `${TYPE_PREFIX}${preset.modelId}`,
        options: JSON.stringify({
          modelId: preset.modelId,
          prompt: preset.prompt,
          showAdvanced: preset.showAdvanced,
          parameterValues: preset.parameterValues,
          createdAt: preset.createdAt,
          updatedAt: preset.updatedAt,
        }),
      },
    })));

    const modelId = presets.length === 1 ? presets[0].modelId : undefined;
    return NextResponse.json({ success: true, presets: await listPresets(workspaceId, modelId) }, { status: 201 });
  } catch (error: unknown) {
    console.error('Failed to save video create preset:', error);
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 });
  }
}
