import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import { createStudioPoseCategory, listStudioPoseCategories } from '@/lib/studio-sessions/poseLibraryServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function GETImpl(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = requireStudioSessionString(searchParams.get('workspaceId'), 'workspaceId');
    const categories = await listStudioPoseCategories(workspaceId);
    return studioSessionNoStoreJson({ success: true, categories });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio pose categories:');
  }
}

async function POSTImpl(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');
    const category = await createStudioPoseCategory(workspaceId, body ?? {});
    return studioSessionJson({ success: true, category }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to create Studio pose category:');
  }
}

export const GET = withWorkspaceRoute(GETImpl, 'content');
export const POST = withWorkspaceRoute(POSTImpl, 'content');
