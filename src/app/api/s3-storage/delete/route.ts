import { NextRequest, NextResponse } from 'next/server';
import S3Service from '@/lib/s3Service';
import SettingsService from '@/lib/settingsService';

export async function DELETE(request: NextRequest) {
  try {
    const { volume, key } = await request.json();

    if (!volume || !key) {
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

    const normalizedKey = key.replace(/^\/+/, '');
    const looksLikeDirectory = normalizedKey.endsWith('/');

    let deleted = 0;

    if (looksLikeDirectory) {
      const result = await s3Service.deletePrefix(normalizedKey);
      deleted = result.deleted;
    } else {
      await s3Service.deleteFile(normalizedKey);
      deleted = 1;
    }

    return NextResponse.json({ 
      success: true, 
      deleted,
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
