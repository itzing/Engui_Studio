import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeStatus, serializeChipArray, toVibeSummary } from '@/lib/vibes/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const existing = await prisma.vibePreset.findUnique({ where: { id } });

    if (!existing || existing.status === 'trash') {
      return NextResponse.json({ success: false, error: 'Vibe not found' }, { status: 404 });
    }

    const name = typeof body?.name === 'string' ? body.name.trim() : existing.name;
    const baseDescription = typeof body?.baseDescription === 'string' ? body.baseDescription.trim() : existing.baseDescription;

    if (!name) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }

    if (!baseDescription) {
      return NextResponse.json({ success: false, error: 'baseDescription is required' }, { status: 400 });
    }

    const updated = await prisma.vibePreset.update({
      where: { id },
      data: {
        name,
        baseDescription,
        tags: serializeChipArray(body?.tags),
        compatibleSceneTypes: serializeChipArray(body?.compatibleSceneTypes),
      },
    });

    return NextResponse.json({ success: true, vibe: toVibeSummary(updated) });
  } catch (error: any) {
    console.error('Failed to update vibe:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : '';
    const existing = await prisma.vibePreset.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Vibe not found' }, { status: 404 });
    }

    if (action === 'soft_delete') {
      if (existing.status === 'trash') {
        return NextResponse.json({ success: false, error: 'Vibe already in trash' }, { status: 409 });
      }

      const updated = await prisma.vibePreset.update({ where: { id }, data: { status: 'trash' } });
      return NextResponse.json({ success: true, vibe: toVibeSummary(updated) });
    }

    if (action === 'restore') {
      if (existing.status !== 'trash') {
        return NextResponse.json({ success: false, error: 'Vibe is not in trash' }, { status: 409 });
      }

      const updated = await prisma.vibePreset.update({ where: { id }, data: { status: 'active' } });
      return NextResponse.json({ success: true, vibe: toVibeSummary(updated) });
    }

    return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to update vibe trash state:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
