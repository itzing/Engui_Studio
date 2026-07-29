import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const maxNotesLength = 1000;
const validScopes = new Set(['single', 'pair']);

function parseNullableWeight(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < -10 || numberValue > 10) {
    throw new Error('Recommended weights must be numbers from -10 to 10');
  }
  return numberValue;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const scope = typeof body?.scope === 'string' ? body.scope.trim().toLowerCase() : '';
    const workspaceId = typeof body?.workspaceId === 'string' && body.workspaceId.trim()
      ? body.workspaceId.trim()
      : null;
    const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';

    if (!validScopes.has(scope)) {
      return NextResponse.json(
        { success: false, error: 'scope must be single or pair' },
        { status: 400 }
      );
    }

    if (notes.length > maxNotesLength) {
      return NextResponse.json(
        { success: false, error: `Notes must be ${maxNotesLength} characters or less` },
        { status: 400 }
      );
    }

    const recommendedHighWeight = scope === 'pair' ? parseNullableWeight(body?.recommendedHighWeight) : null;
    const recommendedLowWeight = scope === 'pair' ? parseNullableWeight(body?.recommendedLowWeight) : null;

    let lookupWhere: {
      workspaceId: string | null;
      scope: string;
      loraId?: string;
      highLoraId?: string;
      lowLoraId?: string;
    };
    let data: {
      workspaceId: string | null;
      scope: string;
      loraId?: string | null;
      highLoraId?: string | null;
      lowLoraId?: string | null;
      notes: string;
      recommendedHighWeight?: number | null;
      recommendedLowWeight?: number | null;
    };

    if (scope === 'single') {
      const loraId = typeof body?.loraId === 'string' ? body.loraId.trim() : '';
      if (!loraId) {
        return NextResponse.json(
          { success: false, error: 'loraId is required for single helper profiles' },
          { status: 400 }
        );
      }

      const lora = await prisma.loRA.findUnique({ where: { id: loraId } });
      if (!lora) {
        return NextResponse.json(
          { success: false, error: 'LoRA not found' },
          { status: 404 }
        );
      }

      lookupWhere = { workspaceId, scope, loraId };
      data = {
        workspaceId,
        scope,
        loraId,
        highLoraId: null,
        lowLoraId: null,
        notes,
        recommendedHighWeight: null,
        recommendedLowWeight: null,
      };
    } else {
      const highLoraId = typeof body?.highLoraId === 'string' ? body.highLoraId.trim() : '';
      const lowLoraId = typeof body?.lowLoraId === 'string' ? body.lowLoraId.trim() : '';
      if (!highLoraId || !lowLoraId) {
        return NextResponse.json(
          { success: false, error: 'highLoraId and lowLoraId are required for pair helper profiles' },
          { status: 400 }
        );
      }

      const pairLoras = await prisma.loRA.findMany({
        where: { id: { in: [highLoraId, lowLoraId] } },
        select: { id: true },
      });
      if (pairLoras.length !== 2) {
        return NextResponse.json(
          { success: false, error: 'Both pair LoRAs must exist' },
          { status: 404 }
        );
      }

      lookupWhere = { workspaceId, scope, highLoraId, lowLoraId };
      data = {
        workspaceId,
        scope,
        loraId: null,
        highLoraId,
        lowLoraId,
        notes,
        recommendedHighWeight,
        recommendedLowWeight,
      };
    }

    const existing = await prisma.loRAHelperProfile.findFirst({ where: lookupWhere });
    const profile = existing
      ? await prisma.loRAHelperProfile.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.loRAHelperProfile.create({ data });

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    logger.error('LoRA helper profile save error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to save LoRA helper profile' },
      { status: 500 }
    );
  }
}
