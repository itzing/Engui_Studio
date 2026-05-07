import { NextRequest } from 'next/server';
import { deleteStudioSessionTemplate, getStudioSessionTemplate, saveStudioSessionTemplate, updateStudioSessionTemplateDraft } from '@/lib/studio-sessions/server';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const template = await getStudioSessionTemplate(id);

    if (!template) {
      return studioSessionJson({ success: false, error: 'Template not found' }, { status: 404 });
    }

    return studioSessionNoStoreJson({ success: true, template });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio Session template:');
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readStudioSessionJsonBody(request);
    const mode = body?.mode === 'save' ? 'save' : 'draft';

    const template = mode === 'save'
      ? await saveStudioSessionTemplate(id, body?.canonicalState ?? body?.draftState ?? body)
      : await updateStudioSessionTemplateDraft(id, body?.draftState ?? body, { name: body?.name, characterId: body?.characterId });

    if (!template) {
      return studioSessionJson({ success: false, error: 'Template not found' }, { status: 404 });
    }

    return studioSessionJson({ success: true, template });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to update Studio Session template:');
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const deleted = await deleteStudioSessionTemplate(id);

    if (!deleted) {
      return studioSessionJson({ success: false, error: 'Template not found' }, { status: 404 });
    }

    return studioSessionJson({ success: true, id: deleted.id });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to delete Studio Session template:');
  }
}
