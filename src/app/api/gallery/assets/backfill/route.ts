import { NextRequest, NextResponse } from 'next/server';
import { backfillGalleryEnrichment } from '@/lib/galleryEnrichment';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const workspaceId = body.workspaceId;
    const limit = typeof body.limit === 'number' ? body.limit : 50;

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const result = await backfillGalleryEnrichment(workspaceId, limit);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Failed to backfill gallery enrichment:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
