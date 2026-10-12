import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import { createStudioPhotoSession, listStudioPhotoSessions } from '@/lib/studio-sessions/portfolioServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function GETImpl(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') === 'all' ? 'all' : undefined;
    const sessions = await listStudioPhotoSessions({ portfolioId: id, status });
    return studioSessionNoStoreJson({ success: true, sessions });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio photo sessions:');
  }
}

async function POSTImpl(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const session = await createStudioPhotoSession(id, body ?? {});
    if (!session) return studioSessionJson({ success: false, error: 'Portfolio not found' }, { status: 404 });
    return studioSessionJson({ success: true, session }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to create Studio photo session:');
  }
}

export const GET = withWorkspaceRoute(GETImpl, 'content');
export const POST = withWorkspaceRoute(POSTImpl, 'content');
