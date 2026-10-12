import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import { generateVideoSequenceFrom } from '@/lib/video-sequences/server';
import {
  handleStudioSessionApiError,
  readStudioSessionJsonBody,
  studioSessionJson,
} from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function POSTImpl(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const result = await generateVideoSequenceFrom(id, body ?? {});
    const status = result.action === 'queued' ? 202 : 200;
    return studioSessionJson({ success: result.action !== 'failed', ...result }, { status });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to generate video sequence from segment:');
  }
}

export const POST = withWorkspaceRoute(POSTImpl, 'content');
