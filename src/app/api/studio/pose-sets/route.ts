import { NextRequest } from 'next/server';
import { getStudioPoseSets } from '@/lib/studio-sessions/poseSets';
import { handleStudioSessionApiError, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')?.trim();
    if (!workspaceId) return studioSessionNoStoreJson({ success: false, error: 'workspaceId is required' }, { status: 400 });
    return studioSessionNoStoreJson({ success: true, poseSets: await getStudioPoseSets(workspaceId) });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch Studio pose sets:');
  }
}
