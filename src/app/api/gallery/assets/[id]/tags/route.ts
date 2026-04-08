import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const tags = body.tags;

    if (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string')) {
      return NextResponse.json({ success: false, error: 'tags must be an array of strings' }, { status: 400 });
    }

    const normalizedTags = Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean)));

    const asset = await prisma.galleryAsset.update({
      where: { id },
      data: { userTags: JSON.stringify(normalizedTags) },
    });

    return NextResponse.json({ success: true, asset, tags: normalizedTags });
  } catch (error: any) {
    console.error('Failed to update gallery tags:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
