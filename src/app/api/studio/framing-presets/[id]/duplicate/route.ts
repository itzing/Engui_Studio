import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import { duplicateStudioFramingPreset } from '@/lib/studio-sessions/framingLibraryServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function POSTImpl(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const preset = await duplicateStudioFramingPreset(id, body ?? {});
    if (!preset) return studioSessionJson({ success: false, error: 'Framing preset not found' }, { status: 404 });
    return studioSessionJson({ success: true, preset }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to duplicate Studio framing preset:');
  }
}

export const POST = withWorkspaceRoute(POSTImpl, 'content');
