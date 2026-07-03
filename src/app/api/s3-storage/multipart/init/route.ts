import { NextRequest, NextResponse } from 'next/server';
import { createMultipartUpload } from '@/lib/s3MultipartUpload';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createMultipartUpload({
      volume: String(body.volume || ''),
      path: String(body.path || ''),
      fileName: String(body.fileName || ''),
      contentType: typeof body.contentType === 'string' ? body.contentType : undefined,
      fileSize: Number(body.fileSize || 0),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize multipart upload.',
      },
      { status: 500 }
    );
  }
}
