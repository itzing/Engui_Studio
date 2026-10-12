import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import { addVideoSequenceFinalToGallery } from '@/lib/video-sequences/server';
import {
  handleStudioSessionApiError,
  studioSessionJson,
} from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function POSTImpl(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const result = await addVideoSequenceFinalToGallery(id);
    return studioSessionJson({ success: true, ...result });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to add video sequence final to Gallery:');
  }
}

export const POST = withWorkspaceRoute(POSTImpl, 'content');
