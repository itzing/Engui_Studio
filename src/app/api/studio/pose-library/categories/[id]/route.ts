import { NextRequest } from 'next/server';
import { deleteStudioPoseCategory, getStudioPoseCategory, updateStudioPoseCategory } from '@/lib/studio-sessions/poseLibraryServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const category = await getStudioPoseCategory(id);
    if (!category) return studioSessionJson({ success: false, error: 'Pose category not found' }, { status: 404 });
    return studioSessionNoStoreJson({ success: true, category });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio pose category:');
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const category = await updateStudioPoseCategory(id, body ?? {});
    if (!category) return studioSessionJson({ success: false, error: 'Pose category not found' }, { status: 404 });
    return studioSessionJson({ success: true, category });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update Studio pose category:');
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const deleted = await deleteStudioPoseCategory(id);
    if (!deleted) return studioSessionJson({ success: false, error: 'Pose category not found' }, { status: 404 });
    return studioSessionJson({ success: true, deleted });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to delete Studio pose category:');
  }
}
