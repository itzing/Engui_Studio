import { NextRequest } from 'next/server';
import { syncVideoSequenceSegmentStatus } from '@/lib/video-sequences/server';
import {
  handleStudioSessionApiError,
  studioSessionJson,
} from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string; segmentId: string }> },
) {
  try {
    const { id, segmentId } = await context.params;
    const result = await syncVideoSequenceSegmentStatus(id, segmentId);
    return studioSessionJson({ success: true, segment: result.segment });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to sync video sequence segment status:');
  }
}
