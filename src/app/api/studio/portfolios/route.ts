import { NextRequest } from 'next/server';
import { createStudioPortfolio, listStudioPortfolios } from '@/lib/studio-sessions/portfolioServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
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

export async function POST(request: NextRequest) {
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
