import { NextRequest } from 'next/server';
import {
  createVideoSegmentTemplate,
  listVideoSegmentTemplates,
} from '@/lib/video-sequences/server';
import {
  handleStudioSessionApiError,
  readStudioSessionJsonBody,
  requireStudioSessionString,
  studioSessionJson,
  studioSessionNoStoreJson,
} from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const workspaceId = requireStudioSessionString(request.nextUrl.searchParams.get('workspaceId'), 'workspaceId');
    const templates = await listVideoSegmentTemplates(workspaceId);
    return studioSessionNoStoreJson({ success: true, templates });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to fetch video segment templates:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');
    const template = await createVideoSegmentTemplate(workspaceId, body ?? {});
    return studioSessionJson({ success: true, template }, { status: 201 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to create video segment template:');
  }
}
