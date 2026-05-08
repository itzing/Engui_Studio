import { NextRequest } from 'next/server';
import { setStudioPosePrimaryPreview } from '@/lib/studio-sessions/poseLibraryServer';
import { handleStudioSessionApiError, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(_request: NextRequest, context: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await context.params;
    const pose = await setStudioPosePrimaryPreview(candidateId);
    if (!pose) return studioSessionJson({ success: false, error: 'Preview candidate not found' }, { status: 404 });
    return studioSessionJson({ success: true, pose });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to set primary pose preview:');
  }
}
