import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import { reorderStudioFramingPresets } from '@/lib/studio-sessions/framingLibraryServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function POSTImpl(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0) : [];
    const presets = await reorderStudioFramingPresets(workspaceId, ids);
    return studioSessionJson({ success: true, presets });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to reorder Studio framing presets:');
  }
}

export const POST = withWorkspaceRoute(POSTImpl, 'content');
