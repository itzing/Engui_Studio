import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { maybeGenerateJobThumbnail } from '@/lib/jobPreviewDerivatives';
import { resolveJobWorkspaceId } from '@/lib/defaultWorkspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function maybePopulateJobThumbnail(job: any) {
  const thumbnailUrl = await maybeGenerateJobThumbnail({
    id: job.id,
    modelId: job.modelId,
    type: job.type,
    resultUrl: job.resultUrl,
    thumbnailUrl: job.thumbnailUrl,
  });

  if (!thumbnailUrl || thumbnailUrl === job.thumbnailUrl) {
    return job;
  }

  return prisma.job.update({
    where: { id: job.id },
    data: { thumbnailUrl },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      userId = 'user-with-settings',
      workspaceId,
      type,
      status = 'queued',
      prompt,
      resultUrl,
      thumbnailUrl,
      options,
      modelId,
      endpointId,
      error,
      cost,
      createdAt,
      executionMs
    } = body;

    const resolvedWorkspaceId = await resolveJobWorkspaceId(userId, workspaceId);

    if (!type) {
      return NextResponse.json(
        { error: 'Missing required fields: type' },
        { status: 400 }
      );
    }

    const upsertedJob = await prisma.job.upsert({
      where: { id: id || 'new-job-' + Date.now() },
      update: {
        status,
        resultUrl,
        thumbnailUrl: thumbnailUrl || null,
        error,
        cost,
        completedAt: status === 'completed' ? new Date() : null,
        executionMs: typeof executionMs === 'number' ? executionMs : null
      },
      create: {
        id: id || undefined,
        userId,
        workspaceId: resolvedWorkspaceId,
        type,
        status,
        prompt: prompt || null,
        resultUrl,
        thumbnailUrl: thumbnailUrl || null,
        options: options ? JSON.stringify(options) : null,
        modelId: modelId || 'unknown',
        endpointId,
        error,
        cost,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        completedAt: status === 'completed' ? new Date() : null,
        executionMs: typeof executionMs === 'number' ? executionMs : null
      }
    });

    const job = await maybePopulateJobThumbnail(upsertedJob);

    return NextResponse.json({ success: true, job }, { status: 201 });
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const userId = searchParams.get('userId') || 'user-with-settings';
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const onlyProcessing = searchParams.get('onlyProcessing') === 'true';
    const workspaceId = searchParams.get('workspaceId');
    const type = (searchParams.get('type') || '').toLowerCase();
    const focusJobId = searchParams.get('focusJobId')?.trim() || null;

    if (jobId) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, job });
    }

    const whereCondition: any = { userId };
    if (onlyProcessing) {
      whereCondition.status = 'processing';
    }

    if (workspaceId) {
      if (workspaceId === 'unassigned') {
        whereCondition.workspaceId = null;
      } else {
        whereCondition.workspaceId = workspaceId;
      }
    }

    if (type) {
      const types = Array.from(new Set(type.split(',').map((entry) => entry.trim()).filter(Boolean)));
      if (types.length === 1 && types[0] === 'audio') {
        whereCondition.type = { in: ['audio', 'tts', 'music'] };
      } else if (types.length > 0) {
        const expandedTypes = types.flatMap((entry) => entry === 'audio' ? ['audio', 'tts', 'music'] : entry);
        whereCondition.type = { in: Array.from(new Set(expandedTypes.filter((entry) => entry === 'image' || entry === 'video' || entry === 'audio' || entry === 'tts' || entry === 'music'))) };
      }
    }

    const jobs = await prisma.job.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      }
    });

    const hydratedJobs = await Promise.all(jobs.map(async (job) => {
      if (job.status !== 'completed' || !job.resultUrl || job.thumbnailUrl) {
        return job;
      }

      return maybePopulateJobThumbnail(job);
    }));

    let formattedJobs = hydratedJobs.map(job => ({
      id: job.id,
      modelId: job.modelId,
      type: job.type,
      status: job.status,
      prompt: job.prompt || '',
      createdAt: job.createdAt.getTime(),
      executionMs: (job as any).executionMs ?? undefined,
      options: job.options,
      secureState: (job as any).secureState ?? null,
      resultUrl: job.resultUrl,
      error: job.error,
      endpointId: job.endpointId,
      thumbnailUrl: job.thumbnailUrl,
      workspaceId: job.workspaceId,
      workspace: job.workspace,
      cost: job.cost
    }));

    const totalCount = formattedJobs.length;
    const focusAbsoluteIndex = focusJobId ? formattedJobs.findIndex((job) => job.id === focusJobId) : -1;
    const resolvedPage = focusAbsoluteIndex >= 0 ? Math.floor(focusAbsoluteIndex / limit) + 1 : page;
    const resolvedSkip = (resolvedPage - 1) * limit;
    formattedJobs = formattedJobs.slice(resolvedSkip, resolvedSkip + limit);
    const hasNextPage = totalCount > resolvedPage * limit;

    return NextResponse.json({
      success: true,
      jobs: formattedJobs,
      focus: focusJobId ? {
        jobId: focusJobId,
        found: focusAbsoluteIndex >= 0,
        page: focusAbsoluteIndex >= 0 ? resolvedPage : null,
        indexOnPage: focusAbsoluteIndex >= 0 ? focusAbsoluteIndex % limit : null,
        absoluteIndex: focusAbsoluteIndex >= 0 ? focusAbsoluteIndex : null,
      } : undefined,
      pagination: {
        page: resolvedPage,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage,
        hasPrevPage: resolvedPage > 1,
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
