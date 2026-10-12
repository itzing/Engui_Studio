import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
export const GET = withWorkspaceRoute(async () => {
  const loras = await prisma.loRA.findMany({ where: { lifecycle: 'active' } });
  const files = loras.map(l => ({ key: l.sourceKey, name: l.fileName, size: Number(l.fileSize), lastModified: l.uploadedAt, workspaceId: l.workspaceId, isShared: l.isShared }));
  return NextResponse.json({ success: true, files, highFiles: files.filter(f => /high/i.test(f.name)), lowFiles: files.filter(f => /low/i.test(f.name)) });
});
