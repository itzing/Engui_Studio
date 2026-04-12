import { NextRequest, NextResponse } from 'next/server';
import S3Service from '@/lib/s3Service';
import SettingsService from '@/lib/settingsService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const volume = searchParams.get('volume');
    const path = searchParams.get('path') || '';
    const recursive = searchParams.get('recursive') === 'true';

    if (!volume) {
      return NextResponse.json(
        { error: '볼륨이 지정되지 않았습니다.' },
        { status: 400 }
      );
    }

    const settingsService = new SettingsService();
    const { settings } = await settingsService.getSettings('user-with-settings');

    console.log('📋 Loaded settings from database:');
    console.log('  - S3 endpointUrl:', settings.s3?.endpointUrl);
    console.log('  - S3 accessKeyId (length):', settings.s3?.accessKeyId?.length);
    console.log('  - S3 secretAccessKey (length):', settings.s3?.secretAccessKey?.length);
    console.log('  - S3 region:', settings.s3?.region);
    console.log('  - S3 bucketName:', settings.s3?.bucketName);

    if (!settings.s3?.endpointUrl || !settings.s3?.accessKeyId || !settings.s3?.secretAccessKey) {
      console.error('❌ Missing S3 credentials:');
      console.error('  - endpointUrl:', settings.s3?.endpointUrl ? 'OK' : 'MISSING');
      console.error('  - accessKeyId:', settings.s3?.accessKeyId ? 'OK' : 'MISSING');
      console.error('  - secretAccessKey:', settings.s3?.secretAccessKey ? 'OK' : 'MISSING');
      return NextResponse.json(
        { error: 'S3 설정이 완료되지 않았습니다.' },
        { status: 400 }
      );
    }

    console.log('✅ All S3 credentials are present, creating S3Service...');

    // RunPod S3 API를 사용하여 파일 목록 가져오기
    const s3Service = new S3Service({
      endpointUrl: settings.s3.endpointUrl,
      accessKeyId: settings.s3.accessKeyId,
      secretAccessKey: settings.s3.secretAccessKey,
      bucketName: volume, // 네트워크 볼륨 ID를 버킷명으로 사용
      region: settings.s3.region || 'us-east-1',
      useGlobalNetworking: settings.s3.useGlobalNetworking ?? false,
    });

    if (recursive) {
      const keys = await s3Service.listAllObjectKeys(path);
      return NextResponse.json({ keys });
    }

    const files = await s3Service.listFiles(path);

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Failed to fetch files:', error);
    
    // 502 Bad Gateway 에러인 경우 특별한 메시지 제공
    if (error instanceof Error && error.message.includes('502')) {
      return NextResponse.json(
        { error: 'RunPod S3 서버가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: '파일 목록을 가져올 수 없습니다.' },
      { status: 500 }
    );
  }
}
