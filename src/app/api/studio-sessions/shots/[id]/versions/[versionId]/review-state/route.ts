import { NextRequest, NextResponse } from 'next/server';
import { updateStudioSessionShotVersionReviewState } from '@/lib/studio-sessions/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const { id, versionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const version = await updateStudioSessionShotVersionReviewState({
      shotId: id,
      versionId,
      hidden: typeof body.hidden === 'boolean' ? body.hidden : undefined,
      rejected: typeof body.rejected === 'boolean' ? body.rejected : undefined,
    });
    if (!version) {
      return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, version });
  } catch (error: any) {
    console.error('Failed to update Studio Session version review state:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
