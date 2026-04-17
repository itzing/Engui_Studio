import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeCharacterCount, normalizePoseSource, serializeChipArray, serializePoseCharacters, serializePoseRelationship, toPoseSummary } from '@/lib/poses/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseExistingRelationship(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const existing = await prisma.posePreset.findUnique({ where: { id } });

    if (!existing || existing.status === 'trash') {
      return NextResponse.json({ success: false, error: 'Pose not found' }, { status: 404 });
    }

    const name = typeof body?.name === 'string' ? body.name.trim() : existing.name;
    const summary = typeof body?.summary === 'string' ? body.summary.trim() : existing.summary;
    const posePrompt = typeof body?.posePrompt === 'string' ? body.posePrompt.trim() : existing.posePrompt;
    const characterCount = body?.characterCount !== undefined ? normalizeCharacterCount(body.characterCount) : normalizeCharacterCount(existing.characterCount);

    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    if (!summary) return NextResponse.json({ success: false, error: 'summary is required' }, { status: 400 });
    if (!posePrompt) return NextResponse.json({ success: false, error: 'posePrompt is required' }, { status: 400 });

    const updated = await prisma.posePreset.update({
      where: { id },
      data: {
        name,
        characterCount,
        summary,
        posePrompt,
        tags: body?.tags !== undefined ? serializeChipArray(body.tags) : existing.tags,
        source: body?.source !== undefined ? normalizePoseSource(body.source) : existing.source,
        sourceImageUrl: body?.sourceImageUrl !== undefined ? (typeof body.sourceImageUrl === 'string' ? body.sourceImageUrl.trim() || null : null) : existing.sourceImageUrl,
        modelHint: body?.modelHint !== undefined ? (typeof body.modelHint === 'string' ? body.modelHint.trim() || null : null) : existing.modelHint,
        charactersJson: body?.characters !== undefined ? serializePoseCharacters(body.characters, characterCount) : existing.charactersJson,
        relationshipJson: body?.relationship !== undefined || body?.characterCount !== undefined
          ? serializePoseRelationship(body?.relationship !== undefined ? body.relationship : parseExistingRelationship(existing.relationshipJson), characterCount)
          : existing.relationshipJson,
      },
    });

    return NextResponse.json({ success: true, pose: toPoseSummary(updated) });
  } catch (error: any) {
    console.error('Failed to update pose:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : '';
    const existing = await prisma.posePreset.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Pose not found' }, { status: 404 });
    }

    if (action === 'soft_delete') {
      if (existing.status === 'trash') {
        return NextResponse.json({ success: false, error: 'Pose already in trash' }, { status: 409 });
      }

      const updated = await prisma.posePreset.update({ where: { id }, data: { status: 'trash' } });
      return NextResponse.json({ success: true, pose: toPoseSummary(updated) });
    }

    if (action === 'restore') {
      if (existing.status !== 'trash') {
        return NextResponse.json({ success: false, error: 'Pose is not in trash' }, { status: 409 });
      }

      const updated = await prisma.posePreset.update({ where: { id }, data: { status: 'active' } });
      return NextResponse.json({ success: true, pose: toPoseSummary(updated) });
    }

    return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to update pose trash state:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
