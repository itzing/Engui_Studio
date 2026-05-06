import { NextRequest, NextResponse } from 'next/server';
import { getStudioSessionTemplate, saveStudioSessionTemplate, updateStudioSessionTemplateDraft } from '@/lib/studio-sessions/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const template = await getStudioSessionTemplate(id);

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch Studio Session template:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const mode = body?.mode === 'save' ? 'save' : 'draft';

    const template = mode === 'save'
      ? await saveStudioSessionTemplate(id, body?.canonicalState ?? body?.draftState ?? body)
      : await updateStudioSessionTemplateDraft(id, body?.draftState ?? body, { name: body?.name, characterId: body?.characterId });

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    console.error('Failed to update Studio Session template:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
