import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { uploadMultipartPartStream } from '@/lib/s3MultipartUpload';

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
    const contentLengthHeader = request.headers.get('content-length');
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;

    const result = await uploadMultipartPartStream({
      volume: searchParams.get('volume') || '',
      key: searchParams.get('key') || '',
      uploadId: searchParams.get('uploadId') || '',
      partNumber: Number(searchParams.get('partNumber') || 0),
      body: Readable.fromWeb(request.body as unknown as import('stream/web').ReadableStream),
      contentLength: Number.isFinite(contentLength) && contentLength && contentLength > 0 ? contentLength : undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload part.',
      },
      { status: 500 }
    );
  }
}
