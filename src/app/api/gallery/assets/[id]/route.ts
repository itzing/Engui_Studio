import { NextRequest, NextResponse } from 'next/server';
import { permanentlyDeleteGalleryAsset } from '@/lib/galleryCleanup';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const permanent = new URL(request.url).searchParams.get('permanent') === 'true';

    if (!permanent) {
      return NextResponse.json({ success: false, error: 'permanent=true is required' }, { status: 400 });
    }

    const result = await permanentlyDeleteGalleryAsset(id);
    return NextResponse.json({ success: true, deletedAssetId: result.id });
  } catch (error: any) {
    console.error('Failed to permanently delete gallery asset:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
