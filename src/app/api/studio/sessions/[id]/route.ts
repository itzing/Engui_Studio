import { NextRequest } from 'next/server';
import { deleteStudioPhotoSession, getStudioPhotoSession, updateStudioPhotoSession } from '@/lib/studio-sessions/portfolioServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = await getStudioPhotoSession(id);
    if (!payload) return studioSessionJson({ success: false, error: 'Session not found' }, { status: 404 });
    return studioSessionNoStoreJson({ success: true, ...payload });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio photo session:');
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const session = await updateStudioPhotoSession(id, body ?? {});
    if (!session) return studioSessionJson({ success: false, error: 'Session not found' }, { status: 404 });
    return studioSessionJson({ success: true, session });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update Studio photo session:');
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const deleted = await deleteStudioPhotoSession(id);
    if (!deleted) return studioSessionJson({ success: false, error: 'Session not found' }, { status: 404 });
    return studioSessionJson({ success: true, deleted });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to delete Studio photo session:');
  }
}
