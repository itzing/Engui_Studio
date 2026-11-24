import { resolveImageVibe } from '@/lib/vibes/resolveImageVibe';
import { NextRequest, NextResponse } from 'next/server';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { requireWorkspaceId, WorkspaceError } from '@/lib/workspaces/context';
import { renderCreatePrompt } from '@/lib/generation/renderCreatePrompt';

export const POST = withWorkspaceRoute(async (request: NextRequest) => {
  try {
    const body = await request.json();
    if (typeof body?.prompt !== 'string' || body.prompt.length > 100_000) {
      return NextResponse.json({ success: false, error: 'A prompt of at most 100,000 characters is required.' }, { status: 422 });
    }
    const effective = await resolveImageVibe(body.prompt, typeof body.selectedVibeId === 'string' ? body.selectedVibeId : '', requireWorkspaceId());
    const result = await renderCreatePrompt({
      prompt: effective.prompt, workspaceId: requireWorkspaceId(),
      seed: typeof body.seed === 'number' || typeof body.seed === 'string' ? body.seed : 0,
      selections: body.promptWildcardSelections,
    });
    return NextResponse.json({ success: true, prompt: result.prompt, characterReferences: result.characterReferences }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Could not preview the prompt.' }, { status: error instanceof WorkspaceError ? error.status : 500 });
  }
}, 'content');
