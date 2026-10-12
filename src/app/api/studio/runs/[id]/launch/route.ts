import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import { runAllStudioSessionShots } from '@/lib/studio-sessions/server';
import { handleStudioSessionApiError, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function POSTImpl(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await runAllStudioSessionShots(id);
    return studioSessionJson({ success: true, ...result });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to launch Studio run:');
  }
}

export const POST = withWorkspaceRoute(POSTImpl, 'content');
