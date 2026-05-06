import { NextRequest, NextResponse } from 'next/server';
import { cloneStudioSessionTemplate } from '@/lib/studio-sessions/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const template = await cloneStudioSessionTemplate(id);

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to clone Studio Session template:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
