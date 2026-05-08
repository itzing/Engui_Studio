import { NextRequest } from 'next/server';
import { reorderStudioPoses } from '@/lib/studio-sessions/poseLibraryServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');
    const categoryId = requireStudioSessionString(body?.categoryId, 'categoryId');
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0) : [];
    const poses = await reorderStudioPoses(workspaceId, categoryId, ids);
    return studioSessionJson({ success: true, poses });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to reorder Studio poses:');
  }
}
