import { NextRequest, NextResponse } from 'next/server';
import { emptyGalleryTrash } from '@/lib/galleryCleanup';

export async function DELETE(request: NextRequest) {
  try {
    const workspaceId = new URL(request.url).searchParams.get('workspaceId') || '';

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const result = await emptyGalleryTrash(workspaceId);
    return NextResponse.json({ success: true, deletedCount: result.deletedCount, deletedIds: result.deletedIds });
  } catch (error: any) {
    console.error('Failed to empty gallery trash:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
