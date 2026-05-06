import { NextRequest } from 'next/server';
import { updateStudioSessionShotSkipState } from '@/lib/studio-sessions/server';
import { handleStudioSessionApiError, readStudioSessionBoolean, readStudioSessionJsonBody, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const shot = await updateStudioSessionShotSkipState({ shotId: id, skipped: readStudioSessionBoolean(body?.skipped, 'skipped') });
    if (!shot) {
      return studioSessionJson({ success: false, error: 'Shot not found' }, { status: 404 });
    }
    return studioSessionJson({ success: true, shot });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update Studio Session shot skip state:');
  }
}
