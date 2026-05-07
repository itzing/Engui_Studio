import { NextRequest } from 'next/server';
import { addStudioCollectionItem } from '@/lib/studio-sessions/portfolioServer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const result = await addStudioCollectionItem(id, body ?? {});
    if ('error' in result) return studioSessionJson({ success: false, error: result.error }, { status: result.error === 'Collection not found' ? 404 : 400 });
    return studioSessionJson({ success: true, item: result.item }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to add Studio collection item:');
  }
}
