import { NextRequest } from 'next/server';
import { createStudioSessionTemplate, listStudioSessionTemplates } from '@/lib/studio-sessions/server';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = typeof searchParams.get('workspaceId') === 'string' ? searchParams.get('workspaceId')!.trim() : '';
    const status = searchParams.get('status') === 'archived' ? 'archived' : 'active';

    requireStudioSessionString(workspaceId, 'workspaceId');

    const templates = await listStudioSessionTemplates(workspaceId, status);
    return studioSessionNoStoreJson({ success: true, templates });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio Session templates:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');

    const template = await createStudioSessionTemplate({
      workspaceId,
      name: body?.name,
      draftState: body?.draftState,
      canonicalState: body?.canonicalState,
      characterId: body?.characterId,
    });

    return studioSessionJson({ success: true, template }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to create Studio Session template:');
  }
}
