import { NextRequest } from 'next/server';
import { deleteStudioPortfolio, getStudioPortfolio, updateStudioPortfolio } from '@/lib/studio-sessions/portfolioServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = await getStudioPortfolio(id);
    if (!payload) return studioSessionJson({ success: false, error: 'Portfolio not found' }, { status: 404 });
    return studioSessionNoStoreJson({ success: true, ...payload });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio portfolio:');
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const portfolio = await updateStudioPortfolio(id, body ?? {});
    if (!portfolio) return studioSessionJson({ success: false, error: 'Portfolio not found' }, { status: 404 });
    if ('error' in portfolio) return studioSessionJson({ success: false, error: portfolio.error }, { status: 400 });
    return studioSessionJson({ success: true, portfolio });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update Studio portfolio:');
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const deleted = await deleteStudioPortfolio(id);
    if (!deleted) return studioSessionJson({ success: false, error: 'Portfolio not found' }, { status: 404 });
    return studioSessionJson({ success: true, deleted });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to delete Studio portfolio:');
  }
}
