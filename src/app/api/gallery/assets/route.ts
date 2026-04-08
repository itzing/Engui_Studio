import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const includeTrashed = searchParams.get('includeTrashed') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const assets = await prisma.galleryAsset.findMany({
      where: {
        workspaceId,
        ...(includeTrashed ? {} : { trashed: false }),
      },
      orderBy: { addedToGalleryAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      assets: assets.map(asset => ({
        id: asset.id,
        workspaceId: asset.workspaceId,
        type: asset.type,
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
        addedToGalleryAt: asset.addedToGalleryAt,
        updatedAt: asset.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('Failed to fetch gallery assets:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
