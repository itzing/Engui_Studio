import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildChangeSummary,
  normalizeCharacterGender,
  normalizeEditorState,
  normalizeTraits,
  serializeEditorState,
  serializeTraits,
  toCharacterSummary,
} from '@/lib/characters/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.character.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });
    }

    const name = typeof body?.name === 'string' ? body.name.trim() : existing.name;
    const gender = Object.prototype.hasOwnProperty.call(body || {}, 'gender')
      ? normalizeCharacterGender(body?.gender, 'female')
      : normalizeCharacterGender(existing.gender, 'female');
    const nextTraits = normalizeTraits(body?.traits);
    const nextEditorState = normalizeEditorState(body?.editorState);
    const previewStatusSummary = typeof body?.previewStatusSummary === 'string'
      ? (body.previewStatusSummary.trim() || null)
      : existing.previewStatusSummary;

    if (!name) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }

    const previousTraits = normalizeTraits(JSON.parse(existing.traits || '{}'));
    const traitsChanged = JSON.stringify(previousTraits) !== JSON.stringify(nextTraits);
    const basicsChanged = name !== existing.name
      || gender !== normalizeCharacterGender(existing.gender, 'female')
      || previewStatusSummary !== existing.previewStatusSummary
      || JSON.stringify(nextEditorState) !== JSON.stringify(normalizeEditorState(JSON.parse(existing.editorState || '{}')));

    if (!traitsChanged && !basicsChanged) {
      return NextResponse.json({
        success: true,
        character: toCharacterSummary({ ...existing, _count: { versions: 0 } }),
        persisted: false,
      });
    }
    if (!traitsChanged && basicsChanged) {
      const updatedCharacter = await prisma.character.update({
        where: { id },
        data: {
          name,
          gender,
          editorState: serializeEditorState(nextEditorState),
          previewStatusSummary,
        },
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
        character: toCharacterSummary(updatedCharacter),
        persisted: true,
      });
    }

    const serializedTraits = serializeTraits(nextTraits);
    const serializedEditorState = serializeEditorState(nextEditorState);

    const updated = await prisma.$transaction(async (tx) => {
      const lastVersion = await tx.characterVersion.findFirst({
        where: { characterId: id },
        orderBy: { versionNumber: 'desc' },
      });

      const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1;
      const changeSummary = typeof body?.changeSummary === 'string' && body.changeSummary.trim()
        ? body.changeSummary.trim()
        : buildChangeSummary(previousTraits, nextTraits);

      const version = await tx.characterVersion.create({
        data: {
          characterId: id,
          traitsSnapshot: serializedTraits,
          editorStateSnapshot: serializedEditorState,
          versionNumber: nextVersionNumber,
          changeSummary,
        },
      });

      return tx.character.update({
        where: { id },
        data: {
          name,
          gender,
          traits: serializedTraits,
          editorState: serializedEditorState,
          previewStatusSummary,
          currentVersionId: version.id,
        },
        include: {
          _count: {
            select: {
              versions: true,
            },
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      character: toCharacterSummary(updated),
      persisted: true,
    });
  } catch (error: any) {
    console.error('Failed to update character:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : '';

    const existing = await prisma.character.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            versions: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });
    }

    if (action === 'soft_delete') {
      if (existing.deletedAt) {
        return NextResponse.json({ success: false, error: 'Character already in trash' }, { status: 409 });
      }

      const updated = await prisma.character.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
        include: {
          _count: {
            select: {
              versions: true,
            },
          },
        },
      });

      return NextResponse.json({ success: true, character: toCharacterSummary(updated) });
    }

    if (action === 'restore') {
      if (!existing.deletedAt) {
        return NextResponse.json({ success: false, error: 'Character is not in trash' }, { status: 409 });
      }

      const updated = await prisma.character.update({
        where: { id },
        data: {
          deletedAt: null,
        },
        include: {
          _count: {
            select: {
              versions: true,
            },
          },
        },
      });

      return NextResponse.json({ success: true, character: toCharacterSummary(updated) });
    }

    return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to update character trash state:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
