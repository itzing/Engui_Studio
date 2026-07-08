import { NextRequest } from 'next/server';
import { saveSegmentAsTemplate } from '@/lib/video-sequences/server';
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
    const template = await saveSegmentAsTemplate(id, segmentId, body ?? {});
    return studioSessionJson({ success: true, template }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to save video sequence segment template:');
  }
}
