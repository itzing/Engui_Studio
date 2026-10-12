import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest, NextResponse } from 'next/server';
import { trashPromptWildcard, updatePromptWildcard } from '@/lib/prompt-wildcards/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Internal server error';
}

async function PUTImpl(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const wildcard = await updatePromptWildcard(id, body ?? {});
    if (!wildcard) {
      return NextResponse.json({ success: false, error: 'Wildcard not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, wildcard });
  } catch (error: unknown) {
    console.error('Failed to update prompt wildcard:', error);
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 });
  }
}

async function DELETEImpl(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const wildcard = await trashPromptWildcard(id);
    if (!wildcard) {
      return NextResponse.json({ success: false, error: 'Wildcard not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, wildcard });
  } catch (error: unknown) {
    console.error('Failed to delete prompt wildcard:', error);
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 });
  }
}

export const PUT = withWorkspaceRoute(PUTImpl, 'content');
export const DELETE = withWorkspaceRoute(DELETEImpl, 'content');
