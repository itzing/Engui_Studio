import { NextRequest, NextResponse } from 'next/server';
import { backfillGalleryUpscaleBucket } from '@/lib/galleryUpscaleBackfill';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const workspaceId = body.workspaceId;
    const limit = typeof body.limit === 'number' ? body.limit : 100;

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const result = await backfillGalleryUpscaleBucket(workspaceId, limit);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Failed to backfill upscale gallery bucket:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
