import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import { deleteStudioPose, getStudioPose, updateStudioPose } from '@/lib/studio-sessions/poseLibraryServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function GETImpl(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const pose = await getStudioPose(id);
    if (!pose) return studioSessionJson({ success: false, error: 'Pose not found' }, { status: 404 });
    return studioSessionNoStoreJson({ success: true, pose });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio pose:');
  }
}

async function PATCHImpl(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

async function DELETEImpl(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const deleted = await deleteStudioPose(id);
    if (!deleted) return studioSessionJson({ success: false, error: 'Pose not found' }, { status: 404 });
    return studioSessionJson({ success: true, deleted });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to delete Studio pose:');
  }
}

export const GET = withWorkspaceRoute(GETImpl, 'content');
export const PATCH = withWorkspaceRoute(PATCHImpl, 'content');
export const DELETE = withWorkspaceRoute(DELETEImpl, 'content');
