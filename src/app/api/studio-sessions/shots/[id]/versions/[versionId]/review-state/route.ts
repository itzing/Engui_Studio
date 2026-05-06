import { NextRequest } from 'next/server';
import { updateStudioSessionShotVersionReviewState } from '@/lib/studio-sessions/server';
import { handleStudioSessionApiError, readStudioSessionJsonBody, readStudioSessionOptionalBoolean, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const { id, versionId } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const hidden = readStudioSessionOptionalBoolean(body?.hidden);
    const rejected = readStudioSessionOptionalBoolean(body?.rejected);
    if (hidden === undefined && rejected === undefined) {
      return studioSessionJson({ success: false, error: 'hidden or rejected boolean is required' }, { status: 400 });
    }
    const version = await updateStudioSessionShotVersionReviewState({ shotId: id, versionId, hidden, rejected });
    if (!version) {
      return studioSessionJson({ success: false, error: 'Version not found' }, { status: 404 });
    }
    return studioSessionJson({ success: true, version });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update Studio Session version review state:');
  }
}
