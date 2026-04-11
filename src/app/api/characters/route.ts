import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildChangeSummary,
  normalizeEditorState,
  normalizeTraits,
  serializeEditorState,
  serializeTraits,
  toCharacterSummary,
} from '@/lib/characters/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    const characters = await prisma.character.findMany({
      where: includeDeleted ? {} : { deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            versions: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      characters: characters.map(toCharacterSummary),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch characters:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const gender = typeof body?.gender === 'string' && body.gender.trim() ? body.gender.trim() : null;
    const traits = normalizeTraits(body?.traits);
    const editorState = normalizeEditorState(body?.editorState);
    const previewStatusSummary = typeof body?.previewStatusSummary === 'string' && body.previewStatusSummary.trim()
      ? body.previewStatusSummary.trim()
      : null;

    if (!name) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }

    const serializedTraits = serializeTraits(traits);
    const serializedEditorState = serializeEditorState(editorState);
    const changeSummary = typeof body?.changeSummary === 'string' && body.changeSummary.trim()
      ? body.changeSummary.trim()
      : buildChangeSummary({}, traits);

    const created = await prisma.$transaction(async (tx) => {
      const character = await tx.character.create({
        data: {
          name,
          gender,
          traits: serializedTraits,
          editorState: serializedEditorState,
          previewStatusSummary,
        },
      });

      const version = await tx.characterVersion.create({
        data: {
          characterId: character.id,
          traitsSnapshot: serializedTraits,
          editorStateSnapshot: serializedEditorState,
          versionNumber: 1,
          changeSummary,
        },
      });

      return tx.character.update({
        where: { id: character.id },
        data: { currentVersionId: version.id },
        include: {
          _count: {
            select: {
              versions: true,
            },
          },
        },
      });
    });

    return NextResponse.json({ success: true, character: toCharacterSummary(created) }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create character:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
