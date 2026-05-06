import { NextRequest } from 'next/server';
import { createStudioSessionRun, listStudioSessionRuns } from '@/lib/studio-sessions/server';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = typeof searchParams.get('workspaceId') === 'string' ? searchParams.get('workspaceId')!.trim() : '';
    const status = typeof searchParams.get('status') === 'string' ? searchParams.get('status')!.trim() : '';

    requireStudioSessionString(workspaceId, 'workspaceId');

    const runs = await listStudioSessionRuns(workspaceId, status || undefined);
    return studioSessionNoStoreJson({ success: true, runs });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio Session runs:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');
    const templateId = requireStudioSessionString(body?.templateId, 'templateId');

    const run = await createStudioSessionRun({ workspaceId, templateId });
    if (!run) {
      return studioSessionJson({ success: false, error: 'Template not found' }, { status: 404 });
    }

    return studioSessionJson({ success: true, run }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to create Studio Session run:');
  }
}
