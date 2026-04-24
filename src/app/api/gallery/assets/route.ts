import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseGenerationSnapshot(raw: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const includeTrashed = searchParams.get('includeTrashed') === 'true';
    const onlyTrashed = searchParams.get('onlyTrashed') === 'true';
    const type = searchParams.get('type');
    const types = Array.from(new Set((type || '').split(',').map(entry => entry.trim()).filter(Boolean)));
    const favoritesOnly = searchParams.get('favoritesOnly') === 'true';
    const bucket = (searchParams.get('bucket') || 'common').trim().toLowerCase();
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const tokens = Array.from(new Set(q.split(/\s+/).map(token => token.trim()).filter(Boolean)));
    const sort = searchParams.get('sort') || 'newest';
    const focusAssetId = searchParams.get('focusAssetId')?.trim() || null;
    const debugSource = searchParams.get('debugSource')?.trim() || null;
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const where = {
      workspaceId,
      ...(onlyTrashed ? { trashed: true } : includeTrashed ? {} : { trashed: false }),
      ...(types.length > 0 && !types.includes('all') ? { type: { in: types } } : {}),
      ...(bucket && bucket !== 'all' ? { bucket } : {}),
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
      bucket: asset.bucket,
      derivativeStatus: asset.derivativeStatus,
      enrichmentStatus: asset.enrichmentStatus,
      prompt: (() => {
        const snapshot = parseGenerationSnapshot(asset.generationSnapshot);
        return typeof snapshot.prompt === 'string' && snapshot.prompt.trim().length > 0 ? snapshot.prompt : null;
      })(),
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
    const focusAbsoluteIndex = focusAssetId ? normalizedAssets.findIndex(asset => asset.id === focusAssetId) : -1;
    const resolvedPage = focusAbsoluteIndex >= 0 ? Math.floor(focusAbsoluteIndex / limit) + 1 : page;
    const skip = (resolvedPage - 1) * limit;
    const paginatedAssets = normalizedAssets.slice(skip, skip + limit);
    const hasNextPage = totalCount > resolvedPage * limit;

    if (debugSource === 'mobile-initial-open' || debugSource === 'mobile-refresh' || debugSource === 'desktop-initial-open' || debugSource === 'desktop-refresh') {
      console.log('[gallery-debug]', JSON.stringify({
        debugSource,
        workspaceId,
        requestedPage: page,
        resolvedPage,
        limit,
        type: types.length > 0 ? types : ['all'],
        includeTrashed,
        onlyTrashed,
        favoritesOnly,
        bucket,
        q,
        tokenCount: tokens.length,
        firstAssetId: paginatedAssets[0]?.id || null,
        focusAssetId,
        totalCount,
      }));
    }

    return NextResponse.json({
      success: true,
      assets: paginatedAssets,
      focus: focusAssetId ? {
        assetId: focusAssetId,
        found: focusAbsoluteIndex >= 0,
        page: focusAbsoluteIndex >= 0 ? resolvedPage : null,
        indexOnPage: focusAbsoluteIndex >= 0 ? focusAbsoluteIndex % limit : null,
        absoluteIndex: focusAbsoluteIndex >= 0 ? focusAbsoluteIndex : null,
      } : undefined,
      pagination: {
        page: resolvedPage,
        limit,
        totalCount,
        hasNextPage,
        hasPrevPage: resolvedPage > 1,
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
