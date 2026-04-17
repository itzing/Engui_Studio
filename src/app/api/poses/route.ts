import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeCharacterCount, normalizePoseSource, normalizePoseStatus, serializeChipArray, serializePoseCharacters, serializePoseRelationship, toPoseSummary } from '@/lib/poses/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = typeof searchParams.get('workspaceId') === 'string' ? searchParams.get('workspaceId')!.trim() : '';
    const status = normalizePoseStatus(searchParams.get('status'));
    const characterCountParam = searchParams.get('characterCount');
    const characterCount = characterCountParam ? normalizeCharacterCount(characterCountParam) : null;

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const poses = await prisma.posePreset.findMany({
      where: {
        workspaceId,
        status,
        ...(characterCount ? { characterCount } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return NextResponse.json({
      success: true,
      poses: poses.map(toPoseSummary),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch poses:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const summary = typeof body?.summary === 'string' ? body.summary.trim() : '';
    const characterCount = normalizeCharacterCount(body?.characterCount);
    const posePrompt = typeof body?.posePrompt === 'string' ? body.posePrompt.trim() : '';

    if (!workspaceId) return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    if (!summary) return NextResponse.json({ success: false, error: 'summary is required' }, { status: 400 });
    if (!posePrompt) return NextResponse.json({ success: false, error: 'posePrompt is required' }, { status: 400 });

    const created = await prisma.posePreset.create({
      data: {
        workspaceId,
        name,
        characterCount,
        summary,
        posePrompt,
        tags: serializeChipArray(body?.tags),
        source: normalizePoseSource(body?.source),
        sourceImageUrl: typeof body?.sourceImageUrl === 'string' ? body.sourceImageUrl.trim() || null : null,
        modelHint: typeof body?.modelHint === 'string' ? body.modelHint.trim() || null : null,
        charactersJson: serializePoseCharacters(body?.characters, characterCount),
        relationshipJson: serializePoseRelationship(body?.relationship, characterCount),
        status: 'active',
      },
    });

    return NextResponse.json({ success: true, pose: toPoseSummary(created) }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create pose:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
