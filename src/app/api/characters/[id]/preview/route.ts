import { buildLookPreviewPrompt } from '@/lib/outfits/previewPrompt';
import { resolveCharacterLook } from '@/lib/outfits/server';
import { imageModelPolicy, generationErrorMessage } from '@/lib/generation/imageModelPolicy';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { submitGenerationFormData } from '@/lib/generation/submitFormData';
import { buildCharacterPreviewSubmission, queueCharacterPreviewGeneration } from '@/lib/characters/server';
import { normalizeCharacterPreviewSlot } from '@/lib/characters/previews';
import { createJobMaterializationTask } from '@/lib/materialization/server';
import { toCharacterSummary } from '@/lib/characters/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function POSTImpl(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const slot = normalizeCharacterPreviewSlot(body?.slot);

    if (!slot) {
      return NextResponse.json({ success: false, error: 'A valid preview slot is required' }, { status: 400 });
    }

    const character = await prisma.character.findUnique({
      where: { id },
      include: {
        defaultOutfit: true,
        _count: {
          select: {
            versions: true,
          },
        },
      },
    });

    if (!character || character.deletedAt) {
      return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });
    }

    const policy = imageModelPolicy(body.modelId || 'z-image');
    const look = await resolveCharacterLook(id, body.look || {});
    const submission = buildCharacterPreviewSubmission(toCharacterSummary(character), slot);
    submission.modelId = policy.modelId;
    submission.prompt = buildLookPreviewPrompt(look, slot);
    const formData = new FormData();
    formData.append('userId', 'user-with-settings');
    formData.append('language', 'en');
    formData.append('modelId', submission.modelId);
    formData.append('prompt', submission.prompt);
    formData.append('use_controlnet', 'false');
    formData.append('width', String(submission.width));
    formData.append('height', String(submission.height));
    formData.append('steps', String(policy.steps));
    formData.append('cfg', '1.0');

    const submitResponse = await submitGenerationFormData(formData);
    const submitPayload = await submitResponse.json() as Record<string, unknown>;
    const jobId = typeof submitPayload.jobId === 'string' ? submitPayload.jobId : null;
    if (!submitResponse.ok || !submitPayload?.success || !jobId) {
      const errorMessage = typeof submitPayload?.error === 'string'
        ? submitPayload.error
        : 'Failed to start character preview generation';
      return NextResponse.json({
        success: false,
        error: generationErrorMessage(errorMessage),
      }, { status: submitResponse.status || 500 });
    }

    const updatedCharacter = await prisma.$transaction(async (tx) => {
      const variant = await tx.characterLookPreview.create({ data: {
        workspaceId: character.workspaceId, characterId: id, slot, modelId: policy.modelId,
        lookName: look.name, snapshotJson: JSON.stringify({ look, generation: { ...policy, width: submission.width, height: submission.height } }),
        promptSnapshot: submission.prompt, jobId, status: 'queued',
      } });
      await createJobMaterializationTask({
        jobId,
        workspaceId: null,
        targetType: 'character_preview',
        targetId: id,
        payload: {
          slot, lookPreviewId: variant.id, updateDefaultCover: look.mode === 'default',
        },
      }, tx as any);

      if (look.mode !== 'default') return toCharacterSummary(character);
      return queueCharacterPreviewGeneration({
        characterId: id,
        slot,
        jobId,
        promptSnapshot: submission.prompt,
      }, tx as any);
    });

    return NextResponse.json({
      success: true,
      jobId,
      status: submitPayload.status || 'IN_QUEUE',
      character: updatedCharacter,
    });
  } catch (error: any) {
    console.error('Failed to queue character preview generation:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: typeof error.status === 'number' ? error.status : 500 });
  }
}

export const POST = withWorkspaceRoute(POSTImpl, 'content');
