import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toCharacterVersionSummary } from '@/lib/characters/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const character = await prisma.character.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!character || character.deletedAt) {
      return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });
    }

    const versions = await prisma.characterVersion.findMany({
      where: { characterId: id },
      orderBy: { versionNumber: 'desc' },
    });

    return NextResponse.json({
      success: true,
      versions: versions.map(toCharacterVersionSummary),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch character versions:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
