import { NextRequest } from 'next/server';
import { createStudioPoseCategory, listStudioPoseCategories } from '@/lib/studio-sessions/poseLibraryServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = requireStudioSessionString(searchParams.get('workspaceId'), 'workspaceId');
    const categories = await listStudioPoseCategories(workspaceId);
    return studioSessionNoStoreJson({ success: true, categories });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio pose categories:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');
    const category = await createStudioPoseCategory(workspaceId, body ?? {});
    return studioSessionJson({ success: true, category }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to create Studio pose category:');
  }
}
