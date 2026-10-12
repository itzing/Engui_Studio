import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest, NextResponse } from 'next/server';
import { backfillGalleryDerivatives } from '@/lib/galleryDerivatives';

async function POSTImpl(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : '';
    const limit = typeof body.limit === 'number' ? body.limit : 50;
    const assetIds = Array.isArray(body.assetIds)
      ? body.assetIds.filter((assetId: unknown): assetId is string => typeof assetId === 'string')
      : [];

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const result = await backfillGalleryDerivatives(workspaceId, limit, assetIds);
    return NextResponse.json({ success: true, processed: result.processed, results: result.results });
  } catch (error: any) {
    console.error('Failed to backfill gallery derivatives:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withWorkspaceRoute(POSTImpl, 'content');
