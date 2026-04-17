import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeCharacterCount } from '@/lib/poses/utils';
import { normalizeSceneCharacterBindings, serializeSceneTags, toSceneSummary } from '@/lib/scenes/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const existing = await prisma.scenePreset.findUnique({
      where: { id },
      include: { characterBindings: true },
    });

    if (!existing || existing.status === 'trash') {
      return NextResponse.json({ success: false, error: 'Scene not found' }, { status: 404 });
    }

    const name = typeof body?.name === 'string' ? body.name.trim() : existing.name;
    const summary = typeof body?.summary === 'string' ? body.summary.trim() : existing.summary;
    const generatedScenePrompt = typeof body?.generatedScenePrompt === 'string' ? body.generatedScenePrompt.trim() : existing.generatedScenePrompt;
    const characterCount = body?.characterCount !== undefined ? normalizeCharacterCount(body.characterCount) : normalizeCharacterCount(existing.characterCount);
    const bindings = body?.characterBindings !== undefined
      ? normalizeSceneCharacterBindings(body.characterBindings, characterCount)
      : normalizeSceneCharacterBindings(existing.characterBindings, characterCount);

    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    if (!summary) return NextResponse.json({ success: false, error: 'summary is required' }, { status: 400 });
    if (!generatedScenePrompt) return NextResponse.json({ success: false, error: 'generatedScenePrompt is required' }, { status: 400 });
    if (!bindings.some((binding) => !!binding.characterPresetId)) {
      return NextResponse.json({ success: false, error: 'At least one character slot must be bound to a character preset' }, { status: 400 });
    }

    const updated = await prisma.scenePreset.update({
      where: { id },
      data: {
        name,
        summary,
        characterCount,
        tags: body?.tags !== undefined ? serializeSceneTags(body.tags) : existing.tags,
        posePresetId: body?.posePresetId !== undefined ? (typeof body.posePresetId === 'string' && body.posePresetId.trim() ? body.posePresetId.trim() : null) : existing.posePresetId,
        vibePresetId: body?.vibePresetId !== undefined ? (typeof body.vibePresetId === 'string' && body.vibePresetId.trim() ? body.vibePresetId.trim() : null) : existing.vibePresetId,
        sceneInstructions: body?.sceneInstructions !== undefined ? (typeof body.sceneInstructions === 'string' ? body.sceneInstructions.trim() : '') : existing.sceneInstructions,
        generatedScenePrompt,
        latestPreviewImageUrl: body?.latestPreviewImageUrl !== undefined ? (typeof body.latestPreviewImageUrl === 'string' && body.latestPreviewImageUrl.trim() ? body.latestPreviewImageUrl.trim() : null) : existing.latestPreviewImageUrl,
        latestPreviewJobId: body?.latestPreviewJobId !== undefined ? (typeof body.latestPreviewJobId === 'string' && body.latestPreviewJobId.trim() ? body.latestPreviewJobId.trim() : null) : existing.latestPreviewJobId,
        characterBindings: {
          deleteMany: {},
          create: bindings.map((binding) => ({
            slot: binding.slot,
            roleLabel: binding.roleLabel,
            characterPresetId: binding.characterPresetId,
            overrideInstructions: binding.overrideInstructions,
          })),
        },
      },
      include: {
        posePreset: { select: { id: true, name: true } },
        vibePreset: { select: { id: true, name: true } },
        characterBindings: {
          include: { characterPreset: { select: { id: true, name: true } } },
          orderBy: [{ slot: 'asc' }],
        },
      },
    });

    return NextResponse.json({ success: true, scene: toSceneSummary(updated) });
  } catch (error: any) {
    console.error('Failed to update scene:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : '';
    const existing = await prisma.scenePreset.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Scene not found' }, { status: 404 });
    }

    if (action === 'soft_delete') {
      if (existing.status === 'trash') {
        return NextResponse.json({ success: false, error: 'Scene already in trash' }, { status: 409 });
      }

      const updated = await prisma.scenePreset.update({
        where: { id },
        data: { status: 'trash' },
        include: {
          posePreset: { select: { id: true, name: true } },
          vibePreset: { select: { id: true, name: true } },
          characterBindings: {
            include: { characterPreset: { select: { id: true, name: true } } },
            orderBy: [{ slot: 'asc' }],
          },
        },
      });
      return NextResponse.json({ success: true, scene: toSceneSummary(updated) });
    }

    if (action === 'restore') {
      if (existing.status !== 'trash') {
        return NextResponse.json({ success: false, error: 'Scene is not in trash' }, { status: 409 });
      }

      const updated = await prisma.scenePreset.update({
        where: { id },
        data: { status: 'active' },
        include: {
          posePreset: { select: { id: true, name: true } },
          vibePreset: { select: { id: true, name: true } },
          characterBindings: {
            include: { characterPreset: { select: { id: true, name: true } } },
            orderBy: [{ slot: 'asc' }],
          },
        },
      });
      return NextResponse.json({ success: true, scene: toSceneSummary(updated) });
    }

    return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to update scene trash state:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
