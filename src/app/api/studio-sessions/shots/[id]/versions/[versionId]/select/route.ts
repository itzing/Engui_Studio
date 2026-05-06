import { NextRequest, NextResponse } from 'next/server';
import { selectStudioSessionShotVersion } from '@/lib/studio-sessions/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const { id, versionId } = await context.params;
    const version = await selectStudioSessionShotVersion({ shotId: id, versionId });
    if (!version) {
      return NextResponse.json({ success: false, error: 'Version not found or not selectable' }, { status: 404 });
    }
    return NextResponse.json({ success: true, version });
  } catch (error: any) {
    console.error('Failed to select Studio Session shot version:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
