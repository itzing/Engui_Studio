import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeChipArray, normalizeStatus, serializeChipArray, toVibeSummary } from '@/lib/vibes/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = normalizeStatus(searchParams.get('status'));

    const vibes = await prisma.vibePreset.findMany({
      where: { status },
      orderBy: [
        { updatedAt: 'desc' },
      ],
    });

    return NextResponse.json({
      success: true,
      vibes: vibes.map(toVibeSummary),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch vibes:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const baseDescription = typeof body?.baseDescription === 'string' ? body.baseDescription.trim() : '';

    if (!name) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }

    if (!baseDescription) {
      return NextResponse.json({ success: false, error: 'baseDescription is required' }, { status: 400 });
    }

    const created = await prisma.vibePreset.create({
      data: {
        name,
        baseDescription,
        tags: serializeChipArray(body?.tags),
        compatibleSceneTypes: serializeChipArray(body?.compatibleSceneTypes),
        status: 'active',
      },
    });

    return NextResponse.json({ success: true, vibe: toVibeSummary(created) }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create vibe:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
