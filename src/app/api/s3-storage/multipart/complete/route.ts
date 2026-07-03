import { NextRequest, NextResponse } from 'next/server';
import { completeMultipartUpload } from '@/lib/s3MultipartUpload';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await completeMultipartUpload({
      volume: String(body.volume || ''),
      key: String(body.key || ''),
      uploadId: String(body.uploadId || ''),
      parts: Array.isArray(body.parts) ? body.parts : undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete multipart upload.',
      },
      { status: 500 }
    );
  }
}
