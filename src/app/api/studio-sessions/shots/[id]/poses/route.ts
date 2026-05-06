import { NextRequest } from 'next/server';
import { listStudioSessionShotPoses } from '@/lib/studio-sessions/server';
import { handleStudioSessionApiError, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = await listStudioSessionShotPoses(id);
    if (!payload) {
      return studioSessionJson({ success: false, error: 'Shot not found' }, { status: 404 });
    }
    return studioSessionNoStoreJson({ success: true, shot: payload.shot, poses: payload.poses });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio Session shot poses:');
  }
}
