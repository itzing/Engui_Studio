import { NextRequest, NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';
import { createMultipartUpload } from '@/lib/s3MultipartUpload';
import { validateLoRAFileServer } from '@/lib/loraValidation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fileName = String(body.fileName || '');
    const fileSize = Number(body.fileSize || 0);
    const contentType = typeof body.contentType === 'string' ? body.contentType : undefined;
    const userId = typeof body.userId === 'string' && body.userId.trim() ? body.userId : 'user-with-settings';

    const validation = validateLoRAFileServer(fileName, fileSize);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error || 'Invalid LoRA file.' },
        { status: 400 }
      );
    }

    const settingsService = new SettingsService();
    const { settings } = await settingsService.getSettings(userId);

    if (!settings.s3?.bucketName) {
      return NextResponse.json(
        { success: false, error: 'S3 configuration is incomplete.' },
        { status: 400 }
      );
    }

    const result = await createMultipartUpload({
      volume: settings.s3.bucketName,
      path: 'loras',
      fileName,
      contentType,
      fileSize,
    });

    return NextResponse.json({
      success: true,
      volume: settings.s3.bucketName,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize LoRA upload.',
      },
      { status: 500 }
    );
  }
}
