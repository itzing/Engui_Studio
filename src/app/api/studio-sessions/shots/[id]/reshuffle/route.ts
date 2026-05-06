import { NextRequest, NextResponse } from 'next/server';
import { reshuffleStudioSessionShot } from '@/lib/studio-sessions/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await reshuffleStudioSessionShot(id);
    if (!result) {
      return NextResponse.json({ success: false, error: 'Shot not found' }, { status: 404 });
    }
    if (result.exhausted) {
      return NextResponse.json({ success: false, exhausted: true, exhaustedCategories: result.exhaustedCategories, error: 'No available reshuffle pose for this shot' }, { status: 409 });
    }
    return NextResponse.json({ success: true, revision: result.revision, exhaustedCategories: [] });
  } catch (error: any) {
    console.error('Failed to reshuffle Studio Session shot:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
