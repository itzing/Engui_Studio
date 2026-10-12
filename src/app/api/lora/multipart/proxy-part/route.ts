import { NextResponse } from 'next/server';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { putLoraPart } from '@/lib/workspaces/loraUpload';
export const PUT = withWorkspaceRoute(async request => {
  const p = request.nextUrl.searchParams;
  const result = await putLoraPart({ uploadId: p.get('uploadId') || '', key: p.get('key') || '', volume: p.get('volume') || '', partNumber: Number(p.get('partNumber')), body: Buffer.from(await request.arrayBuffer()) });
  return NextResponse.json({ success: true, ...result });
});
