import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import { getStudioCollection, updateStudioCollection } from '@/lib/studio-sessions/portfolioServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function GETImpl(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = await getStudioCollection(id);
    if (!payload) return studioSessionJson({ success: false, error: 'Collection not found' }, { status: 404 });
    return studioSessionNoStoreJson({ success: true, ...payload });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio collection:');
  }
}

async function PATCHImpl(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const collection = await updateStudioCollection(id, body ?? {});
    if (!collection) return studioSessionJson({ success: false, error: 'Collection not found' }, { status: 404 });
    return studioSessionJson({ success: true, collection });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update Studio collection:');
  }
}

export const GET = withWorkspaceRoute(GETImpl, 'content');
export const PATCH = withWorkspaceRoute(PATCHImpl, 'content');
