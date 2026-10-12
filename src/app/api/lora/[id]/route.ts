import { NextResponse } from 'next/server';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { deleteLora, updateLora } from '@/lib/workspaces/loraAccess';
type Context = { params: Promise<{ id: string }> };
export const PATCH = withWorkspaceRoute(async (request, context: Context) => {
  const row = await updateLora((await context.params).id, await request.json());
  return NextResponse.json({ success: true, lora: { ...row, fileSize: row.fileSize.toString() } });
});
export const DELETE = withWorkspaceRoute(async (_request, context: Context) => NextResponse.json(await deleteLora((await context.params).id)));
