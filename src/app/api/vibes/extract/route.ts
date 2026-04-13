import { NextRequest, NextResponse } from 'next/server';
import { heuristicExtractVibe } from '@/lib/vibes/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'prompt is required' }, { status: 400 });
    }

    const extracted = heuristicExtractVibe(prompt);
    return NextResponse.json({ success: true, extracted });
  } catch (error: any) {
    console.error('Failed to extract vibe:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
