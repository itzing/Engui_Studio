import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const includeTrashed = searchParams.get('includeTrashed') === 'true';
    const type = searchParams.get('type');
    const favoritesOnly = searchParams.get('favoritesOnly') === 'true';
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const sort = searchParams.get('sort') || 'newest';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const assets = await prisma.galleryAsset.findMany({
      where: {
        workspaceId,
        ...(includeTrashed ? {} : { trashed: false }),
        ...(type && type !== 'all' ? { type } : {}),
        ...(favoritesOnly ? { favorited: true } : {}),
      },
      orderBy: sort === 'oldest'
        ? { addedToGalleryAt: 'asc' }
        : { addedToGalleryAt: 'desc' },
      take: limit,
    });

    let normalizedAssets = assets.map(asset => ({
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
    }));

    if (q) {
      normalizedAssets = normalizedAssets.filter(asset => {
        const haystack = [
          asset.id,
          asset.sourceJobId || '',
          asset.sourceOutputId || '',
          ...(asset.userTags || []),
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }

    if (sort === 'favorites') {
      normalizedAssets = normalizedAssets.sort((a, b) => {
        if (a.favorited !== b.favorited) return a.favorited ? -1 : 1;
        return new Date(b.addedToGalleryAt).getTime() - new Date(a.addedToGalleryAt).getTime();
      });
    }

    return NextResponse.json({
      success: true,
      assets: normalizedAssets,
    });
  } catch (error: any) {
    console.error('Failed to fetch gallery assets:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
