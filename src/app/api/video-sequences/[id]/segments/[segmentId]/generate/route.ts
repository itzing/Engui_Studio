import { NextRequest } from 'next/server';
import { generateVideoSequenceSegment } from '@/lib/video-sequences/server';
import {
  handleStudioSessionApiError,
  readStudioSessionJsonBody,
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
    const body = await readStudioSessionJsonBody(request);
    const result = await generateVideoSequenceSegment(id, segmentId, body ?? {});
    return studioSessionJson({ success: !result.error, ...result }, { status: result.error ? 500 : 202 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to generate video sequence segment:');
  }
}
