import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const userTags = body.tags ?? body.userTags;
    const autoTags = body.autoTags;

    if (!Array.isArray(userTags) || !userTags.every(tag => typeof tag === 'string')) {
      return NextResponse.json({ success: false, error: 'userTags must be an array of strings' }, { status: 400 });
    }

    if (autoTags !== undefined && (!Array.isArray(autoTags) || !autoTags.every(tag => typeof tag === 'string'))) {
      return NextResponse.json({ success: false, error: 'autoTags must be an array of strings' }, { status: 400 });
    }

    const normalizedUserTags = Array.from(new Set(userTags.map(tag => tag.trim()).filter(Boolean)));
    const normalizedAutoTags = Array.from(new Set((autoTags ?? []).map(tag => tag.trim()).filter(Boolean)));

    const asset = await prisma.galleryAsset.update({
      where: { id },
      data: {
        userTags: JSON.stringify(normalizedUserTags),
        ...(autoTags !== undefined ? { autoTags: JSON.stringify(normalizedAutoTags) } : {}),
      },
    });

    return NextResponse.json({ success: true, asset, userTags: normalizedUserTags, autoTags: autoTags !== undefined ? normalizedAutoTags : undefined });
  } catch (error: any) {
    console.error('Failed to update gallery tags:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
