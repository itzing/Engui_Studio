import { NextRequest } from 'next/server';
import { reorderStudioPoseCategories } from '@/lib/studio-sessions/poseLibraryServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0) : [];
    const categories = await reorderStudioPoseCategories(workspaceId, ids);
    return studioSessionJson({ success: true, categories });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to reorder Studio pose categories:');
  }
}
