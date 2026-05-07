import { NextRequest } from 'next/server';
import { deleteStudioSessionRun, getStudioSessionRun } from '@/lib/studio-sessions/server';
import { updateStudioRun } from '@/lib/studio-sessions/portfolioServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = await getStudioSessionRun(id);
    if (!payload) return studioSessionJson({ success: false, error: 'Run not found' }, { status: 404 });
    return studioSessionNoStoreJson({ success: true, run: payload.run, shots: payload.shots, revisions: payload.revisions, versions: payload.versions });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio run:');
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const result = await updateStudioRun(id, body ?? {});
    if ('error' in result) return studioSessionJson({ success: false, error: result.error }, { status: result.error === 'Run not found' ? 404 : 400 });
    return studioSessionJson({ success: true, run: result.run });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update Studio run:');
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const deleted = await deleteStudioSessionRun(id);
    if (!deleted) return studioSessionJson({ success: false, error: 'Run not found' }, { status: 404 });
    return studioSessionJson({ success: true, deleted });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to delete Studio run:');
  }
}
