import { NextRequest, NextResponse } from 'next/server';
import { listStudioSessionShotPoses } from '@/lib/studio-sessions/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = await listStudioSessionShotPoses(id);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Shot not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, shot: payload.shot, poses: payload.poses }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch Studio Session shot poses:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
