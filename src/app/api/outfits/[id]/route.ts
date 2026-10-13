import { NextRequest, NextResponse } from 'next/server';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { saveOutfit, archiveOutfit } from '@/lib/outfits/server';
export const PATCH = withWorkspaceRoute(async (request: NextRequest, context: { params: Promise<{id:string}> }) => NextResponse.json({ success: true, outfit: await saveOutfit(await request.json(), (await context.params).id) }), 'content');
export const DELETE = withWorkspaceRoute(async (_request: NextRequest, context: { params: Promise<{id:string}> }) => { await archiveOutfit((await context.params).id); return NextResponse.json({ success: true }); }, 'content');
