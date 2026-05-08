import { NextRequest } from 'next/server';
import { listStudioSessionShotPoses, manualPickStudioSessionShot } from '@/lib/studio-sessions/server';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = await listStudioSessionShotPoses(id);
    if (!payload) return studioSessionJson({ success: false, error: 'Shot not found' }, { status: 404 });
    return studioSessionNoStoreJson({ success: true, ...payload });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio shot poses:');
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const poseId = typeof body?.poseId === 'string' && body.poseId.trim() ? body.poseId.trim() : '';
    if (!poseId) return studioSessionJson({ success: false, error: 'poseId is required' }, { status: 400 });
    const revision = await manualPickStudioSessionShot({ shotId: id, poseId });
    if (!revision) return studioSessionJson({ success: false, error: 'Pose is not available for this shot' }, { status: 400 });
    return studioSessionJson({ success: true, revision });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to choose Studio shot pose:');
  }
}
