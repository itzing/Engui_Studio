import { NextRequest } from 'next/server';
import { exportStudioPoseLibrary } from '@/lib/studio-sessions/poseLibraryServer';
import { handleStudioSessionApiError, requireStudioSessionString, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const workspaceId = requireStudioSessionString(request.nextUrl.searchParams.get('workspaceId'), 'workspaceId');
    const categoryId = request.nextUrl.searchParams.get('categoryId')?.trim() || null;
    const library = await exportStudioPoseLibrary({ workspaceId, categoryId });
    return studioSessionNoStoreJson({ success: true, library });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to export Studio pose library:');
  }
}
