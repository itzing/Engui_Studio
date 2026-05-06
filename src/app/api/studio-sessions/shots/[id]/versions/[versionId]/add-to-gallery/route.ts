import { NextRequest } from 'next/server';
import { addStudioSessionShotVersionToGallery } from '@/lib/studio-sessions/server';
import { handleStudioSessionApiError, readStudioSessionBucket, readStudioSessionJsonBody, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const { id, versionId } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const bucket = readStudioSessionBucket(body?.bucket);
    const result = await addStudioSessionShotVersionToGallery({ shotId: id, versionId, bucket });
    if (!result) {
      return studioSessionJson({ success: false, error: 'Version not found or not transferable' }, { status: 404 });
    }
    return studioSessionJson({ success: true, ...result, bucket });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to add Studio Session version to gallery:');
  }
}
