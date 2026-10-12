import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { WorkspaceError } from '@/lib/workspaces/context';
export const POST = withWorkspaceRoute(async () => {
  const workspace = await prisma.workspace.findFirst({ where: { userId: 'user-with-settings', isProtected: true } });
  if (!workspace) throw new WorkspaceError('The original Default workspace requires the reviewed migration.', 409);
  return NextResponse.json({ workspace, isNew: false });
}, 'global');
