import { registerWorkspaceFile } from '@/lib/workspaces/files';
// 서버 전용 파일 처리 헬퍼 함수들

import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * S3 업로드 및 로컬 백업 저장을 처리하는 함수 (서버용)
 * @param file 업로드할 파일
 * @param fileName 저장할 파일 이름
 * @param uploadFunction S3 업로드 함수 - returns both s3Url and filePath
 * @param localStoragePath 로컬 저장 경로 (선택사항)
 * @returns Promise<{s3Path: string, s3Url?: string, localPath?: string, webPath?: string}>
 */
export const processFileUpload = async (
  file: File,
  fileName: string,
  uploadFunction: (file: File, fileName: string) => Promise<{ s3Url: string; filePath: string }>,
  localStoragePath?: string
): Promise<{s3Path: string, s3Url?: string, localPath?: string, webPath?: string}> => {
  try {
    // S3에 업로드
    console.log(`📤 S3 업로드 시작:`, fileName);
    const uploadResult = await uploadFunction(file, fileName);
    console.log('✅ S3 업로드 완료:', uploadResult);

    const result: {s3Path: string, s3Url?: string, localPath?: string, webPath?: string} = { 
      s3Path: uploadResult.filePath,
      s3Url: uploadResult.s3Url
    };

    // 로컬 백업 저장 (경로가 제공된 경우)
    if (localStoragePath) {
      try {
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const localFullPath = join(localStoragePath, fileName);

        { await registerWorkspaceFile(localFullPath); writeFileSync(localFullPath, fileBuffer); }
        console.log('✅ 로컬 백업 저장 완료:', localFullPath);

        result.localPath = localFullPath;
        result.webPath = `/results/${fileName}`;
      } catch (saveError) {
        console.error('❌ 로컬 백업 저장 실패:', saveError);
        // 실패해도 계속 진행 (optional)
      }
    }

    return result;
  } catch (error) {
    console.error('❌ 파일 업로드 실패:', error);
    throw error;
  }
};