import { NextRequest, NextResponse } from 'next/server';
import { createPromptWildcard, listPromptWildcards } from '@/lib/prompt-wildcards/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Internal server error';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId')?.trim();
    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const wildcards = await listPromptWildcards(workspaceId);
    return NextResponse.json({ success: true, wildcards }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: unknown) {
    console.error('Failed to fetch prompt wildcards:', error);
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId.trim() : '';
    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const wildcard = await createPromptWildcard(workspaceId, body ?? {});
    return NextResponse.json({ success: true, wildcard }, { status: 201 });
  } catch (error: unknown) {
    console.error('Failed to create prompt wildcard:', error);
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 });
  }
}
