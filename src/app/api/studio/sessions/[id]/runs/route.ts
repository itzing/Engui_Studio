import { NextRequest } from 'next/server';
import { createStudioPhotoSessionRun, listStudioPhotoSessionRuns } from '@/lib/studio-sessions/portfolioServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const runs = await listStudioPhotoSessionRuns(id);
    return studioSessionNoStoreJson({ success: true, runs });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio session runs:');
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const result = await createStudioPhotoSessionRun(id, body ?? {});
    if ('error' in result) return studioSessionJson({ success: false, error: result.error }, { status: result.error === 'Session not found' ? 404 : 400 });
    return studioSessionJson({ success: true, run: result.run }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to create Studio session run:');
  }
}
