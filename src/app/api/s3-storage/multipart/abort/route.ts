import { NextRequest, NextResponse } from 'next/server';
import { abortMultipartUpload } from '@/lib/s3MultipartUpload';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await abortMultipartUpload({
      volume: String(body.volume || ''),
      key: String(body.key || ''),
      uploadId: String(body.uploadId || ''),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to abort multipart upload.',
      },
      { status: 500 }
    );
  }
}
