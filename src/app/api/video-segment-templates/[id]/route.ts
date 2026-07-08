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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const template = await updateVideoSegmentTemplate(id, body ?? {});
    return studioSessionJson({ success: true, template });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update video segment template:');
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await deleteVideoSegmentTemplate(id);
    return studioSessionJson({ success: true, deleted: true });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to delete video segment template:');
  }
}
