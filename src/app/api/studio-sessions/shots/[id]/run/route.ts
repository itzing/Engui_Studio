import { NextRequest, NextResponse } from 'next/server';
import { runStudioSessionShot } from '@/lib/studio-sessions/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await runStudioSessionShot(id);
    if (!result) {
      return NextResponse.json({ success: false, error: 'Shot is not runnable' }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Failed to run Studio Session shot:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
