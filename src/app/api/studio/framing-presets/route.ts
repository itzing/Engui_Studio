import { NextRequest } from 'next/server';
import { createStudioFramingPreset, listStudioFramingPresets } from '@/lib/studio-sessions/framingLibraryServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = requireStudioSessionString(searchParams.get('workspaceId'), 'workspaceId');
    const presets = await listStudioFramingPresets({ workspaceId, orientation: searchParams.get('orientation'), query: searchParams.get('query') });
    return studioSessionNoStoreJson({ success: true, presets });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio framing presets:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');
    const preset = await createStudioFramingPreset(workspaceId, body ?? {});
    return studioSessionJson({ success: true, preset }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to create Studio framing preset:');
  }
}
