import { NextRequest, NextResponse } from 'next/server';
import { manualPickStudioSessionShot } from '@/lib/studio-sessions/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const poseId = typeof body?.poseId === 'string' ? body.poseId.trim() : '';
    if (!poseId) {
      return NextResponse.json({ success: false, error: 'poseId is required' }, { status: 400 });
    }
    const revision = await manualPickStudioSessionShot({ shotId: id, poseId });
    if (!revision) {
      return NextResponse.json({ success: false, error: 'Shot or pose not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, revision });
  } catch (error: any) {
    console.error('Failed to manually pick Studio Session shot pose:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
