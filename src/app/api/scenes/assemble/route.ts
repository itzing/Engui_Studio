import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeCharacterCount } from '@/lib/poses/utils';
import { buildCharacterPromptFromSummary, assembleScenePrompt } from '@/lib/scenes/utils';
import { toCharacterSummary } from '@/lib/characters/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sceneName = typeof body?.sceneName === 'string' ? body.sceneName.trim() : '';
    const sceneSummary = typeof body?.sceneSummary === 'string' ? body.sceneSummary.trim() : '';
    const sceneInstructions = typeof body?.sceneInstructions === 'string' ? body.sceneInstructions.trim() : '';
    const characterCount = normalizeCharacterCount(body?.characterCount);
    const posePresetId = typeof body?.posePresetId === 'string' && body.posePresetId.trim() ? body.posePresetId.trim() : null;
    const vibePresetId = typeof body?.vibePresetId === 'string' && body.vibePresetId.trim() ? body.vibePresetId.trim() : null;
    const rawBindings = Array.isArray(body?.characterBindings) ? body.characterBindings : [];

    const pose = posePresetId
      ? await prisma.posePreset.findUnique({ where: { id: posePresetId } })
      : null;
    const vibe = vibePresetId
      ? await prisma.vibePreset.findUnique({ where: { id: vibePresetId } })
      : null;

    const bindingIds = rawBindings
      .map((binding: any) => typeof binding?.characterPresetId === 'string' ? binding.characterPresetId.trim() : '')
      .filter(Boolean);

    const characters = bindingIds.length > 0
      ? await prisma.character.findMany({ where: { id: { in: bindingIds } } })
      : [];
    const characterMap = new Map(characters.map((character) => [character.id, toCharacterSummary(character)]));

    const assembled = assembleScenePrompt({
      sceneName,
      sceneSummary,
      characterCount,
      sceneInstructions,
      pose: pose ? {
        id: pose.id,
        name: pose.name,
        posePrompt: pose.posePrompt,
        summary: pose.summary,
        characterCount: normalizeCharacterCount(pose.characterCount),
      } : null,
      vibe: vibe ? {
        id: vibe.id,
        name: vibe.name,
        baseDescription: vibe.baseDescription,
        tags: JSON.parse(vibe.tags || '[]'),
      } : null,
      characters: rawBindings.slice(0, characterCount).map((binding: any, index: number) => {
        const characterId = typeof binding?.characterPresetId === 'string' && binding.characterPresetId.trim() ? binding.characterPresetId.trim() : null;
        const character = characterId ? characterMap.get(characterId) : null;
        return {
          slot: typeof binding?.slot === 'number' ? binding.slot : index,
          roleLabel: typeof binding?.roleLabel === 'string' && binding.roleLabel.trim() ? binding.roleLabel.trim() : null,
          characterId,
          characterName: character?.name || null,
          resolvedCharacterPrompt: buildCharacterPromptFromSummary(character),
          overrideInstructions: typeof binding?.overrideInstructions === 'string' && binding.overrideInstructions.trim() ? binding.overrideInstructions.trim() : null,
        };
      }),
    });

    return NextResponse.json({
      success: true,
      prompt: assembled.prompt,
      mode: assembled.mode,
      warnings: assembled.warnings,
    });
  } catch (error: any) {
    console.error('Failed to assemble scene prompt:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
