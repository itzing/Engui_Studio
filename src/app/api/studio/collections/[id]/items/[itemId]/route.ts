import { NextRequest } from 'next/server';
import { deleteStudioCollectionItem } from '@/lib/studio-sessions/portfolioServer';
import { handleStudioSessionApiError, studioSessionJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { id, itemId } = await context.params;
    const deleted = await deleteStudioCollectionItem(id, itemId);
    if (!deleted) return studioSessionJson({ success: false, error: 'Collection item not found' }, { status: 404 });
    return studioSessionJson({ success: true, deleted });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to delete Studio collection item:');
  }
}
