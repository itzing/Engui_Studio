import { NextRequest } from 'next/server';
import { manualPickStudioSessionShot } from '@/lib/studio-sessions/server';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const poseId = requireStudioSessionString(body?.poseId, 'poseId');
    const revision = await manualPickStudioSessionShot({ shotId: id, poseId });
    if (!revision) {
      return studioSessionJson({ success: false, error: 'Shot or pose not found' }, { status: 404 });
    }
    return studioSessionJson({ success: true, revision });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to manually pick Studio Session shot pose:');
  }
}
