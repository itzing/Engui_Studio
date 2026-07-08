import { NextRequest } from 'next/server';
import {
  createVideoSequence,
  listVideoSequences,
} from '@/lib/video-sequences/server';
import {
  handleStudioSessionApiError,
  readStudioSessionJsonBody,
  requireStudioSessionString,
  studioSessionJson,
  studioSessionNoStoreJson,
} from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const workspaceId = requireStudioSessionString(request.nextUrl.searchParams.get('workspaceId'), 'workspaceId');
    const sequences = await listVideoSequences(workspaceId);
    return studioSessionNoStoreJson({ success: true, sequences });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch video sequences:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');
    const sequence = await createVideoSequence(workspaceId, body ?? {});
    return studioSessionJson({ success: true, sequence }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to create video sequence:');
  }
}
