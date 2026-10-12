import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import { insertSegmentFromTemplate } from '@/lib/video-sequences/server';
import {
  handleStudioSessionApiError,
  readStudioSessionJsonBody,
  studioSessionJson,
} from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function POSTImpl(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const segment = await insertSegmentFromTemplate(id, body ?? {});
    return studioSessionJson({ success: true, segment }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to insert video sequence segment from template:');
  }
}

export const POST = withWorkspaceRoute(POSTImpl, 'content');
