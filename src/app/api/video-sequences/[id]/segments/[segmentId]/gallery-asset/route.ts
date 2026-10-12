import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import { applyGalleryAssetToVideoSequenceSegment } from '@/lib/video-sequences/server';
import {
  handleStudioSessionApiError,
  readStudioSessionJsonBody,
  studioSessionJson,
} from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function POSTImpl(
  request: NextRequest,
  context: { params: Promise<{ id: string; segmentId: string }> },
) {
  try {
    const { id, segmentId } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const segment = await applyGalleryAssetToVideoSequenceSegment(id, segmentId, body ?? {});
    return studioSessionJson({ success: true, segment });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to apply gallery asset to video sequence segment:');
  }
}

export const POST = withWorkspaceRoute(POSTImpl, 'content');
