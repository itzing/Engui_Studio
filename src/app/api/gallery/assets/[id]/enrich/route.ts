import { NextRequest, NextResponse } from 'next/server';
import { enrichGalleryAsset } from '@/lib/galleryEnrichment';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await enrichGalleryAsset(id);
    return NextResponse.json({ success: true, asset: result.asset, autoTags: result.autoTags });
  } catch (error: any) {
    console.error('Failed to enrich gallery asset:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
