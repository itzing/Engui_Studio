import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import { deleteStudioFramingPreset, getStudioFramingPreset, updateStudioFramingPreset } from '@/lib/studio-sessions/framingLibraryServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function GETImpl(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const preset = await getStudioFramingPreset(id);
    if (!preset) return studioSessionJson({ success: false, error: 'Framing preset not found' }, { status: 404 });
    return studioSessionNoStoreJson({ success: true, preset });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio framing preset:');
  }
}

async function PATCHImpl(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const preset = await updateStudioFramingPreset(id, body ?? {});
    if (!preset) return studioSessionJson({ success: false, error: 'Framing preset not found' }, { status: 404 });
    return studioSessionJson({ success: true, preset });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update Studio framing preset:');
  }
}

async function DELETEImpl(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const deleted = await deleteStudioFramingPreset(id);
    if (!deleted) return studioSessionJson({ success: false, error: 'Framing preset not found' }, { status: 404 });
    return studioSessionJson({ success: true, deleted });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to delete Studio framing preset:');
  }
}

export const GET = withWorkspaceRoute(GETImpl, 'content');
export const PATCH = withWorkspaceRoute(PATCHImpl, 'content');
export const DELETE = withWorkspaceRoute(DELETEImpl, 'content');
