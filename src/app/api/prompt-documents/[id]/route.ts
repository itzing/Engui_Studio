import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildPromptValidation, buildRenderedPrompt, normalizeConstraintIds, normalizePromptDocumentStatus, normalizePromptDocumentTitle, normalizePromptState, normalizePromptTemplateId, normalizePromptTemplateVersion, serializeConstraintIds, serializePromptState, toPromptDocument } from '@/lib/prompt-constructor/utils';
import { getPromptTemplate } from '@/lib/prompt-constructor/templateRegistry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const existing = await prisma.promptDocument.findUnique({ where: { id } });

    if (!existing || normalizePromptDocumentStatus(existing.status) === 'trash') {
      return NextResponse.json({ success: false, error: 'Prompt document not found' }, { status: 404 });
    }

    const document = toPromptDocument(existing);
    return NextResponse.json({
      success: true,
      document,
      renderedPrompt: buildRenderedPrompt(document),
      warnings: buildPromptValidation(document),
    });
  } catch (error: any) {
    console.error('Failed to fetch prompt document:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const existing = await prisma.promptDocument.findUnique({ where: { id } });

    if (!existing || normalizePromptDocumentStatus(existing.status) === 'trash') {
      return NextResponse.json({ success: false, error: 'Prompt document not found' }, { status: 404 });
    }

    const templateId = body?.templateId !== undefined ? normalizePromptTemplateId(body.templateId) : normalizePromptTemplateId(existing.templateId);
    const templateVersion = body?.templateVersion !== undefined ? normalizePromptTemplateVersion(body.templateVersion) : normalizePromptTemplateVersion(existing.templateVersion);
    const template = getPromptTemplate(templateId);

    if (!template) {
      return NextResponse.json({ success: false, error: 'Unsupported templateId' }, { status: 400 });
    }

    const title = body?.title !== undefined ? normalizePromptDocumentTitle(body.title) : existing.title;
    const state = body?.state !== undefined ? normalizePromptState(body.state) : normalizePromptState(existing.stateJson);
    const enabledConstraintIds = body?.enabledConstraintIds !== undefined
      ? normalizeConstraintIds(body.enabledConstraintIds, templateId)
      : normalizeConstraintIds(existing.enabledConstraintIds, templateId);

    const updated = await prisma.promptDocument.update({
      where: { id },
      data: {
        title: title || template.title,
        templateId,
        templateVersion,
        stateJson: serializePromptState(state),
        enabledConstraintIds: serializeConstraintIds(enabledConstraintIds, templateId),
      },
    });

    const document = toPromptDocument(updated);
    return NextResponse.json({
      success: true,
      document,
      renderedPrompt: buildRenderedPrompt(document),
      warnings: buildPromptValidation(document),
    });
  } catch (error: any) {
    console.error('Failed to update prompt document:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : '';
    const existing = await prisma.promptDocument.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Prompt document not found' }, { status: 404 });
    }

    if (action !== 'soft_delete' && action !== 'restore') {
      return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 });
    }

    if (action === 'soft_delete' && existing.status === 'trash') {
      return NextResponse.json({ success: false, error: 'Prompt document already in trash' }, { status: 409 });
    }

    if (action === 'restore' && existing.status !== 'trash') {
      return NextResponse.json({ success: false, error: 'Prompt document is not in trash' }, { status: 409 });
    }

    const updated = await prisma.promptDocument.update({
      where: { id },
      data: { status: action === 'soft_delete' ? 'trash' : 'active' },
    });

    const document = toPromptDocument(updated);
    return NextResponse.json({ success: true, document });
  } catch (error: any) {
    console.error('Failed to update prompt document status:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
