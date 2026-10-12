import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { NextResponse } from 'next/server';

async function GETImpl() {
    return NextResponse.json({
        success: false,
        error: 'workspace-media is deprecated'
    }, { status: 410 });
}

async function POSTImpl() {
    return NextResponse.json({
        success: false,
        error: 'workspace-media is deprecated'
    }, { status: 410 });
}

export const GET = withWorkspaceRoute(GETImpl, 'content');
export const POST = withWorkspaceRoute(POSTImpl, 'content');
