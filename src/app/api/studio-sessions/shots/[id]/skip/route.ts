import { NextRequest, NextResponse } from 'next/server';
import { updateStudioSessionShotSkipState } from '@/lib/studio-sessions/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (typeof body.skipped !== 'boolean') {
      return NextResponse.json({ success: false, error: 'skipped boolean is required' }, { status: 400 });
    }
    const shot = await updateStudioSessionShotSkipState({ shotId: id, skipped: body.skipped });
    if (!shot) {
      return NextResponse.json({ success: false, error: 'Shot not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, shot });
  } catch (error: any) {
    console.error('Failed to update Studio Session shot skip state:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
