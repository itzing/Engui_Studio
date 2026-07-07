import { NextRequest, NextResponse } from 'next/server';
import S3Service from '@/lib/s3Service';
import SettingsService from '@/lib/settingsService';

function buildDestinationKey(sourceKey: string, newName: string): string {
  const normalizedSourceKey = sourceKey.replace(/^\/+/, '');
  const cleanName = newName.trim();

  if (!normalizedSourceKey || normalizedSourceKey.endsWith('/')) {
    throw new Error('Only files can be renamed.');
  }

  if (!cleanName || cleanName === '.' || cleanName === '..') {
    throw new Error('Enter a file name.');
  }

  if (cleanName.includes('/') || cleanName.includes('\\')) {
    throw new Error('File name cannot contain folder separators.');
  }

  const lastSlashIndex = normalizedSourceKey.lastIndexOf('/');
  const prefix = lastSlashIndex >= 0 ? normalizedSourceKey.slice(0, lastSlashIndex + 1) : '';
  return `${prefix}${cleanName}`;
}

export async function POST(request: NextRequest) {
  try {
    const { volume, key, newName } = await request.json();

    if (!volume || !key || typeof newName !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Volume, key, and new file name are required.' },
        { status: 400 }
      );
    }

    const sourceKey = String(key).replace(/^\/+/, '');
    let destinationKey: string;

    try {
      destinationKey = buildDestinationKey(sourceKey, newName);
    } catch (validationError) {
      return NextResponse.json(
        { success: false, error: validationError instanceof Error ? validationError.message : 'Invalid file name.' },
        { status: 400 }
      );
    }

    if (sourceKey === destinationKey) {
      return NextResponse.json(
        { success: false, error: 'Choose a different file name.' },
        { status: 400 }
      );
    }

    const settingsService = new SettingsService();
    const { settings } = await settingsService.getSettings('user-with-settings');

    if (!settings.s3?.endpointUrl || !settings.s3?.accessKeyId || !settings.s3?.secretAccessKey) {
      return NextResponse.json(
        { success: false, error: 'S3 settings are not configured.' },
        { status: 400 }
      );
    }

    const s3Service = new S3Service({
      endpointUrl: settings.s3.endpointUrl,
      accessKeyId: settings.s3.accessKeyId,
      secretAccessKey: settings.s3.secretAccessKey,
      bucketName: String(volume),
      region: settings.s3.region || 'us-east-1',
      useGlobalNetworking: settings.s3.useGlobalNetworking ?? false,
    });

    const result = await s3Service.renameObject(sourceKey, destinationKey);

    return NextResponse.json({
      success: true,
      sourceKey: result.sourceKey,
      destinationKey: result.destinationKey,
      message: 'File renamed successfully.',
    });
  } catch (error) {
    console.error('Failed to rename file:', error);
    const message = error instanceof Error ? error.message : 'Failed to rename file.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
