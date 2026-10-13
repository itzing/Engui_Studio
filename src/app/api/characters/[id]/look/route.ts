import { NextRequest, NextResponse } from 'next/server';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { resolveCharacterLook } from '@/lib/outfits/server';
export const POST = withWorkspaceRoute(async (request: NextRequest, context: { params: Promise<{id:string}> }) => NextResponse.json({ success: true, look: await resolveCharacterLook((await context.params).id, await request.json()) }), 'content');
