import { NextRequest, NextResponse } from 'next/server';
import S3Service from '@/lib/s3Service';
import SettingsService from '@/lib/settingsService';

export async function DELETE(request: NextRequest) {
  try {
    const { volume, key, keys } = await request.json();

    if (!volume || (!key && !Array.isArray(keys))) {
      return NextResponse.json(
        { error: '볼륨과 파일 키가 필요합니다.' },
        { status: 400 }
      );
    }

    const settingsService = new SettingsService();
    const { settings } = await settingsService.getSettings('user-with-settings');
    
    if (!settings.s3?.endpointUrl || !settings.s3?.accessKeyId || !settings.s3?.secretAccessKey) {
      return NextResponse.json(
        { error: 'S3 설정이 완료되지 않았습니다.' },
        { status: 400 }
      );
    }

    const s3Service = new S3Service({
      endpointUrl: settings.s3.endpointUrl,
      accessKeyId: settings.s3.accessKeyId,
      secretAccessKey: settings.s3.secretAccessKey,
      bucketName: volume,
      region: settings.s3.region || 'us-east-1',
      useGlobalNetworking: settings.s3.useGlobalNetworking ?? false,
    });

    let deleted = 0;
    let deletedKeys: string[] = [];

    if (Array.isArray(keys)) {
      const normalizedKeys = keys.map((entry) => String(entry).replace(/^\/+/, '')).filter(Boolean);
      const result = await s3Service.deleteFiles(normalizedKeys);
      deleted = result.deleted;
      deletedKeys = normalizedKeys;
    } else {
      const normalizedKey = key.replace(/^\/+/, '');
      const looksLikeDirectory = normalizedKey.endsWith('/');

      if (looksLikeDirectory) {
        const allKeys = await s3Service.listAllObjectKeys(normalizedKey);
        const result = await s3Service.deleteFiles(allKeys);
        deleted = result.deleted;
        deletedKeys = allKeys;
      } else {
        await s3Service.deleteFile(normalizedKey);
        deleted = 1;
        deletedKeys = [normalizedKey];
      }
    }

    return NextResponse.json({ 
      success: true, 
      deleted,
      deletedKeys,
      message: '파일이 성공적으로 삭제되었습니다.' 
    });
  } catch (error) {
    console.error('Failed to delete file:', error);
    return NextResponse.json(
      { error: '파일 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
