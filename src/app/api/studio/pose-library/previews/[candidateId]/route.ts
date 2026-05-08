import { NextRequest } from 'next/server';
import { deleteStudioPosePreviewCandidate } from '@/lib/studio-sessions/poseLibraryServer';
import { handleStudioSessionApiError, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(_request: NextRequest, context: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await context.params;
    const deleted = await deleteStudioPosePreviewCandidate(candidateId);
    if (!deleted) return studioSessionJson({ success: false, error: 'Preview candidate not found' }, { status: 404 });
    return studioSessionJson({ success: true, deleted });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to delete pose preview candidate:');
  }
}
