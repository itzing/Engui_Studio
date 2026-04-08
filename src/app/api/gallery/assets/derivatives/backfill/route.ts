import { NextRequest, NextResponse } from 'next/server';
import { backfillGalleryDerivatives } from '@/lib/galleryDerivatives';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : '';
    const limit = typeof body.limit === 'number' ? body.limit : 50;

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const result = await backfillGalleryDerivatives(workspaceId, limit);
    return NextResponse.json({ success: true, processed: result.processed, results: result.results });
  } catch (error: any) {
    console.error('Failed to backfill gallery derivatives:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
