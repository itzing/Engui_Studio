import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { permanentlyDeleteGalleryAsset } from '@/lib/galleryCleanup';

function parseGenerationSnapshot(raw: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function toAssetResponse(asset: any, snapshot: Record<string, any>) {
  return {
    id: asset.id,
    workspaceId: asset.workspaceId,
    type: asset.type,
    bucket: asset.bucket,
    originalUrl: asset.originalUrl,
    previewUrl: asset.previewUrl,
    thumbnailUrl: asset.thumbnailUrl,
    favorited: asset.favorited,
    trashed: asset.trashed,
    userTags: asset.userTags ? JSON.parse(asset.userTags) : [],
    autoTags: asset.autoTags ? JSON.parse(asset.autoTags) : [],
    sourceJobId: asset.sourceJobId,
    sourceOutputId: asset.sourceOutputId,
    derivativeStatus: asset.derivativeStatus,
    enrichmentStatus: asset.enrichmentStatus,
    prompt: typeof snapshot.prompt === 'string' ? snapshot.prompt : null,
    modelId: typeof snapshot.modelId === 'string' ? snapshot.modelId : null,
    hasSceneSnapshot: !!(snapshot.sceneSnapshot && typeof snapshot.sceneSnapshot === 'object' && snapshot.sceneSnapshot.templateId === 'scene_template_v2'),
    addedToGalleryAt: asset.addedToGalleryAt,
    updatedAt: asset.updatedAt,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const asset = await prisma.galleryAsset.findUnique({ where: { id } });

    if (!asset) {
      return NextResponse.json({ success: false, error: 'Gallery asset not found' }, { status: 404 });
    }

    const snapshot = parseGenerationSnapshot(asset.generationSnapshot);

    return NextResponse.json({
      success: true,
      asset: toAssetResponse(asset, snapshot),
    });
  } catch (error: any) {
    console.error('Failed to fetch gallery asset:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const bucket = body?.bucket;

    if (bucket !== 'common' && bucket !== 'draft' && bucket !== 'upscale') {
      return NextResponse.json({ success: false, error: 'bucket must be common, draft, or upscale' }, { status: 400 });
    }

    const asset = await prisma.galleryAsset.update({
      where: { id },
      data: { bucket },
    });

    const snapshot = parseGenerationSnapshot(asset.generationSnapshot);

    return NextResponse.json({
      success: true,
      asset: toAssetResponse(asset, snapshot),
    });
  } catch (error: any) {
    console.error('Failed to update gallery asset:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const permanent = new URL(request.url).searchParams.get('permanent') === 'true';

    if (!permanent) {
      return NextResponse.json({ success: false, error: 'permanent=true is required' }, { status: 400 });
    }

    const result = await permanentlyDeleteGalleryAsset(id);
    return NextResponse.json({ success: true, deletedAssetId: result.id });
  } catch (error: any) {
    console.error('Failed to permanently delete gallery asset:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
