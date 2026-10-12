import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  handleNotFoundError,
  createSuccessResponse,
  validateRange,
  validateFieldType,
  withErrorHandling,
} from '@/lib/apiErrorHandler';

// Update video track
async function PATCHImpl(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandling(async () => {
    const { id: trackId } = await params;
    const { volume, muted } = await request.json();

    const track = await prisma.videoTrack.findUnique({
      where: { id: trackId }
    });

    if (!track) {
      return handleNotFoundError('Video track', trackId);
    }

    // Validate volume if provided
    if (volume !== undefined) {
      const error = validateRange(volume, 0, 200, 'volume');
      if (error) return error;
    }

    // Validate muted if provided
    if (muted !== undefined) {
      const error = validateFieldType(muted, 'boolean', 'muted');
      if (error) return error;
    }

    const updatedTrack = await prisma.videoTrack.update({
      where: { id: trackId },
      data: {
        ...(volume !== undefined && { volume }),
        ...(muted !== undefined && { muted })
      }
    });

    console.log(`✅ Video track updated: ${updatedTrack.id}`);
    return createSuccessResponse({ track: updatedTrack });
  });
}

// Delete video track
async function DELETEImpl(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandling(async () => {
    const { id: trackId } = await params;

    const track = await prisma.videoTrack.findUnique({
      where: { id: trackId }
    });

    if (!track) {
      return handleNotFoundError('Video track', trackId);
    }

    // Delete track (cascade will handle keyframes)
    await prisma.videoTrack.delete({
      where: { id: trackId }
    });

    console.log(`✅ Video track deleted: ${trackId}`);
    return createSuccessResponse({ success: true });
  });
}

export const PATCH = withWorkspaceRoute(PATCHImpl, 'content');
export const DELETE = withWorkspaceRoute(DELETEImpl, 'content');
