import { NextRequest } from 'next/server';
import { createStudioCollection, listStudioCollections } from '@/lib/studio-sessions/portfolioServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') === 'all' ? 'all' : undefined;
    const collections = await listStudioCollections({ portfolioId: id, status });
    return studioSessionNoStoreJson({ success: true, collections });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio collections:');
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const collection = await createStudioCollection(id, body ?? {});
    if (!collection) return studioSessionJson({ success: false, error: 'Portfolio not found' }, { status: 404 });
    return studioSessionJson({ success: true, collection }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to create Studio collection:');
  }
}
