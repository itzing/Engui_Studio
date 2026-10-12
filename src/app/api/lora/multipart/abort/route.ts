import { NextResponse } from 'next/server';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { abortLoraUpload } from '@/lib/workspaces/loraUpload';
export const POST = withWorkspaceRoute(async request => NextResponse.json(await abortLoraUpload(await request.json())));
