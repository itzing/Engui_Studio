import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import S3Service from '@/lib/s3Service';
import SettingsService from '@/lib/settingsService';
import { completeMultipartUpload } from '@/lib/s3MultipartUpload';
import { validateLoRAFileServer } from '@/lib/loraValidation';
import { logger } from '@/lib/logger';

type CompletedUploadPart = {
  partNumber: number;
  eTag?: string | null;
};

function serializeLora(lora: {
  id: string;
  name: string;
  fileName: string;
  s3Path: string;
  s3Url: string;
  fileSize: bigint;
  extension: string;
  targetOverride: string | null;
  baseModel: string;
  uploadedAt: Date;
  workspaceId: string | null;
}) {
  return {
    id: lora.id,
    name: lora.name,
    fileName: lora.fileName,
    s3Path: lora.s3Path,
    s3Url: lora.s3Url,
    fileSize: lora.fileSize.toString(),
    extension: lora.extension,
    targetOverride: lora.targetOverride,
    baseModel: lora.baseModel,
    uploadedAt: lora.uploadedAt.toISOString(),
    workspaceId: lora.workspaceId,
  };
}

export async function POST(request: NextRequest) {
  let completedFilePath = '';
  let s3Service: S3Service | null = null;

  try {
    const body = await request.json();
    const fileName = String(body.fileName || '');
    const fileSize = Number(body.fileSize || 0);
    const volume = String(body.volume || '');
    const key = String(body.key || '');
    const uploadId = String(body.uploadId || '');
    const workspaceId = typeof body.workspaceId === 'string' && body.workspaceId ? body.workspaceId : null;
    const userId = typeof body.userId === 'string' && body.userId.trim() ? body.userId : 'user-with-settings';
    const baseModel = typeof body.baseModel === 'string' && ['wan2.2', 'z-image', 'krea2-turbo'].includes(body.baseModel)
      ? body.baseModel
      : 'z-image';
    const parts = Array.isArray(body.parts) ? body.parts as CompletedUploadPart[] : undefined;

    const validation = validateLoRAFileServer(fileName, fileSize);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error || 'Invalid LoRA file.' },
        { status: 400 }
      );
    }

    if (!key.startsWith('loras/')) {
      return NextResponse.json(
        { success: false, error: 'LoRA upload key must be inside loras/.' },
        { status: 400 }
      );
    }

    const settingsService = new SettingsService();
    const { settings } = await settingsService.getSettings(userId);
    if (!settings.s3) {
      return NextResponse.json(
        { success: false, error: 'S3 configuration not found.' },
        { status: 400 }
      );
    }

    s3Service = new S3Service({
      endpointUrl: settings.s3.endpointUrl,
      accessKeyId: settings.s3.accessKeyId,
      secretAccessKey: settings.s3.secretAccessKey,
      bucketName: volume,
      region: settings.s3.region,
      timeout: settings.s3.timeout,
      useGlobalNetworking: settings.s3.useGlobalNetworking,
    });

    const completedUpload = await completeMultipartUpload({
      volume,
      key,
      uploadId,
      parts,
    });
    completedFilePath = completedUpload.filePath;

    const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    const lora = await prisma.loRA.create({
      data: {
        name: fileName.substring(0, fileName.lastIndexOf('.')),
        fileName,
        s3Path: completedUpload.filePath,
        s3Url: completedUpload.s3Url,
        fileSize: BigInt(fileSize),
        extension,
        baseModel,
        targetOverride: baseModel === 'wan2.2' ? 'video' : 'image',
        workspaceId,
      },
    });

    return NextResponse.json({
      success: true,
      lora: serializeLora(lora),
    });
  } catch (error) {
    logger.error('LoRA multipart finalize error:', error);

    if (completedFilePath && s3Service) {
      try {
        await s3Service.deleteFile(completedFilePath.replace('/runpod-volume/', ''));
      } catch (deleteError) {
        logger.error('Failed to roll back finalized LoRA upload:', deleteError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to finalize LoRA upload.',
      },
      { status: 500 }
    );
  }
}
