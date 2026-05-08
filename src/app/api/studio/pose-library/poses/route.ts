import { NextRequest } from 'next/server';
import { createStudioPose, listStudioPoses } from '@/lib/studio-sessions/poseLibraryServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = requireStudioSessionString(searchParams.get('workspaceId'), 'workspaceId');
    const poses = await listStudioPoses({
      workspaceId,
      categoryId: searchParams.get('categoryId'),
      query: searchParams.get('query'),
      orientation: searchParams.get('orientation'),
      framing: searchParams.get('framing'),
      cameraAngle: searchParams.get('cameraAngle'),
      preview: searchParams.get('preview') === 'has' ? 'has' : searchParams.get('preview') === 'missing' ? 'missing' : null,
    });
    return studioSessionNoStoreJson({ success: true, poses });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio poses:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');
    const result = await createStudioPose(workspaceId, body ?? {});
    if ('error' in result) return studioSessionJson({ success: false, error: result.error }, { status: 400 });
    return studioSessionJson({ success: true, pose: result.pose }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to create Studio pose:');
  }
}
