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

function toPreset(record: {
  id: string;
  name: string;
  type: string;
  options: string;
  createdAt: Date;
}): VideoCreatePreset | null {
  const modelId = record.type.startsWith(TYPE_PREFIX) ? record.type.slice(TYPE_PREFIX.length) : '';
  if (!modelId) return null;
  let options: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(record.options);
    options = isRecord(parsed) ? parsed : {};
  } catch {
    options = {};
  }

  return {
    id: record.id,
    modelId,
    name: record.name,
    prompt: typeof options.prompt === 'string' ? options.prompt : '',
    showAdvanced: options.showAdvanced === true,
    parameterValues: isRecord(options.parameterValues) ? options.parameterValues : {},
    createdAt: typeof options.createdAt === 'number' ? options.createdAt : record.createdAt.getTime(),
    updatedAt: typeof options.updatedAt === 'number' ? options.updatedAt : record.createdAt.getTime(),
  };
}

async function listPresets(workspaceId: string): Promise<VideoCreatePreset[]> {
  const records = await prisma.preset.findMany({
    where: {
      userId: workspaceId,
      type: { startsWith: TYPE_PREFIX },
    },
    orderBy: { createdAt: 'desc' },
  });

  return records
    .map(toPreset)
    .filter((preset): preset is VideoCreatePreset => !!preset)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const workspaceId = readString(body?.workspaceId);
    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    await prisma.preset.deleteMany({
      where: {
        id,
        userId: workspaceId,
        type: { startsWith: TYPE_PREFIX },
      },
    });

    return NextResponse.json({ success: true, presets: await listPresets(workspaceId) });
  } catch (error: unknown) {
    console.error('Failed to delete video create preset:', error);
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 });
  }
}
