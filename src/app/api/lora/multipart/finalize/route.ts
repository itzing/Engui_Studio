import { NextResponse } from 'next/server';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { finishLoraUpload } from '@/lib/workspaces/loraUpload';
export const POST = withWorkspaceRoute(async request => {
  const lora = await finishLoraUpload(await request.json());
  return NextResponse.json({ success: true, lora: { ...lora, fileSize: lora.fileSize.toString() } });
});
