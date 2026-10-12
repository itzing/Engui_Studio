import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';

async function GETImpl() {
  try {
    const settingsService = new SettingsService();
    const { settings } = await settingsService.getSettings('user-with-settings');
    
    if (!settings.s3?.endpointUrl || !settings.s3?.accessKeyId || !settings.s3?.secretAccessKey) {
      return NextResponse.json(
        { error: 'S3 설정이 완료되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 설정에서 가져온 S3 정보를 기반으로 네트워크 볼륨 구성
    const bucketName = settings.s3.bucketName || 'my-bucket';
    const endpointUrl = settings.s3.endpointUrl;
    const region = settings.s3.region || 'us-east-1';
    
    // 엔드포인트 URL에서 데이터센터 추출
    const datacenterMatch = endpointUrl.match(/s3api-([^-]+-[^-]+-\d+)\.runpod\.io/);
    const datacenter = datacenterMatch ? datacenterMatch[1] : region;
    
    console.log('🔧 S3 Settings for volumes:', {
      bucketName,
      endpointUrl,
      region,
      datacenter
    });
    
    const networkVolumes = [
      {
        name: bucketName, // 설정에서 가져온 실제 네트워크 볼륨 ID
        region: datacenter, // 엔드포인트에서 추출한 데이터센터
        endpoint: endpointUrl, // 설정에서 가져온 엔드포인트
      },
    ];

    return NextResponse.json(networkVolumes);
  } catch (error) {
    console.error('Failed to fetch network volumes:', error);
    return NextResponse.json(
      { error: '네트워크 볼륨 목록을 가져올 수 없습니다.' },
      { status: 500 }
    );
  }
}

export const GET = withWorkspaceRoute(GETImpl, 'global');
