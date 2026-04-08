import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const favorited = body.favorited;

    if (typeof favorited !== 'boolean') {
      return NextResponse.json({ success: false, error: 'favorited must be boolean' }, { status: 400 });
    }

    const asset = await prisma.galleryAsset.update({
      where: { id },
      data: { favorited },
    });

    return NextResponse.json({ success: true, asset });
  } catch (error: any) {
    console.error('Failed to update gallery favorite:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
