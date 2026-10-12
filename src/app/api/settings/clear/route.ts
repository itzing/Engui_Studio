import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { prisma as workspacePrisma } from '@/lib/prisma';
// src/app/api/settings/clear/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = workspacePrisma;

async function POSTImpl(request: NextRequest) {
  try {
    // In a real app, get userId from authentication
    const userId = 'user123'; // TODO: Replace with actual user authentication
    
    console.log(`🗑️  Clearing all settings for user: ${userId}`);
    
    // Delete all settings for the user
    const deleteResult = await prisma.userSetting.deleteMany({
      where: { userId }
    });
    
    console.log(`✅ Cleared ${deleteResult.count} settings for user ${userId}`);
    
    return NextResponse.json({
      success: true,
      message: `Cleared ${deleteResult.count} settings successfully`,
      clearedCount: deleteResult.count,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error clearing settings:', error);
    return NextResponse.json(
      { 
        success: false,
        error: `Failed to clear settings: ${error}` 
      },
      { status: 500 }
    );
  }
}

export const POST = withWorkspaceRoute(POSTImpl, 'global');
