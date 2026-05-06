import { NextRequest, NextResponse } from 'next/server';
import { addStudioSessionShotVersionToGallery } from '@/lib/studio-sessions/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const { id, versionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const bucket = body.bucket === 'draft' || body.bucket === 'upscale' ? body.bucket : 'common';
    const result = await addStudioSessionShotVersionToGallery({ shotId: id, versionId, bucket });
    if (!result) {
      return NextResponse.json({ success: false, error: 'Version not found or not transferable' }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...result, bucket });
  } catch (error: any) {
    console.error('Failed to add Studio Session version to gallery:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
