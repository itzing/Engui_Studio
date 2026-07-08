import { NextRequest } from 'next/server';
import {
  deleteVideoSequenceSegment,
  updateVideoSequenceSegment,
} from '@/lib/video-sequences/server';
import {
  handleStudioSessionApiError,
  readStudioSessionJsonBody,
  studioSessionJson,
} from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; segmentId: string }> },
) {
  try {
    const { id, segmentId } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const segment = await updateVideoSequenceSegment(id, segmentId, body ?? {});
    return studioSessionJson({ success: true, segment });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update video sequence segment:');
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; segmentId: string }> },
) {
  try {
    const { id, segmentId } = await context.params;
    await deleteVideoSequenceSegment(id, segmentId);
    return studioSessionJson({ success: true, deleted: true });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to delete video sequence segment:');
  }
}
