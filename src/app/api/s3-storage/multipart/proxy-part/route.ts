import { NextRequest, NextResponse } from 'next/server';
import { uploadMultipartPartBuffer } from '@/lib/s3MultipartUpload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    if (!request.body) {
      return NextResponse.json(
        { success: false, error: 'Upload part body is required.' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const body = Buffer.from(await request.arrayBuffer());

    const result = await uploadMultipartPartBuffer({
      volume: searchParams.get('volume') || '',
      key: searchParams.get('key') || '',
      uploadId: searchParams.get('uploadId') || '',
      partNumber: Number(searchParams.get('partNumber') || 0),
      body,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[s3-storage] multipart proxy part failed', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload part.',
      },
      { status: 500 }
    );
  }
}
