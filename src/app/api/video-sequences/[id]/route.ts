import { NextRequest } from 'next/server';
import {
  deleteVideoSequence,
  getVideoSequence,
  updateVideoSequence,
} from '@/lib/video-sequences/server';
import {
  handleStudioSessionApiError,
  readStudioSessionJsonBody,
  studioSessionJson,
  studioSessionNoStoreJson,
} from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sequence = await getVideoSequence(id);
    if (!sequence) return studioSessionJson({ success: false, error: 'Video sequence not found' }, { status: 404 });
    return studioSessionNoStoreJson({ success: true, sequence });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch video sequence:');
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const sequence = await updateVideoSequence(id, body ?? {});
    return studioSessionJson({ success: true, sequence });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update video sequence:');
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await deleteVideoSequence(id);
    return studioSessionJson({ success: true, deleted: true });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to delete video sequence:');
  }
}
