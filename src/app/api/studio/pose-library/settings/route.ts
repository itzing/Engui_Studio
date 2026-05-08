import { NextRequest } from 'next/server';
import { ensureStudioPoseLibrarySettings, updateStudioPoseLibrarySettings } from '@/lib/studio-sessions/poseLibraryServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = requireStudioSessionString(searchParams.get('workspaceId'), 'workspaceId');
    const settings = await ensureStudioPoseLibrarySettings(workspaceId);
    return studioSessionNoStoreJson({ success: true, settings });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio pose library settings:');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');
    const settings = await updateStudioPoseLibrarySettings(workspaceId, body ?? {});
    return studioSessionJson({ success: true, settings });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update Studio pose library settings:');
  }
}
