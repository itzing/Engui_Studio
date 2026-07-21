import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { SceneSnapshot } from '@/lib/prompt-constructor/types';

type ReuseAction = 'txt2img' | 'img2img' | 'img2vid' | 'scene-template-v2';
type GalleryReuseAsset = {
  id?: string;
  type: string;
  originKind?: string | null;
  originalUrl: string;
  thumbnailUrl?: string | null;
  generationSnapshot?: string | null;
  sourceJobId?: string | null;
  sourceOutputId?: string | null;
  workspaceId?: string | null;
};

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

function isWan22VideoAsset(asset: { type: string }, snapshot: Record<string, any>) {
  return asset.type === 'video' && snapshot.modelId === 'wan22';
}

function buildAvailableActions(asset: { type: string; originKind?: string | null }, snapshot: Record<string, any>) {
  const actions: ReuseAction[] = [];
  if (asset.type === 'image') {
    actions.push('txt2img', 'img2img', 'img2vid');
  }
  if (isWan22VideoAsset(asset, snapshot)) {
    actions.push('txt2img', 'img2vid');
  }
  if (parseSceneSnapshot(snapshot.sceneSnapshot)) {
    actions.push('scene-template-v2');
  }
  return actions;
}

function normalizeReusableImagePath(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

function normalizeSnapshot(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
}

function resolveImg2VidImageInput(asset: GalleryReuseAsset, snapshot: Record<string, any>, sourceJobImageInputPath?: string | null) {
  if (asset.type === 'image') {
    return asset.originalUrl;
  }

  return normalizeReusableImagePath(snapshot.image_path)
    || normalizeReusableImagePath(snapshot.imageInputPath)
    || normalizeReusableImagePath(snapshot.sourceImageUrl)
    || normalizeReusableImagePath(snapshot.source_image)
    || normalizeReusableImagePath(sourceJobImageInputPath)
    || normalizeReusableImagePath(asset.thumbnailUrl);
}

function buildReusePayload(
  action: ReuseAction,
  asset: GalleryReuseAsset,
  snapshot: Record<string, any>,
  sourceJobImageInputPath?: string | null,
  promptOverride?: string | null,
) {
  const prompt = typeof snapshot.prompt === 'string' ? snapshot.prompt : '';
  const modelId = typeof snapshot.modelId === 'string' ? snapshot.modelId : undefined;
  const baseOptions = { ...snapshot };
  delete baseOptions.prompt;
  delete baseOptions.modelId;
  delete baseOptions.endpointId;

  if (action === 'txt2img') {
    const sourceSnapshot = asset.type === 'video'
      ? normalizeSnapshot(snapshot.sourceImageGenerationSnapshot)
      : snapshot;
    if (!sourceSnapshot) {
      return null;
    }
    const sourcePrompt = asset.type !== 'video' && typeof promptOverride === 'string'
      ? promptOverride
      : typeof sourceSnapshot.prompt === 'string' ? sourceSnapshot.prompt : '';
    const sourceModelId = typeof sourceSnapshot.modelId === 'string' ? sourceSnapshot.modelId : undefined;
    const sourceOptions = { ...sourceSnapshot };
    delete sourceOptions.prompt;
    delete sourceOptions.modelId;
    delete sourceOptions.endpointId;
    delete sourceOptions.sourceImageGenerationSnapshot;

    const txt2imgOptions = asset.type === 'video' ? { ...sourceOptions } : { ...baseOptions };
    delete txt2imgOptions.image_path;
    delete txt2imgOptions.image_path_2;

    if (sourceModelId === 'z-image') {
      txt2imgOptions.use_controlnet = false;
      txt2imgOptions.task_type = '';
    }

    return {
      action,
      type: 'image',
      modelId: sourceModelId,
      prompt: sourcePrompt,
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

  const imageInputPath = resolveImg2VidImageInput(asset, snapshot, sourceJobImageInputPath);
  const videoOptions = {
    ...baseOptions,
    width: typeof snapshot.width === 'number' ? snapshot.width : 768,
    height: typeof snapshot.height === 'number' ? snapshot.height : 512,
    ...(imageInputPath ? { image_path: imageInputPath } : {}),
  };

  return {
    action,
    type: 'video',
    modelId: 'wan22',
    prompt,
    imageInputPath,
    ...(asset.type === 'image' ? { sourceImageGenerationSnapshot: { ...snapshot, prompt, modelId } } : {}),
    ...(asset.type === 'image' ? { preserveVideoDraftFields: true } : {}),
    options: videoOptions,
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
        originalUrl: true,
        thumbnailUrl: true,
        generationSnapshot: true,
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
    const promptOverride = action === 'txt2img' && typeof body.promptOverride === 'string' ? body.promptOverride : null;

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
        thumbnailUrl: true,
        generationSnapshot: true,
        sourceJobId: true,
        sourceOutputId: true,
        workspaceId: true,
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

    let sourceJobImageInputPath: string | null = null;
    if (action === 'img2vid' && asset.type === 'video' && asset.sourceJobId) {
      const sourceJob = await prisma.job.findUnique({
        where: { id: asset.sourceJobId },
        select: { imageInputPath: true },
      });
      sourceJobImageInputPath = sourceJob?.imageInputPath || null;
    }

    const payload = buildReusePayload(action as 'txt2img' | 'img2img' | 'img2vid', asset, snapshot, sourceJobImageInputPath, promptOverride);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Source image metadata is not available for this video' }, { status: 400 });
    }

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
