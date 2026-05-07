import { NextRequest } from 'next/server';
import { updateStudioVersionReview } from '@/lib/studio-sessions/portfolioServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const reviewState = requireStudioSessionString(body?.reviewState, 'reviewState') as any;
    const version = await updateStudioVersionReview({ versionId: id, reviewState, reviewNote: typeof body?.reviewNote === 'string' ? body.reviewNote : undefined });
    if (!version) return studioSessionJson({ success: false, error: 'Version not found' }, { status: 404 });
    return studioSessionJson({ success: true, version });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update Studio version review:');
  }
}
