import { NextRequest, NextResponse } from 'next/server';
import { createUploadPartUrl } from '@/lib/s3MultipartUpload';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createUploadPartUrl({
      volume: String(body.volume || ''),
      key: String(body.key || ''),
      uploadId: String(body.uploadId || ''),
      partNumber: Number(body.partNumber || 0),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sign upload part.',
      },
      { status: 500 }
    );
  }
}
