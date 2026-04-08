import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const trashed = body.trashed;

    if (typeof trashed !== 'boolean') {
      return NextResponse.json({ success: false, error: 'trashed must be boolean' }, { status: 400 });
    }

    const asset = await prisma.galleryAsset.update({
      where: { id },
      data: { trashed },
    });

    return NextResponse.json({ success: true, asset });
  } catch (error: any) {
    console.error('Failed to update gallery trash state:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
