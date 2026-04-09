import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const includeTrashed = searchParams.get('includeTrashed') === 'true';
    const type = searchParams.get('type');
    const favoritesOnly = searchParams.get('favoritesOnly') === 'true';
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const tokens = Array.from(new Set(q.split(/\s+/).map(token => token.trim()).filter(Boolean)));
    const sort = searchParams.get('sort') || 'newest';
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const skip = (page - 1) * limit;

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const where = {
      workspaceId,
      ...(includeTrashed ? {} : { trashed: false }),
      ...(type && type !== 'all' ? { type } : {}),
      ...(favoritesOnly ? { favorited: true } : {}),
    };

    const assets = await prisma.galleryAsset.findMany({
      where,
      orderBy: sort === 'oldest'
        ? { addedToGalleryAt: 'asc' }
        : { addedToGalleryAt: 'desc' },
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

    if (tokens.length > 0) {
      normalizedAssets = normalizedAssets.filter(asset => {
        const haystack = [
          asset.id,
          asset.sourceJobId || '',
          asset.sourceOutputId || '',
          ...(asset.userTags || []),
          ...(asset.autoTags || []),
        ].join(' ').toLowerCase();
        return tokens.every(token => haystack.includes(token));
      });
    }

    if (sort === 'favorites') {
      normalizedAssets = normalizedAssets.sort((a, b) => {
        if (a.favorited !== b.favorited) return a.favorited ? -1 : 1;
        return new Date(b.addedToGalleryAt).getTime() - new Date(a.addedToGalleryAt).getTime();
      });
    }

    const totalCount = normalizedAssets.length;
    const paginatedAssets = normalizedAssets.slice(skip, skip + limit);
    const hasNextPage = totalCount > page * limit;

    return NextResponse.json({
      success: true,
      assets: paginatedAssets,
      pagination: {
        page,
        limit,
        totalCount,
        hasNextPage,
        hasPrevPage: page > 1,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch gallery assets:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
