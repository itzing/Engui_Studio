import { NextRequest } from 'next/server';
import { renderVideoSequenceFinal } from '@/lib/video-sequences/server';
import {
  handleStudioSessionApiError,
  studioSessionJson,
} from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const sequence = await renderVideoSequenceFinal(id);
    return studioSessionJson({ success: true, sequence });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to render video sequence:');
  }
}
