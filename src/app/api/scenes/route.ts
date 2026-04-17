import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeCharacterCount } from '@/lib/poses/utils';
import { normalizeSceneCharacterBindings, normalizeSceneStatus, serializeSceneTags, toSceneSummary } from '@/lib/scenes/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = typeof searchParams.get('workspaceId') === 'string' ? searchParams.get('workspaceId')!.trim() : '';
    const status = normalizeSceneStatus(searchParams.get('status'));
    const characterCountParam = searchParams.get('characterCount');
    const characterCount = characterCountParam ? normalizeCharacterCount(characterCountParam) : null;

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const scenes = await prisma.scenePreset.findMany({
      where: {
        workspaceId,
        status,
        ...(characterCount ? { characterCount } : {}),
      },
      include: {
        posePreset: { select: { id: true, name: true } },
        vibePreset: { select: { id: true, name: true } },
        characterBindings: {
          include: { characterPreset: { select: { id: true, name: true } } },
          orderBy: [{ slot: 'asc' }],
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return NextResponse.json({ success: true, scenes: scenes.map(toSceneSummary) }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch scenes:', error);
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
    const generatedScenePrompt = typeof body?.generatedScenePrompt === 'string' ? body.generatedScenePrompt.trim() : '';
    const bindings = normalizeSceneCharacterBindings(body?.characterBindings, characterCount);

    if (!workspaceId) return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    if (!summary) return NextResponse.json({ success: false, error: 'summary is required' }, { status: 400 });
    if (!generatedScenePrompt) return NextResponse.json({ success: false, error: 'generatedScenePrompt is required' }, { status: 400 });
    if (!bindings.some((binding) => !!binding.characterPresetId)) {
      return NextResponse.json({ success: false, error: 'At least one character slot must be bound to a character preset' }, { status: 400 });
    }

    const created = await prisma.scenePreset.create({
      data: {
        workspaceId,
        name,
        summary,
        characterCount,
        tags: serializeSceneTags(body?.tags),
        posePresetId: typeof body?.posePresetId === 'string' && body.posePresetId.trim() ? body.posePresetId.trim() : null,
        vibePresetId: typeof body?.vibePresetId === 'string' && body.vibePresetId.trim() ? body.vibePresetId.trim() : null,
        sceneInstructions: typeof body?.sceneInstructions === 'string' ? body.sceneInstructions.trim() : '',
        assemblyMode: 'template',
        generatedScenePrompt,
        latestPreviewImageUrl: typeof body?.latestPreviewImageUrl === 'string' && body.latestPreviewImageUrl.trim() ? body.latestPreviewImageUrl.trim() : null,
        latestPreviewJobId: typeof body?.latestPreviewJobId === 'string' && body.latestPreviewJobId.trim() ? body.latestPreviewJobId.trim() : null,
        status: 'active',
        characterBindings: {
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

    return NextResponse.json({ success: true, scene: toSceneSummary(created) }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create scene:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
