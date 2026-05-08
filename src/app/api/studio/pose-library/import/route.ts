import { NextRequest } from 'next/server';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';
import { importStudioPoseLibrary } from '@/lib/studio-sessions/poseLibraryServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');
    const mode = body?.mode === 'replace_all' ? 'replace_all' : 'merge';
    const categoryId = typeof body?.categoryId === 'string' && body.categoryId.trim() ? body.categoryId.trim() : null;
    const result = await importStudioPoseLibrary({ workspaceId, mode, categoryId, payload: body?.library });
    if ('error' in result) return studioSessionNoStoreJson({ success: false, error: result.error }, { status: 400 });
    return studioSessionNoStoreJson({ success: true, ...result });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to import Studio pose library:');
  }
}
