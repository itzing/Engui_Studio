import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { SceneSnapshot } from '@/lib/prompt-constructor/types';

type ReuseAction = 'txt2img' | 'img2img' | 'img2vid' | 'scene-template-v2';

function parseGenerationSnapshot(raw: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function parseSceneSnapshot(snapshot: unknown): SceneSnapshot | null {
  return snapshot && typeof snapshot === 'object' && (snapshot as Record<string, any>).templateId === 'scene_template_v2'
    ? snapshot as SceneSnapshot
    : null;
}

function buildAvailableActions(asset: { type: string; originKind: string | null }, snapshot: Record<string, any>) {
  const actions: ReuseAction[] = [];
  if (asset.type === 'image') {
    actions.push('txt2img', 'img2img', 'img2vid');
  }
  if (parseSceneSnapshot(snapshot.sceneSnapshot)) {
    actions.push('scene-template-v2');
  }
  return actions;
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

    const snapshot = parseGenerationSnapshot(asset.generationSnapshot as string | null);

    return NextResponse.json({
      success: true,
      assetId: asset.id,
      actions: buildAvailableActions(asset, snapshot),
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

    if (!action || !['txt2img', 'img2img', 'img2vid', 'scene-template-v2'].includes(action)) {
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

    const snapshot = parseGenerationSnapshot(asset.generationSnapshot);
    const availableActions = buildAvailableActions(asset, snapshot);
    if (!availableActions.includes(action)) {
      return NextResponse.json({ success: false, error: 'Action is not compatible with this asset' }, { status: 400 });
    }

    if (action === 'scene-template-v2') {
      const sceneSnapshot = parseSceneSnapshot(snapshot.sceneSnapshot);
      if (!sceneSnapshot) {
        return NextResponse.json({ success: false, error: 'This gallery asset does not contain a reusable scene snapshot' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        assetId: asset.id,
        availableActions,
        payload: {
          workflow: 'scene-template-v2',
          workspaceId: typeof asset.workspaceId === 'string' ? asset.workspaceId : null,
          sourceJobId: typeof snapshot.sourceJobId === 'string' ? snapshot.sourceJobId : asset.sourceJobId || asset.id,
          snapshot: sceneSnapshot,
        },
      });
    }

    const payload = buildReusePayload(action as 'txt2img' | 'img2img' | 'img2vid', asset, snapshot);

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
