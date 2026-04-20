import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type ReuseAction = 'txt2img' | 'img2img' | 'img2vid';

function parseGenerationSnapshot(raw: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function buildAvailableActions(asset: { type: string; originKind: string | null }) {
  if (asset.type !== 'image') return [] as ReuseAction[];
  return ['txt2img', 'img2img', 'img2vid'] as ReuseAction[];
}

function buildReusePayload(action: ReuseAction, asset: { originalUrl: string; type: string }, snapshot: Record<string, any>) {
  const prompt = typeof snapshot.prompt === 'string' ? snapshot.prompt : '';
  const modelId = typeof snapshot.modelId === 'string' ? snapshot.modelId : undefined;
  const baseOptions = { ...snapshot };
  delete baseOptions.prompt;
  delete baseOptions.modelId;
  delete baseOptions.endpointId;

  if (action === 'txt2img') {
    const txt2imgOptions = { ...baseOptions };
    if (modelId === 'z-image') {
      txt2imgOptions.use_controlnet = false;
      delete txt2imgOptions.image_path;
    }

    return {
      action,
      type: 'image',
      modelId,
      prompt,
      options: txt2imgOptions,
    };
  }

  if (action === 'img2img') {
    return {
      action,
      type: 'image',
      modelId,
      prompt,
      imageInputPath: asset.originalUrl,
      options: {
        ...baseOptions,
        ...(modelId === 'z-image' ? { use_controlnet: true } : {}),
        image_path: asset.originalUrl,
      },
    };
  }

  return {
    action,
    type: 'video',
    modelId: 'wan22',
    prompt,
    imageInputPath: asset.originalUrl,
    options: {
      width: typeof snapshot.width === 'number' ? snapshot.width : 768,
      height: typeof snapshot.height === 'number' ? snapshot.height : 512,
      image_path: asset.originalUrl,
    },
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const asset = await prisma.galleryAsset.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        originKind: true,
      },
    });

    if (!asset) {
      return NextResponse.json({ success: false, error: 'Gallery asset not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      assetId: asset.id,
      actions: buildAvailableActions(asset),
    });
  } catch (error: any) {
    console.error('Failed to get gallery reuse actions:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action as ReuseAction;

    if (!action || !['txt2img', 'img2img', 'img2vid'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Valid action is required' }, { status: 400 });
    }

    const asset = await prisma.galleryAsset.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        originKind: true,
        originalUrl: true,
        generationSnapshot: true,
      },
    });

    if (!asset) {
      return NextResponse.json({ success: false, error: 'Gallery asset not found' }, { status: 404 });
    }

    const availableActions = buildAvailableActions(asset);
    if (!availableActions.includes(action)) {
      return NextResponse.json({ success: false, error: 'Action is not compatible with this asset' }, { status: 400 });
    }

    const snapshot = parseGenerationSnapshot(asset.generationSnapshot);
    const payload = buildReusePayload(action, asset, snapshot);

    return NextResponse.json({
      success: true,
      assetId: asset.id,
      availableActions,
      payload,
    });
  } catch (error: any) {
    console.error('Failed to build gallery reuse payload:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
