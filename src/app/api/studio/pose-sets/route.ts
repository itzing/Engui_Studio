import { NextRequest } from 'next/server';
import { getStudioPoseSets } from '@/lib/studio-sessions/poseSets';
import { handleStudioSessionApiError, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest) {
  try {
    return studioSessionNoStoreJson({ success: true, poseSets: getStudioPoseSets() });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio pose sets:');
  }
}
