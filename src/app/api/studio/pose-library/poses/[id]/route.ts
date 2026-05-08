import { NextRequest } from 'next/server';
import { deleteStudioPose, getStudioPose, updateStudioPose } from '@/lib/studio-sessions/poseLibraryServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const pose = await getStudioPose(id);
    if (!pose) return studioSessionJson({ success: false, error: 'Pose not found' }, { status: 404 });
    return studioSessionNoStoreJson({ success: true, pose });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio pose:');
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const result = await updateStudioPose(id, body ?? {});
    if (!result) return studioSessionJson({ success: false, error: 'Pose not found' }, { status: 404 });
    if ('error' in result) return studioSessionJson({ success: false, error: result.error }, { status: 400 });
    return studioSessionJson({ success: true, pose: result });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update Studio pose:');
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const deleted = await deleteStudioPose(id);
    if (!deleted) return studioSessionJson({ success: false, error: 'Pose not found' }, { status: 404 });
    return studioSessionJson({ success: true, deleted });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to delete Studio pose:');
  }
}
