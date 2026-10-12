import { NextResponse } from 'next/server';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { startLoraUpload } from '@/lib/workspaces/loraUpload';
export const POST = withWorkspaceRoute(async request => NextResponse.json({ success: true, ...await startLoraUpload(await request.json()) }));
