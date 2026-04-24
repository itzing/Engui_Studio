import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildPromptValidation, normalizeConstraintIds, normalizePromptDocumentTitle, normalizePromptState, normalizePromptTemplateId, normalizePromptTemplateVersion, serializeConstraintIds, serializePromptState, toPromptDocument } from '@/lib/prompt-constructor/utils';
import { getPromptTemplate } from '@/lib/prompt-constructor/templateRegistry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = typeof searchParams.get('workspaceId') === 'string' ? searchParams.get('workspaceId')!.trim() : '';
    const templateId = searchParams.get('templateId');
    const status = searchParams.get('status') === 'trash' ? 'trash' : 'active';

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }

    const documents = await prisma.promptDocument.findMany({
      where: {
        workspaceId,
        status,
        ...(templateId ? { templateId: normalizePromptTemplateId(templateId) } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return NextResponse.json({ success: true, documents: documents.map(toPromptDocument) }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch prompt documents:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId.trim() : '';
    const title = normalizePromptDocumentTitle(body?.title);
    const templateId = normalizePromptTemplateId(body?.templateId);
    const templateVersion = normalizePromptTemplateVersion(body?.templateVersion);
    const template = getPromptTemplate(templateId);

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }
    if (!template) {
      return NextResponse.json({ success: false, error: 'Unsupported templateId' }, { status: 400 });
    }

    const state = normalizePromptState(body?.state ?? template.createInitialState(), templateId);
    const enabledConstraintIds = normalizeConstraintIds(body?.enabledConstraintIds, templateId);

    const created = await prisma.promptDocument.create({
      data: {
        workspaceId,
        title: title || template.title,
        templateId,
        templateVersion,
        stateJson: serializePromptState(state, templateId),
        enabledConstraintIds: serializeConstraintIds(enabledConstraintIds, templateId),
        status: 'active',
      },
    });

    const document = toPromptDocument(created);
    return NextResponse.json({ success: true, document, warnings: buildPromptValidation(document) }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create prompt document:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
