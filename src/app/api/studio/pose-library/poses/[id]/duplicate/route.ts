import { NextRequest } from 'next/server';
import { duplicateStudioPose } from '@/lib/studio-sessions/poseLibraryServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const result = await duplicateStudioPose(id, body ?? {});
    if (!result) return studioSessionJson({ success: false, error: 'Pose not found' }, { status: 404 });
    if ('error' in result) return studioSessionJson({ success: false, error: result.error }, { status: 400 });
    return studioSessionJson({ success: true, pose: result.pose }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to duplicate Studio pose:');
  }
}
