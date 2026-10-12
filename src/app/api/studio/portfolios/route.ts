import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest } from 'next/server';
import { createStudioPortfolio, listStudioPortfolios } from '@/lib/studio-sessions/portfolioServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function GETImpl(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = requireStudioSessionString(searchParams.get('workspaceId'), 'workspaceId');
    const status = searchParams.get('status') === 'all' ? 'all' : searchParams.get('status') === 'archived' ? 'archived' : 'active';
    const portfolios = await listStudioPortfolios({ workspaceId, status });
    return studioSessionNoStoreJson({ success: true, portfolios });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio portfolios:');
  }
}

async function POSTImpl(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');
    const characterId = requireStudioSessionString(body?.characterId, 'characterId');
    const result = await createStudioPortfolio({ workspaceId, characterId, name: body?.name, description: body?.description });
    if ('error' in result) return studioSessionJson({ success: false, error: result.error }, { status: 404 });
    return studioSessionJson({ success: true, portfolio: result.portfolio }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to create Studio portfolio:');
  }
}

export const GET = withWorkspaceRoute(GETImpl, 'content');
export const POST = withWorkspaceRoute(POSTImpl, 'content');
