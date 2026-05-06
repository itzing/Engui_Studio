import { NextRequest, NextResponse } from 'next/server';
import { createStudioSessionTemplate, listStudioSessionTemplates } from '@/lib/studio-sessions/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = typeof searchParams.get('workspaceId') === 'string' ? searchParams.get('workspaceId')!.trim() : '';
    const status = searchParams.get('status') === 'archived' ? 'archived' : 'active';

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const templates = await listStudioSessionTemplates(workspaceId, status);
    return NextResponse.json({ success: true, templates }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch Studio Session templates:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId.trim() : '';

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const template = await createStudioSessionTemplate({
      workspaceId,
      name: body?.name,
      draftState: body?.draftState,
      canonicalState: body?.canonicalState,
      characterId: body?.characterId,
    });

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create Studio Session template:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
