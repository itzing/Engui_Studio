import { NextRequest, NextResponse } from 'next/server';
import { assembleStudioSessionRun } from '@/lib/studio-sessions/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await assembleStudioSessionRun(id);
    if (!result) {
      return NextResponse.json({ success: false, error: 'Run not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Failed to assemble Studio Session run:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
