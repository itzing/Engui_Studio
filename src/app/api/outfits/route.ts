import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { saveOutfit, outfitSummary } from '@/lib/outfits/server';
export const dynamic = 'force-dynamic';
export const GET = withWorkspaceRoute(async () => NextResponse.json({ success: true, outfits: (await prisma.outfit.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } })).map(outfitSummary) }), 'content');
export const POST = withWorkspaceRoute(async (request: NextRequest) => NextResponse.json({ success: true, outfit: await saveOutfit(await request.json()) }), 'content');
