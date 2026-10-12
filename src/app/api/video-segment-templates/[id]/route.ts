import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import {
  deleteVideoSegmentTemplate,
  updateVideoSegmentTemplate,
} from '@/lib/video-sequences/server';
import {
  handleStudioSessionApiError,
  readStudioSessionJsonBody,
  studioSessionJson,
} from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function PATCHImpl(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const template = await updateVideoSegmentTemplate(id, body ?? {});
    return studioSessionJson({ success: true, template });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update video segment template:');
  }
}

async function DELETEImpl(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await deleteVideoSegmentTemplate(id);
    return studioSessionJson({ success: true, deleted: true });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to delete video segment template:');
  }
}

export const PATCH = withWorkspaceRoute(PATCHImpl, 'content');
export const DELETE = withWorkspaceRoute(DELETEImpl, 'content');
