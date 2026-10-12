import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { requireWorkspaceId } from '@/lib/workspaces/context';
import { storageTarget } from '@/lib/workspaces/storage';
export const GET = withWorkspaceRoute(async () => {
  const uploads = await prisma.workspaceUpload.findMany({ where: { workspaceId: requireWorkspaceId(), status: { in: ['pending', 'finalizing'] } }, orderBy: { createdAt: 'asc' } });
  if (!uploads.length) return NextResponse.json({ uploads: [] });
  const target = await storageTarget();
  return NextResponse.json({ uploads: uploads.map(row => ({
    uploadId: row.uploadId, key: row.objectKey, status: row.status,
    volume: row.storageTarget === target.fingerprint ? target.bucketName : null,
    fileName: JSON.parse(row.metadataJson).fileName, createdAt: row.createdAt,
  })) });
});
