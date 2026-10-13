import { NextRequest, NextResponse } from 'next/server';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { wardrobe, assignOutfit } from '@/lib/outfits/server';
export const GET = withWorkspaceRoute(async (_request: NextRequest, context: { params: Promise<{id:string}> }) => NextResponse.json({ success: true, ...await wardrobe((await context.params).id) }), 'content');
export const POST = withWorkspaceRoute(async (request: NextRequest, context: { params: Promise<{id:string}> }) => { const body = await request.json(); return NextResponse.json({ success: true, ...await assignOutfit((await context.params).id, body.outfitId, body.action) }); }, 'content');
