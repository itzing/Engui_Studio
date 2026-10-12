import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest, NextResponse } from 'next/server';
import { ffmpegService } from '@/lib/ffmpegService';

async function POSTImpl(request: NextRequest) {
  try {
    const { videoPath } = await request.json();

    if (!videoPath) {
      return NextResponse.json(
        { error: 'Video path is required' },
        { status: 400 }
      );
    }

    // Create muted version of the video
    const mutedVideoPath = await ffmpegService.createMutedVideo(videoPath);

    return NextResponse.json({ mutedVideoPath });
  } catch (error) {
    console.error('Error creating muted video:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create muted video' },
      { status: 500 }
    );
  }
}

export const POST = withWorkspaceRoute(POSTImpl, 'content');
