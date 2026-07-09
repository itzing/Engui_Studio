import { NextRequest } from 'next/server';
import { pickManualFrameForVideoSequenceSegment } from '@/lib/video-sequences/server';
import {
  handleStudioSessionApiError,
  studioSessionJson,
} from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; segmentId: string }> },
) {
  try {
    const { id, segmentId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const segment = await pickManualFrameForVideoSequenceSegment(id, segmentId, body ?? {});
    return studioSessionJson({ success: true, segment });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to pick video sequence manual frame:');
  }
}
