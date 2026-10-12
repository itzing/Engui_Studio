import { NextResponse } from 'next/server';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { syncWorkspaceLoras } from '@/lib/workspaces/loraSync';
export const POST = withWorkspaceRoute(async () => NextResponse.json(await syncWorkspaceLoras()));
